import { createHash } from 'node:crypto';

export const ACTIONS = ['list', 'create', 'move', 'delete', 'restore', 'setWorkspaceVisibility', 'batchDelete'];
const MAX_RECEIPTS = 4096;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone = value => structuredClone(value);
class Failure extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; this.extra = extra; }
}
const fail = (code, message, extra) => { throw new Failure(code, message, extra); };
const resultError = error => ({ ok: false, code: error instanceof Failure ? error.code : 'OPERATION_FAILED', error: error instanceof Failure ? error.message : '会话操作失败；请刷新核对状态后重试。', ...(error.extra || {}) });
const clean = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300);
function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !ACTIONS.includes(input.action)) fail('INVALID_REQUEST', '无效的会话管理操作。');
  const allowed = input.action === 'list' ? ['action','query','workspaceId','archived','includeHidden','offset','limit'] : input.action === 'setWorkspaceVisibility' ? ['action','workspaceId','hidden','expectedVisibilityRevision','requestId'] : input.action === 'batchDelete' ? ['action','items','requestId'] : ['action','workspaceId','sessionId','expectedToken','requestId'];
  if (Object.keys(input).some(key => !allowed.includes(key))) fail('INVALID_REQUEST', '请求包含不允许的参数。');
  const request = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
  for (const key of ['sessionId','workspaceId','expectedToken','requestId']) if (request[key] !== undefined && (typeof request[key] !== 'string' || !request[key] || request[key].length > 256 || /[\u0000-\u001f]/.test(request[key]))) fail('INVALID_REQUEST', '会话标识、工作区或请求凭证无效。');
  if (request.action === 'list') {
    if (request.query !== undefined && (typeof request.query !== 'string' || request.query.length > 500)) fail('INVALID_REQUEST', '搜索文本不能超过 500 字符。');
    if (request.archived !== undefined && typeof request.archived !== 'boolean') fail('INVALID_REQUEST', '归档筛选必须为布尔值。');
    if (request.includeHidden !== undefined && typeof request.includeHidden !== 'boolean') fail('INVALID_REQUEST', '隐藏工作区筛选必须为布尔值。');
    for (const [key, defaultValue, max] of [['offset',0,1000000],['limit',50,200]]) {
      request[key] ??= defaultValue;
      if (!Number.isSafeInteger(request[key]) || request[key] < (key === 'limit' ? 1 : 0) || request[key] > max) fail('INVALID_REQUEST', '分页范围无效（每页最多 200 条）。');
    }
    return request;
  }
  if (!request.requestId || request.requestId.length < 16 || request.requestId.length > 128) fail('INVALID_REQUEST', '写操作需要 16–128 字符的唯一 requestId。');
  if (request.action === 'batchDelete') {
    if (!Array.isArray(request.items) || request.items.length < 1 || request.items.length > 50) fail('INVALID_REQUEST', '批量删除需要明确选择 1–50 个会话。');
    const ids = new Set();
    for (const item of request.items) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !['sessionId','expectedToken'].includes(key)) || ['sessionId','expectedToken'].some(key => typeof item[key] !== 'string' || !item[key] || item[key].length > 256 || /[\u0000-\u001f]/.test(item[key]))) fail('INVALID_REQUEST', '批量项目必须包含有效 sessionId 和读取时冻结的 expectedToken。');
      if (ids.has(item.sessionId)) fail('INVALID_REQUEST', '批量删除项目不能重复。');
      ids.add(item.sessionId);
    }
    request.items = request.items.map(({ sessionId, expectedToken }) => ({ sessionId, expectedToken }));
    return request;
  }
  if (request.action === 'setWorkspaceVisibility') {
    if (!request.workspaceId) fail('INVALID_REQUEST', '请选择要隐藏或显示的工作区。');
    if (typeof request.hidden !== 'boolean') fail('INVALID_REQUEST', 'hidden 必须是明确的布尔值。');
    if (!Number.isSafeInteger(request.expectedVisibilityRevision) || request.expectedVisibilityRevision < 0) fail('INVALID_REQUEST', '请先读取工作区显示状态并提交其版本号。');
    return request;
  }
  if (['create','move'].includes(request.action) && !request.workspaceId) fail('INVALID_REQUEST', '请选择目标工作区。');
  if (request.action !== 'create' && (!request.sessionId || !request.expectedToken)) fail('INVALID_REQUEST', '请先读取会话并提交其 expectedToken。');
  if (request.action === 'create' && (request.sessionId || request.expectedToken)) fail('INVALID_REQUEST', '新建会话不接受源会话或状态凭证。');
  if (['delete','restore'].includes(request.action) && request.workspaceId) fail('INVALID_REQUEST', '删除或恢复不接受目标工作区。');
  return request;
}

/** Read public Workspace stream baseline only; never reach into registry storage. */
export async function workspaceBaseline(ctx, signal) {
  const control = new AbortController();
  const abort = () => control.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const iterator = ctx.workspaceController.follow(control.signal)[Symbol.asyncIterator]();
  try {
    const frame = await iterator.next();
    if (frame.done || !['baseline','replace'].includes(frame.value?.type)) fail('STATE_UNAVAILABLE', '暂时无法读取工作区归档状态。');
    return frame.value.value;
  } finally {
    control.abort();
    await iterator.return?.();
    signal?.removeEventListener('abort', abort);
  }
}

