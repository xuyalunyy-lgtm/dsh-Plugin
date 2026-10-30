import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, errorSnapshot, quotaSnapshot, testSnapshot } from '../report.js';
import { createController } from '../controller.js';

const at = '2026-10-26T06:00:00.000Z';
const secret = 'DO-NOT-EXPORT-private-email-and-token';
function fixture() {
  let network = 0;
  const entry = { options: { name: 'dsh-llm-codex', config: { proxy: 'http://127.0.0.1:7897', clientVersion: '0.160.1', streamIdleTimeoutMs: 300000, authFile: secret, writeBack: false } } };
  const configEditor = { entries: () => [entry], edit: async (e, fn) => { e.options.config = fn(structuredClone(e.options.config), {}); } };
  const llm = {
    listProviders: () => [{ id: 'codex' }],
    listModels: async () => { network++; return [{ id: 'test-model' }]; },
    prepareCall: async config => ({ config, async *stream() { network++; yield { type: 'text-delta', text: secret }; yield { type: 'finish', reason: { kind: 'stop' } }; } }),
  };
  const controller = createController({
    llm, configEditor,
    summarizeCredential: async () => ({ state: 'present', mode: 'chatgpt', token: secret }),
    reportMetadata: async () => ({ managerVersion: '0.3.0', adapterVersion: '0.2.0', path: secret }),
    quotaQuery: async () => { network++; return { state: 'available', plan: secret, windows: [{ kind: 'primary', remainingPercent: 15, windowSeconds: 604800, resetAt: at }], checkedAt: at, account_id: secret }; },
  });
  return { controller, entry, get network() { return network; } };
}
test('report allowlists fields, omits raw messages, paths, models and generated text', () => {
  const report = buildReport({
    state: { settings: { proxy: 'http://secret.internal:7897', clientVersion: '0.160.1', streamIdleTimeoutMs: 300000, authFile: secret }, credential: { state: 'present', mode: 'chatgpt', token: secret }, adapter: { active: true } },
    metadata: { managerVersion: '0.3.0', adapterVersion: '0.2.0', path: secret },
    latest: { textTest: { ok: false, code: 'AUTH', message: secret, model: secret, finishedAt: at, latencyMs: 50 }, quota: { state: 'available', checkedAt: at, plan: secret, email: secret, windows: [{ kind: 'primary', remainingPercent: 15, windowSeconds: 604800, resetAt: at, secret }] }, error: { action: 'test', code: 'AUTH', at, message: secret } }, now: at,
  });
  const text = JSON.stringify(report);
  assert.equal(text.includes(secret), false); assert.equal(text.includes('secret.internal'), false);
  assert.equal(report.connection.proxyConfigured, true); assert.equal(report.latest.textTest.code, 'AUTH'); assert.equal(report.latest.quota.windows[0].remainingPercent, 15);
  assert.equal(report.generatedAt, at);
});
test('unexpected enums, provider codes, versions and counts do not bypass redaction', () => {
  const report = buildReport({ state: { credential: { state: secret, mode: secret }, settings: { clientVersion: secret, streamIdleTimeoutMs: Infinity } }, metadata: { managerVersion: secret }, latest: { textTest: { ok: false, code: secret, model: secret, usage: { inputTokens: -3 }, finishedAt: secret }, error: { action: secret, code: secret, at: secret } } });
  assert.equal(JSON.stringify(report).includes(secret), false);
  assert.equal(report.latest.error.code, 'FAILED'); assert.equal(report.latest.error.action, 'unknown'); assert.equal(report.managerVersion, null);
  assert.equal(report.latest.textTest.usage.inputTokens, undefined);
});
test('report is local-only and optional metadata failures are contained', async () => {
  const f = fixture();
  const before = f.network; const result = await f.controller.dispatch({ action: 'report' });
  assert.equal(result.ok, true); assert.equal(result.report.managerVersion, '0.3.0'); assert.equal(f.network, before);
  assert.equal(result.report.latest.textTest, null); assert.equal(JSON.stringify(result).includes(secret), false);
  await f.controller.close();
});
test('report describes current lifetime checks and configuration changes clear snapshots', async () => {
  const f = fixture();
  await f.controller.dispatch({ action: 'quota' }); await f.controller.dispatch({ action: 'test', model: 'test-model' });
  const before = f.network;
  const first = (await f.controller.dispatch({ action: 'report' })).report;
  assert.equal(first.latest.textTest.ok, true); assert.equal(first.latest.quota.windows[0].remainingPercent, 15); assert.equal(f.network, before);
  assert.equal(JSON.stringify(first).includes(secret), false);
  f.entry.options.config.clientVersion = '0.160.2';
  const next = (await f.controller.dispatch({ action: 'report' })).report;
  assert.equal(next.latest.textTest, null); assert.equal(next.latest.quota, null); assert.equal(next.connection.clientVersion, '0.160.2');
  await f.controller.close();
});
test('report stays available when configuration is invalid, without exposing raw values', async () => {
  const f = fixture(); f.entry.options.config.proxy = 'http://user:secret@127.0.0.1:7897';
  const result = await f.controller.dispatch({ action: 'report' });
  assert.equal(result.ok, true); assert.equal(result.report.configurationError, 'INVALID_SETTINGS'); assert.equal(result.report.connection, null); assert.equal(result.report.adapter.active, null); assert.equal(JSON.stringify(result).includes('user:secret'), false);
  await f.controller.close();
});
test('report API cannot accept client supplied logs or errors for reflection', async () => {
  const f = fixture(); const r = await f.controller.dispatch({ action: 'report', logs: secret });
  assert.equal(r.code, 'INVALID_REQUEST'); assert.equal(JSON.stringify(r).includes(secret), false); await f.controller.close();
});
test('safe snapshots preserve zeros and never claim unknown quota is full', () => {
  assert.equal(quotaSnapshot({ state: 'available', windows: [{ kind: 'primary', remainingPercent: 0 }] }).windows[0].remainingPercent, 0);
  assert.equal(quotaSnapshot({ state: 'available', windows: [{ kind: 'primary', remainingPercent: null }] }).windows[0].remainingPercent, null);
  assert.equal(testSnapshot({ ok: true, latencyMs: 0, usage: { inputTokens: 0 } }).latencyMs, 0);
  assert.equal(errorSnapshot('quota', secret, at).code, 'FAILED');
});
