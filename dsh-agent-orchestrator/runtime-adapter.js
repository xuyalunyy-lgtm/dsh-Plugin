import { randomUUID } from 'node:crypto';
import { delegationDepthOf } from '@deepseek-ai/dsh-subagent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';

const SUMMARY_LIMIT = 8192;
const EVENT_LIMIT = 256;
const EVENT_TTL_MS = 60_000;
const BINDING_LIMIT = 256;
const STOP_REASONS = new Set(['completed', 'aborted', 'error', 'refusal', 'max-tokens']);
const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const MESSAGES = Object.freeze({
  PARENT_UNAVAILABLE: '任务图的原父会话当前不可用；需要显式重新绑定同一存活根会话。',
  PROVIDER_UNAVAILABLE: '所选子智能体 provider 当前不可用，请检查已注册 provider。',
  DEPTH_LIMIT: '任务图仅允许存活根智能体派工，并遵守宿主委派深度上限。',
  INVALID_REQUEST: '子任务启动参数无效。',
  UNAVAILABLE: '当前宿主缺少任务调度所需的公开服务。',
  CLOSED: '任务调度适配器已关闭。',
  CANCELLED: '子任务启动已取消。',
  ACTIVATION_LIMIT_REACHED: '宿主子智能体容量已满，等待已运行任务释放容量后再调度。',
  RUNTIME_FAILURE: '子智能体运行或收尾失败；未输出原始异常。',
  INVALID_RECEIPT: '宿主返回了无法识别的子智能体运行句柄。',
  SETTLEMENT_UNCONFIRMED: '未收到与当前运行句柄匹配的完整结束事件；不将任务视为成功。',
  TEARDOWN_UNCONFIRMED: '子智能体可能已启动，但未能确认取消与资源收尾完成；必须隔离相关任务和资源，不得按启动失败释放后继续派工。',
  BINDING_LIMIT_REACHED: '当前实例的授权绑定已达上限，不会自动驱逐仍用绑定。请先核对并结束任务，再按维护流程重载插件；重载后须显式重新绑定。',
});

function failure(code, fallback = 'RUNTIME_FAILURE') {
  const safe = typeof code === 'string' && SAFE_CODE.test(code) ? code : fallback;
  return Object.assign(new Error(MESSAGES[safe] ?? MESSAGES.RUNTIME_FAILURE), { code: safe });
}
function sanitized(error) {
  if (error?.name === 'SubagentDepthError') return failure('DEPTH_LIMIT');
  return failure(error?.code);
}

/** Extract text only, without serializing images, reasoning, tool calls or errors. */
function summarize(output) {
  let summary = '';
  let truncated = false;
  if (!Array.isArray(output)) return { summary, truncated };
  for (const block of output) {
    if (block?.type !== 'text' || typeof block.text !== 'string' || block.text.length === 0) continue;
    const separator = summary.length > 0 ? '\n' : '';
    const room = SUMMARY_LIMIT - summary.length;
    if (separator.length + block.text.length > room) {
      const piece = separator + block.text.slice(0, Math.max(0, room - separator.length));
      summary += piece.slice(0, room);
      truncated = true;
      break;
    }
    summary += separator + block.text;
  }
  // Do not publish half of a UTF-16 surrogate pair at the clipping boundary.
  if (truncated && /[\uD800-\uDBFF]$/.test(summary)) summary = summary.slice(0, -1);
  return { summary, truncated };
}

/**
 * Bridge a task-graph engine to managed DSH activations. Nothing here creates a
 * replacement parent, bypasses depth/capacity, or persists Agent/Promise objects.
 */
