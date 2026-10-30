import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import plugin from '../index.js';

// Real Cordis/DSH scope implementations, not replacement Context proxies.
// Activations are deferred in memory; no LLM, HTTP listener, or user profile.
const require = createRequire(import.meta.url);
const hostRequire = createRequire(require.resolve('@deepseek-ai/dsh-subagent'));
const { Context, Service } = hostRequire('@deepseek-ai/cordis');
const { createScope, scopeTarget } = hostRequire('@deepseek-ai/dsh-scope');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function waitForSignal(emitter, event, predicate, description) {
  if (predicate()) return;
  await new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer); emitter.off(event, check);
      error ? reject(error) : resolve();
    };
    const check = () => { if (predicate()) finish(); };
    const timer = setTimeout(() => finish(new Error(description)), 5000);
    emitter.on(event, check);
    check();
  });
}
function makeAgent(id, depth, parentSession) {
  return {
    id, options: { subagentDepth: depth }, status: 'idle',
    session: { id, header: { delegationDepth: depth, ...(parentSession ? { parentSession } : {}) } },
  };
}

async function createHost(t) {
  const tempRoot = await realpath(tmpdir());
  const profileDir = await mkdtemp(join(tempRoot, 'dsh-orchestrator-cordis-dag-'));
  const root = new Context();
  const tools = new Map();
  const active = new Map();
  const started = [];
  const notices = [];
  const signals = new EventEmitter();
  const events = [];
  const invocations = [];
  const owner = makeAgent('cordis-dag-root', 0);
  const unrelated = makeAgent('cordis-dag-unrelated', 0);
  owner.followup = message => { notices.push(message); signals.emit('notice'); };
  owner.steer = message => { notices.push(message); signals.emit('notice'); };
  const agents = new Map([[owner.id, owner], [unrelated.id, unrelated]]);
  let cwdReads = 0;
  let schedulerFiber;
  let ownerScope;
  let unrelatedScope;

  class Tools extends Service {
    constructor(ctx) { super(ctx, 'tools'); }
    get(name) { return tools.get(name); }
    register(definition) {
      return this.ctx.effect(() => {
        tools.set(definition.name, definition);
        return () => tools.delete(definition.name);
      });
    }
    guard() { return this.ctx.effect(() => () => {}); }
  }
  class Agents extends Service {
    constructor(ctx) { super(ctx, 'agents'); }
    get(id) { return agents.get(id); }
  }
  class WorkingDirectory extends Service {
    constructor(ctx) { super(ctx, 'workingDirectory'); }
    async ensure(agent) {
      assert.equal(agents.get(agent.id), agent);
      cwdReads++;
      return profileDir;
    }
  }
  class Profile extends Service {
    constructor(ctx) { super(ctx, 'profileContext'); this.dir = profileDir; }
  }
  class Subagents extends Service {
    constructor(ctx) { super(ctx, 'subagents'); }
    list() { return ['fork']; }
    getProvider(name) { return name === 'fork' ? { name } : undefined; }
    resolveMaxDepth() { return 1; }
    publish(name, info, parent) {
      // Same scoped dispatch as dsh-subagent createLifecycleEmitter: the
      // carrier is based on the exact traceable service and parent Agent.
      const args = [scopeTarget(this, parent), name, info];
      for (const callback of this.ctx.events.dispatch('emit', args)) callback(info);
      events.push({ name, id: info.id, runId: info.runId, stopReason: info.stopReason });
    }
    async startActivation(spec) {
      if (started.length === 2) {
        assert.ok(started[0].finished && started[1].finished, 'C cannot be accepted before both A and B emit completion');
        assert.match(spec.request.prompt[0].text, /ALPHA_DEPENDENCY_RESULT/);
        assert.match(spec.request.prompt[0].text, /BETA_DEPENDENCY_RESULT/);
      }
      assert.equal(spec.request.parent, owner, 'real root identity reaches the backend');
      assert.equal(spec.delivery, 'caller');
      assert.equal(spec.request.maxDepth, 1);
      assert.equal(spec.request.cwd, profileDir);
      const child = makeAgent(`cordis-dag-child-${started.length + 1}`, 1, owner.id);
      agents.set(child.id, child);
      const completion = deferred();
      const info = { id: child.id, provider: spec.provider, runId: `cordis-run-${started.length + 1}`, local: true };
      const service = this;
      const call = { spec, child, info, completion, finished: false };
      call.finish = text => {
        assert.equal(call.finished, false, 'a fixture activation settles once');
        call.finished = true;
        active.delete(child.id);
        service.publish('subagent/end', { ...info, stopReason: 'completed', lastAssistantMessage: [{ type: 'text', text }] }, owner);
        completion.resolve({ stopReason: 'completed', output: [{ type: 'text', text }] });
      };
      started.push(call);
      active.set(child.id, call);
      this.publish('subagent/start', info, owner);
      signals.emit('accepted');
      return {
        childId: child.id, result: completion.promise,
        dispose: async () => {
          if (call.finished) return;
          call.finished = true;
          active.delete(child.id);
          service.publish('subagent/end', { ...info, stopReason: 'aborted' }, owner);
          completion.resolve({ stopReason: 'aborted', output: [] });
        },
      };
    }
  }
  const provider = root.plugin({
    name: 'cordis-dag-test-services',
    apply(ctx) {
      new Tools(ctx); new Agents(ctx); new WorkingDirectory(ctx); new Profile(ctx); new Subagents(ctx);
      ctx.provide('systemPrompt', { getSectionOrder: () => 600, getContextOrder: () => 125, section: () => () => {}, context: () => () => {} });
    },
  });
  await provider;
  let ownEnds = 0;
  let unrelatedEnds = 0;
  ownerScope = createScope(root, owner);
  unrelatedScope = createScope(root, unrelated);
  ownerScope.ctx.on('subagent/end', () => { ownEnds++; });
  unrelatedScope.ctx.on('subagent/end', () => { unrelatedEnds++; });
  t.after(async () => {
    try {
      if (schedulerFiber) await schedulerFiber.dispose();
      await ownerScope?.dispose();
      await unrelatedScope?.dispose();
      await provider.dispose();
      assert.equal(active.size, 0);
      assert.equal(tools.size, 0);
    } finally {
      const target = await realpath(profileDir);
      assert.equal(dirname(target).toLowerCase(), tempRoot.toLowerCase());
      assert.ok(basename(target).startsWith('dsh-orchestrator-cordis-dag-'));
      assert.equal(target, resolve(profileDir));
      await rm(target, { recursive: true, force: false });
    }
  });
  schedulerFiber = root.plugin(plugin, { enabled: true, mode: 'prompt', preferredParallelism: 2 });
  await schedulerFiber;
  assert.equal(schedulerFiber.state, 2);
  const tool = tools.get('orchestrator_plan');
  assert.ok(tool, 'actual entry registers the real tool');
  return {
    owner, unrelated, started, active, notices, signals, events, profileDir, agents,
    ownEnds: () => ownEnds, unrelatedEnds: () => unrelatedEnds, cwdReads: () => cwdReads,
    invocations,
    async execute(request, caller = owner) {
      invocations.push(request.action);
      return tool.execute(request, { agent: caller, signal: new AbortController().signal });
    },
  };
}

