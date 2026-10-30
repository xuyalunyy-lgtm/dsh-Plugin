import test from 'node:test';
import assert from 'node:assert/strict';
import { delegationDepthOf } from '@deepseek-ai/dsh-subagent';
import { createRuntimeAdapter } from '../runtime-adapter.js';

// This imports the real published depth helper but supplies inert host services.
// startActivation never invokes a provider, model, server or real Agent.
const OWNER = 'adapter-owner-session';
const CWD = 'D:\\adapter-fake-workspace';
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function turns(count = 5) { for (let index = 0; index < count; index++) await new Promise(resolve => setImmediate(resolve)); }
const text = value => [{ type: 'text', text: value }];
function fixture(t, { depth = 0, maxDepth = 1, bind = true } = {}) {
  const listeners = new Map();
  const starts = [];
  const notifications = [];
  const root = { id: OWNER, options: {}, session: { id: OWNER, header: { id: OWNER, delegationDepth: depth } } };
  let currentRoot = root;
  let earlySettlement;
  let gate;
  const ctx = {
    on(name, listener) {
      const group = listeners.get(name) ?? new Set();
      listeners.set(name, group); group.add(listener);
      return () => group.delete(listener);
    },
    effect(fn) { return fn(); },
    logger: { debug() {}, warn() {}, error() {} },
    agents: { get: id => id === OWNER ? currentRoot : undefined },
    subagents: {
      config: { maxDepth, maxActiveSubagents: 8 },
      resolveMaxDepth: () => maxDepth,
      getProvider: name => name === 'fake' ? { name: 'fake', capabilities: { depthLimit: true, agentOptions: false, agentPreset: false, outputSchema: false } } : undefined,
      list: () => ['fake'],
      async startActivation(spec) {
        const result = deferred();
        const id = `adapter-child-${starts.length + 1}`;
        const call = { spec, id, runId: `run-${starts.length + 1}`, result, disposals: 0 };
        starts.push(call);
        emit('subagent/start', { id, provider: spec.provider, runId: call.runId, local: false });
        if (earlySettlement) {
          const settlement = earlySettlement; earlySettlement = undefined;
          emit('subagent/end', { id, provider: spec.provider, runId: call.runId, local: false, stopReason: settlement.end });
          result.resolve({ stopReason: settlement.receipt, output: text(settlement.output ?? 'early completion') });
        }
        if (gate) { const pending = gate; gate = undefined; await pending.promise; }
        return {
          childId: id, result: result.promise,
          async dispose() {
            call.disposals++;
            emit('subagent/end', { id, provider: spec.provider, runId: call.runId, local: false, stopReason: 'aborted' });
            result.resolve({ stopReason: 'aborted', output: [] });
          },
        };
      },
      // Any broad-tree draining is an accidental authority expansion in this adapter.
      drainDescendants() { throw new Error('must not drain unrelated descendants'); },
      drainChildren() { throw new Error('dispose only owned receipts'); },
    },
    sessions: {},
  };
  root.notify = async message => { notifications.push(message); };
  function emit(name, info, parent = root) {
    const scope = { agent: parent, parent, session: parent.session };
    for (const listener of listeners.get(name) ?? []) listener.call(scope, info, parent);
  }
  const adapter = createRuntimeAdapter(ctx);
  const binding = bind ? adapter.bindParent(OWNER, root) : null;
  t.after(async () => { await adapter.close?.(); });
  return {
    adapter, binding, ctx, root, starts, notifications, emit, listenerCount: () => [...listeners.values()].reduce((sum, group) => sum + group.size, 0),
    replaceRoot(value) { currentRoot = value; },
    early(end = 'completed', receipt = end, output) { earlySettlement = { end, receipt, output }; },
    gateStart(value) { gate = value; },
    start(extra = {}) { return adapter.start({ parentSessionId: OWNER, bindingId: binding?.bindingId, provider: 'fake', cwd: CWD, prompt: 'Implement a bounded fake task', label: 'Adapter contract', signal: new AbortController().signal, ...extra }); },
    settle(index, { end = 'completed', receipt = end, output = 'done', runId, provider } = {}) {
      const call = starts[index];
      if (end !== null) emit('subagent/end', { id: call.id, provider: provider ?? call.spec.provider, runId: runId ?? call.runId, local: false, stopReason: end });
      call.result.resolve({ stopReason: receipt, output: text(output) });
    },
  };
}

test('adapter: uses the exact registered root, caller delivery and real core depth accounting', async t => {
  const f = fixture(t);
  assert.equal(delegationDepthOf(f.root), 0);
  const activation = await f.start();
  const { spec } = f.starts[0];
  assert.equal(spec.delivery, 'caller');
  assert.equal(spec.request.parent, f.root);
  assert.equal(spec.request.cwd, CWD);
  assert.deepEqual(spec.request.prompt, text('Implement a bounded fake task'));
  assert.equal(spec.provider, 'fake');
  f.settle(0);
  const result = await activation.result;
  assert.equal(result.outcome, 'succeeded');
  assert.equal(result.summary, 'done');
});

