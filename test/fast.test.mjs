import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createController, settingsOf, validateSettings } from '../controller.js';
import { parameters } from '../index.js';
import { buildReport } from '../report.js';

const base = { proxy: '', clientVersion: '0.160.1', streamIdleTimeoutMs: 300000 };
function fixture(extra = {}) {
  const entry = { options: { name: 'dsh-llm-codex', config: { ...base, authFile: 'private', writeBack: false, ...extra } } };
  const controller = createController({
    llm: { listProviders: () => [{ id: 'codex' }], listModels: () => { throw new Error('no network'); } },
    configEditor: { entries: () => [entry], edit: async (e, fn) => { e.options.config = fn(structuredClone(e.options.config)); } },
    summarizeCredential: async () => ({ state: 'present', mode: 'chatgpt' }),
  });
  const save = async settings => {
    const { state } = await controller.dispatch({ action: 'status' });
    return controller.dispatch({ action: 'saveSettings', expectedRevision: state.revision, settings });
  };
  return { entry, controller, save };
}
test('effective Fast defaults off but legacy validation never manufactures a write', () => {
  assert.equal(settingsOf(base).fastMode, false);
  assert.equal(Object.hasOwn(validateSettings(base), 'fastMode'), false);
  for (const fastMode of [false, true]) assert.equal(validateSettings({ ...base, fastMode }).fastMode, fastMode);
  for (const fastMode of [null, undefined, 'true', 1, {}, []]) assert.throws(() => validateSettings({ ...base, fastMode }));
});
test('legacy three-field saves preserve true, false, or absent stored flag', async () => {
  for (const extra of [{}, { fastMode: true }, { fastMode: false }]) {
    const f = fixture(extra);
    const result = await f.save({ ...base, clientVersion: '0.160.2' });
    assert.equal(result.ok, true);
    assert.equal(Object.hasOwn(f.entry.options.config, 'fastMode'), Object.hasOwn(extra, 'fastMode'));
    assert.equal(f.entry.options.config.fastMode, extra.fastMode);
    assert.equal(result.state.settings.fastMode, extra.fastMode ?? false);
    assert.equal(f.entry.options.config.authFile, 'private'); assert.equal(f.entry.options.config.writeBack, false);
    await f.controller.close();
  }
});
test('explicit true and false are saved without tests or account changes', async () => {
  const f = fixture();
  for (const fastMode of [true, false]) {
    const result = await f.save({ ...base, fastMode });
    assert.equal(result.ok, true); assert.equal(result.state.settings.fastMode, fastMode); assert.equal(f.entry.options.config.fastMode, fastMode);
  }
  await f.controller.close();
});
test('Fast changes invalidate frozen revisions and cannot overwrite concurrent changes', async () => {
  const f = fixture();
  const { state } = await f.controller.dispatch({ action: 'status' });
  await f.save({ ...base, fastMode: true });
  const stale = await f.controller.dispatch({ action: 'saveSettings', expectedRevision: state.revision, settings: { ...base, fastMode: false } });
  assert.equal(stale.code, 'CONFLICT'); assert.equal(f.entry.options.config.fastMode, true);
  await f.controller.close();
});
test('tool schema makes only Fast optional and keeps existing operation enum', () => {
  assert.deepEqual(parameters.properties.settings.required, ['proxy', 'clientVersion', 'streamIdleTimeoutMs']);
  assert.equal(parameters.properties.settings.properties.fastMode.type, 'boolean');
  assert.equal(Object.hasOwn(parameters.properties.settings.properties.fastMode, 'default'), false);
  assert.deepEqual(parameters.properties.action.enum, ['status', 'models', 'saveSettings', 'test', 'quota', 'report']);
});
test('report exposes only boolean preference and never claims actual tier', () => {
  for (const fastMode of [false, true]) {
    const report = buildReport({ state: { settings: { ...base, fastMode } } });
    assert.equal(report.connection.fastMode, fastMode);
    assert.equal(report.connection.fastModeMeaning, 'configured-preference-not-observed-service-tier');
    assert.equal(Object.hasOwn(report.connection, 'service_tier'), false);
  }
  const report = buildReport({ state: { settings: { ...base, fastMode: 'secret' } } });
  assert.equal(report.connection.fastMode, null); assert.equal(JSON.stringify(report).includes('secret'), false);
});
test('client draft preserves booleans and defaults off without rendering a mock UI', async () => {
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
  const begin = source.indexOf('    function settingsDraft(settings) {');
  const end = source.indexOf('    // Pure quota display rules', begin);
  assert.ok(begin >= 0 && end > begin);
  const settingsDraft = runInNewContext(source.slice(begin, end) + '\nsettingsDraft');
  assert.equal(settingsDraft(base).fastMode, false);
  assert.equal(settingsDraft({ ...base, fastMode: true }).fastMode, true);
  assert.equal(settingsDraft({ ...base, fastMode: false }).fastMode, false);
  assert.match(source, /checked: draft\.fastMode/);
  assert.match(source, /change\('fastMode', event\.target\.checked\)/);
  assert.match(source, /fastMode: draft\.fastMode/);
  assert.match(source, /expectedRevision: draftRevision\.current/);
  assert.match(source, /setDraft\(settingsDraft\(state\.settings\)\)/);
});