test('real Cordis entry: scoped A/B activations automatically unblock C and persist one terminal report', async t => {
  const host = await createHost(t);
  const submitted = await host.execute({
    action: 'submit', requestId: 'cordis-real-entry-submit-0001',
    plan: {
      title: 'Scoped deferred DAG', maxConcurrency: 2,
      tasks: [
        { id: 'A', title: 'Independent A', prompt: 'PRIVATE_PROMPT_A: read only', dependsOn: [], writeResources: [], acceptance: 'Produce alpha.' },
        { id: 'B', title: 'Independent B', prompt: 'PRIVATE_PROMPT_B: read only', dependsOn: [], writeResources: [], acceptance: 'Produce beta.' },
        { id: 'C', title: 'Combine', prompt: 'PRIVATE_PROMPT_C: combine the dependency reports', dependsOn: ['A', 'B'], writeResources: [] },
      ],
    },
  });
  assert.equal(submitted.ok, true, `actual submit failed: ${JSON.stringify(submitted)}`);
  const jobId = submitted.plan.id;
  try {
    await waitForSignal(host.signals, 'accepted', () => host.started.length === 2, 'A and B must both be accepted without another dispatch tool call');
  } catch (error) {
    const snapshot = await host.execute({ action: 'get', jobId });
    assert.fail(`${error.message}; accepted=${host.started.length}; snapshot=${JSON.stringify(snapshot)}`);
  }
  assert.equal(host.active.size, 2, 'A/B overlap while both deferred results are pending');
  assert.equal(host.started.length, 2);
  assert.equal(host.cwdReads(), 1, 'real submit resolves cwd once through the registered service');
  assert.ok(host.started.every(call => call.child.session.header.delegationDepth === 1 && call.child.options.subagentDepth === 1 && call.child.session.header.parentSession === host.owner.id));

  const unauthorizedChild = await host.execute({ action: 'list' }, host.started[0].child);
  assert.equal(unauthorizedChild.code, 'UNAUTHORIZED', 'a real registered child never becomes root authority');
  const unauthorizedClone = await host.execute({ action: 'list' }, { ...host.owner });
  assert.equal(unauthorizedClone.code, 'UNAUTHORIZED', 'same-id root clones are not accepted');
  const [a, b] = host.started;
  assert.match(a.spec.request.prompt[0].text, /Independent A/);
  assert.match(b.spec.request.prompt[0].text, /Independent B/);
  a.finish('ALPHA_DEPENDENCY_RESULT');
  const partial = await host.execute({ action: 'get', jobId });
  assert.equal(partial.ok, true);
  assert.equal(partial.plan.tasks.find(task => task.id === 'C').state, 'pending');
  assert.equal(b.finished, false);
  assert.equal(host.started.length, 2, 'C cannot run until B is also complete');
  b.finish('BETA_DEPENDENCY_RESULT');
  // No tool operation, parent message, or manual scheduler wake between B ending
  // and C being accepted. This is the core event-driven continuation assertion.
  await waitForSignal(host.signals, 'accepted', () => host.started.length === 3, 'C must start automatically after both predecessor receipts');
  const c = host.started[2];
  const cStartIndex = host.events.findIndex(event => event.name === 'subagent/start' && event.id === c.child.id);
  for (const predecessor of [a, b]) {
    const endIndex = host.events.findIndex(event => event.name === 'subagent/end' && event.id === predecessor.child.id && event.stopReason === 'completed');
    assert.ok(endIndex >= 0 && endIndex < cStartIndex, 'C starts only after both actual scoped completion events');
  }
  assert.match(c.spec.request.prompt[0].text, /ALPHA_DEPENDENCY_RESULT/);
  assert.match(c.spec.request.prompt[0].text, /BETA_DEPENDENCY_RESULT/);
  assert.equal(host.active.size, 1);
  c.finish('COMBINED_DEPENDENCY_RESULT');
  await waitForSignal(host.signals, 'notice', () => host.notices.length === 1, 'the graph must emit exactly one terminal parent notice');
  const terminal = await host.execute({ action: 'get', jobId });
  assert.equal(terminal.ok, true);
  assert.equal(terminal.plan.status, 'completed');
  assert.deepEqual(terminal.plan.tasks.map(task => task.state), ['succeeded', 'succeeded', 'succeeded']);
  assert.ok(terminal.plan.tasks.every(task => task.result.verified === false));
  assert.equal(host.notices[0].source.kind, 'agent-orchestrator');
  assert.equal(host.ownEnds(), 3, 'real scopeTarget routes core events to the owning agent scope');
  assert.equal(host.unrelatedEnds(), 0, 'scoped events do not reach unrelated agent listeners');
  assert.equal(host.events.filter(event => event.name === 'subagent/start').length, 3);
  assert.equal(host.events.filter(event => event.name === 'subagent/end').length, 3);
  assert.equal(host.invocations.filter(action => action === 'submit').length, 1, 'only the initial graph is submitted');
  assert.ok(host.invocations.every(action => ['submit', 'list', 'get'].includes(action)), 'no followup control dispatch is used');

  const serialized = JSON.stringify(terminal);
  for (const secret of ['parentBindingId', 'bindingId', 'PRIVATE_PROMPT_', host.profileDir, host.owner.id]) {
    assert.ok(!serialized.includes(secret), `safe tool summary must not disclose ${secret}`);
  }
  const persisted = JSON.parse(await readFile(join(host.profileDir, 'plugin-data', 'agent-orchestrator', 'jobs.json'), 'utf8'));
  assert.equal(persisted.jobs.length, 1);
  assert.equal(persisted.jobs[0].status, 'completed');
  assert.equal(persisted.jobs[0].ownerSessionId, host.owner.id);
  assert.ok(persisted.jobs[0].tasks.every(task => task.attempt === 1 && task.state === 'succeeded'));
  for (let index = 0; index < 6; index++) await tick();
  assert.equal(host.notices.length, 1, 'reads and idle turns must not repeat completion notices');
});