test('adapter: persisted child depth cannot be lowered by runtime options', async t => {
  const f = fixture(t, { depth: 1, bind: false });
  f.root.options.subagentDepth = 0;
  assert.equal(delegationDepthOf(f.root), 1);
  await assert.rejects(f.start());
  assert.equal(f.starts.length, 0);
});

test('adapter: unavailable parent, unknown provider, and exhausted depth reject before activation', async t => {
  const f = fixture(t, { maxDepth: 0 });
  await assert.rejects(f.start());
  assert.equal(f.starts.length, 0);
  const g = fixture(t);
  await assert.rejects(g.start({ provider: 'missing-provider' }));
  g.replaceRoot(undefined);
  await assert.rejects(g.start());
  assert.equal(g.starts.length, 0);
});

test('adapter: captures lifecycle completion emitted before startActivation returns the receipt', async t => {
  const f = fixture(t);
  f.early();
  const activation = await f.start();
  assert.equal((await activation.result).outcome, 'succeeded');
});

test('adapter: end error overrides completed receipt and cannot unblock a successor as success', async t => {
  const f = fixture(t);
  const activation = await f.start();
  f.settle(0, { end: 'error', receipt: 'completed' });
  assert.equal((await activation.result).outcome, 'failed');
});

test('adapter: receipt-only completion fails closed when matching lifecycle end is absent', async t => {
  const f = fixture(t);
  const activation = await f.start();
  f.settle(0, { end: null, receipt: 'completed' });
  await assert.rejects(activation.result, error => error.code === 'SETTLEMENT_UNCONFIRMED');
});

test('adapter: mismatched run/provider events cannot attest a receipt', async t => {
  const f = fixture(t);
  const activation = await f.start();
  f.settle(0, { runId: 'some-other-run', provider: 'some-other-provider', receipt: 'completed' });
  await assert.rejects(activation.result, error => error.code === 'SETTLEMENT_UNCONFIRMED');
});

test('adapter: end completed cannot hide an error receipt', async t => {
  const f = fixture(t);
  const activation = await f.start();
  f.settle(0, { end: 'completed', receipt: 'error' });
  assert.equal((await activation.result).outcome, 'failed');
});

test('adapter: summary text is bounded and truncation is reported', async t => {
  const f = fixture(t);
  const activation = await f.start();
  f.settle(0, { output: 'X'.repeat(20000) });
  const result = await activation.result;
  assert.equal(result.outcome, 'succeeded');
  assert.ok(result.summary.length <= 8192);
  assert.equal(result.truncated, true);
});

test('adapter: rejected receipt errors stay failed and expose no raw provider exception', async t => {
  const f = fixture(t);
  const activation = await f.start();
  f.starts[0].result.reject(new Error('private provider failure'));
  await assert.rejects(activation.result, error => error.code === 'RUNTIME_FAILURE' && !error.message.includes('private provider failure'));
});

test('adapter: aborted signal after receipt publication disposes the owned activation', async t => {
  const f = fixture(t);
  const abort = new AbortController();
  const activation = await f.start({ signal: abort.signal });
  abort.abort();
  await turns();
  assert.equal(f.starts[0].disposals, 1);
  assert.equal((await activation.result).outcome, 'cancelled');
});

test('adapter: abort while start is pending disposes the eventually returned receipt', async t => {
  const f = fixture(t);
  const gate = deferred();
  const abort = new AbortController();
  f.gateStart(gate);
  const starting = f.start({ signal: abort.signal });
  await turns();
  abort.abort();
  gate.resolve();
  try {
    const activation = await starting;
    assert.equal((await activation.result).outcome, 'cancelled');
  } catch (error) {
    assert.ok(error.name === 'AbortError' || error.code === 'ABORTED' || error.code === 'CANCELLED');
  }
  assert.equal(f.starts[0].disposals, 1);
});

test('adapter: close releases only owned receipts and unregisters its lifecycle observers', async t => {
  const f = fixture(t);
  const activation = await f.start();
  await f.adapter.close();
  assert.equal(f.starts[0].disposals, 1);
  assert.equal((await activation.result).outcome, 'cancelled');
  await f.adapter.close();
  assert.equal(f.starts[0].disposals, 1, 'owned teardown is idempotent');
  assert.equal(f.listenerCount(), 0, 'close unregisters the exact two lifecycle subscriptions');
});

