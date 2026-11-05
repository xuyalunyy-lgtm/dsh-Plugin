import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { patchIdle } from '../idle-patch.mjs';
import { patchSource as patchBackend } from '../backend-patch.mjs';
import { patchSessionStore } from '../lifecycle-patch.mjs';

const root = new URL('../staging/runtime/dsh/node_modules/@deepseek-ai/', import.meta.url);
const load = name => import(new URL(`${name}/lib/index.js`, root));
const candidates = [];
async function candidate(name, patch) {
  const original = new URL(`${name}/lib/index.js`, root);
  const url = new URL(`${name}/lib/idle-candidate-${process.pid}.mjs`, root);
  await writeFile(url, patch(await readFile(original, 'utf8')));
  candidates.push(url);
  return import(url.href);
}
const { Context } = await load('cordis');
const { SessionStore } = await candidate('dsh-session', patchSessionStore);
const { AgentRegistry } = await load('dsh-agent');
const { SessionProjectionRegistry } = await load('dsh-session-projection');
const { SystemPrompt } = await load('dsh-system-prompt');
const loopModule = await candidate('dsh-agent-loop', patchIdle);
const backendModule = await candidate('dsh-session-persistence-jsonl', patchBackend);
test.after(async () => { for (const url of candidates) await unlink(url); });

function deferred() { let resolve; const promise = new Promise(value => { resolve = value; }); return { promise, resolve }; }
async function host() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-idle-real-'));
  const ctx = new Context();
  const sessions = new SessionStore(ctx);
  new SessionProjectionRegistry(ctx);
  const agentFiber = ctx.plugin(AgentRegistry); await agentFiber.await();
  const backendFiber = ctx.plugin(backendModule, { root: join(dir, 'logs'), compression: 'none', listConcurrency: 3 }); await backendFiber.await();
  // No model calls can execute: these ordinary registered dependencies are
  // inert until a turn is admitted. All Agent lifecycle/registry/persistence
  // implementations under test are the real extracted packages.
  ctx.provide('llm', {}); ctx.provide('tools', {});
  new SystemPrompt(ctx, { includeHarnessIdentity: false, includeRuntimeContext: false });
  const loopFiber = ctx.plugin(loopModule.default, { agents: [], maxParallelToolCalls: 1 }); await loopFiber.await();
  const loop = ctx.agentLoop;
  const handle = await ctx.agents.create({ sessionId: 'idle-owned-session', meta: { cwd: dir } });
  return { ctx, sessions, loop, handle, dir, async close() {
    await handle.dispose(); await loopFiber.dispose(); await backendFiber.dispose(); await agentFiber.dispose();
    assert.equal(dirname(dir), tmpdir()); await rm(dir, { recursive: true, force: true });
  } };
}

const code = value => error => error.code === value && error.purgeCommitted === false;

test('exact patch refuses mismatched source and repeat application', async () => {
  const source = await readFile(new URL('dsh-agent-loop/lib/index.js', root), 'utf8');
  assert.throws(() => patchIdle('wrong'), /baseline/);
  assert.throws(() => patchIdle(patchIdle(source)), /already applied/);
});

test('real idle owned Agent releases writer and registries only under purge admission gate', async () => {
  const f = await host();
  try {
    await assert.rejects(f.loop.releaseIdleForPurge(f.handle.agent.id), code('PURGE_ADMISSION_REQUIRED'));
    assert.equal(f.ctx.agents.get(f.handle.agent.id), f.handle.agent);
    const gate = f.sessions.reservePurge(f.handle.agent.id, { allowLoaded: true });
    const before = f.handle.agent.session.snapshotEvents();
    assert.deepEqual(await f.loop.releaseIdleForPurge(f.handle.agent.id), { released: true });
    assert.equal(f.ctx.agents.get(f.handle.agent.id), undefined);
    assert.equal(f.sessions.get(f.handle.agent.id), undefined);
    assert.deepEqual(f.handle.agent.session.snapshotEvents(), before, 'idle teardown must not append cancellation or discard input');
    const writer = await f.ctx.sessionPersistence.open(f.handle.agent.id, 'write'); await writer.close();
    gate.release({ purgeCommitted: false });
  } finally { await f.close(); }
});

