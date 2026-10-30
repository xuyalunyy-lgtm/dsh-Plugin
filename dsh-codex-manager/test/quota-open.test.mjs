import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

// Test the async request sequence alone: no React, DOM, or network emulation.
// Normalize only the in-memory inspection text; Windows checkouts may use CRLF.
const source = (await readFile(new URL('../client.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const begin = source.indexOf('    // Page-open request sequence:');
const end = source.indexOf('    return {\n      inject:', begin);
assert.ok(begin >= 0 && end > begin);
const refreshQuotaOnOpen = runInNewContext(source.slice(begin, end) + '\nrefreshQuotaOnOpen');
const ready = { ok: true, state: { adapter: { active: true }, credential: { state: 'present', mode: 'chatgpt' } } };

test('opening reads status then queries quota exactly once without running tests', async () => {
  const actions = [];
  await refreshQuotaOnOpen(async action => { actions.push(action); return action === 'status' ? ready : { ok: true }; }, () => true);
  assert.deepEqual(actions, ['status', 'quota']);
});
test('failed quota is not automatically retried', async () => {
  const actions = [];
  await refreshQuotaOnOpen(async action => { actions.push(action); return action === 'status' ? ready : { ok: false, code: 'AUTH' }; }, () => true);
  assert.deepEqual(actions, ['status', 'quota']);
});
test('missing credentials, inactive adapter or failed status skip automatic quota', async () => {
  for (const result of [undefined, { ok: false }, { ok: true }, { ok: true, state: { adapter: { active: false }, credential: { state: 'present' } } }, { ok: true, state: { adapter: { active: true }, credential: { state: 'missing' } } }]) {
    const actions = [];
    await refreshQuotaOnOpen(async action => { actions.push(action); return result; }, () => true);
    assert.deepEqual(actions, ['status']);
  }
});
test('closing during local status read prevents a late quota request', async () => {
  let resolveStatus;
  let open = true;
  const actions = [];
  const work = refreshQuotaOnOpen(action => { actions.push(action); return new Promise(resolve => { resolveStatus = resolve; }); }, () => open);
  open = false;
  resolveStatus(ready);
  await work;
  assert.deepEqual(actions, ['status']);
});
test('a closed page does not start any request; a later opening can query once', async () => {
  const actions = [];
  const run = async action => { actions.push(action); return ready; };
  await refreshQuotaOnOpen(run, () => false);
  assert.deepEqual(actions, []);
  await refreshQuotaOnOpen(run, () => true);
  await refreshQuotaOnOpen(run, () => true);
  assert.deepEqual(actions, ['status', 'quota', 'status', 'quota']);
});
