import test from 'node:test';
import assert from 'node:assert/strict';
import { createPurgeTransaction, PurgeTransactionError } from '../transaction.mjs';

const request = Object.freeze({ sessionId: 'session-cold', requestId: 'purge-request-0001', expectedRevision: 'disk:41' });
const copy = value => structuredClone(value);
const deferred = () => { let resolve; const promise = new Promise(value => { resolve = value; }); return { promise, resolve }; };

// Isolated port implementation only. No user files, runtime services or native
// persistence are imported. Tests verify coordinator control flow, not adapters.
function fixture() {
  const events = [], receipts = new Map(), requestLocks = new Set(), sessionLocks = new Set();
  const lifecycleLocks = new Set(), storageLocks = new Set(), guards = new Set();
  const removed = new Set();
  let fault, blocker, tail = Promise.resolve();
  async function step(name) {
    events.push(name);
    if (blocker?.name === name) { blocker.entered.resolve(); await blocker.resume.promise; blocker = undefined; }
    if (fault?.name === name) { const error = fault.error; fault = undefined; throw error; }
  }
  function refuse(code, message) { return new PurgeTransactionError(code, message, false); }
  const ports = {
    workspaces: {
      runExclusive(operation) { const result = tail.then(operation); tail = result.catch(() => {}); return result; },
      async assertArchived() { await step('archived'); },
      async remove(id) { await step('workspaces'); removed.add(`workspaces:${id}`); },
    },
    journal: {
      async reserve(value) {
        await step('journal.reserve');
        if (requestLocks.has(value.requestId) || sessionLocks.has(value.sessionId)) throw refuse('PURGE_IN_PROGRESS', '原请求仍有独占执行者，请稍后重试。');
        requestLocks.add(value.requestId); sessionLocks.add(value.sessionId);
        return {
          async read() { await step('journal.read'); return copy(receipts.get(value.requestId)); },
          async begin(plan) {
            await step('begin.before');
            if (receipts.has(value.requestId)) throw Error('begin must be CAS');
            if ([...receipts.values()].some(receipt => receipt.request.sessionId === value.sessionId)) throw refuse('PURGE_REQUEST_ID_REUSED', '该会话已绑定其他永久删除请求。');
            receipts.set(value.requestId, { request: copy(value), phase: 'begun', plan: copy(plan) }); guards.add(value.sessionId);
            await step('begin.after');
          },
          async complete() {
            await step('complete.before');
            receipts.get(value.requestId).phase = 'done';
            await step('complete.after');
          },
          async release() { await step('journal.release'); requestLocks.delete(value.requestId); sessionLocks.delete(value.sessionId); },
        };
      },
    },
    lifecycle: {
      async reserve(value) {
        await step('lifecycle.reserve');
        assert(!lifecycleLocks.has(value.sessionId), 'lifecycle reservation must not reenter');
        lifecycleLocks.add(value.sessionId);
        return { async release({ purgeCommitted }) { await step('lifecycle.release'); lifecycleLocks.delete(value.sessionId); if (purgeCommitted) guards.add(value.sessionId); } };
      },
    },
    storage: {
      async reserve(value, committedPlan) {
        await step('storage.reserve');
        assert(!storageLocks.has(value.sessionId), 'writer reservation must not reenter');
        storageLocks.add(value.sessionId);
        const plan = committedPlan ?? { sessionId: value.sessionId, revision: value.expectedRevision, generations: ['v3', 'v4'] };
        events.push(committedPlan ? 'storage.recover-plan' : 'storage.fresh-plan');
        return { plan: copy(plan), async release() { await step('storage.release'); storageLocks.delete(value.sessionId); } };
      },
      async remove(plan) { await step('storage'); removed.add(`storage:${plan.sessionId}`); },
    },
    query: {
      async assertUnreferenced() { await step('references'); },
      async remove(id) { await step('query'); removed.add(`query:${id}`); },
    },
    projections: { async remove(id) { await step('projections'); removed.add(`projections:${id}`); } },
  };
  return {
    ports, events, receipts, guards, removed, requestLocks, sessionLocks, lifecycleLocks, storageLocks,
    fail(name, error = Error(`injected:${name}`)) { fault = { name, error }; },
    block(name) { const entered = deferred(), resume = deferred(); blocker = { name, entered, resume }; return { entered: entered.promise, resume: resume.resolve }; },
    resetEvents() { events.length = 0; },
    get reservations() { return requestLocks.size + sessionLocks.size + lifecycleLocks.size + storageLocks.size; },
  };
}

function expected(value = request) { return { sessionId: value.sessionId, requestId: value.requestId, revision: value.expectedRevision, status: 'deleted' }; }
function rejectsCommitted(promise, committed, code) {
  return assert.rejects(promise, error => error instanceof PurgeTransactionError && error.purgeCommitted === committed && (!code || error.code === code));
}

