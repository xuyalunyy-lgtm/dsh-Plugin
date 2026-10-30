import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from '../scheduler.js';

// Deterministic event tests: receipts are deferred promises, not real models.
const OWNER = 'owner-session-a';
const CWD = 'D:\\scheduler-test-workspace';
let requestCounter = 0;
const requestId = () => `test-request-${String(++requestCounter).padStart(8, '0')}`;
const clone = value => structuredClone(value);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function memoryStore(initial = { version: 1, jobs: [], requests: {} }) {
  let current = clone(initial);
  let tail = Promise.resolve();
  let failure;
  let gate;
  let conditionalFailure;
  let updates = 0;
  return {
    snapshot: () => clone(current),
    failNext(error = Object.assign(new Error('fixture durable failure'), { code: 'STORE_WRITE_FAILED' })) { failure = error; },
    gateNext(value) { gate = value; },
    failWhen(predicate) { conditionalFailure = predicate; },
    get updates() { return updates; },
    update(mutator) {
      const operation = tail.then(async () => {
        const draft = clone(current);
        const result = mutator(draft);
        assert.ok(!result || typeof result.then !== 'function', 'scheduler mutators must be synchronous');
        const pendingGate = gate; gate = undefined;
        if (pendingGate) await pendingGate.promise;
        if (failure) { const error = failure; failure = undefined; throw error; }
        if (conditionalFailure?.(draft)) throw Object.assign(new Error('fixture starting commit failure'), { code: 'STORE_WRITE_FAILED' });
        current = clone(draft);
        updates++;
        return clone(result);
      });
      tail = operation.catch(() => {});
      return operation;
    },
    close: () => tail,
  };
}
function fakeClock() {
  let now = Date.UTC(2026, 9, 30, 0, 0, 0);
  let id = 0;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(fn, delay) { const handle = { id: ++id, unref() {} }; timers.set(handle, { at: now + delay, fn, delay }); return handle; },
    clearTimeout(handle) { timers.delete(handle); },
    get timers() { return [...timers.values()]; },
    async advance(ms) {
      now += ms;
      const due = [...timers].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at);
      for (const [handle, timer] of due) if (timers.delete(handle)) await timer.fn();
      await turns();
    },
  };
}
async function turns(count = 12) { for (let index = 0; index < count; index++) await new Promise(resolve => setImmediate(resolve)); }
async function eventually(predicate, description) {
  for (let index = 0; index < 80; index++) { if (predicate()) return; await turns(1); }
  assert.ok(predicate(), description);
}
const nodes = job => job.tasks ?? job.nodes;
const nodeId = node => node.id ?? node.taskId;
const state = item => item.status ?? item.state;
const jobId = job => job.id ?? job.jobId;
function adapterFixture(store) {
  const starts = [];
  let failStart;
  let startGate;
  let parentGate;
  let parentEntered;
  const adapter = {
    bindParent() { return { id: OWNER }; },
    async assertParent() { if (parentGate) { const pending = parentGate; parentGate = undefined; parentEntered?.resolve(); await pending.promise; } return { id: OWNER }; },
    providers: () => ['fake'],
    notify: async () => {},
    async start(input) {
      const startedSnapshot = store.snapshot();
      const receipt = deferred();
      const call = { input, startedSnapshot, receipt, disposeCount: 0 };
      starts.push(call);
      if (failStart) { const error = failStart; failStart = undefined; throw error; }
      const childId = `child-${starts.length}`;
      if (startGate) { const pending = startGate; startGate = undefined; await pending.promise; }
      return { childId, result: receipt.promise, dispose: async () => {
        call.disposeCount++;
        call.disposeSnapshot = store.snapshot();
        if (call.disposeGate) await call.disposeGate.promise;
        if (call.disposeError) throw call.disposeError;
        receipt.resolve({ outcome: 'cancelled', stopReason: 'disposed', summary: '', truncated: false });
      } };
    },
    close: async () => {},
  };
  return {
    adapter, starts,
    capacityNext() { failStart = Object.assign(new Error('fixture capacity'), { code: 'ACTIVATION_LIMIT_REACHED' }); },
    gateStart(value) { startGate = value; },
    gateParent(value, entered) { parentGate = value; parentEntered = entered; },
    finish(index, outcome = 'succeeded', extra = {}) {
      starts[index].receipt.resolve({ outcome, stopReason: outcome, summary: `result-${index}`, truncated: false, ...extra });
    },
  };
}
async function fixture(t, { config = {}, initial, initialize = true } = {}) {
  const store = memoryStore(initial);
  const clock = fakeClock();
  const runtime = adapterFixture(store);
  const settings = { enabled: true, preferredParallelism: 4, ...config };
  const scheduler = createScheduler({ store, adapter: runtime.adapter, readConfig: () => settings, clock });
  t.after(async () => { await scheduler.close(); });
  if (initialize) await scheduler.init();
  return { ...runtime, store, clock, settings, scheduler,
    submit(plan, extra = {}) { return scheduler.submit({ ownerSessionId: OWNER, cwd: CWD, provider: 'fake', parentBindingId: 'bind-owner-1', requestId: requestId(), plan, ...extra }); },
    get rawJob() { return store.snapshot().jobs.at(-1); },
  };
}
const task = (id, extra = {}) => ({ id, title: `Task ${id}`, prompt: `Implement isolated task ${id}`, ...extra });
const plan = (tasks, extra = {}) => ({ title: 'Deterministic task graph', tasks, ...extra });
const hasCode = code => error => error?.code === code;

