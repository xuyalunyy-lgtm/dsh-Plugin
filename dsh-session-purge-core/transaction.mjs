/**
 * Archived-session purge coordinator. This is production transaction logic,
 * not a storage adapter and not an installed Harness capability.
 *
 * Ports (all reservations/releases must be idempotent):
 * - workspaces.runExclusive(operation): execute on the native global registry
 *   operationTail, propagating operation's exact result/error.
 * - journal.reserve(request): exclusively reserve BOTH requestId and sessionId
 *   across coordinator instances; return { read, begin, complete, release }.
 *   read() returns undefined or { request, phase: 'begun'|'done', plan }.
 *   begin(plan) atomically durably binds the exact request and immutable storage
 *   plan. complete() durably marks that same receipt done. They are CAS writes,
 *   never replacements of another request. reserve/read occur under exclusion.
 * - lifecycle.reserve(request): reject live/in-flight/child admission and retain
 *   the gate; return { release({ purgeCommitted }) }. Startup installs durable
 *   tombstone guards BEFORE publishing this capability. release after commit
 *   or uncertainty must preserve that guard; it is NOT a rollback capability.
 * - storage.reserve(request, committedPlan?): return { plan, release }, holding
 *   the in-process writer claim AND OS lease. For a fresh request validate the
 *   exact expectedRevision; on recovery use committedPlan without requiring any
 *   deleted files to exist. plan must be persistable, backend-owned, immutable.
 * - workspaces.assertArchived(request), query.assertUnreferenced(request, plan):
 *   precommit checks while every reservation is held; never resume an Agent.
 * - storage.remove(plan), workspaces.remove(sessionId), query.remove(sessionId),
 *   projections.remove(sessionId): idempotent roll-forward cleanup. Query and
 *   projection adapters must gate delayed read/write-back and drain their own
 *   serialized chains; storage removes all authorized generations, not locks.
 *
 * Linearization is durable journal.begin. An error during begin is UNKNOWN
 * unless the journal explicitly proves purgeCommitted === false. Unknown and
 * postbegin failures retain ALL reservations until exact retry succeeds or an
 * explicit close settles execution resources without revoking deletion guards.
 * journal adapters own crash recovery and tombstone durability. No in-memory
 * promise map can substitute for their cross-instance exclusion or CAS.
 */

export class PurgeTransactionError extends Error {
  constructor(code, message, purgeCommitted, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'PurgeTransactionError';
    this.code = code;
    this.purgeCommitted = purgeCommitted;
  }
}

const sameRequest = (a, b) => a.sessionId === b.sessionId && a.requestId === b.requestId && a.expectedRevision === b.expectedRevision;
const resultFor = request => ({ sessionId: request.sessionId, requestId: request.requestId, revision: request.expectedRevision, status: 'deleted' });

function requestOf(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['sessionId', 'requestId', 'expectedRevision'].includes(key))) {
    throw new PurgeTransactionError('PURGE_INVALID_REQUEST', '永久删除请求参数无效。', false);
  }
  for (const [key, min, max] of [['sessionId', 1, 256], ['requestId', 16, 128], ['expectedRevision', 1, 256]]) {
    if (typeof input[key] !== 'string' || input[key].length < min || input[key].length > max || /[\u0000-\u001f\u007f]/.test(input[key])) {
      throw new PurgeTransactionError('PURGE_INVALID_REQUEST', '永久删除需要有效会话 ID、原请求凭证及冻结的持久版本。', false);
    }
  }
  return Object.freeze({ sessionId: input.sessionId, requestId: input.requestId, expectedRevision: input.expectedRevision });
}

function failure(error, committed) {
  return new PurgeTransactionError(
    typeof error?.code === 'string' ? error.code : committed ? 'PURGE_RECOVERY_REQUIRED' : 'PURGE_PRECONDITION_FAILED',
    typeof error?.code === 'string' && typeof error.message === 'string' ? error.message : committed
      ? '永久删除结果待确认；请保留原请求凭证并使用完全相同参数重试。'
      : '永久删除尚未开始；请核对会话状态后重试。',
    committed,
    error,
  );
}