test('success has a durable begin then ordered idempotent cleanup and done; complete replay does not inspect', async () => {
  const f = fixture(), tx = createPurgeTransaction(f.ports);
  assert.deepEqual(await tx.purgeArchivedSession(request), expected());
  assert.equal(f.receipts.get(request.requestId).phase, 'done');
  assert.equal(f.reservations, 0);
  assert.deepEqual(f.events.filter(name => ['begin.after', 'storage', 'workspaces', 'query', 'projections', 'complete.after'].includes(name)), ['begin.after', 'storage', 'workspaces', 'query', 'projections', 'complete.after']);
  f.resetEvents();
  assert.deepEqual(await tx.purgeArchivedSession(request), expected());
  assert.deepEqual(f.events, ['journal.reserve', 'journal.read', 'journal.release']);
  await tx.close();
});

test('request validation rejects unknown fields, controls and invalid bounds before any port', async () => {
  const f = fixture(), tx = createPurgeTransaction(f.ports);
  for (const input of [null, [], {}, { ...request, extra: true }, { ...request, sessionId: '' }, { ...request, requestId: 'short' }, { ...request, expectedRevision: 'x'.repeat(257) }, { ...request, expectedRevision: 'bad\nvalue' }]) {
    await rejectsCommitted(tx.purgeArchivedSession(input), false, 'PURGE_INVALID_REQUEST');
  }
  assert.deepEqual(f.events, []);
});

for (const stage of ['lifecycle.reserve', 'storage.reserve', 'archived', 'references']) {
  test(`precommit ${stage} failure releases acquired reservations and permits retry`, async () => {
    const f = fixture(), tx = createPurgeTransaction(f.ports);
    f.fail(stage, new PurgeTransactionError('PURGE_SESSION_BUSY', '会话状态暂不允许永久删除。', false));
    await rejectsCommitted(tx.purgeArchivedSession(request), false, 'PURGE_SESSION_BUSY');
    assert.equal(f.receipts.size, 0); assert.equal(f.reservations, 0); assert.equal(f.removed.size, 0);
    assert.deepEqual(await tx.purgeArchivedSession(request), expected());
  });
}

test('definite failed begin is precommit and releases every reservation', async () => {
  const f = fixture(), tx = createPurgeTransaction(f.ports);
  f.fail('begin.before', new PurgeTransactionError('PURGE_CONFLICT', '持久版本已改变。', false));
  await rejectsCommitted(tx.purgeArchivedSession(request), false, 'PURGE_CONFLICT');
  assert.equal(f.reservations, 0); assert.equal(f.receipts.size, 0);
  assert.deepEqual(await tx.purgeArchivedSession(request), expected());
});

test('unknown begin before commit retains reservations; authoritative retry read can establish absence', async () => {
  const f = fixture(), tx = createPurgeTransaction(f.ports);
  f.fail('begin.before');
  await rejectsCommitted(tx.purgeArchivedSession(request), true);
  assert.equal(f.reservations, 4); assert.equal(f.receipts.size, 0);
  assert.deepEqual(await tx.purgeArchivedSession(request), expected());
  assert.equal(f.events.filter(name => name === 'lifecycle.reserve').length, 1);
  assert.equal(f.events.filter(name => name === 'storage.reserve').length, 1);
  assert.equal(f.reservations, 0);
});

for (const stage of ['begin.after', 'storage', 'workspaces', 'query', 'projections', 'complete.before', 'complete.after']) {
  test(`postbegin ${stage} failure retains claims and exact retry rolls forward`, async () => {
    const f = fixture(), tx = createPurgeTransaction(f.ports);
    f.fail(stage, new PurgeTransactionError('PORT_FAILURE', '注入的清理失败。', stage === 'begin.after'));
    await rejectsCommitted(tx.purgeArchivedSession(request), true, 'PORT_FAILURE');
    assert.equal(f.reservations, 4);
    assert(f.guards.has(request.sessionId));
    const failedReceipt = copy(f.receipts.get(request.requestId));
    f.resetEvents();
    assert.deepEqual(await tx.purgeArchivedSession(request), expected());
    assert.equal(f.reservations, 0);
    assert(!f.events.includes('archived')); assert(!f.events.includes('references')); assert(!f.events.includes('begin.before'));
    if (failedReceipt.phase === 'done') assert(!f.events.includes('storage'));
    else assert(f.events.includes('storage'));
    assert.equal(f.removed.size, 4);
  });
}

test('same request in one coordinator joins one in-flight operation; changed parameters reject', async () => {
  const f = fixture(), tx = createPurgeTransaction(f.ports), blocked = f.block('storage');
  const first = tx.purgeArchivedSession(request);
  await blocked.entered;
  const second = tx.purgeArchivedSession({ ...request });
  assert.equal(first, second);
  await rejectsCommitted(tx.purgeArchivedSession({ ...request, expectedRevision: 'disk:42' }), false, 'PURGE_REQUEST_ID_REUSED');
  blocked.resume();
  assert.deepEqual(await first, expected()); assert.deepEqual(await second, expected());
  assert.equal(f.events.filter(name => name === 'storage').length, 1);
});