test('scheduler: A/B start together, persist starting first, and C follows both receipts without a new user message', async t => {
  const f = await fixture(t);
  await f.submit(plan([task('A'), task('B'), task('C', { dependsOn: ['A', 'B'] })]));
  await eventually(() => f.starts.length === 2, 'A and B dispatch concurrently');
  for (const call of f.starts) {
    const active = nodes(call.startedSnapshot.jobs[0]).filter(node => ['starting', 'running'].includes(state(node)));
    assert.ok(active.length >= 1, 'a durable starting record exists before adapter.start');
  }
  f.finish(0);
  await turns();
  assert.equal(f.starts.length, 2, 'one predecessor is insufficient');
  f.finish(1);
  await eventually(() => f.starts.length === 3, 'completion events automatically dispatch C');
  assert.match(f.starts[2].input.prompt, /task C/);
  f.finish(2);
  await eventually(() => nodes(f.rawJob).every(node => state(node) === 'succeeded'), 'all nodes finish');
});

test('scheduler: overlapping wakes cannot double-start a node while adapter.start is unresolved', async t => {
  const f = await fixture(t, { config: { preferredParallelism: 1 } });
  const startGate = deferred();
  f.gateStart(startGate);
  await f.submit(plan([task('A'), task('B')]));
  await eventually(() => f.starts.length === 1, 'first starting node has reserved the only slot');
  await Promise.all(Array.from({ length: 20 }, () => f.scheduler.wake()));
  assert.equal(f.starts.length, 1);
  startGate.resolve();
  await turns();
  assert.equal(f.starts.length, 1, 'running still occupies the slot');
  f.finish(0);
  await eventually(() => f.starts.length === 2, 'slot released by normalized settlement');
});

test('scheduler: plugin-wide capacity is shared across jobs while graph maxConcurrency is separate', async t => {
  const f = await fixture(t, { config: { preferredParallelism: 3 } });
  await f.submit(plan([task('A'), task('B')], { maxConcurrency: 1 }));
  await f.submit(plan([task('X'), task('Y'), task('Z')], { maxConcurrency: 3 }));
  await eventually(() => f.starts.length === 3, 'global limit permits three activations total');
  const snapshot = f.store.snapshot();
  assert.equal(nodes(snapshot.jobs[0]).filter(node => ['starting', 'running'].includes(state(node))).length, 1);
  assert.equal(snapshot.jobs.flatMap(nodes).filter(node => ['starting', 'running'].includes(state(node))).length, 3);
  await turns();
  assert.equal(f.starts.length, 3);
});

test('scheduler: capacity rejection restores ready and uses one bounded timer without a busy loop', async t => {
  const f = await fixture(t);
  f.capacityNext();
  await f.submit(plan([task('A')]));
  await eventually(() => f.starts.length === 1 && f.clock.timers.length > 0, 'capacity error schedules backoff');
  assert.equal(state(nodes(f.rawJob)[0]), 'ready');
  assert.equal(f.clock.timers.length, 1);
  assert.ok(f.clock.timers[0].delay >= 1000 && f.clock.timers[0].delay <= 30000);
  await Promise.all(Array.from({ length: 15 }, () => f.scheduler.wake()));
  await turns();
  assert.equal(f.starts.length, 1, 'wakes cannot bypass capacity backoff');
  assert.equal(f.clock.timers.length, 1, 'only one backoff timer exists');
  await f.clock.advance(30000);
  await eventually(() => f.starts.length === 2, 'backoff reattempts once');
});

