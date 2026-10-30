import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createController, createHttpHandler, API_PATH } from '../controller.js';
import { apply, Config } from '../index.js';

// This file exercises an in-memory configEditor and HTTP streams. It does not
// bind a socket, edit a real profile, or assert browser rendering behavior.
const SETTINGS = Object.freeze({
  enabled: true,
  mode: 'prompt',
  preferredParallelism: 4,
  independentReview: true,
  additionalAllowedTools: '',
});

function editorFixture(config = {}) {
  const entry = {
    id: 'local-agent-orchestrator',
    options: { id: 'local-agent-orchestrator', name: '@local/dsh-agent-orchestrator', config: { ...SETTINGS, ...config } },
  };
  let edits = 0;
  let beforeEdit;
  let tail = Promise.resolve();
  const configEditor = {
    entries: () => [entry],
    edit(target, change) {
      const operation = tail.then(async () => {
        assert.equal(target, entry);
        if (beforeEdit) { const run = beforeEdit; beforeEdit = undefined; await run(entry); }
        const next = change(structuredClone(entry.options.config), {});
        entry.options.config = next;
        edits++;
      });
      tail = operation.catch(() => {});
      return operation;
    },
  };
  return {
    entry, configEditor,
    get edits() { return edits; },
    race(fn) { beforeEdit = fn; },
  };
}

function response() {
  const res = new EventEmitter();
  res.headersSent = false;
  res.destroyed = false;
  res.writableEnded = false;
  res.writeHead = (status, headers) => { res.status = status; res.headers = headers; res.headersSent = true; };
  res.end = body => { res.value = JSON.parse(body); res.writableEnded = true; };
  return res;
}

function request(method, value, headers = {}) {
  const req = new PassThrough();
  req.method = method;
  req.url = '/api/agent-orchestrator';
  req.headers = { ...(method === 'PUT' ? { 'content-type': 'application/json' } : {}), ...headers };
  req.end(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : value === undefined ? undefined : JSON.stringify(value));
  return req;
}

function controllerFixture(extra = {}) {
  const fixture = editorFixture(extra);
  fixture.controller = createController({
    configEditor: fixture.configEditor,
    readConfig: () => fixture.entry.options.config,
    validateConfig: Config,
  });
  return fixture;
}

function assertSafe(value) {
  const encoded = JSON.stringify(value);
  assert.doesNotMatch(encoded, /Bearer|secret-token|private[\\\\/]path|C:[\\\\/]sensitive/i);
  assert.deepEqual(JSON.parse(encoded), value);
}

const allowedConnection = { requestRejection: () => undefined };
async function callHttp(handler, method, value, headers) {
  const res = response();
  await handler(request(method, value, headers), res);
  return res;
}

function coreHost(optionalServices = null) {
  const effects = [];
  const tools = [];
  const guards = [];
  const sections = [];
  const contexts = [];
  const routes = [];
  const injections = [];
  const own = dispose => { effects.push(dispose); return dispose; };
  const host = {
    effect(factory) { return own(factory()); },
    tools: {
      guard(value) { guards.push(value); return own(() => { guards.splice(guards.indexOf(value), 1); }); },
      register(value) { tools.push(value); return () => { tools.splice(tools.indexOf(value), 1); }; },
      get(name) { return name === 'subagent' ? { name } : undefined; },
    },
    systemPrompt: {
      getSectionOrder: () => 1, getContextOrder: () => 1,
      section(value) { sections.push(value); return own(() => {}); },
      context(value) { contexts.push(value); return own(() => {}); },
    },
    logger: { warn() {}, info() {}, debug() {} },
  };
  if (optionalServices !== null) {
    host.inject = (names, callback) => {
      injections.push(names);
      if (names.every(name => optionalServices[name])) {
        callback({ ...host, ...optionalServices });
      }
      return own(() => {});
    };
  }
  return {
    ctx: host, tools, guards, sections, contexts, routes, injections,
    async close() { for (const dispose of effects.toReversed()) if (typeof dispose === 'function') await dispose(); },
  };
}

test('controller: read returns only revision, five settings and migration warnings', async () => {
  const f = controllerFixture({ unrelated: 'private/path', secretValue: 'secret-token' });
  const value = await f.controller.dispatch({ action: 'read' });
  assert.equal(value.ok, true);
  assert.equal(typeof value.revision, 'string');
  assert.ok(value.revision.length > 0);
  assert.deepEqual(value.settings, SETTINGS);
  assert.ok(Array.isArray(value.warnings));
  assert.ok(value.warnings.some(warning => /指令|规则|AGENTS/.test(warning) && /其他|独立|撤销/.test(warning)), 'other user/project rules are independent from plugin switch');
  assertSafe(value);
  assert.equal(f.edits, 0);
  await f.controller.close();
});