test('durable completed receipt rejects same request ID with different session or revision', async () => {
  const f = fixture(), tx = createPurgeTransaction(f.ports);
  await tx.purgeArchivedSession(request);
  for (const input of [{ ...request, expectedRevision: 'other' }, { ...request, sessionId: 'other' }]) {
    await rejectsCommitted(tx.purgeArchivedSession(input), false, 'PURGE_REQUEST_ID_REUSED');
  }
  assert.equal(f.reservations, 0);
});

test('two coordinators use the shared workspace chain and do not concurrently enter cleanup', async () => {
  const f = fixture(), left = createPurgeTransaction(f.ports), right = createPurgeTransaction(f.ports), blocked = f.block('storage');
  const first = left.purgeArchivedSession(request);
  await blocked.entered;
  const second = right.purgeArchivedSession(request);
  blocked.resume();
  assert.deepEqual(await first, expected()); assert.deepEqual(await second, expected());
  assert.equal(f.events.filter(name => name === 'storage').length, 1);
});

test('retained transaction excludes another coordinator through journal reservation, not local promises', async () => {
  const f = fixture(), left = createPurgeTransaction(f.ports), right = createPurgeTransaction(f.ports);
  f.fail('query');
  await rejectsCommitted(left.purgeArchivedSession(request), true);
  await rejectsCommitted(right.purgeArchivedSession(request), false, 'PURGE_IN_PROGRESS');
  assert.equal(f.events.filter(name => name === 'storage.reserve').length, 1);
  assert.deepEqual(await left.purgeArchivedSession(request), expected());
  assert.deepEqual(await right.purgeArchivedSession(request), expected());
});

test('different request for retained session cannot enter its lifecycle or writer', async () => {
  const f = fixture(), tx = createPurgeTransaction(f.ports);
  f.fail('storage');
  await rejectsCommitted(tx.purgeArchivedSession(request), true);
  await rejectsCommitted(tx.purgeArchivedSession({ ...request, requestId: 'purge-request-0002' }), false, 'PURGE_IN_PROGRESS');
  assert.equal(f.events.filter(name => name === 'lifecycle.reserve').length, 1);
  await tx.purgeArchivedSession(request);
});

test('journal read uncertainty retains claim, releases no execution resource and exact retry resolves', async () => {
  const f = fixture(), tx = createPurgeTransaction(f.ports);
  f.fail('journal.read');
  await rejectsCommitted(tx.purgeArchivedSession(request), true);
  assert.equal(f.reservations, 2);
  assert.deepEqual(await tx.purgeArchivedSession(request), expected());
});

test('close releases execution resources but keeps committed guard; new instance resumes immutable plan', async () => {
  const f = fixture(), left = createPurgeTransaction(f.ports);
  f.fail('query');
  await rejectsCommitted(left.purgeArchivedSession(request), true);
  await left.close();
  assert.equal(f.reservations, 0); assert(f.guards.has(request.sessionId));
  await rejectsCommitted(left.purgeArchivedSession(request), false, 'PURGE_UNAVAILABLE');
  f.resetEvents();
  const right = createPurgeTransaction(f.ports);
  assert.deepEqual(await right.purgeArchivedSession(request), expected());
  assert(f.events.includes('storage.recover-plan'));
  assert(!f.events.includes('archived')); assert(!f.events.includes('references'));
});

test('close waits for accepted execution then releases without cancelling it', async () => {
  const f = fixture(), tx = createPurgeTransaction(f.ports), blocked = f.block('storage');
  const operation = tx.purgeArchivedSession(request);
  await blocked.entered;
  const closing = tx.close();
  await rejectsCommitted(tx.purgeArchivedSession({ ...request, requestId: 'purge-request-0002' }), false, 'PURGE_UNAVAILABLE');
  blocked.resume();
  assert.deepEqual(await operation, expected()); await closing;
  assert.equal(f.reservations, 0);
});

for (const stage of ['storage.release', 'lifecycle.release', 'journal.release']) {
  test(`completed receipt with ${stage} failure stays committed; exact retry finishes release only`, async () => {
    const f = fixture(), tx = createPurgeTransaction(f.ports);
    f.fail(stage);
    await rejectsCommitted(tx.purgeArchivedSession(request), true);
    assert.equal(f.receipts.get(request.requestId).phase, 'done');
    f.resetEvents();
    assert.deepEqual(await tx.purgeArchivedSession(request), expected());
    assert(!f.events.includes('storage')); assert.equal(f.reservations, 0);
  });
}

test('close release failure is reported and explicit close retry can finish cleanup', async () => {
  const f = fixture(), tx = createPurgeTransaction(f.ports);
  f.fail('storage'); await rejectsCommitted(tx.purgeArchivedSession(request), true);
  f.fail('lifecycle.release'); await assert.rejects(tx.close(), AggregateError);
  assert.equal(f.lifecycleLocks.size, 1);
  await tx.close();
  assert.equal(f.reservations, 0); assert(f.guards.has(request.sessionId));
});
