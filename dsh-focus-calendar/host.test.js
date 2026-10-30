import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { apply, createHttpHandler, parameters, API_PATH } from './index.js';
import { createController, initialState, ACTIONS } from './state.js';

function request(body, method = 'POST', contentType = 'application/json') {
  const req = Readable.from([body]); req.method = method; req.headers = { 'content-type': contentType }; return req;
}
function response() {
  return { headersSent: false, writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; }, end(body) { this.value = JSON.parse(body); } };
}
test('connection rejection prevents execution even for correctly shaped requests', async () => {
  for (const rejection of [401, 403]) {
    let calls = 0;
    const handler = createHttpHandler({ requestRejection: () => rejection }, async () => { calls++; });
    const res = response(); await handler(request('{"action":"read"}'), res);
    assert.equal(res.status, rejection); assert.equal(res.value.ok, false); assert.equal(calls, 0);
  }
});
test('authenticated transport rejects method/content type/invalid JSON/oversized body', async () => {
  let calls = 0;
  const handler = createHttpHandler({ requestRejection: () => undefined }, async () => { calls++; });
  const cases = [[request('{}', 'GET'), 405], [request('{}', 'POST', 'text/plain'), 415], [request('bad'), 400], [request('x'.repeat(5*1024*1024+1)), 413]];
  for (const [req, code] of cases) { const res = response(); await handler(req, res); assert.equal(res.status, code); }
  assert.equal(calls, 0);
});
test('browser and tool operation contracts share serialized dispatch', async () => {
  let stored = initialState();
  const controller = createController({ load: () => stored, save: async next => { stored = next; }, clock: () => 123, id: () => 'task-1' });
  const handler = createHttpHandler({ requestRejection: () => undefined }, controller.dispatch);
  const res = response();
  await handler(request(JSON.stringify({ action: 'add', date: '2026-10-22', title: 'Shared task' })), res);
  assert.equal(res.status, 200); assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.deepEqual(res.value, await controller.dispatch({ action: 'read' }));
  assert.deepEqual(parameters.properties.action.enum, ACTIONS);
  const invalid = response();
  await handler(request(JSON.stringify({ action: 'add', title: 'Missing date' })), invalid);
  assert.equal(invalid.value.ok, false);
  assert.equal(stored.tasks.length, 1);
  await controller.close();
});

test('apply validates storage name and real zod schema, registers shared tool/HTTP state, and disposes resources', async () => {
  // Exact UNIT_NAME_RE inspected from installed @deepseek-ai/dsh-storage/lib/index.js:80.
  const unitName = /^[a-z][a-z0-9_]*$/;
  assert.equal(unitName.test('focus-calendar'), false);
  const disposers = [];
  let stored, schema, route, tool, closed = false, toolRemoved = false, routeRemoved = false;
  let authRejection;
  let writes = 0;
  const ctx = {
    effect(factory) { const dispose = factory(); disposers.push(dispose); return dispose; },
    storageDomain: { async open(spec) {
      assert.match(spec.name, unitName);
      assert.equal(spec.name, 'focus_calendar');
      assert.equal(spec.version, 1);
      schema = spec.global.schema;
      assert.equal(schema.safeParse(null).success, false);
      stored = schema.parse(spec.global.initial);
      return { global: { get: () => stored, async set(value) { stored = schema.parse(value); writes++; } }, async close() { closed = true; } };
    } },
    connection: { requestRejection: () => authRejection },
    webServer: { register(value) { route = value; return () => { routeRemoved = true; }; } },
    tools: { register(value) { tool = value; return () => { toolRemoved = true; }; } },
  };
  await apply(ctx);
  try {
    assert.equal(route.path, API_PATH);
    assert.equal(route.kind, 'exact');
    assert.equal(tool.name, 'focus_calendar');
    assert.equal(schema.safeParse({ ...stored, settings: { ...stored.settings, eyeMinutes: 0 } }).success, false);
    const added = await tool.execute({ action: 'add', date: '2026-10-22', title: 'From actual registered tool' });
    assert.equal(added.ok, true);
    const id = added.state.tasks[0].id;
    const res = response();
    await route.handler(request(JSON.stringify({ action: 'update', id, done: true })), res);
    assert.equal(res.status, 200);
    assert.equal(res.value.state.tasks[0].done, true);
    const read = await tool.execute({ action: 'read' });
    const { now: _httpNow, ...httpState } = res.value.state;
    const { now: _toolNow, ...toolState } = read.state;
    assert.deepEqual(httpState, toolState);
    assert.equal(JSON.parse(tool.output.render({}, read)[0].text).ok, true);
    authRejection = 403;
    const denied = response();
    await route.handler(request(JSON.stringify({ action: 'delete', id })), denied);
    assert.equal(denied.status, 403);
    assert.equal(stored.tasks.length, 1);
    assert.equal(writes, 2);
    const invalid = await tool.execute({ action: 'settings', settings: { eyeMinutes: 241 } });
    assert.equal(invalid.ok, false);
    assert.equal(stored.settings.eyeMinutes, 20);
  } finally {
    for (const dispose of disposers.reverse()) await dispose();
  }
  assert.equal(closed, true);
  assert.equal(toolRemoved, true);
  assert.equal(routeRemoved, true);
  assert.equal((await tool.execute({ action: 'read' })).ok, false);
});
