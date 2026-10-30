import { createHash } from 'node:crypto';
import { DEFAULTS, normalizeConfig } from './policy.js';

export const API_PATH = '/api/agent-orchestrator';
export const PLANS_PATH = `${API_PATH}/plans`;
export const SETTINGS_KEYS = Object.freeze(Object.keys(DEFAULTS));
const PACKAGE = '@local/dsh-agent-orchestrator';
export const SETTINGS_WARNINGS = Object.freeze([
  '关闭停止本插件的新派工并撤销辅助提示与守卫，不自动取消已运行的任务；其他用户级、项目级指令可能独立影响行为。',
  '并行设置限制本插件的同时执行数，不代表宿主可用槽位；此页面不修改账号、模型、权限、审批或委派深度。',
  '保存影响后续提示和工具调用，不能撤回已发出的模型请求、正在执行的操作或已启动的子任务。',
]);
const MESSAGES = Object.freeze({
  INVALID_REQUEST: '请求参数无效，请保留草稿并重新核对。',
  INVALID_SETTINGS: '配置无效：请核对开关、模式、1–16 的整数并行偏好和精确工具名。',
  CONFLICT: '配置已被其他页面修改；未覆盖新值，请保留草稿，重新读取后人工核对。',
  ENTRY_AMBIGUOUS: '无法唯一定位当前主控调度插件配置，请检查插件安装状态。',
  EXPRESSION_CONFIG: '当前配置包含动态表达式，本页面不会覆盖；请使用宿主原生配置入口。',
  UNAVAILABLE: '当前环境不支持持久配置编辑，请检查插件和宿主配置服务。',
  BUSY: '已有保存操作进行中，请保留草稿后重试。',
  CLOSED: '主控调度设置服务已停止，请重新读取状态。',
  FAILED: '操作失败；未输出原始异常，请保留草稿并重新读取状态。',
});
class SettingsError extends Error {
  constructor(code) { super(MESSAGES[code] ?? MESSAGES.FAILED); this.code = code; }
}
const fail = code => { throw new SettingsError(code); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function hasExpression(value) {
  if (value === null || typeof value !== 'object') return false;
  return Object.hasOwn(value, '__jsExpr') || Object.values(value).some(hasExpression);
}
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (!record(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
}
/** Opaque fingerprint of this plugin's raw config only, never another profile row. */
export function revisionOf(raw) {
  return createHash('sha256').update(JSON.stringify(ordered(raw))).digest('hex');
}
export function validateSettings(value) {
  if (!record(value) || Object.keys(value).length !== SETTINGS_KEYS.length
    || SETTINGS_KEYS.some(key => !Object.hasOwn(value, key))
    || Object.keys(value).some(key => !SETTINGS_KEYS.includes(key))
    || typeof value.enabled !== 'boolean' || typeof value.independentReview !== 'boolean'
    || !Number.isInteger(value.preferredParallelism) || typeof value.mode !== 'string'
    || typeof value.additionalAllowedTools !== 'string' || value.additionalAllowedTools.length > 4096) {
    fail('INVALID_SETTINGS');
  }
  try { return normalizeConfig(value); }
  catch { fail('INVALID_SETTINGS'); }
}
function safeFailure(error) {
  const code = error instanceof SettingsError ? error.code : 'FAILED';
  return { ok: false, code, error: MESSAGES[code] ?? MESSAGES.FAILED };
}
/** Only ConfigEditor owns persistence, locking, validation and Loader reconciliation. */
export function createController({ configEditor, readConfig, validateConfig, ownerFiber, onSaved } = {}) {
  let closed = false;
  let saving = false;
  const pending = new Set();

  function entry() {
    if (!configEditor || typeof configEditor.entries !== 'function' || typeof configEditor.edit !== 'function') fail('UNAVAILABLE');
    const entries = configEditor.entries().filter(item => item.options?.name === PACKAGE
      && (ownerFiber === undefined || item.fiber === ownerFiber));
    // A legacy/custom entry id is allowed when package identity is unambiguous.
    if (entries.length !== 1) fail('ENTRY_AMBIGUOUS');
    return entries[0];
  }
  function rawOf(item) {
    const raw = structuredClone(item.options.config ?? {});
    if (!record(raw)) fail('INVALID_SETTINGS');
    if (hasExpression(raw)) fail('EXPRESSION_CONFIG');
    return raw;
  }
  function snapshot(item = entry()) {
    const raw = rawOf(item);
    let settings;
    try { settings = normalizeConfig(typeof readConfig === 'function' ? readConfig() : raw); }
    catch { fail('INVALID_SETTINGS'); }
    return { ok: true, revision: revisionOf(raw), settings, warnings: [...SETTINGS_WARNINGS] };
  }
  async function operate(request) {
    if (closed) fail('CLOSED');
    if (!record(request)) fail('INVALID_REQUEST');
    if (request.action === 'read') {
      if (Object.keys(request).some(key => key !== 'action')) fail('INVALID_REQUEST');
      return snapshot();
    }
    if (request.action !== 'save' || Object.keys(request).some(key => !['action', 'expectedRevision', 'settings'].includes(key))
      || typeof request.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(request.expectedRevision)) fail('INVALID_REQUEST');
    const next = validateSettings(request.settings);
    try { if (typeof validateConfig === 'function') validateConfig(next); }
    catch { fail('INVALID_SETTINGS'); }
    if (saving) fail('BUSY');
    saving = true;
    try {
      const item = entry();
      await configEditor.edit(item, current => {
        if (closed) fail('CLOSED');
        if (!record(current)) fail('INVALID_SETTINGS');
        if (hasExpression(current)) fail('EXPRESSION_CONFIG');
        // This callback runs under ConfigEditor's file lock, after external reload.
        if (revisionOf(current) !== request.expectedRevision) fail('CONFLICT');
        return { ...current, ...next }; // preserve unknown/ordinary fields of this row
      });
      // Settings have already committed; wake failures must not misreport the
      // persisted save as failed or make the browser retry an accepted write.
      try { await onSaved?.(); } catch { /* Scheduler reports its own safe status. */ }
      return snapshot();
    } finally { saving = false; }
  }
  function dispatch(request) {
    const work = operate(request).catch(safeFailure);
    pending.add(work);
    void work.finally(() => pending.delete(work));
    return work;
  }
  return {
    dispatch,
    async close() { closed = true; await Promise.allSettled([...pending]); },
  };
}
function respond(res, status, value, extra = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra,
  });
  res.end(JSON.stringify(value));
}
const STATUS = Object.freeze({
  CONFLICT: 409, BUSY: 409, INVALID_REQUEST: 400, INVALID_SETTINGS: 400,
  ENTRY_AMBIGUOUS: 503, EXPRESSION_CONFIG: 503, UNAVAILABLE: 503, CLOSED: 503,
});
/** Authentication precedes method checks, body reading, state disclosure and writes. */
const PLAN_WARNINGS = Object.freeze([
  '任务板显示本 profile 的任务标题与执行结果摘要，其中可能含用户内容；完整提示、工作目录、父会话授权不通过网页返回。',
  '网页只读，提交、暂停、恢复、取消与重试须回到原对话使用 orchestrator_plan。',
  '重启后中断任务不会自动重放，须由原会话明确重新绑定并恢复。',
]);
const textField = (value, limit = 200) => typeof value === 'string' ? value.slice(0, limit) : '';
const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const PUBLIC_SCHEDULER_ERRORS = Object.freeze({
  TEARDOWN_UNCONFIRMED: '执行清理未获确认；已停止新派工并保留资源预留，请先人工确认旧执行退出。',
  STORE_FAILED: '任务状态持久化失败；已停止新派工，请核对存储状态。',
  STORE_WRITE_FAILED: '任务状态写入未确认；已停止新派工，请核对存储状态。',
  CONFIG_INVALID: '调度配置无效，请核对设置。',
  CLOSED: '调度服务已停止。',
});
function publicPlan(plan, detailed = false) {
  const states = ['pending', 'ready', 'starting', 'running', 'succeeded', 'failed', 'blocked', 'cancelled', 'interrupted'];
  const result = {
    id: textField(plan?.id, 128), title: textField(plan?.title, 8192), status: textField(plan?.status, 40),
    revision: safeCount(plan?.revision), maxConcurrency: safeCount(plan?.maxConcurrency),
    cancelRequested: plan?.cancelRequested === true, needsReconcile: plan?.needsReconcile === true,
    cleanupUncertain: plan?.cleanupUncertain === true,
    counts: Object.fromEntries(states.map(state => [state, safeCount(plan?.counts?.[state])])),
    concurrency: {
      starting: safeCount(plan?.concurrency?.starting), running: safeCount(plan?.concurrency?.running),
      limit: safeCount(plan?.concurrency?.limit ?? plan?.maxConcurrency), runtimeCapacity: null,
    },
  };
  for (const key of ['createdAt', 'updatedAt']) {
    const value = plan?.[key];
    if (typeof value === 'string') result[key] = value.slice(0, 40);
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  }
  if (plan?.pauseReason) result.pauseReason = textField(plan.pauseReason, 200);
  if (detailed && record(plan?.schedulerError)) {
    const code = typeof plan.schedulerError.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(plan.schedulerError.code)
      ? plan.schedulerError.code : 'SCHEDULER_FAILURE';
    result.schedulerError = { code, message: PUBLIC_SCHEDULER_ERRORS[code] ?? '任务调度发生故障，请回到原对话核对状态。' };
  }
  if (detailed) result.tasks = (Array.isArray(plan?.tasks) ? plan.tasks : []).slice(0, 32).map(task => {
    const value = {
      id: textField(task?.id, 128), title: textField(task?.title, 8192), state: textField(task?.state, 40),
      dependsOn: (Array.isArray(task?.dependsOn) ? task.dependsOn : []).slice(0, 32).map(id => textField(id, 128)),
      writeResources: (Array.isArray(task?.writeResources) ? task.writeResources : []).slice(0, 32).map(resource => textField(resource, 512)),
      attempt: safeCount(task?.attempt), provider: textField(task?.provider, 128),
    };
    if (task?.childId) value.childId = textField(task.childId, 128);
    for (const key of ['startedAt', 'finishedAt']) {
      if (typeof task?.[key] === 'number' && Number.isFinite(task[key])) value[key] = task[key];
    }
    if (record(task?.result)) value.result = {
      summary: textField(task.result.summary, 8192),
      truncated: task.result.truncated === true || (typeof task.result.summary === 'string' && task.result.summary.length > 8192),
      stopReason: textField(task.result.stopReason, 128), verified: false,
    };
    if (record(task?.failure)) value.failure = {
      code: textField(task.failure.code, 128), message: textField(task.failure.message, 1000),
    };
    if (task?.blockedReason) value.blockedReason = textField(task.blockedReason, 200);
    return value;
  });
  return result;
}
/** Read-only board projection; it never binds a parent or starts scheduler work. */
export function createPlansHttpHandler(connection, getScheduler, readConfig = () => ({})) {
  return async (req, res) => {
    try {
      const rejection = connection.requestRejection(req);
      if (rejection) return respond(res, rejection, { ok: false, code: 'UNAUTHORIZED', error: '连接未获授权。' });
      if (req.method !== 'GET') return respond(res, 405, { ok: false, code: 'METHOD', error: '任务板仅支持 GET。' }, { Allow: 'GET' });
      const path = new URL(req.url ?? PLANS_PATH, 'http://local').pathname;
      const suffix = path === PLANS_PATH ? '' : path.startsWith(`${PLANS_PATH}/`) ? path.slice(PLANS_PATH.length + 1) : null;
      if (suffix === null || (suffix !== '' && !/^[a-zA-Z0-9_-]{1,128}$/.test(suffix))) {
        return respond(res, 404, { ok: false, code: 'NOT_FOUND', error: '任务图不存在。' });
      }
      const scheduler = await getScheduler();
      if (!scheduler) return respond(res, 503, { ok: false, code: 'SCHEDULER_UNAVAILABLE', error: '当前调度服务不可用。' });
      if (suffix) {
        const plan = await scheduler.get({ jobId: suffix });
        if (!plan) return respond(res, 404, { ok: false, code: 'NOT_FOUND', error: '任务图不存在。' });
        return respond(res, 200, { ok: true, plan: publicPlan(plan, true), permissions: { control: false }, warnings: [...PLAN_WARNINGS] });
      }
      const config = normalizeConfig(readConfig());
      const plans = await scheduler.list({});
      return respond(res, 200, {
        ok: true, plans: (Array.isArray(plans) ? plans : []).slice(0, 20).map(plan => publicPlan(plan)),
        warnings: [...PLAN_WARNINGS],
        scheduler: { available: true, enabled: config.enabled, limit: config.preferredParallelism, runtimeCapacity: null },
      });
    } catch (error) {
      if (!res.headersSent && !res.destroyed) respond(res, error?.code === 'NOT_FOUND' ? 404 : 503, {
        ok: false, code: error?.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'SCHEDULER_UNAVAILABLE', error: '当前任务板不可用，请回到原对话核对。',
      });
    }
  };
}
export function createHttpHandler(connection, dispatch) {
  return async (req, res) => {
    try {
      const rejection = connection.requestRejection(req);
      if (rejection) return respond(res, rejection, { ok: false, code: 'UNAUTHORIZED', error: '连接未获授权。' });
      if (!['GET', 'PUT'].includes(req.method)) {
        return respond(res, 405, { ok: false, code: 'METHOD', error: '仅支持 GET 和 PUT。' }, { Allow: 'GET, PUT' });
      }
      let request = { action: 'read' };
      if (req.method === 'PUT') {
        if ((req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') {
          return respond(res, 415, { ok: false, code: 'CONTENT_TYPE', error: '需要 JSON 请求。' });
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += part.length;
          if (size > 8192) return respond(res, 413, { ok: false, code: 'TOO_LARGE', error: '请求不能超过 8 KiB。' });
          chunks.push(part);
        }
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { return respond(res, 400, { ok: false, code: 'INVALID_JSON', error: 'JSON 格式无效。' }); }
        if (!record(body) || Object.keys(body).some(key => !['expectedRevision', 'settings'].includes(key))) {
          return respond(res, 400, { ok: false, code: 'INVALID_REQUEST', error: MESSAGES.INVALID_REQUEST });
        }
        request = { action: 'save', expectedRevision: body.expectedRevision, settings: body.settings };
      }
      const result = await dispatch(request);
      if (!res.destroyed) respond(res, result.ok ? 200 : STATUS[result.code] ?? 500, result);
    } catch {
      if (!res.headersSent && !res.destroyed) respond(res, 500, { ok: false, code: 'FAILED', error: MESSAGES.FAILED });
    }
  };
}