test('scheduler: failed predecessor blocks dependants but independent branch keeps running', async t => {
  const f = await fixture(t);
  await f.submit(plan([task('A'), task('B'), task('C', { dependsOn: ['A'] })]));
  await eventually(() => f.starts.length === 2, 'independent roots start');
  const a = f.starts.findIndex(call => /task A/.test(call.input.prompt));
  const b = a === 0 ? 1 : 0;
  f.finish(a, 'failed', { stopReason: 'fixture failure' });
  f.finish(b);
  await eventually(() => state(nodes(f.rawJob).find(node => nodeId(node) === 'C')) === 'blocked', 'C is blocked');
  assert.equal(state(nodes(f.rawJob).find(node => nodeId(node) === 'B')), 'succeeded');
  assert.equal(f.starts.length, 2);
});

test('scheduler: cancellation is durable before dispose and a late success cannot resurrect successors', async t => {
  const f = await fixture(t);
  await f.submit(plan([task('A'), task('B', { dependsOn: ['A'] })]));
  await eventually(() => f.starts.length === 1, 'A starts');
  // Hold disposal and deliberately resolve a successful late receipt after the
  // cancellation intent has become durable but before teardown finishes.
  const disposeGate = deferred();
  f.starts[0].disposeGate = disposeGate;
  const current = f.rawJob;
  let cancellationResolved = false;
  const cancelling = f.scheduler.control({ ownerSessionId: OWNER, jobId: jobId(current), action: 'cancel', expectedRevision: current.revision, requestId: requestId() }).then(value => { cancellationResolved = true; return value; });
  await eventually(() => f.starts[0].disposeCount === 1, 'cancel waits for the owned activation disposal');
  const persistedAtDispose = f.starts[0].disposeSnapshot.jobs[0];
  assert.equal(persistedAtDispose.cancelRequested, true, 'cancel intent is persisted before disposal');
  assert.equal(cancellationResolved, false, 'cancel must not report completion before teardown');
  f.finish(0, 'succeeded');
  disposeGate.resolve();
  await cancelling;
  await turns();
  assert.equal(f.starts.length, 1);
  assert.ok(nodes(f.rawJob).every(node => state(node) !== 'succeeded'), 'late settlement must not override cancellation generation');
  assert.equal(f.starts[0].disposeCount, 1);
});

test('scheduler: submit idempotency never redispatches and rejects changed parameters', async t => {
  const f = await fixture(t);
  const input = { ownerSessionId: OWNER, cwd: CWD, provider: 'fake', parentBindingId: 'bind-owner-1', requestId: requestId(), plan: plan([task('A')]) };
  const [first, duplicate] = await Promise.all([f.scheduler.submit(input), f.scheduler.submit({ ...clone(input), parentBindingId: 'different-internal-handle' })]);
  assert.equal(jobId(first), jobId(duplicate));
  await eventually(() => f.starts.length === 1, 'only one activation from one idempotent request');
  assert.equal(f.store.snapshot().jobs.length, 1);
  await assert.rejects(f.scheduler.submit({ ...input, plan: plan([task('B')]) }), hasCode('CONFLICT'));
  assert.equal(f.starts.length, 1);
});

test('scheduler: stale revision and wrong owner cannot control a job', async t => {
  const f = await fixture(t);
  await f.submit(plan([task('A')]));
  await eventually(() => f.starts.length === 1, 'root starts');
  const current = f.rawJob;
  await assert.rejects(f.scheduler.control({ ownerSessionId: OWNER, jobId: jobId(current), action: 'pause', expectedRevision: current.revision - 1, requestId: requestId() }), hasCode('CONFLICT'));
  await assert.rejects(f.scheduler.control({ ownerSessionId: 'another-session', jobId: jobId(current), action: 'cancel', expectedRevision: current.revision, requestId: requestId() }));
  assert.equal(f.starts[0].disposeCount, 0);
});

for (const [name, tasks] of [
  ['cycle', [task('A', { dependsOn: ['B'] }), task('B', { dependsOn: ['A'] })]],
  ['duplicate ID', [task('A'), task('A')]],
  ['unknown dependency', [task('A', { dependsOn: ['missing'] })]],
  ['unordered same file ignoring Windows case', [task('A', { writeResources: ['D:\\Repo\\file.js'] }), task('B', { writeResources: ['d:/repo/FILE.js'] })]],
  ['unordered ancestor directory', [task('A', { writeResources: ['D:\\Repo\\src'] }), task('B', { writeResources: ['d:/repo/src/component.js'] })]],
]) {
  test(`scheduler: rejects ${name} before persisting or starting`, async t => {
    const f = await fixture(t);
    await assert.rejects(f.submit(plan(tasks)));
    assert.equal(f.store.snapshot().jobs.length, 0);
    assert.equal(f.starts.length, 0);
  });
}