test('controller: save freezes revision, preserves unrelated config and supports off/on', async () => {
  const f = controllerFixture({ unrelated: { keep: true } });
  const before = await f.controller.dispatch({ action: 'read' });
  const disabled = await f.controller.dispatch({ action: 'save', expectedRevision: before.revision, settings: { ...SETTINGS, enabled: false } });
  assert.equal(disabled.ok, true);
  assert.equal(disabled.settings.enabled, false);
  assert.notEqual(disabled.revision, before.revision);
  assert.deepEqual(f.entry.options.config.unrelated, { keep: true });
  const stale = await f.controller.dispatch({ action: 'save', expectedRevision: before.revision, settings: SETTINGS });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, 'CONFLICT');
  const enabled = await f.controller.dispatch({ action: 'save', expectedRevision: disabled.revision, settings: SETTINGS });
  assert.equal(enabled.ok, true);
  assert.equal(enabled.settings.enabled, true);
  assert.equal(f.edits, 2);
  await f.controller.close();
});

test('controller: competing external change is checked inside configEditor edit lock', async () => {
  const f = controllerFixture();
  const before = await f.controller.dispatch({ action: 'read' });
  f.race(entry => { entry.options.config.preferredParallelism = 8; });
  const result = await f.controller.dispatch({ action: 'save', expectedRevision: before.revision, settings: { ...SETTINGS, enabled: false } });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CONFLICT');
  assert.equal(f.entry.options.config.preferredParallelism, 8);
  assert.equal(f.entry.options.config.enabled, true);
  assert.equal(f.edits, 0);
  await f.controller.close();
});

test('controller: duplicate simultaneous saves never both overwrite using one revision', async () => {
  const f = controllerFixture();
  const { revision } = await f.controller.dispatch({ action: 'read' });
  const results = await Promise.all([
    f.controller.dispatch({ action: 'save', expectedRevision: revision, settings: { ...SETTINGS, preferredParallelism: 5 } }),
    f.controller.dispatch({ action: 'save', expectedRevision: revision, settings: { ...SETTINGS, preferredParallelism: 6 } }),
  ]);
  assert.equal(results.filter(value => value.ok).length, 1);
  assert.ok(results.some(value => value.code === 'CONFLICT' || value.code === 'BUSY'));
  assert.equal(f.edits, 1);
  await f.controller.close();
});

test('controller: complete five-field settings and exact request keys are enforced before edit', async () => {
  const f = controllerFixture();
  const { revision } = await f.controller.dispatch({ action: 'read' });
  const invalid = [
    { ...SETTINGS, enabled: 'false' }, { ...SETTINGS, mode: 'automatic' },
    { ...SETTINGS, preferredParallelism: 0 }, { ...SETTINGS, preferredParallelism: 17 },
    { ...SETTINGS, preferredParallelism: 1.5 }, { ...SETTINGS, independentReview: 1 },
    { ...SETTINGS, additionalAllowedTools: '*' }, { ...SETTINGS, additionalAllowedTools: 'functions.read' },
    { ...SETTINGS, injected: true }, {}, null, [],
  ];
  for (const key of Object.keys(SETTINGS)) {
    const partial = { ...SETTINGS }; delete partial[key]; invalid.push(partial);
  }
  for (const settings of invalid) {
    const result = await f.controller.dispatch({ action: 'save', expectedRevision: revision, settings });
    assert.equal(result.ok, false, JSON.stringify(settings));
    assert.ok(['INVALID_SETTINGS', 'INVALID_REQUEST'].includes(result.code), result.code);
  }
  for (const value of [
    { action: 'save', expectedRevision: revision, settings: SETTINGS, extra: true },
    { action: 'save', settings: SETTINGS }, { action: 'save', expectedRevision: 1, settings: SETTINGS },
    { action: 'delete' }, { action: 'read', extra: true }, null, [],
  ]) assert.equal((await f.controller.dispatch(value)).ok, false);
  assert.equal(f.edits, 0);
  await f.controller.close();
});

test('controller: unavailable or ambiguous entries, expressions and closed state are safe failures', async () => {
  for (const entries of [[], [editorFixture().entry, editorFixture().entry]]) {
    const controller = createController({ configEditor: { entries: () => entries }, readConfig: () => SETTINGS, validateConfig: Config });
    const value = await controller.dispatch({ action: 'read' });
    assert.equal(value.ok, false);
    assert.ok(['UNAVAILABLE', 'ENTRY_AMBIGUOUS'].includes(value.code));
    assertSafe(value);
    await controller.close();
  }
  const f = controllerFixture({ mode: { __jsExpr: 'secret-token()' } });
  const expression = await f.controller.dispatch({ action: 'read' });
  assert.equal(expression.ok, false);
  assert.equal(expression.code, 'EXPRESSION_CONFIG');
  assertSafe(expression);
  await f.controller.close();
  assert.equal((await f.controller.dispatch({ action: 'read' })).code, 'CLOSED');
});

