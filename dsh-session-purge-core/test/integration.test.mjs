import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { patchSource as patchBackend } from '../backend-patch.mjs';
import { patchSessionStore } from '../lifecycle-patch.mjs';
import { patchWorkspace } from '../workspace-patch.mjs';
import { patchIdle } from '../idle-patch.mjs';
import { upgradeNeverPurgeSource } from '../derived-patch.mjs';
const root = new URL('../staging/runtime/dsh/node_modules/@deepseek-ai/', import.meta.url);
const load = name => import(new URL(`${name}/lib/index.js`, root));
const candidates = [];
async function candidate(name, patch) {
  const original = new URL(`${name}/lib/index.js`, root);
  const url = new URL(`${name}/lib/integration-candidate-${process.pid}.mjs`, root);
  await writeFile(url, patch(await readFile(original, 'utf8')));
  candidates.push(url);
  return import(url.href);
}
const backendModule = await candidate('dsh-session-persistence-jsonl', patchBackend);
const { SessionStore, Session, SESSION_FORMAT_VERSION } = await candidate('dsh-session', patchSessionStore);
const { WorkspaceRegistry } = await candidate('dsh-workspace', patchWorkspace);
const { Context, Service } = await load('cordis');
const { default: Query } = await candidate('dsh-session-query-sqlite', upgradeNeverPurgeSource);
const { default: Cache } = await load('dsh-session-projection-cache');
const { SessionProjectionRegistry } = await load('dsh-session-projection');
const { DomainFacility } = await load('dsh-storage-domain');
const { JsonStorageBackend } = await load('dsh-storage-json');
const { AgentRegistry } = await load('dsh-agent');
const { SystemPrompt } = await load('dsh-system-prompt');
const loopModule = await candidate('dsh-agent-loop', patchIdle);
test.after(async () => { for (const url of candidates) await unlink(url); });

async function restartableHost(dir, openAt = 'first-search') {
  const ctx = new Context();
  const sessions = new SessionStore(ctx);
  const backend = ctx.plugin(backendModule, { root: join(dir, 'logs'), compression: 'none', listConcurrency: 3 });
  await backend.await();
  const json = new JsonStorageBackend(join(dir, 'domains'));
  ctx.provide('storage', { backend: { get: () => json } });
  const domains = new DomainFacility(ctx, { backend: 'json' });
  ctx.provide('storageDomain', domains);
  new SessionProjectionRegistry(ctx);
  const cacheFiber = ctx.plugin(Cache, { writeEveryEvents: 100, writeIntervalMs: 10000 });
  await cacheFiber.await();
  const queryFiber = ctx.plugin(Query, { path: join(dir, 'query.sqlite'), openAt });
  await queryFiber.await();
  const registryFiber = ctx.plugin(WorkspaceRegistry);
  await registryFiber.await();
  return {
    ctx, sessions, cache: ctx.sessionProjectionCache, query: ctx.sessionQuery, registry: ctx.workspaceRegistry,
    close: async () => {
      await registryFiber.dispose(); await queryFiber.dispose(); await cacheFiber.dispose();
      await domains.closeAll(); await json.close(); await backend.dispose();
    }
  };
}