test('scheduler: ordered file ownership permits a dependent writer', async t => {
  const f = await fixture(t);
  await f.submit(plan([task('A', { writeResources: ['D:\\Repo\\shared.js'] }), task('B', { dependsOn: ['A'], writeResources: ['d:/repo/SHARED.js'] })]));
  await eventually(() => f.starts.length === 1, 'first writer only');
  f.finish(0);
  await eventually(() => f.starts.length === 2, 'second writer follows its dependency');
});

for (const [name, invalidPlan] of [
  ['empty tasks', plan([])],
  ['more than 32 tasks', plan(Array.from({ length: 33 }, (_, index) => task(`N${index}`)))],
  ['zero graph concurrency', plan([task('A')], { maxConcurrency: 0 })],
  ['graph concurrency above eight', plan([task('A')], { maxConcurrency: 9 })],
]) {
  test(`scheduler: rejects ${name}`, async t => {
    const f = await fixture(t);
    await assert.rejects(f.submit(invalidPlan));
    assert.equal(f.store.snapshot().jobs.length, 0);
    assert.equal(f.starts.length, 0);
  });
}

test('scheduler: mutation request IDs enforce the 16–128 character bound', async t => {
  const f = await fixture(t);
  for (const invalid of ['', 'short', 'x'.repeat(129)]) {
    await assert.rejects(f.submit(plan([task('A')]), { requestId: invalid }));
  }
  assert.equal(f.store.snapshot().jobs.length, 0);
});

test('scheduler: disabled scheduling rejects new submit and stops new dispatch without cancelling running work', async t => {
  const f = await fixture(t, { config: { preferredParallelism: 1 } });
  await f.submit(plan([task('A'), task('B')]));
  await eventually(() => f.starts.length === 1, 'A starts before disabling');
  f.settings.enabled = false;
  f.scheduler.wake();
  await turns();
  await assert.rejects(f.submit(plan([task('X')])), hasCode('DISABLED'));
  assert.equal(f.starts[0].disposeCount, 0, 'config change is not cancellation');
  f.finish(0);
  await turns();
  assert.equal(f.starts.length, 1, 'B remains unstarted while disabled');
  f.settings.enabled = true;
  f.scheduler.wake();
  await eventually(() => f.starts.length === 2, 're-enabling and waking resumes eligible work without cancelling A');
});

test('scheduler: pause and resume are idempotent controls and do not duplicate live work', async t => {
  const f = await fixture(t, { config: { preferredParallelism: 1 } });
  await f.submit(plan([task('A'), task('B')]));
  await eventually(() => f.starts.length === 1, 'only A starts');
  let current = f.rawJob;
  const pause = { ownerSessionId: OWNER, jobId: jobId(current), action: 'pause', expectedRevision: current.revision, requestId: requestId() };
  const first = await f.scheduler.control(pause);
  const duplicate = await f.scheduler.control(clone(pause));
  assert.deepEqual(duplicate, first);
  f.finish(0);
  await turns();
  assert.equal(f.starts.length, 1, 'pause prevents dispatching B after A settles');
  current = f.rawJob;
  await f.scheduler.control({ ownerSessionId: OWNER, jobId: jobId(current), action: 'resume', expectedRevision: current.revision, requestId: requestId() });
  await eventually(() => f.starts.length === 2, 'explicit resume dispatches B');
});

test('scheduler: failed durable submit cannot call the runtime adapter', async t => {
  const f = await fixture(t);
  f.store.failNext();
  await assert.rejects(f.submit(plan([task('A')])), hasCode('STORE_FAILED'));
  await turns();
  assert.equal(f.starts.length, 0);
  assert.equal(f.store.snapshot().jobs.length, 0);
});

test('scheduler: failed starting commit never reaches adapter.start or loops dispatch', async t => {
  const f = await fixture(t);
  f.store.failWhen(draft => draft.jobs.some(job => nodes(job).some(node => state(node) === 'starting')));
  try { await f.submit(plan([task('A')])); } catch (error) { assert.equal(error.code, 'STORE_FAILED'); }
  await turns();
  f.scheduler.wake();
  await turns();
  assert.equal(f.starts.length, 0, 'no external side effect before a durable starting transition');
});