test('controller: ownerFiber selects its exact configuration row and never edits a sibling instance', async () => {
  const first = editorFixture();
  const second = editorFixture({ preferredParallelism: 9 });
  const ownerFiber = {};
  first.entry.fiber = ownerFiber;
  second.entry.fiber = {};
  const editor = { ...first.configEditor, entries: () => [second.entry, first.entry] };
  const controller = createController({ configEditor: editor, readConfig: () => first.entry.options.config, validateConfig: Config, ownerFiber });
  const before = await controller.dispatch({ action: 'read' });
  assert.equal(before.ok, true);
  assert.equal(before.settings.preferredParallelism, 4);
  const saved = await controller.dispatch({ action: 'save', expectedRevision: before.revision, settings: { ...SETTINGS, enabled: false } });
  assert.equal(saved.ok, true);
  assert.equal(first.entry.options.config.enabled, false);
  assert.equal(second.entry.options.config.enabled, true);
  assert.equal(second.entry.options.config.preferredParallelism, 9);
  await controller.close();
});

test('controller: missing configEditor is unavailable and dynamic expressions are never overwritten', async () => {
  const unavailable = createController({ readConfig: () => SETTINGS });
  assert.equal((await unavailable.dispatch({ action: 'read' })).code, 'UNAVAILABLE');
  await unavailable.close();
  const f = controllerFixture();
  const before = await f.controller.dispatch({ action: 'read' });
  f.race(entry => { entry.options.config.enabled = { __jsExpr: 'secret-token()' }; });
  const result = await f.controller.dispatch({ action: 'save', expectedRevision: before.revision, settings: { ...SETTINGS, enabled: false } });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EXPRESSION_CONFIG');
  assert.equal(f.edits, 0);
  assertSafe(result);
  await f.controller.close();
});

test('controller: host exceptions are not reflected with tokens or sensitive paths', async () => {
  const controller = createController({
    configEditor: { entries() { throw new Error('Bearer secret-token C:\\sensitive\\profile.yml'); } },
    readConfig: () => SETTINGS, validateConfig: Config,
  });
  const value = await controller.dispatch({ action: 'read' });
  assert.equal(value.ok, false);
  assertSafe(value);
  await controller.close();
});

test('HTTP: authentication precedes GET dispatch and PUT body iteration', async () => {
  let dispatched = 0;
  const handler = createHttpHandler({ requestRejection: () => 401 }, async () => { dispatched++; });
  for (const method of ['GET', 'PUT']) {
    const req = { method, headers: {}, [Symbol.asyncIterator]() { throw new Error('must not read unauthorized body'); } };
    const res = response();
    await handler(req, res);
    assert.equal(res.status, 401);
    assert.equal(res.value.ok, false);
  }
  assert.equal(dispatched, 0);
});

test('HTTP: GET reads no body; PUT saves and returns settings; headers prohibit caching', async () => {
  assert.equal(API_PATH, '/api/agent-orchestrator');
  const f = controllerFixture();
  const handler = createHttpHandler(allowedConnection, f.controller.dispatch);
  const getReq = { method: 'GET', headers: {}, [Symbol.asyncIterator]() { throw new Error('GET must not read body'); } };
  const before = response();
  await handler(getReq, before);
  assert.equal(before.status, 200);
  assert.equal(before.value.ok, true);
  assert.match(before.headers['Cache-Control'] ?? before.headers['cache-control'], /no-store/);
  const saved = await callHttp(handler, 'PUT', { expectedRevision: before.value.revision, settings: { ...SETTINGS, enabled: false } });
  assert.equal(saved.status, 200);
  assert.equal(saved.value.settings.enabled, false);
  const conflict = await callHttp(handler, 'PUT', { expectedRevision: before.value.revision, settings: SETTINGS });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.value.code, 'CONFLICT');
  await f.controller.close();
});

test('HTTP: unsupported methods, MIME, malformed JSON and oversized bodies never dispatch', async () => {
  let calls = 0;
  const handler = createHttpHandler(allowedConnection, async () => { calls++; throw new Error('must not dispatch'); });
  const cases = [
    ['POST', {}, {}, 405], ['PUT', '{}', { 'content-type': 'text/plain' }, 415],
    ['PUT', '{oops', {}, 400], ['PUT', Buffer.alloc(8193, 32), {}, 413],
  ];
  for (const [method, body, headers, expected] of cases) {
    const result = await callHttp(handler, method, body, headers);
    assert.equal(result.status, expected, `${method}/${expected}`);
    assert.equal(result.value.ok, false);
  }
  assert.equal(calls, 0);
});