export function createPurgeTransaction(ports) {
  const running = new Map();
  const retained = new Map();
  let closing = false, closePromise;

  async function release(context) {
    const errors = [];
    // Keep every failed release available to the exact retry. Continue releasing
    // independent resources; an adapter's successful release is idempotent.
    for (const key of ['storage', 'lifecycle', 'journal']) {
      if (!context[key]) continue;
      try { await context[key].release({ purgeCommitted: context.committed !== false }); context[key] = undefined; }
      catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, '永久删除资源释放失败。');
    retained.delete(context.request.requestId);
  }

  async function execute(request) {
    let context = retained.get(request.requestId);
    if (!context) {
      context = { request, committed: undefined };
      retained.set(request.requestId, context);
    } else if (!sameRequest(context.request, request)) {
      throw new PurgeTransactionError('PURGE_REQUEST_ID_REUSED', '同一永久删除请求凭证不能用于不同会话或版本。', false);
    }
    try {
      context.journal ??= await ports.journal.reserve(request);
      const receipt = await context.journal.read();
      if (receipt) {
        if (!sameRequest(receipt.request, request)) throw new PurgeTransactionError('PURGE_REQUEST_ID_REUSED', '同一永久删除请求凭证不能用于不同会话或版本。', false);
        if (!['begun', 'done'].includes(receipt.phase)) throw new Error('Invalid purge receipt phase');
        context.committed = true;
        if (receipt.phase === 'done') {
          await release(context);
          return resultFor(request);
        }
      } else context.committed = false; // authoritative read under the journal lock

      context.lifecycle ??= await ports.lifecycle.reserve(request);
      context.storage ??= await ports.storage.reserve(request, receipt?.plan);
      const plan = receipt ? receipt.plan : context.storage.plan;
      if (!receipt) {
        await ports.workspaces.assertArchived(request);
        await ports.query.assertUnreferenced(request, plan);
        // A rejected await can still follow a committed namespace write. Only
        // the journal owner can prove a definite precommit failure here.
        context.committed = true;
        try { await context.journal.begin(plan); }
        catch (error) {
          if (error?.purgeCommitted === false) context.committed = false;
          throw error;
        }
      }
      // No per-stage checkpoints: each owner repeats its idempotent cleanup
      // from the durable plan, including when earlier cleanup already succeeded.
      await ports.storage.remove(plan);
      await ports.workspaces.remove(request.sessionId);
      await ports.query.remove(request.sessionId);
      await ports.projections.remove(request.sessionId);
      await context.journal.complete();
      await release(context);
      return resultFor(request);
    } catch (error) {
      // Port precommit evidence is accepted only while we have not observed or
      // attempted begin. A later port cannot revoke a durable begin receipt.
      if (context.committed === undefined && error?.purgeCommitted === false) context.committed = false;
      if (context.committed === false) {
        try { await release(context); }
        catch (releaseError) { throw failure(new AggregateError([error, releaseError], '删除未开始，但资源释放失败。'), false); }
      } else if (!context.journal && !context.lifecycle && !context.storage) retained.delete(request.requestId);
      throw failure(error, context.committed !== false);
    }
  }

  function purgeArchivedSession(input) {
    if (closing) return Promise.reject(new PurgeTransactionError('PURGE_UNAVAILABLE', '永久删除服务正在关闭；未接受新请求。', false));
    let request;
    try { request = requestOf(input); } catch (error) { return Promise.reject(error); }
    const active = running.get(request.requestId);
    if (active) {
      if (!sameRequest(active.request, request)) return Promise.reject(new PurgeTransactionError('PURGE_REQUEST_ID_REUSED', '同一永久删除请求凭证不能用于不同会话或版本。', false));
      return active.promise;
    }
    const promise = Promise.resolve().then(() => ports.workspaces.runExclusive(() => execute(request))).catch(error => {
      if (error instanceof PurgeTransactionError) throw error;
      throw failure(error, retained.get(request.requestId)?.committed !== false);
    }).finally(() => { running.delete(request.requestId); });
    running.set(request.requestId, { request, promise });
    return promise;
  }

  function close() {
    if (closePromise) return closePromise;
    closing = true;
    closePromise = (async () => {
      await Promise.allSettled([...running.values()].map(entry => entry.promise));
      const errors = [];
      for (const context of [...retained.values()]) {
        try { await release(context); } catch (error) { errors.push(error); }
      }
      if (errors.length) {
        closePromise = undefined; // explicit close retry can finish failed releases
        throw new AggregateError(errors, '永久删除服务关闭时资源未全部释放。');
      }
    })();
    return closePromise;
  }

  return { purgeArchivedSession, close };
}
