import { ACTIONS, createController, createHttpHandler, receiptSchema, visibilitySchema } from './controller.js';

export const name = 'session-manager';
export const inject = ['storageDomain', 'tools', 'connection', 'webServer', 'sessionController', 'sessionPersistence', 'sessions', 'workspaceRegistry', 'workspaceController', 'agents', 'agentPresets'];
export const API_PATH = '/session-manager/api';
export const parameters = {
  type: 'object', additionalProperties: false, required: ['action'],
  properties: {
    action: { type: 'string', enum: ACTIONS, description: 'list 列出；create 新建；move 目标新 ID 承接完整历史后归档源；delete 可恢复归档；batchDelete 批量可恢复归档；restore 恢复；setWorkspaceVisibility 设置本插件列表的工作区隐藏状态。运行、后台任务、排队输入或未闭合历史拒绝移动和删除。' },
    workspaceId: { type: 'string', description: 'create/move/setWorkspaceVisibility 必填：list 返回的工作区 id；list 可用来筛选。' },
    sessionId: { type: 'string', description: 'move/delete/restore 必填：list 返回的会话 id。' },
    expectedToken: { type: 'string', description: 'move/delete/restore 必填：确认操作时冻结的 list 条目 token；CONFLICT 后重新读取并核对，不自动替换旧凭证。' },
    items: { type: 'array', minItems: 1, maxItems: 50, description: '仅 batchDelete 必填：明确选择的 1–50 个唯一会话及其确认时冻结的 token；不自动选择其他页或按标题删除。', items: { type: 'object', additionalProperties: false, required: ['sessionId','expectedToken'], properties: { sessionId: { type:'string' }, expectedToken: { type:'string' } } } },
    requestId: { type: 'string', description: '写操作必填：新建唯一 16–128 字符 ID；WRITE_UNCERTAIN、PENDING、RECOVERY_REQUIRED 时仅以原 ID 和完全相同参数重试。凭证永久保留；会话操作与显示设置各最多 4096 条，满后拒绝对应新写入。' },
    query: { type: 'string', description: '仅 list：按标题、会话 ID、工作目录搜索，最多 500 字符。' },
    archived: { type: 'boolean', description: '仅 list：false（默认）列出未归档，true 列出可恢复归档。' },
    includeHidden: { type: 'boolean', description: '仅 list：true 包含隐藏工作区中的会话；默认 false，显式 workspaceId 不绕过隐藏。workspaces 始终返回全部及 hidden 标记。' },
    hidden: { type: 'boolean', description: '仅 setWorkspaceVisibility 必填：true 隐藏、false 显示，仅影响会话管理页。' },
    expectedVisibilityRevision: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: '仅 setWorkspaceVisibility 必填：读取 list 返回的 visibilityRevision；CONFLICT 后刷新核对。' },
    offset: { type: 'integer', minimum: 0, maximum: 1000000, description: '仅 list：零起始分页偏移，默认 0。' },
    limit: { type: 'integer', minimum: 1, maximum: 200, description: '仅 list：每页数量，默认 50。' },
  },
};

/** Some strict-schema model adapters materialize unused optional fields.
 * Drop only their neutral sentinels; never discard meaningful input. */
export function normalizeToolRequest(request) {
  if (!request || typeof request !== 'object') return request;
  const next = { ...request };
  const defaults = request.action === 'list'
    ? { sessionId: '', expectedToken: '', requestId: '', workspaceId: '', hidden: false, expectedVisibilityRevision: 0 }
    : { query: '', archived: false, includeHidden: false, offset: 0, limit: 50, ...(['delete', 'restore', 'batchDelete'].includes(request.action) ? { workspaceId: '' } : {}), ...(['create', 'setWorkspaceVisibility', 'batchDelete'].includes(request.action) ? { sessionId: '', expectedToken: '' } : {}), ...(request.action === 'setWorkspaceVisibility' ? {} : { hidden: false, expectedVisibilityRevision: 0 }) };
  for (const [key, value] of Object.entries(defaults)) if (next[key] === value) delete next[key];
  if (request.action !== 'batchDelete' && Array.isArray(next.items) && (next.items.length === 0 || next.items.length === 1 && next.items[0] && Object.keys(next.items[0]).every(key => ['sessionId','expectedToken'].includes(key)) && next.items[0].sessionId === '' && next.items[0].expectedToken === '')) delete next.items;
  return next;
}

export async function apply(ctx) {
  const { z } = await import('zod');
  const domain = await ctx.storageDomain.open({
    name: 'session_manager', version: 1, layout: 'per-record',
    tables: { receipts: { valueSchema: receiptSchema(z) } },
  });
  let visibilityDomain;
  try {
    visibilityDomain = await ctx.storageDomain.open({
      name: 'session_manager_visibility', version: 1, layout: 'single', tables: {},
      global: { schema: visibilitySchema(z), initial: { revision: 0, hiddenWorkspaceIds: [], receipts: [] } },
    });
  } catch (error) { await domain.close(); throw error; }
  const controller = createController(ctx, domain.table('receipts'), { visibility: visibilityDomain.global });
  ctx.effect(() => async () => {
    await controller.close();
    try { await visibilityDomain.close(); } finally { await domain.close(); }
  });
  ctx.provide('sessionManager', { dispatch: controller.dispatch });
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: API_PATH, handler: createHttpHandler(ctx.connection, controller.dispatch) }));
  ctx.effect(() => ctx.tools.register({
    name: 'session_manager',
    description: '管理与会话管理页共享的会话及工作区显示设置。移动完整历史至新 ID 并归档源；删除仅可恢复归档。隐藏工作区仅影响本插件列表，不影响原生侧栏、会话归档、模型或任务运行。返回分页列表（empty 为保守内容判定）、状态凭证及显示版本。batchDelete 逐项安全检查并返回成功/失败清单，全部结算时 ok:true；结果待确认须原批量请求重试。可保留目标、提醒、团队和子智能体历史；迁移不接管旧团队/子智能体或提醒，目标需明确恢复才继续。实际活动及排队输入仍拒绝迁移。',
    parameters,
    output: {
      schema: { type: 'object', required: ['ok'], additionalProperties: true, properties: { ok: { type: 'boolean' }, code: { type: 'string' }, error: { type: 'string' }, sessionId: { type: 'string' }, sourceSessionId: { type: 'string' }, message: { type: 'string' }, visibilityRevision: { type: 'integer' }, succeeded: { type: 'integer' }, failed: { type: 'integer' }, results: { type: 'array', items: { type:'object', additionalProperties:true } }, total: { type: 'integer' }, offset: { type: 'integer' }, limit: { type: 'integer' }, items: { type: 'array', items: { type: 'object', additionalProperties: true } }, workspaces: { type: 'array', items: { type: 'object', additionalProperties: true } } } },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: (request, exec) => controller.dispatch(normalizeToolRequest(request), { signal: exec.signal }),
    isConcurrencySafe: request => request?.action === 'list',
  }));
}
export { createHttpHandler } from './controller.js';
