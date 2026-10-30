import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, realpath, rm, readdir } from 'node:fs/promises';
import { tmpdir, hostname } from 'node:os';
import { join, resolve, dirname, basename, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { openJobStore } from '../store.js';

// Every write is confined to a fresh OS temp directory. No real DSH profile,
// model, server, account or user task data is accessed by these tests.
async function fixture(t) {
  const base = await realpath(tmpdir());
  const directory = await mkdtemp(join(base, 'dsh-orchestrator-store-test-'));
  const stores = [];
  t.after(async () => {
    for (const store of stores.toReversed()) await store.close().catch(() => {});
    const target = await realpath(directory);
    assert.equal(target, resolve(directory), 'verify the exact absolute cleanup target');
    assert.equal(dirname(target), base, 'cleanup must stay in the OS temp root');
    assert.ok(basename(target).startsWith('dsh-orchestrator-store-test-'));
    assert.ok(isAbsolute(target));
    await rm(target, { recursive: true, force: true });
  });
  return {
    directory,
    data: join(directory, 'jobs.json'),
    lock: join(directory, 'writer.lock'),
    async open() { const store = await openJobStore({ directory }); stores.push(store); return store; },
  };
}
const errorCode = code => error => error?.code === code;
const lockRecord = extra => ({ pid: process.pid, hostname: hostname(), token: randomUUID(), createdAt: new Date().toISOString(), ...extra });

test('store: initializes durably, snapshots and update results are detached clones', async t => {
  const f = await fixture(t);
  const store = await f.open();
  assert.deepEqual(store.snapshot(), { version: 1, jobs: [], requests: {} });
  assert.deepEqual(JSON.parse(await readFile(f.data, 'utf8')), store.snapshot());
  const outside = store.snapshot();
  outside.jobs.push({ id: 'not-persisted' });
  assert.equal(store.snapshot().jobs.length, 0);
  const source = { id: 'job-1', nested: { value: 1 } };
  const result = await store.update(draft => { draft.jobs.push(source); return source; });
  source.nested.value = 9;
  result.nested.value = 7;
  assert.equal(store.snapshot().jobs[0].nested.value, 1);
  assert.deepEqual(JSON.parse(await readFile(f.data, 'utf8')), store.snapshot(), 'update resolves only after disk contains the published value');
  assert.ok((await readdir(f.directory)).every(name => !name.endsWith('.tmp')));
});

test('store: simultaneous updates serialize against the preceding committed draft', async t => {
  const f = await fixture(t);
  const store = await f.open();
  const results = await Promise.all(Array.from({ length: 24 }, (_, index) => store.update(draft => {
    const previous = draft.jobs.length;
    draft.jobs.push({ id: `job-${index}`, previous });
    return previous;
  })));
  assert.deepEqual(results, Array.from({ length: 24 }, (_, index) => index));
  assert.deepEqual(store.snapshot().jobs.map(job => job.previous), results);
  assert.deepEqual(JSON.parse(await readFile(f.data, 'utf8')), store.snapshot());
});

test('store: mutator exceptions and async mutators publish nothing and do not poison the store', async t => {
  const f = await fixture(t);
  const store = await f.open();
  await assert.rejects(store.update(draft => { draft.jobs.push({ id: 'discard' }); throw new Error('fixture failure'); }), /fixture failure/);
  await assert.rejects(store.update(async draft => { draft.jobs.push({ id: 'async-discard' }); }), errorCode('STORE_MUTATOR_ASYNC'));
  assert.equal(store.snapshot().jobs.length, 0);
  await store.update(draft => { draft.jobs.push({ id: 'valid-after-rejection' }); });
  assert.equal(store.snapshot().jobs[0].id, 'valid-after-rejection');
});

test('store: exclusive lifetime ownership rejects a second opener, then close permits reopen', async t => {
  const f = await fixture(t);
  const first = await f.open();
  await first.update(draft => { draft.jobs.push({ id: 'kept' }); });
  await assert.rejects(openJobStore({ directory: f.directory }), errorCode('STORE_LOCKED'));
  const lock = JSON.parse(await readFile(f.lock, 'utf8'));
  assert.equal(lock.pid, process.pid);
  assert.equal(lock.hostname, hostname());
  assert.match(lock.token, /^[a-f0-9-]{36}$/);
  await first.close();
  const next = await f.open();
  assert.equal(next.snapshot().jobs[0].id, 'kept');
});

for (const [name, content] of [
  ['malformed', '{not-json'],
  ['foreign-host', JSON.stringify(lockRecord({ hostname: 'definitely-another-host.invalid', pid: 2147483647 }))],
  ['live-local-process', JSON.stringify(lockRecord())],
]) {
  test(`store: does not reclaim ${name} writer locks`, async t => {
    const f = await fixture(t);
    await writeFile(f.lock, content, 'utf8');
    await assert.rejects(openJobStore({ directory: f.directory }), errorCode('STORE_LOCKED'));
    assert.equal(await readFile(f.lock, 'utf8'), content);
  });
}

test('store: only a proven exited same-host process lock can be reclaimed', async t => {
  const f = await fixture(t);
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore', windowsHide: true });
  const exited = once(child, 'exit');
  const pid = child.pid;
  assert.equal(typeof pid, 'number');
  const [code] = await exited;
  assert.equal(code, 0);
  assert.throws(() => process.kill(pid, 0), errorCode('ESRCH'), 'prove the PID has exited rather than guessing a stale PID');
  await writeFile(f.lock, JSON.stringify(lockRecord({ pid })), 'utf8');
  const store = await f.open();
  assert.deepEqual(store.snapshot().jobs, []);
  assert.equal(JSON.parse(await readFile(f.lock, 'utf8')).pid, process.pid);
  assert.ok((await readdir(f.directory)).every(name => !name.startsWith('writer.lock.takeover-')));
});

for (const [name, content] of [
  ['malformed JSON', '{broken'],
  ['unsupported version', JSON.stringify({ version: 999, jobs: [], requests: {} })],
  ['invalid shape', JSON.stringify({ version: 1, jobs: {}, requests: [] })],
  ['over 8 MiB', 'x'.repeat(8 * 1024 * 1024 + 1)],
]) {
  test(`store: ${name} is rejected without resetting the original file`, async t => {
    const f = await fixture(t);
    await writeFile(f.data, content, 'utf8');
    await assert.rejects(openJobStore({ directory: f.directory }), errorCode('STORE_CORRUPT'));
    assert.equal(await readFile(f.data, 'utf8'), content);
    await assert.rejects(readFile(f.lock), errorCode('ENOENT'), 'startup failure releases only its owned lock');
  });
}

test('store: lock loss rejects the write, preserves old JSON and poisons subsequent operations', async t => {
  const f = await fixture(t);
  const store = await f.open();
  const before = await readFile(f.data, 'utf8');
  const replacement = lockRecord();
  await writeFile(f.lock, JSON.stringify(replacement), 'utf8');
  await assert.rejects(store.update(draft => { draft.jobs.push({ id: 'must-not-publish' }); }), errorCode('STORE_WRITE_FAILED'));
  assert.equal(await readFile(f.data, 'utf8'), before);
  assert.throws(() => store.snapshot(), errorCode('STORE_WRITE_FAILED'));
  let mutatorRan = false;
  await assert.rejects(store.update(() => { mutatorRan = true; }), errorCode('STORE_WRITE_FAILED'));
  assert.equal(mutatorRan, false);
  await store.close();
  assert.equal(JSON.parse(await readFile(f.lock, 'utf8')).token, replacement.token, 'close must not remove another lock generation');
});

test('store: oversized mutation never publishes partial JSON and fails closed', async t => {
  const f = await fixture(t);
  const store = await f.open();
  const before = await readFile(f.data, 'utf8');
  await assert.rejects(store.update(draft => { draft.jobs.push({ id: 'oversized', result: 'x'.repeat(8 * 1024 * 1024) }); }), errorCode('STORE_WRITE_FAILED'));
  assert.equal(await readFile(f.data, 'utf8'), before);
  assert.throws(() => store.snapshot(), errorCode('STORE_WRITE_FAILED'));
  assert.ok((await readdir(f.directory)).every(name => !name.endsWith('.tmp')));
});

for (const [name, value] of [['undefined', undefined], ['NaN', NaN], ['Infinity', Infinity], ['negative zero', -0], ['Date', new Date(0)]]) {
  test(`store: lossy non-JSON ${name} is not silently normalized and published`, async t => {
    const f = await fixture(t);
    const store = await f.open();
    const before = await readFile(f.data, 'utf8');
    await assert.rejects(store.update(draft => { draft.jobs.push({ id: 'lossy', value }); }), errorCode('STORE_WRITE_FAILED'));
    assert.equal(await readFile(f.data, 'utf8'), before);
    assert.throws(() => store.snapshot(), errorCode('STORE_WRITE_FAILED'));
  });
}

test('store: close drains accepted updates, is idempotent, and rejects later use', async t => {
  const f = await fixture(t);
  const store = await f.open();
  const update = store.update(draft => { draft.jobs.push({ id: 'accepted-before-close' }); });
  const closing = store.close();
  assert.equal(store.close(), closing);
  await update;
  await closing;
  assert.equal(JSON.parse(await readFile(f.data, 'utf8')).jobs[0].id, 'accepted-before-close');
  assert.throws(() => store.snapshot(), errorCode('STORE_CLOSED'));
  await assert.rejects(store.update(() => {}), errorCode('STORE_CLOSED'));
});

test('store: requires an explicit absolute data directory', async () => {
  for (const directory of [undefined, '', '.', 'relative/tasks']) {
    await assert.rejects(openJobStore({ directory }), errorCode('STORE_UNAVAILABLE'));
  }
});
