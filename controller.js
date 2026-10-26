import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { queryQuota } from './quota.js';

const ENTRY = 'dsh-llm-codex';
const EDITABLE = ['proxy', 'clientVersion', 'streamIdleTimeoutMs'];
const DEFAULTS = { proxy: '', clientVersion: '0.160.1', streamIdleTimeoutMs: 300000 };
const MESSAGES = {
  INVALID_REQUEST: '请求参数无效。', ADAPTER_MISSING: '当前 codex 适配器未启用，请在插件页启用现有 dsh-llm-codex。',
  ENTRY_AMBIGUOUS: '需要且只能有一个现有 Codex 适配器配置。', CONFLICT: '配置已被其他页面修改；草稿未覆盖新值，请重新读取后核对。',
  INVALID_SETTINGS: '代理须为无账号密码的 HTTP(S) 地址；客户端版本和超时须符合范围。',
  EXPRESSION_CONFIG: '配置包含动态表达式，管理中心不会覆盖；请使用原插件配置页。',
  BUSY: '已有管理操作进行中，请稍后再试。', CLOSED: '管理插件已停止。',
  MODEL_REQUIRED: '请先刷新目录，并选择其中的模型。', TIMEOUT: '测试超时，请检查代理与服务状态。',
  AUTH: '凭证未获服务端接受，请在 Codex CLI 中重新登录。', MISSING_CREDENTIAL: '未找到有效凭证，请先在 Codex CLI 登录。',
  RATE_LIMIT: '账号额度或请求频率受限，请稍后重试。', INVALID_REQUEST_PROVIDER: '服务端拒绝测试请求，请核对模型与客户端版本。',
  TRANSPORT: '连接失败，请检查本地代理及网络。', SERVER: '服务端暂时不可用。',
  QUOTA_FORMAT: '额度接口未返回可识别的数据，请稍后手动刷新。',
  QUOTA_UNAVAILABLE: '当前账号暂不支持此额度接口。', QUOTA_TRANSPORT: '无法复用现有适配器网络连接，请检查适配器安装。',
  FAILED: '操作失败；未输出原始异常，避免泄露凭证与本机路径。',
};
class ManagerError extends Error {
  constructor(code) { super(MESSAGES[code] ?? MESSAGES.FAILED); this.code = code; }
}
function fail(code) { throw new ManagerError(code); }
function plain(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function hasExpression(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.hasOwn(value, '__jsExpr') || Object.values(value).some(hasExpression);
}
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!plain(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
}
export function revisionOf(raw) { return createHash('sha256').update(JSON.stringify(sorted(raw))).digest('hex'); }
export function settingsOf(raw) {
  return Object.fromEntries(EDITABLE.map(key => [key, raw[key] ?? DEFAULTS[key]]));
}
export function validateSettings(value) {
  if (!plain(value) || Object.keys(value).length !== EDITABLE.length || EDITABLE.some(k => !Object.hasOwn(value, k))) fail('INVALID_SETTINGS');
  const { proxy, clientVersion, streamIdleTimeoutMs } = value;
  if (typeof proxy !== 'string' || proxy.length > 512 || proxy !== proxy.trim()) fail('INVALID_SETTINGS');
  if (proxy) {
    let url;
    try { url = new URL(proxy); } catch (error) { fail('INVALID_SETTINGS'); }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash || url.pathname !== '/') fail('INVALID_SETTINGS');
  }
  if (typeof clientVersion !== 'string' || !/^\d{1,4}\.\d{1,4}\.\d{1,4}(?:[-.][a-zA-Z0-9.-]{1,40})?$/.test(clientVersion)) fail('INVALID_SETTINGS');
  if (!Number.isInteger(streamIdleTimeoutMs) || streamIdleTimeoutMs < 5000 || streamIdleTimeoutMs > 600000) fail('INVALID_SETTINGS');
  return { proxy, clientVersion, streamIdleTimeoutMs };
}
/** Read only credential presence/mode. No token, account id, path or raw error leaves this method. */
export async function readCredential(raw) {
  if (hasExpression(raw.authFile)) fail('EXPRESSION_CONFIG');
  const file = raw.authFile || join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json');
  let handle;
  try {
    handle = await open(file, 'r');
    const info = await handle.stat();
    if (!info.isFile() || info.size > 262144) fail('MISSING_CREDENTIAL');
    const buffer = Buffer.alloc(262145);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 262144) fail('MISSING_CREDENTIAL');
    try { return JSON.parse(buffer.subarray(0, bytesRead).toString('utf8')); } catch (error) { fail('MISSING_CREDENTIAL'); }
  } catch (error) { fail('MISSING_CREDENTIAL'); }
  finally { if (handle) await handle.close(); }
}
export async function credentialSummary(raw) {
  if (hasExpression(raw.authFile)) return { state: 'unavailable', mode: 'unknown' };
  const file = raw.authFile || join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json');
  let handle;
  try {
    handle = await open(file, 'r');
    const info = await handle.stat();
    if (!info.isFile() || info.size > 262144) return { state: 'invalid', mode: 'unknown' };
    const buffer = Buffer.alloc(262145);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 262144) return { state: 'invalid', mode: 'unknown' };
    let auth;
    try { auth = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8')); }
    catch (error) { return { state: 'invalid', mode: 'unknown' }; }
    const key = typeof auth?.OPENAI_API_KEY === 'string' && auth.OPENAI_API_KEY.trim().length > 0;
    const token = typeof auth?.tokens?.access_token === 'string' && auth.tokens.access_token.length > 0;
    if (auth?.auth_mode === 'apikey' || (!auth?.auth_mode && key && !token)) return { state: key ? 'present' : 'invalid', mode: 'apikey' };
    if (auth?.auth_mode === 'chatgpt' || token) return { state: token ? 'present' : 'invalid', mode: 'chatgpt' };
    return { state: 'invalid', mode: 'unknown' };
  } catch (error) {
    return { state: error?.code === 'ENOENT' ? 'missing' : 'unavailable', mode: 'unknown' };
  } finally { if (handle) await handle.close(); }
}
function safeFailure(error, signal) {
  let code = signal?.aborted ? 'TIMEOUT' : String(error?.code ?? 'FAILED');
  if (code === 'INVALID_REQUEST' && !(error instanceof ManagerError)) code = 'INVALID_REQUEST_PROVIDER';
  if (!Object.hasOwn(MESSAGES, code)) code = 'FAILED';
  return { ok: false, code, error: MESSAGES[code] };
}
function assertRequest(request) {
  if (!plain(request) || !['status', 'models', 'saveSettings', 'test', 'quota'].includes(request.action)) fail('INVALID_REQUEST');
  // Tool schema adapters may materialize every optional property; ignore known
  // fields unused by this action, but never accept unrelated operations/keys.
  const allowed = ['action', 'settings', 'expectedRevision', 'model'];
  if (Object.keys(request).some(k => !allowed.includes(k))) fail('INVALID_REQUEST');
}
/** Owns bounded management work, serializes writes/tests, and cancels work on unload. */
export function createController({ llm, configEditor, summarizeCredential = credentialSummary, quotaQuery = queryQuota }) {
  const lifetime = new AbortController();
  const pending = new Set();
  let busy = false;
  function entry() {
    const entries = configEditor.entries().filter(e => e.options.name === ENTRY);
    if (entries.length !== 1) fail('ENTRY_AMBIGUOUS');
    return entries[0];
  }
  function rawOf(e) { return structuredClone(e.options.config ?? {}); }
  function active() { return llm.listProviders().some(p => p.id === 'codex'); }
  async function state() {
    const raw = rawOf(entry());
    if (hasExpression(raw)) fail('EXPRESSION_CONFIG');
    const settings = settingsOf(raw);
    // Never expose a legacy proxy containing credentials or arbitrary raw settings.
    try { validateSettings(settings); } catch (error) { fail('INVALID_SETTINGS'); }
    return { revision: revisionOf(raw), adapter: { active: active(), provider: 'codex' }, credential: await summarizeCredential(raw), settings, limits: { testTimeoutMs: 45000 }, checkedAt: new Date().toISOString() };
  }
  async function operate(request, callerSignal) {
    assertRequest(request);
    if (lifetime.signal.aborted) fail('CLOSED');
    if (request.action === 'status') return { ok: true, state: await state() };
    if (busy) fail('BUSY');
    busy = true;
    const timer = AbortSignal.timeout(request.action === 'test' ? 45000 : 20000);
    const signals = [lifetime.signal, timer];
    if (callerSignal) signals.push(callerSignal);
    const signal = AbortSignal.any(signals);
    try {
      if (request.action === 'saveSettings') {
        const next = validateSettings(request.settings);
        if (typeof request.expectedRevision !== 'string') fail('INVALID_REQUEST');
        await configEditor.edit(entry(), current => {
          if (hasExpression(current)) fail('EXPRESSION_CONFIG');
          if (revisionOf(current) !== request.expectedRevision) fail('CONFLICT');
          return { ...current, ...next }; // preserve authFile/writeBack/staticModels and unknown owned fields
        });
        return { ok: true, state: await state() };
      }
      if (!active()) fail('ADAPTER_MISSING');
      if (request.action === 'quota') {
        const raw = rawOf(entry());
        if (hasExpression(raw)) fail('EXPRESSION_CONFIG');
        validateSettings(settingsOf(raw));
        const quota = await quotaQuery(raw, signal, { readCredential });
        return { ok: true, quota };
      }
      if (request.action === 'models') {
        // listModels has no signal; bound caller wait and drain in close().
        const catalogWork = llm.listModels('codex');
        pending.add(catalogWork);
        void catalogWork.finally(() => pending.delete(catalogWork)).catch(() => {});
        const list = await abortable(catalogWork, signal);
        const models = [];
        for (const m of list.slice(0, 100)) {
          const info = await llm.resolveModelInfo('codex', m.id, signal);
          models.push({ id: m.id, name: m.name, inputModalities: info.inputModalities ?? [], contextWindow: info.context?.contextWindow ?? null, efforts: (info.reasoning?.efforts ?? []).map(e => e.id), defaultEffort: info.reasoning?.defaultEffort ?? null });
        }
        return { ok: true, models, truncated: list.length > 100, checkedAt: new Date().toISOString() };
      }
      if (typeof request.model !== 'string' || request.model.length < 1 || request.model.length > 160) fail('MODEL_REQUIRED');
      const started = Date.now();
      try {
        const catalogWork = llm.listModels('codex');
        pending.add(catalogWork);
        void catalogWork.finally(() => pending.delete(catalogWork)).catch(() => {});
        const catalog = await abortable(catalogWork, signal);
        if (!catalog.some(m => m.id === request.model)) fail('MODEL_REQUIRED');
        const call = await llm.prepareCall({ provider: 'codex', model: request.model }, signal);
        let finish;
        let usage;
        let text = false;
        for await (const chunk of call.stream({ ...call.config, signal, system: 'Connection check. Reply briefly.', messages: [{ role: 'user', content: [{ type: 'text', text: 'Reply with exactly OK.' }] }] })) {
          if (chunk.type === 'text-delta' && chunk.text.trim()) text = true;
          if (chunk.type === 'usage') usage = chunk.usage;
          if (chunk.type === 'finish') finish = chunk.reason;
        }
        if (finish?.kind !== 'stop' || !text) {
          const failure = finish?.failure ?? { code: 'FAILED' };
          throw Object.assign(new Error('test failed'), { code: failure.code });
        }
        const safeUsage = {};
        for (const k of ['inputTokens', 'outputTokens', 'totalTokens', 'cacheReadTokens', 'reasoningTokens']) if (Number.isFinite(usage?.[k]) && usage[k] >= 0) safeUsage[k] = usage[k];
        return { ok: true, diagnostic: { ok: true, model: request.model, latencyMs: Date.now() - started, finishedAt: new Date().toISOString(), usage: safeUsage } };
      } catch (error) {
        const failure = safeFailure(error, signal);
        return { ok: true, diagnostic: { ok: false, model: request.model, latencyMs: Date.now() - started, finishedAt: new Date().toISOString(), code: failure.code, message: failure.error } };
      }
    } catch (error) { return safeFailure(error, signal); }
    finally { busy = false; }
  }
  function dispatch(request, signal) {
    const work = operate(request, signal).catch(error => safeFailure(error));
    pending.add(work);
    void work.finally(() => pending.delete(work));
    return work;
  }
  return { dispatch, async close() { lifetime.abort(); await Promise.allSettled([...pending]); } };
}
function abortable(work, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new ManagerError('TIMEOUT'));
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort)).catch(() => {});
  });
}