for (const openAt of ['first-search', 'never']) test(`real loaded idle Agent workspace purge with query openAt ${openAt}`, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-purge-idle-integration-'));
  let host, agentFiber, loopFiber, handle;
  try {
    host = await restartableHost(dir, openAt);
    const ctx = host.ctx;
    agentFiber = ctx.plugin(AgentRegistry); await agentFiber.await();
    ctx.provide('llm', {}); ctx.provide('tools', {});
    new SystemPrompt(ctx, { includeHarnessIdentity: false, includeRuntimeContext: false });
    loopFiber = ctx.plugin(loopModule.default, { agents: [], maxParallelToolCalls: 1 }); await loopFiber.await();
    const header = { version: SESSION_FORMAT_VERSION, id: 'idle-integration-target', createdAt: 300, cwd: dir, isSeeded: false };
    const session = Session.create(header.id, [], header);
    session.append('user/message', { id: 'idle-message', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'idlepurgeuniqueneedle' }] }, { surfaceOp: 'append' });
    const writer = await ctx.sessionPersistence.create(header);
    await writer.append(session.snapshotEvents()); await writer.flush(); await writer.close();
    handle = await ctx.agents.resume({ resumeSessionId: header.id });
    assert.equal(handle.agent.status, 'idle');
    assert.equal(ctx.agents.get(header.id), handle.agent);
    assert.equal(host.sessions.get(header.id), handle.agent.session);
    await host.registry.archiveSession(header.id);
    await host.cache.write(handle.agent.session);
    if (openAt === 'never') await assert.rejects(host.query.searchSessions({ query: 'idlepurgeuniqueneedle' }), { code: 'SESSION_QUERY_SEARCH_DISABLED' });
    else assert.equal((await host.query.searchSessions({ query: 'idlepurgeuniqueneedle' })).items.length, 1);
    const before = handle.agent.session.snapshotEvents();
    const request = { sessionId: header.id, requestId: 'idle-integration-purge-0001', expectedRevision: (await ctx.sessionPersistence.stat(header.id)).revision };
    assert.equal((await host.registry.purgeArchivedSession(request)).status, 'deleted');
    assert.deepEqual(handle.agent.session.snapshotEvents(), before, 'purge must not start a turn or append cancellation');
    assert.equal(ctx.agents.get(header.id), undefined);
    assert.equal(host.sessions.get(header.id), undefined);
    assert.equal(await ctx.sessionPersistence.stat(header.id), undefined);
    assert.equal((await ctx.sessionPersistence.purgeStatus(request)).phase, 'done');
    assert.equal(host.cache.requireTable().get(header.id), undefined);
    if (openAt === 'never') {
      assert.equal(host.query._db, undefined);
      await assert.rejects(host.query.searchSessions({ query: 'idlepurgeuniqueneedle' }), { code: 'SESSION_QUERY_SEARCH_DISABLED' });
    } else assert.equal((await host.query.searchSessions({ query: 'idlepurgeuniqueneedle' })).items.length, 0);
    assert.equal(host.registry.headers.has(header.id), false);
  } finally {
    await handle?.dispose(); await loopFiber?.dispose(); await agentFiber?.dispose(); await host?.close();
    assert.equal(dirname(dir), tmpdir()); await rm(dir, { recursive: true, force: true });
  }
});

