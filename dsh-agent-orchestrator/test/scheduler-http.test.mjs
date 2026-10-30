import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createScheduler } from '../scheduler.js';
import { createPlansHttpHandler, PLANS_PATH } from '../controller.js';

// Real scheduler -> real read-only HTTP handler -> real client validator.
// HTTP requests are plain objects; this file never creates a server or model.
const OWNER = 'http-projection-private-owner';
const CWD = 'D:\\private-http-projection-workspace';
const PROMPT = 'PRIVATE-PROMPT-HTTP-DO-NOT-LEAK';
const clone = value => structuredClone(value);
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
async function eventually(check, message) {
  for (let index = 0; index < 80; index++) { if (check()) return; await new Promise(resolve => setImmediate(resolve)); }
  assert.ok(check(), message);
}
function memoryStore() {
  let data = { version: 1, jobs: [], requests: {} };
  let tail = Promise.resolve();
  return {
    snapshot: () => clone(data),
    update(mutator) {
      const work = tail.then(() => { const draft = clone(data); const result = mutator(draft); data = clone(draft); return clone(result); });
      tail = work.catch(() => {});
      return work;
    },
  };
}
function response() {
  return {
    headersSent: false, destroyed: false,
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; },
    end(body) { this.body = JSON.parse(body); },
  };
}
async function request(handler, suffix = '', method = 'GET') {
  const res = response();
  await handler({ method, url: `${PLANS_PATH}${suffix}`, headers: {} }, res);
  return res;
}
async function clientValidator() {
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
  const start = source.indexOf('        const PLAN_STATES =');
  const end = source.indexOf('        function TaskBoard()', start);
  assert.ok(start > 0 && end > start, 'client validation contract is present');
  return vm.runInNewContext(`(() => { ${source.slice(start, end)}; return validatePlan; })()`);
}
async function fixture(t) {
  const store = memoryStore();
  const calls = [];
  const scheduler = createScheduler({ store, adapter: {
    assertParent(id) { assert.equal(id, OWNER); }, providers: () => ['fake'], notify: () => {},
    async start(input) {
      const outcome = deferred(); const call = { input, outcome }; calls.push(call);
      return { childId: 'http-child-1', result: outcome.promise, dispose: async () => outcome.resolve({ outcome: 'cancelled', stopReason: 'aborted', summary: '', truncated: false }) };
    },
  }, readConfig: () => ({ enabled: true, preferredParallelism: 4 }) });
  await scheduler.init();
  t.after(() => scheduler.close());
  const handler = createPlansHttpHandler({ requestRejection: () => undefined }, () => scheduler);
  const submitted = await scheduler.submit({ ownerSessionId: OWNER, cwd: CWD, provider: 'fake', parentBindingId: 'private-http-binding', requestId: 'http-submit-request-0001', plan: {
    title: 'HTTP contract integration', maxConcurrency: 2,
    tasks: [{ id: 'A', title: 'Project safely', prompt: PROMPT, writeResources: ['src/output.js'], acceptance: 'Report unverified execution evidence' }],
  } });
  await eventually(() => calls.length === 1 && store.snapshot().jobs[0].tasks[0].state === 'running', 'real scheduler publishes running task');
  return { store, scheduler, handler, submitted, calls };
}
function assertNoAuthorityLeak(value) {
  const encoded = JSON.stringify(value);
  for (const secret of [OWNER, CWD, PROMPT]) assert.ok(!encoded.includes(secret), 'response omits parent authority, cwd and full prompt');
  function walk(item) {
    if (!item || typeof item !== 'object') return;
    for (const [key, value] of Object.entries(item)) { assert.ok(!['ownerSessionId', 'parentSessionId', 'parentBindingId', 'bindingId', 'cwd', 'prompt', 'requests'].includes(key)); walk(value); }
  }
  walk(value);
}

test('scheduler HTTP: running and completed summaries retain the exact client-readable shape', async t => {
  const f = await fixture(t);
  const validatePlan = await clientValidator();
  const list = await request(f.handler);
  assert.equal(list.status, 200);
  assert.equal(list.body.ok, true);
  assert.equal(list.body.plans.length, 1);
  assert.doesNotThrow(() => validatePlan(list.body.plans[0]));
  assert.deepEqual(list.body.plans[0].concurrency, { starting: 0, running: 1, limit: 2, runtimeCapacity: null });
  assert.equal(list.body.scheduler.limit, 4);
  assert.equal(list.body.scheduler.runtimeCapacity, null);
  const detail = await request(f.handler, `/${f.submitted.id}`);
  assert.equal(detail.status, 200);
  assert.doesNotThrow(() => validatePlan(detail.body.plan, true));
  assert.equal(detail.body.plan.tasks[0].state, 'running');
  assert.deepEqual(detail.body.plan.tasks[0].writeResources, ['src/output.js']);
  assert.deepEqual(detail.body.permissions, { control: false });
  assertNoAuthorityLeak(list.body); assertNoAuthorityLeak(detail.body);
  const before = f.store.snapshot();
  await request(f.handler, `/${f.submitted.id}`);
  assert.deepEqual(f.store.snapshot(), before, 'board reads do not create parent bindings, controls or executions');

  f.calls[0].outcome.resolve({ outcome: 'succeeded', stopReason: 'completed', summary: 'execution report only', truncated: false });
  await eventually(() => f.store.snapshot().jobs[0].status === 'completed', 'real receipt settles');
  const complete = await request(f.handler, `/${f.submitted.id}`);
  assert.equal(complete.status, 200);
  assert.doesNotThrow(() => validatePlan(complete.body.plan, true));
  assert.equal(complete.body.plan.tasks[0].state, 'succeeded');
  assert.deepEqual(complete.body.plan.tasks[0].result, { summary: 'execution report only', truncated: false, stopReason: 'completed', verified: false });
  assert.equal(complete.body.plan.concurrency.running, 0);
  assertNoAuthorityLeak(complete.body);
});

test('scheduler HTTP: authentication precedes state access and board methods never authorize mutation', async t => {
  const f = await fixture(t);
  let reads = 0;
  const blocked = createPlansHttpHandler({ requestRejection: () => 401 }, () => { reads++; return f.scheduler; });
  const unauthorized = await request(blocked);
  assert.equal(unauthorized.status, 401);
  assert.equal(reads, 0);
  for (const method of ['PUT', 'POST', 'DELETE']) {
    const res = await request(f.handler, `/${f.submitted.id}`, method);
    assert.equal(res.status, 405);
    assert.equal(res.headers.Allow, 'GET');
  }
  assert.equal(f.calls.length, 1);
  assert.equal(f.store.snapshot().jobs[0].cancelRequested, false);
});

test('scheduler HTTP: unknown plans return 404 without disclosing private scheduler errors', async t => {
  const f = await fixture(t);
  const res = await request(f.handler, '/missing-job');
  assert.equal(res.status, 404);
  assert.equal(res.body.code, 'NOT_FOUND');
  assertNoAuthorityLeak(res.body);
});
