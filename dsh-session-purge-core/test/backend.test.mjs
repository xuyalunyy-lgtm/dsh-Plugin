import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm, copyFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { patchSource } from '../backend-patch.mjs';

const runtime = resolve(import.meta.dirname, '../staging/runtime/dsh');
const packageDir = join(runtime, 'node_modules/@deepseek-ai/dsh-session-persistence-jsonl');
const source = await readFile(join(packageDir, 'lib/index.js'), 'utf8');
const patched = patchSource(source);
// Load the transformed REAL backend in its dependency directory. A temporary
// module name prevents mutation of the extracted pristine candidate source.
const modulePath = join(packageDir, 'lib', `purge-isolated-test-${process.pid}.mjs`);
await writeFile(modulePath, patched);
const backend = await import(pathToFileURL(modulePath).href);
const { Context } = await import(pathToFileURL(join(runtime, 'node_modules/@deepseek-ai/cordis/lib/index.js')).href);
const resources = [];
test.after(async () => {
  for (const resource of resources.reverse()) await resource();
  await rm(modulePath, { force: true });
});

async function mount(root) {
  const ctx = new Context();
  const fiber = ctx.plugin(backend, { root, compression: 'none', listConcurrency: 3 });
  await fiber.await();
  const service = ctx.sessionPersistence;
  assert(service, 'real backend service mounted');
  let disposed = false;
  const close = async () => { if (!disposed) { disposed = true; await fiber.dispose(); } };
  resources.push(close);
  return { service, close };
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-purge-real-'));
  resources.push(async () => { assert(dirname(root) === tmpdir()); await rm(root, { recursive: true, force: true }); });
  const mounted = await mount(root);
  const header = { version: 4, id: 'cold-target', createdAt: 123, cwd: resolve(root, 'project'), isSeeded: false };
  const writer = await mounted.service.create(header);
  await writer.flush(); await writer.close();
  const snapshot = await mounted.service.stat(header.id);
  const request = { sessionId: header.id, requestId: 'real-purge-request-0001', expectedRevision: snapshot.revision };
  return { root, header, request, path: snapshot.location.path, dir: dirname(snapshot.location.path), ...mounted };
}
const isPurge = (code, committed) => error => error.code === code && error.purgeCommitted === committed;

test('generator refuses changed anchors and duplicate application', () => {
  assert.throws(() => patchSource('not the reviewed source'), /anchor mismatch/);
  assert.throws(() => patchSource(patched), /already applied/);
});

test('real JSONL begin hides reads and writes, deletes all generations, preserves lock and restart tombstone', async () => {
  const f = await fixture();
  const lower = join(f.dir, 'session.v3.jsonl');
  await copyFile(f.path, lower);
  // This is only an extra canonical filename; it is not selected/read as v3.
  const reader = await f.service.open(f.header.id, 'read');
  const lease = await f.service.reservePurge(f.request);
  assert.equal(await lease.read(), undefined);
  const begun = await lease.begin();
  assert.equal(begun.phase, 'begun');
  assert.equal(await f.service.stat(f.header.id), undefined);
  assert.equal((await f.service.list()).length, 0);
  await assert.rejects(f.service.open(f.header.id, 'read'), isPurge('PURGE_DELETED', true));
  await assert.rejects(reader.read(), isPurge('PURGE_DELETED', true));
  await reader.close();
  await assert.rejects(f.service.create(f.header), isPurge('PURGE_DELETED', true));
  await assert.rejects(f.service.create({ ...f.header, id: 'child-target', parentSession: f.header.id }), isPurge('PURGE_DELETED', true));
  await lease.remove();
  const files = await readdir(f.dir);
  assert(!files.some(name => name.endsWith('.jsonl')));
  assert((await stat(f.dir)).isDirectory());
  if (process.platform !== 'win32') assert(files.includes('session.lock'));
  assert.equal((await lease.complete()).phase, 'done');
  await lease.release(); await f.close();
  const restart = await mount(f.root);
  assert.equal(await restart.service.stat(f.header.id), undefined);
  assert.equal((await restart.service.purgeEntries())[0].phase, 'done');
  const replay = await restart.service.reservePurge(f.request);
  assert.equal((await replay.read()).phase, 'done');
  // A completed tombstone must still authorize physical cleanup if a namespace
  // deletion did not survive a crash; it must not merely hide an old file.
  await writeFile(f.path, 'returned generation bytes');
  await replay.remove();
  await assert.rejects(stat(f.path), error => error.code === 'ENOENT');
  await replay.release();
});