test('adapter: provider enumeration never invents fallback capacity or an unregistered provider', async t => {
  const f = fixture(t);
  f.ctx.subagents.list = () => ['codex', 'fork', 'fork', '', null, { name: 'not-public-contract' }];
  assert.deepEqual(f.adapter.providers(), ['fork', 'codex']);
  f.ctx.subagents.list = () => ['codex'];
  assert.deepEqual(f.adapter.providers(), ['codex'], 'no implicit fork is invented');
  f.ctx.subagents.startActivation = async () => { throw Object.assign(new Error('private capacity path'), { code: 'ACTIVATION_LIMIT_REACHED' }); };
  await assert.rejects(f.start(), error => error.code === 'ACTIVATION_LIMIT_REACHED' && !error.message.includes('private capacity path'));
});

test('adapter: stale end from before this activation fence cannot attest a reused child identity', async t => {
  const f = fixture(t);
  const stale = { id: 'adapter-child-1', provider: 'fake', runId: 'prior-run', local: false };
  f.emit('subagent/start', stale); f.emit('subagent/end', { ...stale, stopReason: 'completed' });
  const activation = await f.start();
  f.settle(0, { end: null, receipt: 'completed' });
  await assert.rejects(activation.result, error => error.code === 'SETTLEMENT_UNCONFIRMED');
});

test('adapter: exact parent registry identity is required and no pre-aborted request starts work', async t => {
  const f = fixture(t);
  f.replaceRoot({ ...f.root, session: { ...f.root.session, id: 'different-session' } });
  await assert.rejects(f.start(), error => error.code === 'PARENT_UNAVAILABLE');
  f.replaceRoot(f.root);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(f.start({ signal: abort.signal }), error => error.code === 'CANCELLED');
  assert.equal(f.starts.length, 0);
});

test('adapter: explicit bindings pin exact Agent incarnation and never broaden an older graph capability', async t => {
  const f = fixture(t, { bind: false });
  await assert.rejects(f.start(), error => error.code === 'PARENT_UNAVAILABLE');
  const first = f.adapter.bindParent(OWNER, f.root);
  const same = f.adapter.bindParent(OWNER, f.root);
  assert.equal(first.bindingId, same.bindingId, 'same exact Agent reuses the opaque capability');
  assert.deepEqual(f.adapter.assertParent(OWNER, first.bindingId), { id: OWNER, depth: 0 });
  const replacementMessages = [];
  const replacement = { ...f.root, options: {}, session: { ...f.root.session }, status: 'idle', followup: value => replacementMessages.push(value) };
  f.replaceRoot(replacement);
  assert.throws(() => f.adapter.assertParent(OWNER, first.bindingId), error => error.code === 'PARENT_UNAVAILABLE');
  await assert.rejects(f.start({ bindingId: first.bindingId }), error => error.code === 'PARENT_UNAVAILABLE');
  assert.equal(await f.adapter.notify(OWNER, 'Old graph terminal notice', first.bindingId), false);
  assert.equal(replacementMessages.length, 0, 'old graph must not wake a replacement Agent');
  const second = f.adapter.bindParent(OWNER, replacement);
  assert.notEqual(second.bindingId, first.bindingId, 'new incarnation requires a newly explicit capability');
  assert.throws(() => f.adapter.assertParent(OWNER, first.bindingId), error => error.code === 'PARENT_UNAVAILABLE', 'rebind of graph one cannot fix graph two implicitly');
  const activation = await f.start({ bindingId: second.bindingId });
  assert.equal(f.starts[0].spec.request.parent, replacement);
  f.settle(0);
  assert.equal((await activation.result).outcome, 'succeeded');
});

test('adapter: invalid receipt rollback failure preserves TEARDOWN_UNCONFIRMED instead of admission failure', async t => {
  const f = fixture(t);
  let disposals = 0;
  f.ctx.subagents.startActivation = async () => ({
    childId: 'invalid-receipt-child', result: null,
    async dispose() { disposals++; throw new Error('private invalid receipt rollback failed'); },
  });
  await assert.rejects(f.start(), error => error.code === 'TEARDOWN_UNCONFIRMED' && !error.message.includes('private invalid receipt rollback failed'));
  assert.equal(disposals, 1, 'rollback is attempted exactly once, without pretending the activation is gone');
});

test('adapter: terminal notices wake only the original root and never pretend to be new user authorization', async t => {
  const f = fixture(t);
  const messages = [];
  f.root.status = 'idle';
  f.root.followup = message => messages.push({ method: 'followup', message });
  f.root.steer = message => messages.push({ method: 'steer', message });
  assert.equal(await f.adapter.notify(OWNER, 'Graph completed; verify evidence.', f.binding.bindingId), true);
  assert.equal(messages[0].method, 'followup');
  assert.match(JSON.stringify(messages[0].message), /不是新的用户授权/);
  f.root.status = 'running';
  assert.equal(await f.adapter.notify(OWNER, 'Graph failed.', f.binding.bindingId), true);
  assert.equal(messages[1].method, 'steer');
  assert.equal(await f.adapter.notify('another-session', 'not allowed'), false);
  assert.equal(messages.length, 2);
});
