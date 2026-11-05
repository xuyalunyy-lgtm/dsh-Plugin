import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { upgradeNeverPurgeSource } from '../derived-patch.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = new URL('../staging/runtime/dsh/node_modules/@deepseek-ai/', import.meta.url);
const load = name => import(new URL(`${name}/lib/index.js`, root));
const { Context, Service } = await load('cordis');
const candidate = new URL(`dsh-session-query-sqlite/lib/derived-never-${process.pid}.mjs`, root);
await writeFile(candidate, upgradeNeverPurgeSource(await readFile(new URL('dsh-session-query-sqlite/lib/index.js', root), 'utf8')));
const { default: Query } = await import(candidate.href);
test.after(async () => { await unlink(candidate); });
const { default: BaseQuery } = await load('dsh-session-query');
const { default: Cache } = await load('dsh-session-projection-cache');
const { DomainFacility } = await load('dsh-storage-domain');
const { JsonStorageBackend } = await load('dsh-storage-json');
const { Session, SESSION_FORMAT_VERSION } = await load('dsh-session');
function context() {
  const ctx = new Context();
  ctx.provide('sessions', { get: () => undefined, list: () => [] });
  ctx.provide('sessionPersistence', { purgeEntries: async () => [{ request: { sessionId: 'target' }, phase: 'begun' }], list: async () => [] });
  return ctx;
}
const header = { id: 'target', version: SESSION_FORMAT_VERSION, createdAt: 100, isSeeded: false };
test('real SQLite purge removes persisted/live FTS rows and advances generation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-derived-'));
  const ctx = context();
  const query = new Query(ctx, { path: join(dir, 'search.sqlite'), openAt: 'first-search' });
  try {
    await query.searchSessions({ query: 'needle' });
    const session = Session.create('target', [], header);
    session.append('user/message', { role: 'user', content: [{ type: 'text', text: 'needle' }] }, { surfaceOp: 'append' });
    const entry = { header, inheritedEventCount: 0, events: session.snapshotEvents(), documents: [] };
    // Populate using the backend's own document writer, not an imitation database.
    entry.documents = (await load('dsh-session-query')).buildSessionEventSearchDocuments(header.id, entry.events);
    query._replacePersistedSession(entry, 'revision', 1);
    query._replaceLiveSession({ ...entry, fingerprint: 'stale-live' }, 1, true);
    query._observations.cache.set('target', { refs: 1 });
    const db = query._requireDb();
    assert.equal(db.prepare('SELECT count(*) AS n FROM persisted_sessions').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM persisted_docs').get().n, 1);
    const before = query._globalGeneration;
    let unblock;
    const blocking = new Promise(resolve => { unblock = resolve; });
    const acceptedSearch = query._serialized(undefined, () => blocking);
    const purge = query.purgeSessionData('target');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(db.prepare('SELECT count(*) AS n FROM persisted_docs').get().n, 1);
    unblock();
    await acceptedSearch;
    await purge;
    assert.equal(db.prepare('SELECT count(*) AS n FROM persisted_sessions').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM persisted_docs').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM temp.live_docs').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM temp.live_sessions').get().n, 0);
    assert.equal(query._observations.cache.has('target'), false);
    query._observations.store('target', { refs: 0 });
    assert.equal(query._observations.cache.has('target'), false);
    await assert.rejects(query.observeSession('target'), { code: 'SESSION_QUERY_SESSION_NOT_FOUND' });
    assert.ok(query._globalGeneration > before);
    await query.purgeSessionData('target');
    assert.equal(db.prepare('SELECT global_generation AS n FROM search_state').get().n, 2);
  } finally { await query.close(); await rm(dir, { recursive: true, force: true }); }
});
test('unknown backend refuses purge; never maintenance does not create an absent database', async () => {
  const base = new BaseQuery(context());
  await assert.rejects(base.purgeSessionData('target'), { code: 'PURGE_UNSUPPORTED' });
  const dir = await mkdtemp(join(tmpdir(), 'dsh-never-absent-'));
  const path = join(dir, 'absent-parent', 'index.sqlite');
  const query = new Query(context(), { path, openAt: 'never' });
  try {
    query.assertPurgeSupported();
    await query.purgeSessionData('target');
    assert.equal(query._db, undefined);
    await assert.rejects(stat(join(dir, 'absent-parent')), { code: 'ENOENT' });
    await assert.rejects(query.searchSessions({ query: 'needle' }), { code: 'SESSION_QUERY_SEARCH_DISABLED' });
  } finally { await query.close(); await rm(dir, { recursive: true, force: true }); }
});
test('never maintenance deletes existing durable FTS rows, bumps generation, keeps search disabled', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-never-existing-'));
  const path = join(dir, 'index.sqlite');
  const seed = new Query(context(), { path, openAt: 'first-search' });
  let query;
  try {
    await seed.searchSessions({ query: 'needle' });
    const documents = [{ sessionId: 'target', seq: 0, type: 'user/message', time: 1, surface: 'current', text: 'needle' }];
    seed._replacePersistedSession({ header, inheritedEventCount: 0, documents }, 'revision', 1);
    await seed.close();
    query = new Query(context(), { path, openAt: 'never' });
    await assert.rejects(query.searchSessions({ query: 'needle' }), { code: 'SESSION_QUERY_SEARCH_DISABLED' });
    assert.equal(query._db, undefined);
    await query.purgeSessionData('target');
    const db = query._requireDb();
    assert.equal(db.prepare('SELECT count(*) AS n FROM persisted_docs').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM persisted_sessions').get().n, 0);
    assert.equal(db.prepare('SELECT global_generation AS n FROM search_state').get().n, 1);
    await assert.rejects(query.searchSessions({ query: 'needle' }), { code: 'SESSION_QUERY_SEARCH_DISABLED' });
    await query.close();
    const { DatabaseSync } = await import('node:sqlite');
    const reopened = new DatabaseSync(path);
    try { assert.equal(reopened.prepare('SELECT count(*) AS n FROM persisted_docs').get().n, 0); }
    finally { reopened.close(); }
  } finally { await seed.close(); await query?.close(); await rm(dir, { recursive: true, force: true }); }
});
test('real JSON domain cache deletion persists; delayed writeback and restart tombstone cannot resurrect', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-derived-cache-'));
  const ctx = context();
  const backend = new JsonStorageBackend(dir);
  ctx.provide('storage', { backend: { get: () => backend } });
  const facility = new DomainFacility(ctx, { backend: 'json' });
  ctx.provide('storageDomain', facility);
  ctx.provide('sessionProjections', {});
  const cache = new Cache(ctx, { writeEveryEvents: 100, writeIntervalMs: 10000 });
  try {
    await cache[Service.init]();
    const identity = { formatVersion: SESSION_FORMAT_VERSION, createdAt: 100, isSeeded: false, inheritedEventCount: 0 };
    await cache.requireTable().put('target', { identity, rows: {} });
    assert.ok(cache.requireTable().get('target'));
    let release;
    const delayed = new Promise(resolve => { release = resolve; });
    const original = ctx.sessionPersistence.purgeEntries;
    ctx.sessionPersistence.purgeEntries = () => delayed;
    const write = cache.put('target', identity, {});
    ctx.sessionPersistence.purgeEntries = original;
    await cache.purgeSessionData('target');
    release([]); // stale lookup started before deletion must still see the local gate.
    await write;
    assert.equal(cache.requireTable().get('target'), undefined);
    cache.purged.clear(); // simulate fresh process: durable tombstone remains authoritative.
    await cache.put('target', identity, {});
    assert.equal(cache.requireTable().get('target'), undefined);
    await facility.closeAll();
    const reopened = await facility.open((await load('dsh-session-projection-cache')).projectionCacheDomainSpec);
    assert.equal(reopened.table('sessions').get('target'), undefined);
  } finally { await facility.closeAll(); await backend.close(); await rm(dir, { recursive: true, force: true }); }
});