test('HTTP: invalid body keys and missing settings map to 400; unavailability to 503', async () => {
  const f = controllerFixture();
  const handler = createHttpHandler(allowedConnection, f.controller.dispatch);
  const { revision } = await f.controller.dispatch({ action: 'read' });
  for (const value of [
    { expectedRevision: revision, settings: SETTINGS, action: 'save' },
    { expectedRevision: revision, settings: { ...SETTINGS, mode: 'bogus' } },
    { expectedRevision: revision }, null, [],
  ]) assert.equal((await callHttp(handler, 'PUT', value)).status, 400, JSON.stringify(value));
  await f.controller.close();
  const unavailable = await callHttp(handler, 'GET');
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.value.code, 'CLOSED');
});

test('HTTP: raw transport and dispatch exceptions are sanitized', async () => {
  const handler = createHttpHandler(allowedConnection, async () => { throw new Error('Bearer secret-token private/path'); });
  const result = await callHttp(handler, 'GET');
  assert.equal(result.status, 500);
  assertSafe(result.value);
});

test('host simulation: optional management services may be absent without breaking core guard/status', async () => {
  for (const optional of [null, {}, { configEditor: {} }, { configEditor: {}, connection: {} }]) {
    const host = coreHost(optional);
    await apply(host.ctx, Config({}));
    assert.equal(host.guards.length, 1);
    assert.ok(host.tools.some(tool => tool.name === 'orchestrator_status'));
    assert.ok(host.sections.length > 0);
    await host.close();
  }
});

test('host simulation: settings route stays mounted while disabled and can re-enable explicit strict policy', async () => {
  const strictSettings = { ...SETTINGS, mode: 'strict' };
  const f = editorFixture({ ...strictSettings, enabled: false });
  const routeRows = [];
  const host = coreHost({
    configEditor: f.configEditor,
    connection: allowedConnection,
    webServer: { register(route) {
      const row = { route, active: true };
      routeRows.push(row);
      return () => { row.active = false; };
    } },
  });
  const config = Object.fromEntries(Object.keys(SETTINGS).map(key => [key, { get: () => f.entry.options.config[key] }]));
  await apply(host.ctx, config);
  const settingsRoute = routeRows.find(row => row.route.kind === 'exact' && row.route.path === API_PATH);
  assert.ok(settingsRoute, 'settings route remains registered alongside read-only plan routes');
  assert.equal(routeRows.filter(row => row.route.kind === 'exact' && row.route.path === API_PATH).length, 1);
  const exec = { name: 'write', agent: { options: {}, session: { header: { delegationDepth: 0 } } } };
  assert.equal(host.guards[0](exec), undefined);
  const handler = settingsRoute.route.handler;
  const before = await callHttp(handler, 'GET');
  assert.equal(before.status, 200);
  assert.equal(before.value.settings.enabled, false);
  const enabled = await callHttp(handler, 'PUT', { expectedRevision: before.value.revision, settings: strictSettings });
  assert.equal(enabled.status, 200);
  assert.equal(enabled.value.settings.enabled, true);
  assert.equal(typeof host.guards[0](exec), 'string');
  assert.equal(settingsRoute.active, true);
  await host.close();
  assert.equal(settingsRoute.active, false);
  assert.equal(routeRows.some(row => row.active), false, 'all registered routes are disposed');
});

test('host simulation: controller save drives explicit strict guard off and back on for subsequent calls', async () => {
  const strictSettings = { ...SETTINGS, mode: 'strict' };
  const f = controllerFixture(strictSettings);
  const host = coreHost();
  const config = Object.fromEntries(Object.keys(SETTINGS).map(key => [key, { get: () => f.entry.options.config[key] }]));
  await apply(host.ctx, config);
  const exec = { name: 'write', agent: { options: {}, session: { header: { delegationDepth: 0 } } } };
  assert.equal(typeof host.guards[0](exec), 'string');
  const before = await f.controller.dispatch({ action: 'read' });
  const disabled = await f.controller.dispatch({ action: 'save', expectedRevision: before.revision, settings: { ...strictSettings, enabled: false } });
  assert.equal(disabled.ok, true);
  assert.equal(host.guards[0](exec), undefined);
  const enabled = await f.controller.dispatch({ action: 'save', expectedRevision: disabled.revision, settings: strictSettings });
  assert.equal(enabled.ok, true);
  assert.equal(typeof host.guards[0](exec), 'string');
  await host.close();
  await f.controller.close();
});