test('pending inbox rejects without clearing input or disposing Agent', async () => {
  const f = await host();
  try {
    f.handle.agent.inject({ id: 'queued-id', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'pending' }] });
    const gate = f.sessions.reservePurge(f.handle.agent.id, { allowLoaded: true });
    const before = f.handle.agent.session.snapshotEvents();
    await assert.rejects(f.loop.releaseIdleForPurge(f.handle.agent.id), code('PURGE_SESSION_BUSY'));
    assert.equal(f.handle.agent.inbox.hasPending, true);
    assert.equal(f.ctx.agents.get(f.handle.agent.id), f.handle.agent);
    assert.deepEqual(f.handle.agent.session.snapshotEvents(), before);
    gate.release({ purgeCommitted: false });
  } finally { await f.close(); }
});

test('maintenance is not releasable even though public status is idle; it is never cancelled', async () => {
  const f = await host(); const blocker = deferred(); let signal;
  try {
    const maintenance = f.handle.agent.runMaintenance(value => { signal = value; return blocker.promise; });
    assert.equal(f.handle.agent.status, 'idle');
    const gate = f.sessions.reservePurge(f.handle.agent.id, { allowLoaded: true });
    await assert.rejects(f.loop.releaseIdleForPurge(f.handle.agent.id), code('PURGE_SESSION_BUSY'));
    assert.equal(signal.aborted, false);
    gate.release({ purgeCommitted: false }); blocker.resolve(); await maintenance;
  } finally { blocker.resolve(); await f.close(); }
});

test('running real Agent is refused before cancellation or disposal', async () => {
  const f = await host(); const entered = deferred(), resume = deferred();
  try {
    f.handle.agent.model.current = () => ({ provider: 'isolated', model: 'unused' });
    f.ctx.tools.resolve = async () => { entered.resolve(); await resume.promise; throw Error('isolated driver boundary stopped'); };
    f.handle.agent.followup({ id: 'running-id', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'pending running turn' }] });
    await entered.promise;
    assert.equal(f.handle.agent.status, 'running');
    const signal = f.handle.agent.phase.abort.signal;
    const gate = f.sessions.reservePurge(f.handle.agent.id, { allowLoaded: true });
    const seq = f.handle.agent.session.seq;
    await assert.rejects(f.loop.releaseIdleForPurge(f.handle.agent.id), code('PURGE_SESSION_BUSY'));
    assert.equal(signal.aborted, false); assert.equal(f.ctx.agents.get(f.handle.agent.id), f.handle.agent);
    assert.equal(f.handle.agent.session.seq, seq);
    gate.release({ purgeCommitted: false }); resume.resolve(); await f.handle.agent.whenIdle();
  } finally { resume.resolve(); await f.close(); }
});

test('activity provider prevents release without invoking cancellation', async () => {
  const f = await host();
  try {
    const stop = f.ctx.on('workspace/session-activity', async (_request, next) => [...await next(), { kind: 'job' }]);
    const gate = f.sessions.reservePurge(f.handle.agent.id, { allowLoaded: true });
    await assert.rejects(f.loop.releaseIdleForPurge(f.handle.agent.id), code('PURGE_SESSION_BUSY'));
    assert.equal(f.ctx.agents.get(f.handle.agent.id), f.handle.agent);
    gate.release({ purgeCommitted: false }); stop();
  } finally { await f.close(); }
});

test('purge gate rejects prompt/followup/steer/inject/maintenance/wake and competing resume during asynchronous check', async () => {
  const f = await host(); const entered = deferred(), unblock = deferred();
  try {
    const stop = f.ctx.on('workspace/session-activity', async (_request, next) => { entered.resolve(); await unblock.promise; return next(); });
    const gate = f.sessions.reservePurge(f.handle.agent.id, { allowLoaded: true });
    const releasing = f.loop.releaseIdleForPurge(f.handle.agent.id);
    await entered.promise;
    const message = { id: 'race-input', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'must not queue' }] };
    const before = f.handle.agent.session.seq;
    for (const send of [() => f.handle.agent.followup(message), () => f.handle.agent.steer(message), () => f.handle.agent.inject(message), () => f.handle.agent.inbox.append('next-turn', message), () => f.handle.agent.inbox.splice('next-step', 0, 0, [message]), () => f.handle.agent.runMaintenance(() => {}), () => f.handle.agent.wakeDriver()]) assert.throws(send, /删除/);
    await assert.rejects(f.ctx.agents.resume({ resumeSessionId: f.handle.agent.id }), /删除/);
    assert.equal(f.handle.agent.session.seq, before); assert.equal(f.handle.agent.inbox.hasPending, false);
    unblock.resolve(); await releasing;
    gate.release({ purgeCommitted: true }); stop();
    assert.throws(() => f.sessions.prepare(f.handle.agent.id), /删除/);
  } finally { unblock.resolve(); await f.close(); }
});