test('scheduler: get/list summaries do not expose execution prompts or private paths by default', async t => {
  const f = await fixture(t);
  const submitted = await f.submit(plan([task('A', { prompt: 'PRIVATE-PROMPT-DO-NOT-LEAK', writeResources: ['D:\\\\private\\\\secret.js'] })]));
  const summary = await f.scheduler.get({ ownerSessionId: OWNER, jobId: jobId(submitted) });
  const listing = await f.scheduler.list({ ownerSessionId: OWNER });
  const encoded = JSON.stringify({ summary, listing });
  assert.doesNotMatch(encoded, /PRIVATE-PROMPT-DO-NOT-LEAK|private|secret[.]js|parentBindingId|bindingId|bind-owner-1/);
});

test('scheduler: cross-job overlapping Windows resources serialize while unrelated writers still run', async t => {
  const f = await fixture(t, { config: { preferredParallelism: 3 } });
  await f.submit(plan([task('A', { writeResources: ['D:/Repo/src'] })]));
  await eventually(() => f.starts.length === 1, 'first graph owns src');
  await f.submit(plan([task('B', { writeResources: ['d:/repo/SRC/shared.js'] })]));
  await f.submit(plan([task('C', { writeResources: ['D:/Repo/other.js'] })]));
  await eventually(() => f.starts.length === 2, 'unrelated third graph runs concurrently');
  assert.ok(f.starts.some(call => call.input.label === 'Task C'));
  assert.ok(!f.starts.some(call => call.input.label === 'Task B'), 'overlapping second graph must not start');
  const firstIndex = f.starts.findIndex(call => call.input.label === 'Task A');
  f.finish(firstIndex);
  await eventually(() => f.starts.length === 3, 'release of the unique owner admits the waiting graph');
  assert.equal(f.starts[2].input.label, 'Task B');
});

test('scheduler: only an explicit capacity release wake may bypass outstanding backoff', async t => {
  const f = await fixture(t);
  f.capacityNext();
  await f.submit(plan([task('A')]));
  await eventually(() => f.clock.timers.length === 1, 'capacity delay is active');
  f.scheduler.wake();
  await turns();
  assert.equal(f.starts.length, 1);
  f.scheduler.wake({ capacityReleased: true });
  await eventually(() => f.starts.length === 2, 'core capacity release edge permits prompt retry');
  assert.equal(f.clock.timers.length, 0, 'capacity release clears the old timer');
});

test('scheduler: retry is explicit, attempt-fenced and cannot revive a live or successful node', async t => {
  const f = await fixture(t);
  await f.submit(plan([task('A'), task('B', { dependsOn: ['A'] })]));
  await eventually(() => f.starts.length === 1, 'A starts');
  let current = f.rawJob;
  await assert.rejects(f.scheduler.control({ ownerSessionId: OWNER, jobId: jobId(current), action: 'retry', taskId: 'A', expectedRevision: current.revision, requestId: requestId() }), hasCode('INVALID_STATE'));
  f.finish(0, 'failed');
  await eventually(() => state(nodes(f.rawJob)[0]) === 'failed', 'A failure is durable');
  current = f.rawJob;
  await f.scheduler.control({ ownerSessionId: OWNER, jobId: jobId(current), action: 'retry', taskId: 'A', expectedRevision: current.revision, requestId: requestId() });
  await eventually(() => f.starts.length === 2, 'explicit retry starts one new attempt');
  assert.equal(nodes(f.rawJob)[0].attempt, 2);
  f.finish(1);
  await eventually(() => f.starts.length === 3, 'dependant unlocked only by successful retry');
  current = f.rawJob;
  await assert.rejects(f.scheduler.control({ ownerSessionId: OWNER, jobId: jobId(current), action: 'retry', taskId: 'A', expectedRevision: current.revision, requestId: requestId() }), hasCode('INVALID_STATE'));
});

test('scheduler: disabling while parent validation awaits prevents admission without consuming an attempt', async t => {
  const f = await fixture(t, { config: { preferredParallelism: 1 } });
  await f.submit(plan([task('A'), task('B')]));
  await eventually(() => f.starts.length === 1, 'A occupies the only slot');
  const validation = deferred(); const entered = deferred();
  f.gateParent(validation, entered);
  f.finish(0);
  await entered.promise;
  f.settings.enabled = false;
  validation.resolve();
  await turns();
  assert.equal(f.starts.length, 1, 'no activation may cross a disabled admission fence');
  const b = nodes(f.rawJob).find(node => nodeId(node) === 'B');
  assert.equal(b.state, 'ready');
  assert.equal(b.attempt, 0, 'an unadmitted node does not consume an execution attempt');
  f.settings.enabled = true;
  f.scheduler.wake();
  await eventually(() => f.starts.length === 2, 'explicit enabled wake may now admit B');
});

