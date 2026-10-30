// In-memory end-to-end exercise of the reviewed original routes plus local adapter.
// Does not start an HTTP listener or change DSH's running profile.
import { strict as assert } from 'node:assert';
import { Readable } from 'node:stream';
import { apply, testOnly } from './index.mjs';
assert.equal(testOnly.patchedAvailable(), true);
const routes = new Map();
const disposers = [];
const ctx = {
  get: () => undefined,
  subprocess: { resolveExecutable: async () => { throw new Error('not on PATH'); } },
  connection: { requestRejection: () => undefined },
  webServer: { register(route) {
    const k = `${route.kind}:${route.path}`;
    if (routes.has(k)) throw new Error(`duplicate route: ${k}`);
    routes.set(k, route.handler);
    return () => routes.delete(k);
  } },
  effect: fn => { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose); },
};
async function request(path, method, payload) {
  const body = payload === undefined ? '' : JSON.stringify(payload);
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  Object.assign(req, { method, headers: { 'content-type': 'application/json' }, url: path });
  const res = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(data) { this.body = data; } };
  await routes.get(`exact:${path}`)(req, res);
  return { status: res.statusCode, body: res.body && JSON.parse(res.body) };
}
try {
  apply(ctx, { probeTimeoutMs: 10000, iconTimeoutMs: 10000, launchWatchMs: 1000 });
  const apps = await request('/open-in-app/apps', 'GET');
  assert.equal(apps.status, 200);
  assert.ok(apps.body.apps.includes('vscode'), `VS Code is not listed: ${JSON.stringify(apps.body)}`);
  console.log('Detected VS Code in the original application catalog.');
  const opened = await request('/open-in-app/open', 'POST', { app: 'vscode', path: 'D:\\xuyl\\tool\\DSH' });
  assert.equal(opened.status, 200, JSON.stringify(opened));
  assert.equal(opened.body.ok, true);
  console.log('Original route and fixed launcher accepted the workspace open request.');
} finally {
  while (disposers.length) disposers.pop()();
  assert.equal(routes.size, 0);
}