function logDigest(inspection) { return hash([inspection.meta, inspection.inheritedEventCount, inspection.events]); }
function tokenForDigest(digest, id, state, workspaceId) {
  return hash([digest, workspaceId ?? null, state.archivedSessionIds.includes(id), state.pinnedSessionIds.includes(id)]);
}
function tokenFor(inspection, state, workspaceId) {
  return tokenForDigest(logDigest(inspection), inspection.meta.id, state, workspaceId);
}
function effectivePreset(inspection) {
  let preset = inspection.meta.agentPreset;
  for (const event of inspection.events) if (event.type === 'agent-preset/selected') preset = event.data.agentPreset;
  return preset ?? undefined;
}
function titleOf(summary, inspection) {
  const value = summary.projections?.values?.sessionTitle ?? summary.projections?.values?.title;
  if (typeof value === 'string' && value) return clean(value);
  if (value?.title) return clean(value.title);
  let title;
  for (const event of inspection.events) if (event.type === 'session/title') title = event.data.title;
  if (title) return clean(title);
  const first = inspection.events.find(event => event.type === 'user/message' && event.data.source?.kind === 'user');
  return clean(first?.data.content?.filter(block => block.type === 'text').map(block => block.text).join(' ')) || '新会话';
}

// Conservative emptiness: only known non-content setup/metadata events can be
// empty. Unknown events, coordination history, prompts and tool output count as
// content even when a title says “新会话”. No deletion is implied by this flag.
const EMPTY_SETUP_EVENTS = new Set(['agent-preset/selected','approval/policy','model/selection','permission/preset','plan/mode','sandbox/mode','session/end-seed','session/title','session/title-llm-request','subagent/model-selection-policy','working-directory/change']);
export function isEmptyHistory(inspection) {
  return inspection.events.every(event => EMPTY_SETUP_EVENTS.has(event.type));
}

/** Conservative read-only safety fold, also covering cold/abnormally stopped logs. */
export function assertSafeHistory(inspection, action, { allowSubagent = false } = {}) {
  if (!allowSubagent && inspection.meta.origin === 'subagent') fail('UNSAFE_STATE', '子智能体会话由其父会话管理，不能在此移动或删除。');
  const turns = new Set(), steps = new Set(), calls = new Set();
  const inbox = { 'next-turn': [], 'next-step': [] };
  for (const event of inspection.events.slice(inspection.inheritedEventCount ?? 0)) {
    const data = event.data;
    if (event.type === 'turn/start') turns.add(data.turn);
    if (event.type === 'turn/end') turns.delete(data.turn);
    if (event.type === 'step/start') steps.add(`${data.turn}:${data.step}`);
    if (event.type === 'step/end') steps.delete(`${data.turn}:${data.step}`);
    if (event.type === 'tool/call') calls.add(data.callId);
    if (event.type === 'tool/result') calls.delete(data.message?.toolCallId);
    if (event.type === 'agent/inbox/spliced') {
      const queue = inbox[data.target], removed = data.removedCount ?? 0;
      if (!queue || !Array.isArray(data.inserted) || !Number.isSafeInteger(data.start) || !Number.isSafeInteger(removed) || data.start < 0 || removed < 0 || data.start + removed > queue.length) fail('UNSAFE_STATE', '会话队列历史无法安全核对。');
      queue.splice(data.start, removed, ...data.inserted);
    }
    // Historical coordination records stay byte-for-byte in the inherited
    // prefix. Native fork projections isolate Team by new Session id and the
    // subagent catalog by inheritedEventCount; only actual work blocks here.
  }
  if (turns.size || steps.size || calls.size) fail('SESSION_BUSY', '会话存在未闭合的轮次、步骤或工具调用；请先结束运行。');
  if (inbox['next-turn'].length || inbox['next-step'].length) fail('SESSION_BUSY', '会话仍有排队输入；请先处理或清空队列。');
}