test('scheduler: unconfirmed teardown fails closed and preserves cross-graph write exclusion', async t => {
  const f = await fixture(t, { config: { preferredParallelism: 2 } });
  await f.submit(plan([task('A', { writeResources: ['D:/Shared/output.js'] })]));
  await eventually(() => f.starts.length === 1, 'first writer is active');
  f.starts[0].disposeError = new Error('fixture teardown unconfirmed');
  await f.submit(plan([task('B', { writeResources: ['d:/shared/OUTPUT.js'] })]));
  const first = f.store.snapshot().jobs[0];
  const cancelling = f.scheduler.control({ ownerSessionId: OWNER, jobId: jobId(first), action: 'cancel', expectedRevision: first.revision, requestId: requestId() }).catch(error => error);
  await eventually(() => f.starts[0].disposeCount === 1, 'exact active writer receives disposal');
  await turns();
  assert.equal(f.starts.length, 1, 'uncertain running side effects retain their write reservation');
  const report = await f.scheduler.get({ ownerSessionId: OWNER, jobId: jobId(first) });
  assert.match(JSON.stringify(report), /TEARDOWN_UNCONFIRMED|CANCEL_CLEANUP_FAILED/, 'uncertain cleanup is visible rather than falsely cancelled');
  f.scheduler.wake({ capacityReleased: true });
  await turns();
  assert.equal(f.starts.length, 1, 'capacity wake cannot release uncertain side-effect ownership');
  // Complete the deferred result only to let the offline fixture close cleanly;
  // this is not proof that a failed disposer actually stopped real side effects.
  f.finish(0, 'failed');
  await cancelling;
  await turns();
  assert.equal(f.starts.length, 1, 'unconfirmed teardown is fail-closed, not a ready signal for another writer');
});

test('scheduler: restart interrupts active nodes and requires owner rebind plus explicit retry', async t => {
  const old = await fixture(t);
  await old.submit(plan([task('A'), task('B', { dependsOn: ['A'] })]));
  await eventually(() => old.starts.length === 1, 'first process starts A');
  const persisted = old.store.snapshot();
  const restarted = await fixture(t, { initial: persisted });
  await turns();
  assert.equal(restarted.starts.length, 0, 'startup must not replay previously active work');
  assert.ok(['paused', 'interrupted'].includes(state(restarted.rawJob)));
  assert.equal(restarted.rawJob.needsReconcile, true);
  assert.equal(state(nodes(restarted.rawJob).find(node => nodeId(node) === 'A')), 'interrupted');
  let current = restarted.rawJob;
  await assert.rejects(restarted.scheduler.control({ ownerSessionId: OWNER, jobId: jobId(current), action: 'retry', taskId: 'A', expectedRevision: current.revision, requestId: requestId() }), hasCode('RECOVERY_REQUIRED'));
  await assert.rejects(restarted.scheduler.control({ ownerSessionId: OWNER, jobId: jobId(current), action: 'resume', expectedRevision: current.revision, requestId: requestId() }), hasCode('RECOVERY_REQUIRED'));
  const rebind = { ownerSessionId: OWNER, jobId: jobId(current), action: 'rebind', parentBindingId: 'bind-owner-restarted', expectedRevision: current.revision, requestId: requestId() };
  await restarted.scheduler.control(rebind);
  const afterRebind = restarted.rawJob;
  await restarted.scheduler.control({ ...rebind, parentBindingId: 'different-replayed-internal-handle' });
  assert.equal(restarted.rawJob.revision, afterRebind.revision, 'replayed rebind does not mutate again');
  current = restarted.rawJob;
  await restarted.scheduler.control({ ownerSessionId: OWNER, jobId: jobId(current), action: 'retry', taskId: 'A', expectedRevision: current.revision, requestId: requestId() });
  current = restarted.rawJob;
  if (state(current) === 'paused') await restarted.scheduler.control({ ownerSessionId: OWNER, jobId: jobId(current), action: 'resume', expectedRevision: current.revision, requestId: requestId() });
  await eventually(() => restarted.starts.length === 1, 'only explicit rebind/retry permits replay');
});
