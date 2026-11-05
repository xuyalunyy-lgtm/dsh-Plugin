import { createHash } from 'node:crypto';

export const IDLE_REVIEWED_SHA256 = 'a6fa8e0c7c90191caf5f4a3bb5c624a86e9845cf3c79d020b71420d0e20ae4c1';

/** Exact-build idle Agent release. Applies only to a separate candidate source. */
export function patchIdle(source) {
  if (source.includes('async releaseIdleForPurge(')) throw Error('Idle purge patch already applied');
  if (createHash('sha256').update(source).digest('hex') !== IDLE_REVIEWED_SHA256) throw Error('Idle purge source baseline mismatch');
  const replace = (before, after) => {
    if (source.split(before).length !== 2) throw Error(`Idle purge anchor mismatch: ${before.slice(0, 80)}`);
    source = source.replace(before, after);
  };
  // One common send boundary covers prompt/followup/steer/inject from API,
  // schedules and peer services. Direct inbox insertions share the same gate.
  replace('\tconstructor(readState, session, dispatch) {', '\tassertPurgeInsertion;\n\tconstructor(readState, session, dispatch, assertPurgeInsertion) {\n\t\tthis.assertPurgeInsertion = assertPurgeInsertion;');
  replace('\tmutate(target, start, deleteCount, inserted, discardRemoved) {', '\tmutate(target, start, deleteCount, inserted, discardRemoved) {\n\t\tif (inserted.length) this.assertPurgeInsertion();');
  replace('\t\tthis.inbox = new ReactLoopInbox(projections.inbox, session, this.dispatch);', '\t\tthis.inbox = new ReactLoopInbox(projections.inbox, session, this.dispatch, () => this.loopCtx.sessions.assertPurgeAdmission(this.id, this.session.header.parentSession));');
  // Gate maintenance and direct wakes as well.
  replace('\tsend(message, target, wakeup) {', '\tsend(message, target, wakeup) {\n\t\tthis.loopCtx.sessions.assertPurgeAdmission(this.id, this.session.header.parentSession);');
  replace('\trunMaintenance(job) {', '\trunMaintenance(job) {\n\t\tthis.loopCtx.sessions.assertPurgeAdmission(this.id, this.session.header.parentSession);');
  replace('\twakeDriver(wakeAfterAbort = false) {', '\twakeDriver(wakeAfterAbort = false) {\n\t\tthis.loopCtx.sessions.assertPurgeAdmission(this.id, this.session.header.parentSession);');
  replace('\townership;\n\t/** Plain holder', '\townership;\n\tpurgeHandles = new Map();\n\t/** Plain holder');
  replace('\tasync initializeAgent(ownerCtx, options) {', METHODS + '\n\tasync initializeAgent(ownerCtx, options) {');
  replace('\t\t\ttry {\n\t\t\t\tdetachAgent?.();\n\t\t\t\tdetachSession?.();', '\t\t\ttry {\n\t\t\t\tif (this.purgeHandles.get(id)?.agent === machine) this.purgeHandles.delete(id);\n\t\t\t\tdetachAgent?.();\n\t\t\t\tdetachSession?.();');
  replace('\t\t\t\t\tready = true;\n\t\t\t\t\treturn {', '\t\t\t\t\tready = true;\n\t\t\t\t\tthis.purgeHandles.set(id, { agent, dispose });\n\t\t\t\t\treturn {');
  replace('\tasync create(id, options = {}, meta = {}) {', '\tasync create(id, options = {}, meta = {}) {\n\t\tthis.runtime.ctx.sessions.assertPurgeAdmission(id, meta.parentSession);');
  replace('\tasync createAgent(ownerCtx, options) {', '\tasync createAgent(ownerCtx, options) {\n\t\tthis.runtime.ctx.sessions.assertPurgeAdmission(options.sessionId, options.meta?.parentSession);');
  replace('\tresumeWith(ownerCtx, persistence, options) {\n\t\tconst id = options.resumeSessionId;', '\tresumeWith(ownerCtx, persistence, options) {\n\t\tconst id = options.resumeSessionId;\n\t\tthis.runtime.ctx.sessions.assertPurgeAdmission(id);');
  return source;
}

const METHODS = String.raw`
	/**
	 * Release only a factory-owned, phase-idle Agent with no pending inbox and
	 * no activity provider. Caller must already hold SessionStore's purge gate.
	 * No await separates the final phase/inbox check from starting disposal.
	 * Maintenance reports public status "idle" but is NOT eligible here.
	 */
	async releaseIdleForPurge(id) {
		const ctx = this.runtime.ctx;
		const refuse = (code, message) => { throw Object.assign(new Error(message), { code, purgeCommitted: false }); };
		if (!ctx.sessions.purgeReservations.has(id)) refuse("PURGE_ADMISSION_REQUIRED", "请先锁定会话删除准入，再释放空闲会话。");
		const agent = ctx.agents.get(id);
		if (!agent) {
			if (ctx.sessions.get(id)) refuse("PURGE_LIVE_SESSION", "会话仍被其他宿主组件加载，不能自动释放。");
			return { released: false };
		}
		const handle = this.purgeHandles.get(id);
		if (!handle || handle.agent !== agent) refuse("PURGE_LIVE_SESSION", "会话不由当前 Agent 工厂持有，不能自动释放。");
		const assertIdle = () => {
			if (ctx.agents.get(id) !== agent || ctx.sessions.get(id) !== agent.session || agent.phase.kind !== "idle" || agent.inbox.hasPending) refuse("PURGE_SESSION_BUSY", "会话仍有运行、维护或排队工作，未停止任何任务。");
		};
		assertIdle();
		const activity = await ctx.waterfall("workspace/session-activity", { sessionId: id }, () => Promise.resolve([]));
		if (!Array.isArray(activity) || activity.length) refuse("PURGE_SESSION_BUSY", "会话仍有后台或关联活动，未停止任何任务。");
		assertIdle();
		// A fresh blank Agent can still have a lazy unmaterialized log. Flush it
		// while idle and admitted to this exact purge gate, then recheck before
		// ordered teardown; the caller must still compare its frozen revision.
		await ctx.sessions.flush(agent.session);
		assertIdle();
		await handle.dispose();
		if (ctx.agents.get(id) || ctx.sessions.get(id)) refuse("PURGE_LIVE_SESSION", "空闲会话资源尚未完全释放，请核对后重试。");
		return { released: true };
	}`;