/** Plugin-owned receipts implement a durable, bounded, never-pruned request journal. */
export function createController(ctx, receipts, { now = Date.now, visibility } = {}) {
  let tail = Promise.resolve(), closing = false;
  let uncertainVisibility;
  let pendingBatch = [...(receipts.entries?.() ?? [])].find(([, receipt]) => receipt.request?.action === 'batchDelete' && receipt.stage !== 'done')?.[0];
  const visibilityState = () => visibility?.get() ?? { revision: 0, hiddenWorkspaceIds: [], receipts: [] };
  const workspaceViews = state => {
    const hidden = new Set(state.hiddenWorkspaceIds);
    return ctx.workspaceRegistry.list().map(({ id, title, path }) => ({ id, title, path, hidden: hidden.has(id) }));
  };
  const inFlight = new Set();
  const summaries = new Map();
  const workspaceFor = id => ctx.workspaceRegistry.list().find(workspace => workspace.sessionIds.includes(id));
  const targetFor = async id => {
    const target = ctx.workspaceRegistry.get(id);
    if (!target) fail('WORKSPACE_NOT_FOUND', '目标工作区不存在，请刷新列表。');
    if (await target.status() !== 'ok') fail('WORKSPACE_UNAVAILABLE', '目标工作区目录不存在。');
    return target;
  };
  async function inspect(id, signal) {
    try { return await ctx.sessionController.inspect(id, signal); }
    catch (error) { fail('SESSION_UNAVAILABLE', `会话不存在、格式不兼容或当前不可读取：${clean(error.message || error)}`); }
  }
  function activityMessage(activities) {
    const kinds = new Set(activities.map(activity => activity.kind));
    if (kinds.has('subagent')) return '会话仍有正在运行的子智能体，请先结束子智能体工作。';
    if (kinds.has('schedule')) return '会话仍有启用的提醒，请先停用提醒。';
    if (kinds.has('job')) return '会话仍有后台任务，请先结束后台任务。';
    if (kinds.has('turn')) return '会话正在运行，请先停止后再操作。';
    return '会话仍有运行、后台或关联工作，请先结束这些工作。';
  }
  async function activitySafe(id) {
    const activities = await ctx.waterfall('workspace/session-activity', { sessionId: id }, async () => []);
    if (!Array.isArray(activities)) fail('STATE_UNAVAILABLE', '当前无法核对会话运行状态，请稍后重试。');
    if (activities.length) fail('SESSION_BUSY', activityMessage(activities));
    const jobs = ctx.get?.('jobs');
    if (jobs?.list(id).some(job => job.owner === id && ['running','stopping'].includes(job.status))) fail('SESSION_BUSY', '会话仍有后台任务，请先结束后台任务。');
  }
  async function descendantsSafe(id, inspection, action) {
    const liveAgents = ctx.agents.list?.() ?? [];
    const descendants = new Map();
    // Live lineage catches accepted workers before catalog publication and
    // children omitted by damaged/old catalogs. Ordinary forks are not workers.
    const parents = new Set([id]);
    let added = true;
    while (added) {
      added = false;
      for (const agent of liveAgents) {
        const header = agent.session?.header;
        if (header?.origin !== 'subagent' || !parents.has(header.parentSession) || parents.has(agent.id)) continue;
        parents.add(agent.id); descendants.set(agent.id, { id: agent.id, live: true }); added = true;
      }
    }
    const own = inspection.events.slice(inspection.inheritedEventCount ?? 0);
    const ownCatalog = own.some(event => event.type === 'subagent/catalog');
    for (const event of own) {
      if (event.type === 'subagent/catalog' && event.data.mode !== 'external' && typeof event.data.childId === 'string') descendants.set(event.data.childId, { id: event.data.childId, label: event.data.label, live: Boolean(ctx.agents.get(event.data.childId)) });
      if (event.type === 'tool-workflow/agent-start' && typeof event.data.childId === 'string') descendants.set(event.data.childId, { id: event.data.childId, label: event.data.label, live: Boolean(ctx.agents.get(event.data.childId)) });
    }
    const subagents = ctx.get?.('subagents');
    if (ownCatalog && subagents) {
      let rows;
      try { rows = await subagents.listDescendants(id); }
      catch {
        // Old cold catalogs may point to deleted or unsupported children. They
        // remain history on the source, not relationships adopted by the copy.
        rows = [];
      }
      for (const row of rows) {
        if (row.kind === 'diagnostic') {
          // The cold artifact may be gone, but a current job or live Agent with
          // this known identity is still actual activity and must be checked.
          descendants.set(row.id, { ...row, live: Boolean(ctx.agents.get(row.id)) });
          continue;
        }
        if (row.kind !== 'child') continue;
        if (row.activity === 'running') fail('SESSION_BUSY', `子智能体 ${clean(row.label || row.id)} 正在运行，请先结束其工作。`);
        if (row.mode !== 'external') descendants.set(row.id, { ...row, live: Boolean(ctx.agents.get(row.id)) });
      }
    }
    // Provisioning is not necessarily represented by a published Agent yet.
    // Select only this exact Team's own latest member snapshots, never inherited
    // records belonging to an earlier Team id.
    const members = new Map();
    for (const event of own) if (event.type === 'team/member' && event.data.teamId === id && event.data.member?.id) members.set(event.data.member.id, event.data.member);
    for (const member of members.values()) {
      if (member.phase === 'provisioning') fail('SESSION_BUSY', `团队成员 ${clean(member.name || member.id)} 正在创建，请稍后再操作。`);
      if (member.phase === 'active') descendants.set(member.id, { id: member.id, label: member.name, live: Boolean(ctx.agents.get(member.id)) });
    }
    for (const child of descendants.values()) {
      const live = ctx.agents.get(child.id);
      if (live?.status === 'running') fail('SESSION_BUSY', `子智能体 ${clean(child.label || child.id)} 正在运行，请先结束其工作。`);
      // Jobs may outlive a readable child log; never hide a currently running
      // background operation just because an old artifact disappeared.
      try { await activitySafe(child.id); }
      catch (error) {
        if (error instanceof Failure) fail(error.code, `子智能体 ${clean(child.label || child.id)}：${error.message}`);
        throw error;
      }
      let observed;
      try { observed = await ctx.sessionController.inspect(child.id); }
      catch {
        if (live || child.live) fail('STATE_UNAVAILABLE', `无法核对活动子智能体 ${clean(child.label || child.id)} 的待处理输入，请稍后重试。`);
        continue; // stale cold historical child: no transfer and no resurrection
      }
      try {
        assertSafeHistory(observed, action, { allowSubagent: true });
      } catch (error) {
        if (error instanceof Failure) fail(error.code, `子智能体 ${clean(child.label || child.id)}：${error.message}`);
        throw error;
      }
    }
  }
  async function safe(id, inspection, action) {
    assertSafeHistory(inspection, action);
    if (ctx.agents.get(id)?.status === 'running') fail('SESSION_BUSY', '会话正在运行，请先停止后再操作。');
    await activitySafe(id);
    await descendantsSafe(id, inspection, action);
  }
  async function list(request, signal) {
    const [catalog, state] = await Promise.all([ctx.sessionController.list({}, signal), workspaceBaseline(ctx, signal)]);
    const visibleState = visibilityState();
    const workspaces = workspaceViews(visibleState);
    const hidden = new Set(visibleState.hiddenWorkspaceIds);
    const archived = new Set(state.archivedSessionIds);
    // Native list includes cold sessions and excludes subagent-only ownership.
    let rows = [];
    for (const summary of catalog.items) {
      if (summary.origin === 'subagent') continue;
      const workspaceId = workspaceFor(summary.sessionId)?.id;
      if (!request.includeHidden && workspaceId && hidden.has(workspaceId)) continue;
      if (request.workspaceId && workspaceId !== request.workspaceId) continue;
      if (archived.has(summary.sessionId) !== (request.archived ?? false)) continue;
      try {
        const live = ctx.sessions.get(summary.sessionId);
        const version = live ? `live:${live.seq}` : `stored:${(await ctx.sessionPersistence.stat(summary.sessionId))?.revision}`;
        let cached = summaries.get(summary.sessionId);
        if (!cached || cached.version !== version) {
          const inspection = await inspect(summary.sessionId, signal);
          cached = { version, digest: logDigest(inspection), title: titleOf(summary, inspection), cwd: inspection.events.findLast(event => event.type === 'working-directory/change')?.data.cwd ?? inspection.meta.cwd ?? summary.cwd ?? '', empty: isEmptyHistory(inspection) };
          summaries.set(summary.sessionId, cached);
          if (summaries.size > 2000) summaries.delete(summaries.keys().next().value);
        }
        const { title, cwd } = cached;
        if (request.query && !`${title}\n${summary.sessionId}\n${cwd}`.toLocaleLowerCase().includes(request.query.toLocaleLowerCase())) continue;
        rows.push({ sessionId: summary.sessionId, title, cwd, empty: cached.empty, ...(workspaceId ? { workspaceId } : {}), running: Boolean(summary.running || ctx.agents.get(summary.sessionId)?.status === 'running'), archived: archived.has(summary.sessionId), updatedAt: summary.updatedAt, token: tokenForDigest(cached.digest, summary.sessionId, state, workspaceId) });
      } catch (error) {
        signal?.throwIfAborted();
        // A damaged/incompatible log is a disabled row, not a reason to hide
        // every healthy Session in the page. No token means no mutation can be
        // submitted against a history whose current state is unverifiable.
        const title = '不可读取的会话', cwd = summary.cwd ?? '';
        if (request.query && !`${title}\n${summary.sessionId}\n${cwd}`.toLocaleLowerCase().includes(request.query.toLocaleLowerCase())) continue;
        rows.push({ sessionId: summary.sessionId, title, cwd, empty: false, ...(workspaceId ? { workspaceId } : {}), running: Boolean(summary.running), archived: archived.has(summary.sessionId), updatedAt: summary.updatedAt, readError: clean(error.message || error) });
      }
    }
    rows.sort((a,b) => b.updatedAt - a.updatedAt || a.sessionId.localeCompare(b.sessionId));
    return { ok: true, workspaces, visibilityRevision: visibleState.revision, items: rows.slice(request.offset, request.offset + request.limit), total: rows.length, offset: request.offset, limit: request.limit };
  }
  async function save(id, receipt) {
    try { await receipts.put(id, clone(receipt)); }
    catch { fail('WRITE_UNCERTAIN', '操作凭证写入结果待确认；只能使用相同 requestId 和完全相同参数重试。', receipt.sessionId ? { sessionId: receipt.sessionId } : undefined); }
  }
  async function restoreSource(receipt) {
    await ctx.workspaceRegistry.unarchiveSession(receipt.request.sessionId);
    if (receipt.sourcePinned) await ctx.workspaceRegistry.pinSession(receipt.request.sessionId);
  }
  async function checkedSource(request, action) {
    const state = await workspaceBaseline(ctx);
    const source = await inspect(request.sessionId);
    if (tokenFor(source, state, workspaceFor(request.sessionId)?.id) !== request.expectedToken) fail('CONFLICT', '会话已发生变化，请刷新列表并重新确认操作。');
    if (action !== 'restore') await safe(request.sessionId, source, action);
    return { state, source };
  }
  async function finish(request, receipt, result) {
    await save(request.requestId, { ...receipt, stage: 'done', result });
    return result;
  }
  async function create(request, receipt) {
    const target = await targetFor(request.workspaceId);
    if (receipt.stage === 'prepared') {
      receipt = { ...receipt, stage: 'applying' };
      await save(request.requestId, receipt);
    }
    let stored = await ctx.sessionPersistence.stat(receipt.sessionId);
    if (!stored) {
      const value = await ctx.sessionController.create({ workspaceId: target.id, sessionId: receipt.sessionId });
      if (value.sessionId !== receipt.sessionId) fail('RECOVERY_REQUIRED', '新建结果的会话标识不一致；请保留请求凭证并人工核对。', { sessionId: value.sessionId });
    } else if (stored.header.cwd !== target.path) fail('RECOVERY_REQUIRED', '请求对应会话的工作区不一致，已停止重试。', { sessionId: receipt.sessionId });
    const live = ctx.sessions.get(receipt.sessionId);
    if (live) await ctx.sessions.flush(live);
    else await ctx.sessionPersistence.flush();
    await target.attachSession(receipt.sessionId);
    return finish(request, receipt, { ok: true, sessionId: receipt.sessionId, message: '已在目标工作区新建会话。' });
  }
  async function move(request, receipt) {
    if (receipt.stage === 'rollback' || receipt.stage === 'failed') {
      try {
        if (await ctx.sessionPersistence.stat(receipt.sessionId)) await ctx.workspaceRegistry.archiveSession(receipt.sessionId);
        await restoreSource(receipt);
      } catch { fail('RECOVERY_REQUIRED', '源会话恢复尚未完成；请保留请求凭证并使用同一请求重试。', { sessionId: request.sessionId }); }
      return finish(request, receipt, receipt.failure ?? { ok: false, code: 'MOVE_FAILED', error: '移动未完成；源会话已恢复，未删除任何历史。', sessionId: receipt.sessionId });
    }
    let target;
    try { target = await targetFor(request.workspaceId); }
    catch (error) {
      if (!receipt.sourceDigest) throw error;
      const failure = resultError(error);
      receipt = { ...receipt, stage: 'rollback', failure };
      await save(request.requestId, receipt);
      try {
        if (await ctx.sessionPersistence.stat(receipt.sessionId)) await ctx.workspaceRegistry.archiveSession(receipt.sessionId);
        await restoreSource(receipt);
      } catch { fail('RECOVERY_REQUIRED', '目标工作区不可用且源会话恢复尚未完成；请使用相同请求重试。', { sessionId: request.sessionId }); }
      return finish(request, receipt, { ...failure, error: `${failure.error} 源会话已恢复。` });
    }
    if (!receipt.sourceDigest) {
      const { state, source } = await checkedSource(request, 'move');
      if (state.archivedSessionIds.includes(request.sessionId)) fail('INVALID_STATE', '请先恢复归档会话，再进行移动。');
      if (workspaceFor(request.sessionId)?.id === target.id) fail('SAME_WORKSPACE', '会话已属于此工作区，无需移动。');
      receipt = { ...receipt, sourceDigest: logDigest(source), sourcePinned: state.pinnedSessionIds.includes(request.sessionId), stage: 'freezing' };
      await save(request.requestId, receipt);
    }
    // Re-check optimistic preconditions at the last public-API boundary. There
    // is no registry compare-and-set API for an atomic cross-plugin archive.
    const beforeFreeze = await workspaceBaseline(ctx);
    if (!beforeFreeze.archivedSessionIds.includes(request.sessionId)) {
      const source = await inspect(request.sessionId);
      if (tokenFor(source, beforeFreeze, workspaceFor(request.sessionId)?.id) !== request.expectedToken) {
        return finish(request, receipt, { ok: false, code: 'CONFLICT', error: '冻结前会话状态已变化，请刷新并重新确认。' });
      }
    }
    // Native archive errors happen before the inactive archive commits. Do not
    // unarchive here: another owner action may have changed this source.
    try { await ctx.workspaceRegistry.archiveSession(request.sessionId); }
    catch { fail('PENDING', '尚未冻结源会话；可能仍有活动或归档写入失败，请使用相同请求重试。'); }
    try {
      const source = await inspect(request.sessionId);
      await safe(request.sessionId, source, 'move');
      if (logDigest(source) !== receipt.sourceDigest) fail('CONFLICT', '冻结期间会话发生变化，已取消移动。');
      const live = ctx.sessions.get(request.sessionId);
      if (live) await ctx.sessions.flush(live);
      const preset = effectivePreset(source);
      if (preset !== undefined) {
        const resolved = await ctx.agentPresets.resolve(preset);
        if (!resolved || resolved.broken) fail('PRESET_UNAVAILABLE', '源会话智能体预设当前不可用，无法安全移动。');
      }
      // Preserve every event byte-for-byte and append the canonical target cwd
      // after old cwd changes. Do not activate a seeded Agent while copying.
      const events = [
        ...clone(source.events),
        // Same inherited-cut marker as native buildForkSeed. The format codec
        // requires the final inherited marker exactly at inheritedEventCount,
        // including the empty-source case (cut=0).
        { type: 'session/end-seed', seq: source.events.length, time: receipt.createdAt, data: { inherited: true } },
        { type: 'working-directory/change', seq: source.events.length + 1, time: receipt.createdAt, data: { cwd: target.path } },
      ];
      const header = { version: source.meta.version, id: receipt.sessionId, createdAt: receipt.createdAt, cwd: target.path, parentSession: request.sessionId, isSeeded: true, ...(preset === undefined ? {} : { agentPreset: preset }) };
      let handle;
      const stored = await ctx.sessionPersistence.stat(receipt.sessionId);
      if (!stored) handle = await ctx.sessionPersistence.create(header, { inheritedEventCount: source.events.length });
      else {
        if (hash(stored.header) !== hash(header) || ctx.sessions.get(receipt.sessionId)) fail('RECOVERY_REQUIRED', '目标副本已被修改或打开，禁止覆盖；源会话将恢复。', { sessionId: receipt.sessionId });
        handle = await ctx.sessionPersistence.open(receipt.sessionId, 'write');
      }
      try {
        const existing = (await handle.read()).events;
        if (existing.length > events.length || hash(existing) !== hash(events.slice(0, existing.length))) fail('RECOVERY_REQUIRED', '目标副本不匹配本次历史快照，禁止覆盖。', { sessionId: receipt.sessionId });
        if (existing.length < events.length) await handle.append(events.slice(existing.length));
        await handle.flush();
      } finally { await handle.close(); }
      const verified = await inspect(receipt.sessionId);
      if (hash(verified.events) !== hash(events) || verified.meta.cwd !== target.path || verified.meta.agentPreset !== preset) fail('RECOVERY_REQUIRED', '目标历史完整性核对失败；源会话将恢复。', { sessionId: receipt.sessionId });
      await target.attachSession(receipt.sessionId);
      // A late admitted input must never be lost even after durable copy.
      if (logDigest(await inspect(request.sessionId)) !== receipt.sourceDigest) fail('CONFLICT', '移动期间源会话新增了内容，已取消移动并保留源会话。');
      if (!(await workspaceBaseline(ctx)).archivedSessionIds.includes(request.sessionId)) fail('CONFLICT', '移动期间源会话被恢复，已取消移动。');
      return await finish(request, receipt, { ok: true, sessionId: receipt.sessionId, sourceSessionId: request.sessionId, message: '全部历史已由目标工作区的新会话承接；源会话已归档，可恢复。' });
    } catch (error) {
      // Keep an uncertain receipt rather than overwriting a success whose final
      // receipt barrier failed. Exact retry can verify and finish the same ID.
      if (error.code === 'WRITE_UNCERTAIN') throw error;
      const failure = resultError(error);
      receipt = { ...receipt, stage: 'rollback', failure: { ...failure, ...(receipt.sessionId ? { sessionId: receipt.sessionId } : {}) } };
      await save(request.requestId, receipt);
      try {
        if (await ctx.sessionPersistence.stat(receipt.sessionId)) await ctx.workspaceRegistry.archiveSession(receipt.sessionId);
        await restoreSource(receipt);
      } catch { fail('RECOVERY_REQUIRED', '移动未完成，自动恢复尚未完成；源历史仍保留。请使用相同请求重试。', { sessionId: request.sessionId }); }
      return finish(request, receipt, { ...receipt.failure, error: `${receipt.failure.error} 源会话已恢复；若已创建部分副本，则副本已可恢复归档。` });
    }
  }
  async function setWorkspaceVisibility(request) {
    if (!visibility) fail('VISIBILITY_UNAVAILABLE', '工作区显示设置当前不可用。');
    const fingerprint = hash([request.action, request.workspaceId, request.hidden, request.expectedVisibilityRevision, request.requestId]);
    const state = visibilityState();
    const receipt = state.receipts.find(entry => entry.requestId === request.requestId);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) fail('REQUEST_ID_REUSED', '同一个 requestId 不能用于不同参数。');
      if (uncertainVisibility?.requestId === request.requestId) uncertainVisibility = undefined;
      return clone(receipt.result);
    }
    if (uncertainVisibility && (uncertainVisibility.requestId !== request.requestId || uncertainVisibility.fingerprint !== fingerprint)) fail('PENDING', '前一次显示设置写入结果待确认；请先使用其原请求凭证重试。');
    if (receipts.get(request.requestId)) fail('REQUEST_ID_REUSED', '此 requestId 已用于其他会话管理操作。');
    if (!ctx.workspaceRegistry.get(request.workspaceId)) fail('WORKSPACE_NOT_FOUND', '工作区不存在，请刷新列表。');
    if (state.revision !== request.expectedVisibilityRevision) {
      if (uncertainVisibility?.requestId === request.requestId) uncertainVisibility = undefined;
      fail('CONFLICT', '工作区显示状态已改变，请刷新并重新确认。', { visibilityRevision: state.revision });
    }
    if (state.receipts.length >= MAX_RECEIPTS) fail('JOURNAL_FULL', '显示设置操作凭证已达上限；为防重复写入，已拒绝新请求。');
    if (state.revision >= Number.MAX_SAFE_INTEGER) fail('REVISION_EXHAUSTED', '工作区显示版本已达上限，无法继续修改。');
    const hidden = new Set(state.hiddenWorkspaceIds);
    if (request.hidden) hidden.add(request.workspaceId); else hidden.delete(request.workspaceId);
    const next = { revision: state.revision + 1, hiddenWorkspaceIds: [...hidden], receipts: state.receipts };
    // Keep receipts compact and independent of directory count. The caller
    // refreshes list for current workspaces; exact replay returns this same
    // historical acknowledgement without duplicating all paths per request.
    const result = { ok: true, visibilityRevision: next.revision, message: request.hidden ? '已在会话管理页隐藏此工作区；不影响原生侧栏、会话归档或运行。' : '已在会话管理页显示此工作区；不影响原生侧栏、会话归档或运行。' };
    next.receipts = [...state.receipts, { requestId: request.requestId, fingerprint, result }];
    // One domain-global atomic barrier commits both absolute visibility and its
    // receipt. A retry can never overwrite a later revision: receipt lookup is
    // before CAS, and a failed unknown write gates new visibility requests.
    try { await visibility.set(clone(next)); }
    catch {
      uncertainVisibility = { requestId: request.requestId, fingerprint };
      fail('WRITE_UNCERTAIN', '显示设置写入结果待确认；只能使用原 requestId 和完全相同参数重试。');
    }
    uncertainVisibility = undefined;
    return result;
  }
  async function batchDelete(request) {
    const fingerprint = hash([request.action, request.items, request.requestId]);
    let parent = receipts.get(request.requestId);
    if (parent && parent.fingerprint !== fingerprint) fail('REQUEST_ID_REUSED', '同一个 requestId 不能用于不同批量项目。');
    if (parent?.stage === 'done') { if (pendingBatch === request.requestId) pendingBatch = undefined; return clone(parent.result); }
    const children = request.items.map((item, index) => ({ action: 'delete', ...item, requestId: `batch-${hash([request.requestId, index, item.sessionId])}` }));
    if (!parent) {
      if (uncertainVisibility?.requestId === request.requestId) fail('REQUEST_ID_REUSED', '此 requestId 已用于待确认的显示设置。');
      if (visibilityState().receipts.some(entry => entry.requestId === request.requestId)) fail('REQUEST_ID_REUSED', '此 requestId 已用于显示设置。');
      if (receipts.size + children.length + 1 > MAX_RECEIPTS) fail('JOURNAL_FULL', '操作凭证空间不足以安全完成整批请求；本批未进行任何删除。');
      if (children.some(child => receipts.get(child.requestId) || visibilityState().receipts.some(entry => entry.requestId === child.requestId))) fail('REQUEST_ID_REUSED', '批量子操作凭证已存在，请换用新的批量 requestId。');
      parent = { fingerprint, request: clone(request), createdAt: now(), stage: 'applying' };
      pendingBatch = request.requestId;
      await save(request.requestId, parent);
    } else pendingBatch = request.requestId;
    const results = [];
    for (const child of children) {
      let result;
      const prior = receipts.get(child.requestId);
      if (prior && prior.stage !== 'prepared' && prior.stage !== 'done') {
        // Archive might have committed before its receipt barrier failed. Never
        // reapply against a subsequently restored Session: observe the absolute
        // archive state, settle it, and leave any later user restore intact.
        let state;
        try { state = await workspaceBaseline(ctx); }
        catch { fail('WRITE_UNCERTAIN', '批量子操作归档状态仍无法核对，请使用原批量请求重试。'); }
        result = state.archivedSessionIds.includes(child.sessionId)
          ? { ok: true, sessionId: child.sessionId, message: '已核对会话处于可恢复归档状态。' }
          : { ok: false, code: 'CONFLICT', error: '先前子操作结果待确认且会话目前未归档；为避免覆盖后续恢复，本次不再删除，请刷新后重新选择。' };
        await save(child.requestId, { ...prior, stage: 'done', result });
      }
      try { result ??= await mutate(child, { batchRequestId: request.requestId }); }
      catch (error) {
        const receipt = receipts.get(child.requestId);
        const uncertain = ['WRITE_UNCERTAIN','PENDING','RECOVERY_REQUIRED'].includes(error.code);
        if (uncertain || !(error instanceof Failure) || receipt && receipt.stage !== 'prepared' && receipt.stage !== 'done') {
          fail('WRITE_UNCERTAIN', `批量删除进行到 ${results.length + 1}/${children.length} 时结果待确认；只能用原批量 requestId 和完全相同项目重试。`);
        }
        result = resultError(error);
        // Precondition failures also receive stable child receipts. A later
        // retry must not change a prior failure into success with a stale token.
        await save(child.requestId, { ...(receipt ?? { fingerprint: hash(child), request: clone(child), createdAt: now() }), stage: 'done', result });
      }
      if (result.ok === false && ['WRITE_UNCERTAIN','PENDING','RECOVERY_REQUIRED'].includes(result.code)) fail('WRITE_UNCERTAIN', '批量删除结果待确认，请使用原批量请求重试。');
      results.push({ sessionId: child.sessionId, ok: result.ok === true, ...(result.ok ? {} : { code: result.code, error: result.error }) });
    }
    const succeeded = results.filter(result => result.ok).length, failed = results.length - succeeded;
    const result = { ok: true, results, succeeded, failed, message: `批量处理完成：${succeeded} 个会话已可恢复归档，${failed} 个未删除；未永久删除任何历史。` };
    await save(request.requestId, { ...parent, stage: 'done', result });
    pendingBatch = undefined;
    return result;
  }
  async function mutate(request, { batchRequestId } = {}) {
    if (pendingBatch && request.requestId !== pendingBatch && batchRequestId !== pendingBatch) fail('PENDING', '有批量删除尚未确认完成；请先使用原批量请求凭证重试。');
    if (request.action === 'batchDelete') return batchDelete(request);
    if (request.action === 'setWorkspaceVisibility') return setWorkspaceVisibility(request);
    if (uncertainVisibility?.requestId === request.requestId || visibilityState().receipts.some(entry => entry.requestId === request.requestId)) fail('REQUEST_ID_REUSED', '此 requestId 已用于工作区显示设置。');
    let receipt = receipts.get(request.requestId);
    const fingerprint = hash(request);
    if (receipt && receipt.fingerprint !== fingerprint) fail('REQUEST_ID_REUSED', '同一个 requestId 不能用于不同参数。');
    if (receipt?.stage === 'done') return clone(receipt.result);
    if (!receipt) {
      if (receipts.size >= MAX_RECEIPTS) fail('JOURNAL_FULL', '操作凭证已达上限；为防重复操作，已拒绝新的写请求。');
      // Validate preconditions before reserving the request so normal conflicts
      // leave the client free to obtain a fresh token and mint a new request.
      if (request.action !== 'create') {
        const checked = await checkedSource(request, request.action);
        if (request.action === 'move') {
          const target = await targetFor(request.workspaceId);
          if (checked.state.archivedSessionIds.includes(request.sessionId)) fail('INVALID_STATE', '请先恢复归档会话，再进行移动。');
          if (workspaceFor(request.sessionId)?.id === target.id) fail('SAME_WORKSPACE', '会话已属于此工作区，无需移动。');
        }
      } else await targetFor(request.workspaceId);
      receipt = { fingerprint, request: clone(request), createdAt: now(), stage: 'prepared', ...(['create','move'].includes(request.action) ? { sessionId: `session-${hash(['session-manager',request.requestId]).slice(0,40)}` } : {}) };
      await save(request.requestId, receipt);
    }
    if (request.action === 'create') return create(request, receipt);
    if (request.action === 'move') return move(request, receipt);
    // A retry after the registry committed but before the receipt committed is
    // an idempotent set/unset, never a second mutation of a different Session.
    if (receipt.stage === 'prepared') {
      await checkedSource(request, request.action);
      receipt = { ...receipt, stage: 'applying' }; await save(request.requestId, receipt);
    }
    if (request.action === 'delete') {
      const source = await inspect(request.sessionId);
      await safe(request.sessionId, source, 'delete');
      await ctx.workspaceRegistry.archiveSession(request.sessionId);
    } else await ctx.workspaceRegistry.unarchiveSession(request.sessionId);
    return finish(request, receipt, { ok: true, sessionId: request.sessionId, message: request.action === 'delete' ? '会话已可恢复归档；未永久删除历史，可在归档列表恢复。' : '会话已从归档恢复。' });
  }
  function dispatch(input, { signal } = {}) {
    if (closing) return Promise.resolve({ ok: false, code: 'UNAVAILABLE', error: '插件正在关闭，请稍后重试。' });
    let request;
    try { request = validate(input); } catch (error) { return Promise.resolve(resultError(error)); }
    const operation = request.action === 'list' ? list(request, signal) : tail.then(() => mutate(request));
    const pending = operation.catch(async error => {
      const receipt = request.action === 'list' ? undefined : receipts.get(request.requestId);
      const reserved = error instanceof Failure && ['WRITE_UNCERTAIN','PENDING','RECOVERY_REQUIRED','REQUEST_ID_REUSED'].includes(error.code);
      if (receipt?.stage === 'prepared' && !receipt.sourceDigest && error instanceof Failure && !reserved) {
        // Target/precondition failures before applying/freezing are known not to
        // have changed Session state. Settle them rather than trapping a client
        // in an endless exact-retry loop with an obsolete expectedToken.
        const failure = resultError(error);
        try { await save(request.requestId, { ...receipt, stage: 'done', result: failure }); }
        catch (saveError) { return resultError(saveError); }
        return failure;
      }
      if (receipt && receipt.stage !== 'done' && !reserved) return { ok: false, code: 'WRITE_UNCERTAIN', error: '写操作尚未确认完成；请保留原 requestId 和完全相同参数重试。', ...(receipt.sessionId ? { sessionId: receipt.sessionId } : {}) };
      return resultError(error);
    }).finally(() => inFlight.delete(pending));
    if (request.action !== 'list') tail = pending.then(() => undefined);
    inFlight.add(pending);
    return pending;
  }
  return { dispatch, async close() { closing = true; await Promise.allSettled(inFlight); } };
}

