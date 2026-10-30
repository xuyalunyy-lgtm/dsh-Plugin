// Run with the installed Electron executable in Node mode:
// ELECTRON_RUN_AS_NODE=1 "DeepSeek Harness.exe" test.mjs ".../app.asar/dsh"
import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';

assert.ok(process.argv[2]);
const { apply, testOnly } = await import('./index.mjs');
assert.equal(testOnly.reviewedFilesMatch(), true);
assert.equal(testOnly.patchedAvailable(), true);
const root = join(process.argv[2], 'node_modules', '@deepseek-ai', 'dsh-host-open-in-app');
// Future metadata or private-code changes must still fall back to the official host.
// Read-only injection tests the gate without altering the installed archive.
for (const relative of ['package.json', 'lib/index.js', 'lib/types/index.js', 'lib/types/internals.js', 'lib/types/resolver.js', 'lib/types/catalog.js']) {
  const target = join(root, relative);
  const changed = file => file === target ? Buffer.from('unreviewed update') : readFileSync(file);
  assert.equal(testOnly.reviewedFilesMatch(changed), false, `${relative} must remain pinned`);
}
assert.equal(testOnly.reviewedFilesMatch(() => { throw new Error('unreadable'); }), false);
const { internals } = await import(pathToFileURL(join(root, 'lib/types/internals.js')).href);
assert.equal(internals.catalog.launch, undefined);

// The child gets a fresh filtered environment; explicitly opted-in adapters stay opted in.
const source = { Electron_Run_As_Node: '1', PATH: 'keep', PASSWORD: 'already scrubbed by host' };
const filtered = testOnly.childEnvironment(source, { ELECTRON_RUN_AS_NODE: '1', EXTRA: 'value' });
assert.equal(filtered.ELECTRON_RUN_AS_NODE, '1');
assert.equal(filtered.Electron_Run_As_Node, undefined);
assert.equal(source.Electron_Run_As_Node, '1');
assert.equal(filtered.PATH, 'keep');

let originalCalls = 0;
const originalLaunch = async () => { originalCalls++; };
const records = [];
let nextAction = child => queueMicrotask(() => child.emit('exit', 0, null));
const spawnProcess = (command, args, options) => {
  const child = new EventEmitter();
  child.unrefCount = 0;
  child.unref = () => { child.unrefCount++; };
  records.push({ command, args, options, child });
  nextAction(child);
  return child;
};
const launcher = testOnly.makeLauncher({
  originalLaunch,
  scrubbedParentEnv: () => ({ ELECTRON_RUN_AS_NODE: '1', Path: 'safe', LANG: 'zh_CN' }),
  spawnProcess,
  platform: 'win32',
});
const args = ['D:\\空格 directory\\工作区'];
await launcher('C:\\Program Files\\Microsoft VS Code\\Code.exe', args, { watchMs: 40 });
assert.equal(originalCalls, 0);
assert.deepEqual(records[0].args, args);
assert.equal(records[0].options.env.ELECTRON_RUN_AS_NODE, undefined);
assert.equal(records[0].options.env.Path, 'safe');
assert.equal(records[0].options.stdio, 'ignore');
assert.equal(records[0].options.detached, true);
assert.equal(records[0].child.unrefCount, 1);
await launcher('C:\\Apps\\GitHubDesktop.exe', ['a'], { watchMs: 40, env: { ELECTRON_RUN_AS_NODE: '1' } });
assert.equal(originalCalls, 1);
assert.equal(records.length, 1);
await launcher('C:\\Apps\\Code - Insiders.exe', [], { watchMs: 40, env: { ELECTRON_RUN_AS_NODE: '1' } });
assert.equal(records[1].options.env.ELECTRON_RUN_AS_NODE, '1');
nextAction = child => queueMicrotask(() => child.emit('exit', 7, null));
await assert.rejects(launcher('C:\\Apps\\Code.exe', [], { watchMs: 40 }), /code 7/);
assert.equal(records[2].child.unrefCount, 1);
nextAction = child => queueMicrotask(() => child.emit('error', Object.assign(new Error('missing'), { code: 'ENOENT' })));
await assert.rejects(launcher('C:\\Apps\\Code.exe', [], { watchMs: 40 }), /missing/);
nextAction = () => {};
await launcher('C:\\Apps\\Code.exe', [], { watchMs: 5 });
assert.equal(records[4].child.unrefCount, 1);

// Exercise the real route logic in memory, never binding a socket or server.
const routes = new Map();
const disposers = [];
const ctx = {
  get: () => undefined,
  subprocess: { resolveExecutable: async () => { throw new Error('not found'); } },
  connection: { requestRejection: req => req.reject },
  webServer: { register: route => {
    const k = `${route.kind}:${route.path}`;
    if (routes.has(k)) throw new Error(`duplicate ${k}`);
    routes.set(k, route.handler);
    return () => routes.delete(k);
  } },
  effect: fn => { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose); },
};
const before = internals.catalog;
apply(ctx, { probeTimeoutMs: 10000, iconTimeoutMs: 10000, launchWatchMs: 1000 });
assert.equal(routes.size, 3);
assert.equal(typeof internals.catalog.launch, 'function');
async function request(path, { method = 'POST', reject, headers = {}, body = '' } = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  Object.assign(req, { method, reject, headers, url: path });
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(data) { this.body = data; } };
  await routes.get(`exact:${path}`)(req, res);
  return res;
}
const blocked = await request('/open-in-app/open', { reject: 401 });
assert.equal(blocked.statusCode, 401);
const wrongType = await request('/open-in-app/open');
assert.equal(wrongType.statusCode, 415);
const invalid = await request('/open-in-app/open', { headers: { 'content-type': 'application/json' }, body: '{}' });
assert.equal(invalid.statusCode, 400);
while (disposers.length) disposers.pop()();
assert.equal(routes.size, 0);
assert.equal(internals.catalog, before);
console.log('All open-in-app workaround tests passed.');
