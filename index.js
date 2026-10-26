import { createController } from './controller.js';
import { createHttpHandler } from './http.js';
import { adapterTransport, queryQuota } from './quota.js';
import { dirname } from 'node:path';

export const name = 'codex-manager';
export const inject = ['llm', 'configEditor', 'connection', 'webServer', 'tools'];
export const parameters = {
  type: 'object', additionalProperties: false, required: ['action'],
  properties: {
    action: { type: 'string', enum: ['status', 'models', 'saveSettings', 'test', 'quota'], description: 'status 读取本地连接与配置；models 读取模型目录；quota 手动查询账号额度百分比与重置时间，不是剩余 Token 数；saveSettings 保存代理/版本/超时；test 发送固定文本测试并消耗账号配额，不发送会话历史。' },
    expectedRevision: { type: 'string', description: 'saveSettings 必填：开始编辑时 status 返回的 revision。' },
    settings: { type: 'object', additionalProperties: false, required: ['proxy', 'clientVersion', 'streamIdleTimeoutMs'], properties: {
      proxy: { type: 'string', description: '无账号密码的 HTTP(S) 代理地址；空字符串沿用适配器的环境代理。' },
      clientVersion: { type: 'string', description: 'Codex 协议客户端版本，例如 0.160.1。' },
      streamIdleTimeoutMs: { type: 'integer', minimum: 5000, maximum: 600000, description: '现有适配器的流空闲超时，毫秒。' },
    } },
    model: { type: 'string', description: 'test 必填：模型目录中的准确模型 ID。' },
  },
};
/** Adds management only: never registers an LLM adapter or changes model selection. */
export function apply(ctx) {
  const controller = createController({
    llm: ctx.llm, configEditor: ctx.configEditor,
    quotaQuery: (raw, signal, dependencies) => queryQuota(raw, signal, {
      ...dependencies,
      transport: config => adapterTransport(config, dirname(ctx.configEditor.documentPath)),
    }),
  });
  ctx.effect(() => () => controller.close());
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/codex-manager/api', handler: createHttpHandler(ctx.connection, controller.dispatch) }));
  ctx.effect(() => ctx.tools.register({
    name: 'codex_manager',
    description: '管理现有 Codex 连接、模型目录和代理设置，返回脱敏状态。不会登录/退出、切换账户、修改默认模型或注册新模型路由。',
    parameters,
    output: {
      schema: { type: 'object', additionalProperties: true, required: ['ok'], properties: { ok: { type: 'boolean' } } },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: (request, exec) => controller.dispatch(request, exec.signal),
  }));
}