test('real writer claim prevents precommit purge and revision conflict removes nothing', async () => {
  const f = await fixture();
  const writer = await f.service.open(f.header.id, 'write');
  await assert.rejects(f.service.reservePurge(f.request), isPurge('PURGE_WRITER_HELD', false));
  await writer.close();
  await assert.rejects(f.service.reservePurge({ ...f.request, expectedRevision: 'not-current' }), isPurge('PURGE_CONFLICT', false));
  assert(await f.service.stat(f.header.id));
  assert.equal((await f.service.purgeEntries()).length, 0);
});

test('real pending child blocks purge before begin and parent reservation blocks new children', async () => {
  const f = await fixture();
  const child = await f.service.create({ ...f.header, id: 'pending-child', parentSession: f.header.id });
  await assert.rejects(f.service.reservePurge(f.request), isPurge('PURGE_REFERENCED', false));
  await child.close();
  const lease = await f.service.reservePurge(f.request);
  await assert.rejects(f.service.create({ ...f.header, id: 'racing-child', parentSession: f.header.id }), isPurge('PURGE_IN_PROGRESS', true));
  await lease.begin(); await lease.remove(); await lease.complete(); await lease.release();
});

test('two real backend instances contend on native journal/target leases', async () => {
  const f = await fixture();
  const other = await mount(f.root);
  const lease = await f.service.reservePurge(f.request);
  await assert.rejects(other.service.reservePurge(f.request), isPurge('PURGE_WRITER_HELD', false));
  await lease.release();
  const retry = await other.service.reservePurge(f.request);
  await retry.begin(); await retry.remove(); await retry.complete(); await retry.release();
});

for (const boundary of ['after-begin', 'after-generation:session.v4.jsonl', 'after-remove', 'after-complete']) {
  test(`real disk fault ${boundary} survives backend restart and exact replay`, async () => {
    const f = await fixture();
    let fired = false;
    f.service.purgeFaultHook = name => { if (!fired && name === boundary) { fired = true; throw Error(`fault:${name}`); } };
    const lease = await f.service.reservePurge(f.request);
    try {
      await lease.begin(); await lease.remove(); await lease.complete();
      assert.fail('fault boundary must fire');
    } catch (error) { assert.match(error.message, /fault:/); }
    assert(fired);
    await lease.release(); await f.close();
    const restart = await mount(f.root);
    assert.equal(await restart.service.stat(f.header.id), undefined);
    const recovered = await restart.service.reservePurge(f.request);
    assert(['begun', 'done'].includes((await recovered.read()).phase));
    await recovered.begin(); await recovered.remove(); await recovered.complete(); await recovered.release();
    assert.equal((await restart.service.purgeStatus(f.request)).phase, 'done');
  });
}

test('real immutable journal rejects request parameter reuse and a new request for same tombstone', async () => {
  const f = await fixture(), lease = await f.service.reservePurge(f.request);
  await lease.begin(); await lease.release();
  await assert.rejects(f.service.reservePurge({ ...f.request, expectedRevision: 'different' }), isPurge('PURGE_REQUEST_ID_REUSED', false));
  await assert.rejects(f.service.reservePurge({ ...f.request, requestId: 'real-purge-request-0002' }), isPurge('PURGE_REQUEST_ID_REUSED', false));
});