export function createRuntimeAdapter(ctx) {
  let closed = false;
  let closeWork;
  let eventSequence = 0;
  const epochs = new Map();
  const owned = new Set();
  const startups = new Set();
  const bindings = new Map();
  let bindingByAgent = new WeakMap();
  const subscriptions = [];

  function pruneEvents() {
    const cutoff = Date.now() - EVENT_TTL_MS;
    for (const [runId, epoch] of epochs) {
      if (epoch.owner || epoch.at >= cutoff) continue;
      epochs.delete(runId);
    }
    while (epochs.size > EVENT_LIMIT) {
      const candidate = [...epochs].find(([, epoch]) => !epoch.owner);
      if (!candidate) break; // active owned epochs are bounded by core capacity
      epochs.delete(candidate[0]);
    }
  }
  function observe(kind, event) {
    if (closed || !event || typeof event.id !== 'string' || typeof event.runId !== 'string'
      || typeof event.provider !== 'string') return;
    let epoch = epochs.get(event.runId);
    if (epoch && (epoch.childId !== event.id || epoch.provider !== event.provider)) return;
    if (!epoch) {
      epoch = { childId: event.id, provider: event.provider, sequence: ++eventSequence,
        at: Date.now(), started: false, stopReason: null, owner: null };
      epochs.set(event.runId, epoch);
    }
    if (kind === 'start') epoch.started = true;
    else if (epoch.stopReason === null) {
      epoch.stopReason = STOP_REASONS.has(event.stopReason) ? event.stopReason : 'error';
    }
    epoch.at = Date.now();
    pruneEvents();
  }
  if (typeof ctx?.on !== 'function') throw failure('UNAVAILABLE');
  try {
    subscriptions.push(ctx.on('subagent/start', event => observe('start', event)));
    subscriptions.push(ctx.on('subagent/end', event => observe('end', event)));
  } catch {
    for (const dispose of subscriptions) if (typeof dispose === 'function') dispose();
    throw failure('UNAVAILABLE');
  }

  function exactRoot(parentSessionId, parent) {
    if (closed) throw failure('CLOSED');
    if (typeof parentSessionId !== 'string' || parentSessionId.length === 0
      || typeof ctx.agents?.get !== 'function' || !parent
      || ctx.agents.get(parentSessionId) !== parent || parent.id !== parentSessionId
      || parent.session?.id !== parentSessionId) throw failure('PARENT_UNAVAILABLE');
    let depth;
    try { depth = delegationDepthOf(parent); }
    catch { throw failure('DEPTH_LIMIT'); }
    if (depth !== 0) throw failure('DEPTH_LIMIT');
    return parent;
  }
  // Called only by an explicitly authorized root tool operation. In particular,
  // get/list/start/notify never turn a stored session id into fresh authority.
  function bindParent(parentSessionId, expectedAgent) {
    const parent = exactRoot(parentSessionId, expectedAgent);
    const existingId = bindingByAgent.get(parent);
    if (existingId && bindings.get(existingId)?.agent === parent) {
      return { bindingId: existingId, id: parent.id, depth: 0 };
    }
    if (bindings.size >= BINDING_LIMIT) throw failure('BINDING_LIMIT_REACHED');
    const bindingId = randomUUID();
    bindings.set(bindingId, { sessionId: parentSessionId, agent: parent });
    bindingByAgent.set(parent, bindingId);
    return { bindingId, id: parent.id, depth: 0 };
  }
  function liveParent(parentSessionId, bindingId) {
    const binding = typeof bindingId === 'string' ? bindings.get(bindingId) : undefined;
    if (!binding || binding.sessionId !== parentSessionId) throw failure('PARENT_UNAVAILABLE');
    return exactRoot(parentSessionId, binding.agent);
  }
  function providers() {
    if (closed || typeof ctx.subagents?.list !== 'function') return [];
    const values = ctx.subagents.list();
    if (!Array.isArray(values)) return [];
    const names = [...new Set(values.filter(value => typeof value === 'string' && value.length > 0))];
    // Prefer a registered in-process fork; never invent it or fall back to Codex.
    return names.includes('fork') ? ['fork', ...names.filter(name => name !== 'fork')] : names;
  }
  function assertParent(parentSessionId, bindingId) {
    const parent = liveParent(parentSessionId, bindingId);
    return { id: parent.id, depth: 0 };
  }
  function bindEpoch(record) {
    const candidates = [...epochs.entries()].filter(([, epoch]) => epoch.sequence > record.fence
      && epoch.started && epoch.childId === record.receipt.childId && epoch.provider === record.provider
      && !epoch.owner);
    if (candidates.length !== 1) return;
    const [runId, epoch] = candidates[0];
    epoch.owner = record;
    record.runId = runId;
    record.epoch = epoch;
  }
  function detachSignal(record) {
    record.signal?.removeEventListener('abort', record.abort);
  }
  function releaseRecord(record) {
    detachSignal(record);
    owned.delete(record);
    if (record.runId && epochs.get(record.runId)?.owner === record) epochs.delete(record.runId);
    record.epoch = null;
  }
  function disposeRecord(record) {
    if (!record.disposal) {
      // Assign before invoking the core disposer, including synchronous reentry.
      record.disposal = Promise.resolve().then(() => record.receipt.dispose()).catch(() => {
        // The backend may still own a running child or its write resources. This
        // is not an ordinary admission failure, even before start() returns.
        throw failure('TEARDOWN_UNCONFIRMED');
      });
      // Abort callbacks have no awaiting caller; retain rejection for result/close.
      void record.disposal.catch(() => {});
    }
    return record.disposal;
  }
  function normalizeResult(record, result) {
    const receiptStop = STOP_REASONS.has(result?.stopReason) ? result.stopReason : 'error';
    const endStop = record.epoch?.stopReason;
    let stopReason = receiptStop;
    // Core emits end before resolving result. Disposal can fail while the result
    // still says completed, so only matched, successfully ended epochs succeed.
    if (receiptStop === 'completed' && !endStop) throw failure('SETTLEMENT_UNCONFIRMED');
    if (endStop === 'error' || (receiptStop === 'completed' && endStop !== 'completed')) stopReason = 'error';
    else if (endStop && endStop !== receiptStop) stopReason = endStop === 'aborted' ? 'aborted' : 'error';
    return {
      outcome: stopReason === 'completed' ? 'succeeded' : stopReason === 'aborted' ? 'cancelled' : 'failed',
      stopReason,
      ...summarize(result?.output),
    };
  }

  function start(options = {}) {
    const work = begin(options);
    const item = { work, controller: null };
    // begin installs its startup controller synchronously before its first await.
    item.controller = work.controller;
    startups.add(item);
    void work.then(() => startups.delete(item), () => startups.delete(item));
    return work;
  }
  function begin({ parentSessionId, bindingId, provider, cwd, prompt, label, signal } = {}) {
    let parent;
    let maxDepth;
    try {
      parent = liveParent(parentSessionId, bindingId);
      if (typeof ctx.subagents?.getProvider !== 'function'
        || typeof ctx.subagents?.startActivation !== 'function'
        || typeof ctx.subagents?.resolveMaxDepth !== 'function') throw failure('UNAVAILABLE');
      if (typeof provider !== 'string' || !ctx.subagents.getProvider(provider)) throw failure('PROVIDER_UNAVAILABLE');
      if (typeof prompt !== 'string' || prompt.trim().length === 0 || typeof label !== 'string'
        || label.trim().length === 0 || (cwd !== undefined && typeof cwd !== 'string')
        || (signal !== undefined && (typeof signal.addEventListener !== 'function'
          || typeof signal.removeEventListener !== 'function' || typeof signal.aborted !== 'boolean'))) {
        throw failure('INVALID_REQUEST');
      }
      maxDepth = ctx.subagents.resolveMaxDepth(undefined);
      if (maxDepth !== undefined && (!Number.isSafeInteger(maxDepth) || maxDepth < 1)) throw failure('DEPTH_LIMIT');
      if (signal?.aborted) throw failure('CANCELLED');
    } catch (error) { return Promise.reject(sanitized(error)); }
    const controller = new AbortController();
    const record = { provider, signal, fence: eventSequence, receipt: null, epoch: null,
      runId: null, disposal: null, abort: null };
    record.abort = () => {
      controller.abort();
      if (record.receipt) void disposeRecord(record).catch(() => {});
    };
    signal?.addEventListener('abort', record.abort, { once: true });
    if (signal?.aborted) record.abort();
    const work = (async () => {
      try {
        const receipt = await ctx.subagents.startActivation({
          provider, label,
          request: { parent, prompt: [{ type: 'text', text: prompt }],
            ...(cwd === undefined ? {} : { cwd }), maxDepth },
          signal: controller.signal,
          delivery: 'caller',
        });
        if (!receipt || typeof receipt.childId !== 'string' || !receipt.result
          || typeof receipt.result.then !== 'function' || typeof receipt.dispose !== 'function') {
          if (typeof receipt?.dispose === 'function') {
            try { await receipt.dispose(); }
            catch { throw failure('TEARDOWN_UNCONFIRMED'); }
          } else if (receipt) {
            // A malformed accepted handle with no cleanup capability cannot
            // prove that an externally started execution released resources.
            throw failure('TEARDOWN_UNCONFIRMED');
          }
          throw failure('INVALID_RECEIPT');
        }
        record.receipt = receipt;
        owned.add(record);
        bindEpoch(record);
        const result = Promise.resolve(receipt.result).then(async value => {
          if (record.disposal) await record.disposal;
          return normalizeResult(record, value);
        }, error => { throw sanitized(error); }).finally(() => releaseRecord(record));
        void result.catch(() => {});
        record.result = result;
        if (closed || controller.signal.aborted) {
          await disposeRecord(record);
          throw failure(closed ? 'CLOSED' : 'CANCELLED');
        }
        return { childId: receipt.childId, result, dispose: () => disposeRecord(record) };
      } catch (error) {
        if (!record.receipt) detachSignal(record);
        if (!record.receipt && controller.signal.aborted && (error?.name === 'AbortError' || error?.code === 'ABORT_ERR')) {
          throw failure(closed ? 'CLOSED' : 'CANCELLED');
        }
        throw sanitized(error);
      }
    })();
    // Private startup cancellation capability, never returned in a run receipt.
    Object.defineProperty(work, 'controller', { value: controller });
    return work;
  }

  async function notify(parentSessionId, text, bindingId) {
    if (typeof text !== 'string' || text.trim().length === 0) return false;
    let parent;
    try { parent = liveParent(parentSessionId, bindingId); } catch { return false; }
    const clipped = summarize([{ type: 'text', text }]);
    const message = createUserMessage({
      content: [{ type: 'text', text: '[主控调度任务图事件通知；不是新的用户授权。请核对交付与验证证据。]\n'
        + clipped.summary + (clipped.truncated ? '\n[通知已截断]' : '') }],
      source: { kind: 'agent-orchestrator', form: 'notice', summary: '主控调度任务图已到终态，等待主智能体验收。' },
    });
    try {
      if (parent.status === 'idle' && typeof parent.followup === 'function') parent.followup(message);
      else if (typeof parent.steer === 'function') parent.steer(message);
      else if (typeof parent.followup === 'function') parent.followup(message);
      else return false; // inject alone is not a reliable wake; do not claim one.
      return true;
    } catch { return false; }
  }

  function close() {
    if (closeWork) return closeWork;
    closed = true;
    for (const item of startups) item.controller?.abort();
    closeWork = (async () => {
      const failures = [];
      for (const dispose of subscriptions.splice(0)) {
        try { if (typeof dispose === 'function') dispose(); }
        catch (error) { failures.push(sanitized(error)); }
      }
      const running = [...owned];
      const disposals = running.map(record => disposeRecord(record));
      const startupResults = await Promise.allSettled([...startups].map(item => item.work));
      for (const settled of startupResults) {
        if (settled.status === 'rejected' && !['CLOSED', 'CANCELLED'].includes(settled.reason?.code)) {
          failures.push(sanitized(settled.reason));
        }
      }
      for (const record of owned) if (!running.includes(record)) disposals.push(disposeRecord(record));
      for (const settled of await Promise.allSettled(disposals)) {
        if (settled.status === 'rejected') failures.push(sanitized(settled.reason));
      }
      for (const record of owned) detachSignal(record);
      epochs.clear();
      owned.clear();
      bindings.clear();
      bindingByAgent = new WeakMap();
      if (failures.length > 0) {
        throw failure(failures.some(error => error.code === 'TEARDOWN_UNCONFIRMED')
          ? 'TEARDOWN_UNCONFIRMED' : 'RUNTIME_FAILURE');
      }
    })();
    void closeWork.catch(() => {});
    return closeWork;
  }

  return { start, bindParent, assertParent, providers, notify, close };
}