export function visibilitySchema(z) {
  const result = z.object({ ok: z.literal(true), visibilityRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), message: z.string() });
  return z.object({ revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), hiddenWorkspaceIds: z.array(z.string()).refine(ids => new Set(ids).size === ids.length), receipts: z.array(z.object({ requestId: z.string().min(16).max(128), fingerprint: z.string(), result })).max(MAX_RECEIPTS).refine(entries => new Set(entries.map(entry => entry.requestId)).size === entries.length) });
}

export function receiptSchema(z) {
  return z.object({ fingerprint: z.string(), request: z.record(z.string(), z.unknown()), createdAt: z.number(), stage: z.enum(['prepared','freezing','applying','rollback','failed','done']), sessionId: z.string().optional(), sourceDigest: z.string().optional(), sourcePinned: z.boolean().optional(), failure: z.record(z.string(), z.unknown()).optional(), result: z.record(z.string(), z.unknown()).optional() });
}

export function createHttpHandler(connection, dispatch) {
  const reply = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  };
  return async (req, res) => {
    const admission = connection.admit(req);
    if (admission.rejection) return reply(res, admission.rejection, { ok: false, code: 'UNAUTHORIZED', error: '请求未通过连接鉴权。' });
    if (admission.peer?.principal?.kind !== 'owner') return reply(res, 403, { ok: false, code: 'FORBIDDEN', error: '仅当前 Harness 所有者可管理会话。' });
    if (req.method !== 'POST') return reply(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', error: '仅支持 POST。' });
    if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return reply(res, 415, { ok: false, code: 'INVALID_REQUEST', error: '需要 application/json 请求。' });
    try {
      const parts = []; let bytes = 0;
      for await (const chunk of req) {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 16384) return reply(res, 413, { ok: false, code: 'INVALID_REQUEST', error: '请求不能超过 16KiB。' });
        parts.push(Buffer.from(chunk));
      }
      let request;
      try { request = JSON.parse(Buffer.concat(parts).toString('utf8')); }
      catch { return reply(res, 400, { ok: false, code: 'INVALID_REQUEST', error: 'JSON 格式无效。' }); }
      reply(res, 200, await dispatch(request, { signal: admission.peer.signal }));
    } catch { if (!res.headersSent) reply(res, 500, { ok: false, code: 'WRITE_UNCERTAIN', error: '请求结果待确认；写操作请使用原请求凭证重试。' }); }
  };
}
