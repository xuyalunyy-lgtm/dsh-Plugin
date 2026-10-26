import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createController, credentialSummary, revisionOf, validateSettings } from '../controller.js';
import { createHttpHandler } from '../http.js';
import { apply } from '../index.js';

const settings = { proxy: 'http://127.0.0.1:7897', clientVersion: '0.160.1', streamIdleTimeoutMs: 300000 };
function fixture(extra = {}) {
  const entry = { options: { name: 'dsh-llm-codex', config: { ...settings, writeBack: false, authFile: 'private/path' } } };
  let edits = 0; let calls = 0;
  const llm = {
    listProviders: () => [{ id: 'codex' }],
    listModels: async () => [{ id: 'model', name: 'Model' }],
    resolveModelInfo: async () => ({ inputModalities: ['text', 'image'], context: { contextWindow: 100000 }, reasoning: { efforts: [{ id: 'low' }], defaultEffort: 'low' } }),
    prepareCall: async config => ({ config, async *stream(request) { calls++; assert.equal(request.messages.length, 1); assert.equal(request.tools, undefined); assert.equal(JSON.stringify(request).includes('private/path'), false); yield { type: 'text-delta', text: 'OK' }; yield { type: 'finish', reason: { kind: 'stop' } }; } }),
    ...extra,
  };
  const configEditor = { entries: () => [entry], edit: async (e, fn) => { e.options.config = fn(structuredClone(e.options.config), {}); edits++; } };
  const controller = createController({ llm, configEditor, summarizeCredential: async () => ({ state: 'present', mode: 'chatgpt' }) });
  return { controller, entry, llm, configEditor, get edits() { return edits; }, get calls() { return calls; } };
}
test('status stays local and exposes no raw settings or credential path', async () => {
  const f = fixture({ listModels: () => { throw new Error('should not call network'); } });
  const r = await f.controller.dispatch({ action: 'status' });
  assert.equal(r.ok, true); assert.equal(r.state.adapter.active, true);
  assert.equal(JSON.stringify(r).includes('private/path'), false); assert.equal(f.calls, 0);
  await f.controller.close();
});
test('writes use frozen revision and preserve unrelated adapter fields', async () => {
  const f = fixture(); const { state } = await f.controller.dispatch({ action: 'status' });
  const r = await f.controller.dispatch({ action: 'saveSettings', expectedRevision: state.revision, settings: { ...settings, proxy: '' } });
  assert.equal(r.ok, true); assert.equal(f.entry.options.config.writeBack, false); assert.equal(f.entry.options.config.authFile, 'private/path');
  const conflict = await f.controller.dispatch({ action: 'saveSettings', expectedRevision: state.revision, settings });
  assert.equal(conflict.code, 'CONFLICT'); assert.equal(f.edits, 1); await f.controller.close();
});
test('rejects arbitrary config keys, secret-bearing proxy and dynamic config', async () => {
  const f = fixture();
  for (const bad of [{ ...settings, authFile: 'evil' }, { ...settings, proxy: 'http://user:password@localhost:123' }, { ...settings, proxy: 'file:///tmp' }, { ...settings, streamIdleTimeoutMs: 0 }]) {
    assert.throws(() => validateSettings(bad));
  }
  f.entry.options.config.proxy = { __jsExpr: 'secret()' };
  assert.equal((await f.controller.dispatch({ action: 'status' })).code, 'EXPRESSION_CONFIG');
  assert.equal(f.edits, 0); await f.controller.close();
});
test('models show declared capabilities; text test never receives conversation history', async () => {
  const f = fixture(); const models = await f.controller.dispatch({ action: 'models' });
  assert.deepEqual(models.models[0].inputModalities, ['text', 'image']);
  const r = await f.controller.dispatch({ action: 'test', model: 'model' });
  assert.equal(r.diagnostic.ok, true); assert.equal(f.calls, 1); await f.controller.close();
});
test('provider exceptions are allowlisted rather than reflected with secrets', async () => {
  const f = fixture({ prepareCall: async () => { throw Object.assign(new Error('Bearer secret-token private/path'), { code: 'AUTH' }); } });
  const r = await f.controller.dispatch({ action: 'test', model: 'model' });
  assert.equal(r.diagnostic.code, 'AUTH'); assert.equal(JSON.stringify(r).includes('secret-token'), false); await f.controller.close();
});
test('close blocks new work; unsupported operations cannot delete or switch credentials', async () => {
  const f = fixture();
  assert.equal((await f.controller.dispatch({ action: 'logout' })).ok, false);
  await f.controller.close(); assert.equal((await f.controller.dispatch({ action: 'status' })).code, 'CLOSED');
});
test('tool callers can include unused known schema fields without side effects', async () => {
  const f = fixture();
  const r = await f.controller.dispatch({ action: 'status', expectedRevision: '', model: '', settings });
  assert.equal(r.ok, true); assert.equal(f.edits, 0); assert.equal(f.calls, 0);
  assert.equal((await f.controller.dispatch({ action: 'status', authFile: 'evil' })).code, 'INVALID_REQUEST');
  await f.controller.close();
});
test('revision is independent of object key order', () => { assert.equal(revisionOf({ a: 1, b: 2 }), revisionOf({ b: 2, a: 1 })); });
test('credential summary reads local mode without returning token content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-manager-'));
  try {
    const authFile = join(dir, 'auth.json');
    assert.equal((await credentialSummary({ authFile })).state, 'missing');
    await writeFile(authFile, JSON.stringify({ auth_mode: 'chatgpt', tokens: { access_token: 'secret-token' } }));
    assert.deepEqual(await credentialSummary({ authFile }), { state: 'present', mode: 'chatgpt' });
    await writeFile(authFile, 'not json'); assert.equal((await credentialSummary({ authFile })).state, 'invalid');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
function response() { const r = new EventEmitter(); r.writeHead = (s, h) => { r.status = s; r.headers = h; }; r.end = t => { r.value = JSON.parse(t); r.writableEnded = true; }; return r; }
test('HTTP rejects unauthorized request before reading body or executing', async () => {
  let ran = false;
  const req = { headers: {}, method: 'POST', [Symbol.asyncIterator]() { throw new Error('must not read'); } };
  const res = response(); await createHttpHandler({ requestRejection: () => 401 }, async () => { ran = true; })(req, res);
  assert.equal(res.status, 401); assert.equal(ran, false);
});
test('HTTP rejects large body and invalid JSON', async () => {
  for (const [body, status] of [[Buffer.alloc(9000), 413], [Buffer.from('{oops'), 400]]) {
    const req = new PassThrough(); req.headers = { 'content-type': 'application/json' }; req.method = 'POST'; req.end(body);
    const res = response(); await createHttpHandler({ requestRejection: () => undefined }, () => { throw new Error('must not dispatch'); })(req, res); assert.equal(res.status, status);
  }
});
test('Host lifecycle removes HTTP route and tool, without registering any adapter', async () => {
  const f = fixture(); const disposers = []; const routes = new Map(); const tools = new Map();
  const ctx = { llm: f.llm, configEditor: f.configEditor, connection: {}, effect(fn) { disposers.push(fn()); }, webServer: { register(r) { routes.set(r.path, r); return () => routes.delete(r.path); } }, tools: { register(t) { tools.set(t.name, t); return () => tools.delete(t.name); } } };
  apply(ctx); assert.equal(routes.size, 1); assert.equal(tools.size, 1);
  for (const dispose of disposers.reverse()) await dispose();
  assert.equal(routes.size, 0); assert.equal(tools.size, 0); await f.controller.close();
});
