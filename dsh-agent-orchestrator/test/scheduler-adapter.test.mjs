import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from '../scheduler.js';
import { createRuntimeAdapter } from '../runtime-adapter.js';

// Integration regression: the real adapter may own an activation while its
// start() has not yet returned to the real scheduler. Core services are inert.
const OWNER = 'starting-cancel-owner';
const CWD = 'D:\\starting-cancel-fixture';
const clone = value => structuredClone(value);
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function turns(count = 8) { for (let index = 0; index < count; index++) await new Promise(resolve => setImmediate(resolve)); }
async function eventually(predicate, message) {
  for (let index = 0; index < 100; index++) { if (predicate()) return; await turns(1); }
  assert.ok(predicate(), message);
}
function memoryStore(initial = { version: 1, jobs: [], requests: {} }) {
  let current = clone(initial);
  let tail = Promise.resolve();
  return {
    snapshot: () => clone(current),
    update(mutator) {
      const work = tail.then(() => { const draft = clone(current); const result = mutator(draft); current = clone(draft); return clone(result); });
      tail = work.catch(() => {});
      return work;
    },
  };
}
function coreFixture() {
  const listeners = new Map();
  const calls = [];
  const receiptGate = deferred();
  const root = { id: OWNER, options: {}, session: { id: OWNER, header: { delegationDepth: 0 } }, status: 'idle', followup() {}, steer() {} };
  function emit(name, info) { for (const listener of listeners.get(name) ?? []) listener(info); }
  const ctx = {
    on(name, listener) { const group = listeners.get(name) ?? new Set(); listeners.set(name, group); group.add(listener); return () => group.delete(listener); },
    agents: { get: id => id === OWNER ? root : undefined },
    subagents: {
      list: () => ['fake'], getProvider: name => name === 'fake' ? { name: 'fake' } : undefined, resolveMaxDepth: () => 1,
      async startActivation(spec) {
        const call = { spec, childId: `integration-child-${calls.length + 1}`, disposals: 0, result: deferred() };
        calls.push(call);
        if (calls.length === 1) await receiptGate.promise;
        emit('subagent/start', { id: call.childId, provider: spec.provider, runId: `integration-run-${calls.length}` });
        return {
          childId: call.childId,
          result: call.result.promise, // deliberately never settles after cancellation
          async dispose() { call.disposals++; throw new Error('private teardown failure'); },
        };
      },
    },
  };
  return { ctx, root, calls, receiptGate };
}
function request(bindingId, requestId, id) {
  return { ownerSessionId: OWNER, parentBindingId: bindingId, cwd: CWD, provider: 'fake', requestId,
    plan: { title: `Integration ${id}`, tasks: [{ id, title: `Writer ${id}`, prompt: `Implement only writer ${id}`, writeResources: ['D:/Shared/critical-output.js'] }] } };
}

test('scheduler + real adapter: cancel during start with unconfirmed rollback preserves reservations and survives restart', async t => {
  const core = coreFixture();
  const store = memoryStore();
  const adapter = createRuntimeAdapter(core.ctx);
  const binding = adapter.bindParent(OWNER, core.root);
  const scheduler = createScheduler({ store, adapter, readConfig: () => ({ enabled: true, preferredParallelism: 2 }) });
  t.after(async () => { await scheduler.close(); await adapter.close().catch(() => {}); });
  await scheduler.init();
  const first = await scheduler.submit(request(binding.bindingId, 'integration-submit-first-0001', 'A'));
  await eventually(() => core.calls.length === 1, 'core startActivation is pending before it returns a receipt');
  assert.equal(store.snapshot().jobs[0].tasks[0].state, 'starting');
  const second = await scheduler.submit(request(binding.bindingId, 'integration-submit-second-0002', 'B'));
  await turns();
  assert.equal(core.calls.length, 1, 'the second graph cannot overlap the starting writer');

  const before = store.snapshot().jobs.find(job => job.id === first.id);
  let cancelSettled = false;
  const cancelling = scheduler.control({ ownerSessionId: OWNER, jobId: first.id, action: 'cancel', expectedRevision: before.revision, requestId: 'integration-cancel-first-0003' })
    .then(value => { cancelSettled = true; return { value }; }, error => { cancelSettled = true; return { error }; });
  await eventually(() => store.snapshot().jobs[0].cancelRequested === true && core.calls[0].spec.signal.aborted, 'cancel is durable and reaches the still-pending core start');
  assert.equal(cancelSettled, false, 'cancel cannot claim success before rollback is known');
  core.receiptGate.resolve();
  await eventually(() => cancelSettled, 'cancel returns a visible fault despite the permanently pending result');
  const cancellation = await cancelling;
  const report = cancellation.value ?? await scheduler.get({ ownerSessionId: OWNER, jobId: first.id });
  assert.match(JSON.stringify({ report, code: cancellation.error?.code }), /TEARDOWN_UNCONFIRMED/, 'uncertain receipt cleanup is reported as a fault');
  const quarantined = store.snapshot().jobs.find(job => job.id === first.id);
  assert.equal(quarantined.cleanupUncertain, true);
  assert.equal(quarantined.tasks[0].cleanupUncertain, true);
  assert.equal(quarantined.tasks[0].reservationHeld, true, 'the underlying activation still owns declared resources');
  assert.equal(core.calls[0].disposals, 1);
  scheduler.wake({ capacityReleased: true });
  await turns();
  assert.equal(core.calls.length, 1, 'neither cancellation nor a capacity wake can release uncertain ownership');
  assert.equal(store.snapshot().jobs.find(job => job.id === second.id).tasks[0].attempt, 0);

  const persisted = store.snapshot();
  const recoveredStore = memoryStore(persisted);
  const recoveredAdapter = createRuntimeAdapter(core.ctx);
  const newBinding = recoveredAdapter.bindParent(OWNER, core.root);
  const recovered = createScheduler({ store: recoveredStore, adapter: recoveredAdapter, readConfig: () => ({ enabled: true, preferredParallelism: 2 }) });
  t.after(async () => { await recovered.close(); await recoveredAdapter.close().catch(() => {}); });
  await recovered.init();
  recovered.wake({ capacityReleased: true });
  await turns();
  assert.equal(core.calls.length, 1, 'a restart must not clear persistent cleanup uncertainty');
  const recoveredFirst = recoveredStore.snapshot().jobs.find(job => job.id === first.id);
  assert.equal(recoveredFirst.tasks[0].reservationHeld, true);
  const recoveredSecond = recoveredStore.snapshot().jobs.find(job => job.id === second.id);
  await assert.rejects(recovered.control({ ownerSessionId: OWNER, parentBindingId: newBinding.bindingId, jobId: second.id, action: 'rebind', expectedRevision: recoveredSecond.revision, requestId: 'integration-rebind-second-0004' }), error => error.code === 'TEARDOWN_UNCONFIRMED');
  assert.equal(core.calls.length, 1);
});
