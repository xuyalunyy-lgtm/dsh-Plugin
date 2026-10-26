/**
 * 把 harness 消息序列化为 OpenAI Responses API 的请求体
 * (ChatGPT 订阅后端与官方 API 共用同一 Responses 协议)。
 *
 * 注意:ChatGPT codex 后端拒绝 input 里的 system 角色消息
 * (`{"detail":"System messages are not allowed"}`),系统提示必须放到
 * 顶层 `instructions` 字段 —— 与 ompcn 的 normalizeSystemPrompts 行为一致。
 *
 * harness 的工具结果消息是 `role: 'tool'` + `toolCallId`(content 为文本块),
 * 不是 `tool-result` 内容块;两种形态都要映射成 `function_call_output`,
 * 否则后续任何带工具调用的历史都会被后端以 "No tool output" 拒绝。
 */

import { createHash } from 'node:crypto';

import { LlmError } from '@deepseek-ai/dsh-llm';

/** 汇合一条消息中的文本块。 */
function flattenText(blocks) {
  return blocks.filter((block) => block.type === 'text').map((block) => block.text).join('');
}

/** Responses API call_id 的协议上限。 */
const MAX_CALL_ID_LENGTH = 64;

/**
 * 将任意 provider 的工具调用 ID 映射为 Responses API 接受的稳定 ID。
 * 64 字符以内且只含协议字符的 ID 原样保留;其余 ID 使用 SHA-256,
 * 保证 function_call 与 function_call_output 对同一历史 ID 得到相同结果。
 */
export function normalizeCallId(value) {
  const id = String(value);
  if (id.length > 0 && id.length <= MAX_CALL_ID_LENGTH && /^[a-zA-Z0-9_-]+$/.test(id)) return id;
  const digestLength = MAX_CALL_ID_LENGTH - 'call_'.length;
  return `call_${createHash('sha256').update(id).digest('hex').slice(0, digestLength)}`;
}

/**
 * 一条消息的文本与图片块 → Responses 的 user/developer 内容块。
 * 图片字节由调用方预先解析成 data URL;缺失即报错,避免静默丢图。
 */
function contentParts(blocks, images) {
  const parts = [];
  for (const block of blocks) {
    if (block?.type === 'text') {
      if (block.text.length > 0) parts.push({ type: 'input_text', text: block.text });
      continue;
    }
    if (block?.type === 'image') {
      const id = String(block.attachment?.attachmentId ?? '');
      const data = images?.get(id);
      if (data === undefined) {
        throw new LlmError('图片附件缺少请求字节:适配器未解析该附件。', 'MISSING_ATTACHMENT');
      }
      parts.push({ type: 'input_image', image_url: data });
    }
  }
  return parts;
}

/** 一条工具结果消息 → function_call_output。 */
function toolOutput(callId, content) {
  return {
    type: 'function_call_output',
    call_id: normalizeCallId(callId),
    output: flattenText(content) || '(no output)',
  };
}

/**
 * 将 harness 消息列表序列化为 Responses API 的 input 项。
 * system 消息不进入 input,而是收集进 `systemParts`(由调用方放到 instructions)。
 */
export function serializeMessages(messages, systemParts, images) {
  const input = [];
  for (const message of messages) {
    const content = Array.isArray(message.content) ? message.content : [];
    if (message.role === 'system') {
      const text = flattenText(content);
      if (text.length > 0) systemParts.push(text);
      continue;
    }
    if (message.role === 'assistant') {
      const text = flattenText(content);
      if (text.length > 0) {
        input.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] });
      }
      for (const block of content) {
        if (block.type !== 'tool-call') continue;
        input.push({
          type: 'function_call',
          call_id: normalizeCallId(block.id),
          name: block.name,
          arguments: block.arguments,
        });
      }
      continue;
    }
    if (message.role === 'tool') {
      input.push(toolOutput(message.toolCallId, content));
      continue;
    }
    // user / developer(或混合角色)消息:文本与图片在前,工具结果展开为 function_call_output
    const parts = contentParts(content, images);
    if (parts.length > 0) {
      // 订阅后端只接受 user 角色输入;developer 角色在部分部署会被拒绝
      input.push({ type: 'message', role: 'user', content: parts });
    }
    for (const block of content) {
      if (block.type !== 'tool-result') continue;
      input.push(toolOutput(block.toolCallId, block.content ?? []));
    }
  }
  return input;
}

const WIRE_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'ultra']);

/** 把 harness 的 reasoningEffort 映射到 Responses 的 reasoning.effort;off/未知 → 不发送(用后端默认)。 */
export function wireEffort(effort) {
  if (effort === undefined || effort === null) return undefined;
  const value = String(effort).toLowerCase();
  if (value === 'off' || value === 'none' || value === 'disabled') return undefined;
  return WIRE_EFFORTS.has(value) ? value : undefined;
}

/**
 * 组装完整的 Responses 请求体。
 * @param options - LLM 服务的生成选项。
 * @param images - 已解析的图片 data URL,键为附件 id;缺省表示本次请求不含图片。
 */
export function serializeRequest(options, images) {
  const systemParts = [];
  if (typeof options.system === 'string' && options.system.length > 0) {
    systemParts.push(options.system);
  }
  const input = serializeMessages(options.messages, systemParts, images);

  const tools = options.tools?.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
  const effort = wireEffort(options.reasoningEffort);

  return {
    model: options.model,
    input,
    stream: true,
    store: false,
    ...(systemParts.length > 0 ? { instructions: systemParts.join('\n\n') } : {}),
    ...(tools !== undefined && tools.length > 0 ? { tools } : {}),
    ...(effort !== undefined ? { reasoning: { effort } } : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxTokens === undefined ? {} : { max_output_tokens: options.maxTokens }),
    ...(options.stop !== undefined && options.stop.length > 0 ? { stop: options.stop } : {}),
  };
}