test('real startup recovers begun cleanup without an explicit retry and restores done admission guards', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-purge-restart-'));
  let host;
  try {
    host = await restartableHost(dir);
    const header = { version: SESSION_FORMAT_VERSION, id: 'restart-target', createdAt: 200, cwd: dir, isSeeded: false };
    const session = Session.create(header.id, [], header);
    session.append('user/message', { id: 'restart-message', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'restartpurgen eedle' }] }, { surfaceOp: 'append' });
    const writer = await host.ctx.sessionPersistence.create(header);
    await writer.append(session.snapshotEvents()); await writer.flush(); await writer.close();
    await host.registry.archiveSession(header.id);
    await host.cache.write(session);
    assert.equal((await host.query.searchSessions({ query: 'restartpurgen' })).items.length, 1);
    const request = { sessionId: header.id, requestId: 'restart-purge-request-0001', expectedRevision: (await host.ctx.sessionPersistence.stat(header.id)).revision };
    host.query._deleteSession = () => { throw new Error('restart injected query failure'); };
    await assert.rejects(host.registry.purgeArchivedSession(request), error => error.purgeCommitted === true && /injected/.test(error.message));
    assert.equal((await host.ctx.sessionPersistence.purgeStatus(request)).phase, 'begun');
    assert.ok(host.cache.requireTable().get(header.id));
    await host.close(); host = undefined;
    host = await restartableHost(dir);
    // No manual purge call and no search reconciliation before these checks.
    assert.equal((await host.ctx.sessionPersistence.purgeStatus(request)).phase, 'done');
    assert.equal(host.cache.requireTable().get(header.id), undefined);
    assert.equal(host.query._requireDb().prepare('SELECT count(*) AS n FROM persisted_docs').get().n, 0);
    assert.equal((await host.ctx.sessionPersistence.list()).length, 0);
    assert.throws(() => host.sessions.prepare(header.id), /删除/);
    await host.close(); host = undefined;
    host = await restartableHost(dir);
    assert.equal((await host.ctx.sessionPersistence.purgeStatus(request)).phase, 'done');
    assert.throws(() => host.sessions.prepare(header.id), /删除/);
    assert.throws(() => host.sessions.prepare('restart-child', { meta: { parentSession: header.id } }), /删除/);
  } finally {
    await host?.close();
    assert.equal(dirname(dir), tmpdir());
    await rm(dir, { recursive: true, force: true });
  }
});
test('real native packages: cold archive purge clears log, registry, SQLite, cache and replays receipt', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-purge-integration-'));
  const ctx = new Context();
  const sessions = new SessionStore(ctx);
  const backend = ctx.plugin(backendModule, { root: join(dir, 'logs'), compression: 'none', listConcurrency: 3 });
  await backend.await();
  const json = new JsonStorageBackend(join(dir, 'domains'));
  ctx.provide('storage', { backend: { get: () => json } });
  const domains = new DomainFacility(ctx, { backend: 'json' });
  ctx.provide('storageDomain', domains);
  new SessionProjectionRegistry(ctx);
  const cache = new Cache(ctx, { writeEveryEvents: 100, writeIntervalMs: 10000 });
  const query = new Query(ctx, { path: join(dir, 'query.sqlite'), openAt: 'first-search' });
  try {
    await cache[Service.init]();
    const header = { version: SESSION_FORMAT_VERSION, id: 'integration-target', createdAt: 100, cwd: dir, isSeeded: false };
    const session = Session.create(header.id, [], header);
    session.append('user/message', { id: 'integration-message', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'purgeintegrationneedle' }] }, { surfaceOp: 'append' });
    const writer = await ctx.sessionPersistence.create(header);
    await writer.append(session.snapshotEvents());
    await writer.flush(); await writer.close();
    const registry = new WorkspaceRegistry(ctx);
    await registry[Service.init]();
    await registry.archiveSession(header.id);
    await cache.write(session);
    const before = await query.searchSessions({ query: 'purgeintegrationneedle' });
    assert.equal(before.items.length, 1);
    assert.ok(cache.requireTable().get(header.id));
    const revision = (await ctx.sessionPersistence.stat(header.id)).revision;
    const request = { sessionId: header.id, requestId: 'integration-purge-request-0001', expectedRevision: revision };
    const deleteSession = query._deleteSession.bind(query);
    query._deleteSession = () => { throw new Error('injected SQLite cleanup failure'); };
    await assert.rejects(registry.purgeArchivedSession(request), error => error.purgeCommitted === true && /injected/.test(error.message));
    assert.equal(await ctx.sessionPersistence.stat(header.id), undefined);
    assert.equal((await ctx.sessionPersistence.purgeStatus(request)).phase, 'begun');
    query._deleteSession = deleteSession;
    const result = await registry.purgeArchivedSession(request);
    assert.equal(result.status, 'deleted');
    assert.equal(await ctx.sessionPersistence.stat(header.id), undefined);
    assert.equal((await ctx.sessionPersistence.list()).length, 0);
    await assert.rejects(query.readSession(header.id));
    assert.equal((await query.searchSessions({ query: 'purgeintegrationneedle' })).items.length, 0);
    assert.equal(cache.requireTable().get(header.id), undefined);
    assert.equal(registry.headers.has(header.id), false);
    assert.equal(registry.requireState().archivedSessionIds.includes(header.id), false);
    for (const workspace of registry.entities.values()) assert.equal(workspace.sessionIds.includes(header.id), false);
    assert.deepEqual(await registry.purgeArchivedSession(request), result);
    assert.throws(() => sessions.prepare(header.id), /删除/);
  } finally {
    await query.close(); await domains.closeAll(); await json.close(); await backend.dispose();
    assert.equal(dirname(dir), tmpdir());
    await rm(dir, { recursive: true, force: true });
  }
});
