import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Optional entry override is only for proving this regression against an actual
// previous installed build, with the same assertions and real Context fixture.
const entry = process.env.DSH_ORCHESTRATOR_TEST_ENTRY
  ? pathToFileURL(resolve(process.env.DSH_ORCHESTRATOR_TEST_ENTRY)).href
  : new URL('../index.js', import.meta.url).href;
// Resolve the existing host dependency through dsh-tools; do not install or
// substitute Cordis. The Context proxy, plugin fibers, injection, and effects
// below are real. Other host services are deliberately inert in-memory stubs.
const localRequire = createRequire(import.meta.url);
const hostRequire = createRequire(localRequire.resolve('@deepseek-ai/dsh-tools'));
// Production resolves host peers through its loader; standalone Node cannot
// resolve them from the desktop file-install copy. The optional baseline loader
// maps only these exact peer ids to the real, already installed local packages.
const peerUrls = new Map(['@deepseek-ai/schemastery', '@deepseek-ai/dsh-subagent', '@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-llm']
  .map(name => [name, pathToFileURL(localRequire.resolve(name)).href]));
const baselineHook = process.env.DSH_ORCHESTRATOR_TEST_ENTRY ? registerHooks({
  resolve(specifier, context, nextResolve) {
    if (peerUrls.has(specifier)) return { url: peerUrls.get(specifier), shortCircuit: true };
    return nextResolve(specifier, context);
  },
}) : null;
let plugin;
try { ({ default: plugin } = await import(entry)); }
finally { baselineHook?.deregister(); }
const { Context, Service } = hostRequire('@deepseek-ai/cordis');
const cordisVersion = hostRequire('@deepseek-ai/cordis/package.json').version;
const pause = () => new Promise(resolve => setImmediate(resolve));

async function settleFibers(root) {
  // ctx.plugin apply is asynchronous and can register nested ctx.inject fibers.
  // Join actual fibers rather than assuming plugin.apply() means ready.
  for (let pass = 0; pass < 4; pass++) {
    const fibers = [...root.registry.values()].flatMap(runtime => [...runtime.fibers]);
    await Promise.all(fibers.map(fiber => fiber.await()));
    await pause();
  }
}

function agent(id, depth = 0) {
  return {
    id, session: { id, header: { delegationDepth: depth } }, options: {},
    status: 'idle', followup() {}, steer() {},
  };
}

async function createHost(t, { runtime = true } = {}) {
  const parent = await realpath(tmpdir());
  const profileDirectory = await mkdtemp(join(parent, 'dsh-orchestrator-cordis-'));
  const root = new Context();
  const tools = new Map();
  const guards = new Set();
  const rootAgent = agent('cordis-root');
  const childAgent = agent('cordis-child', 1);
  const liveAgents = new Map([[rootAgent.id, rootAgent], [childAgent.id, childAgent]]);
  const calls = { starts: 0, workingDirectories: 0 };
  const services = {
    systemPrompt: {
      getSectionOrder: () => 600, getContextOrder: () => 125,
      section: () => () => {}, context: () => () => {},
    },
    tools: {
      get: name => tools.get(name),
      register(definition) {
        tools.set(definition.name, definition);
        return () => tools.delete(definition.name);
      },
      guard(callback) { guards.add(callback); return () => guards.delete(callback); },
    },
    agents: { get: id => liveAgents.get(id) },
  };
  if (runtime) {
    Object.assign(services, {
      // Provide profileContext as a service, not an inherited plain property or
      // DSH_PROFILE_DIR override. This catches the second undeclared access.
      profileContext: { dir: profileDirectory },
      workingDirectory: {
        ensure: async exactAgent => {
          assert.equal(liveAgents.get(exactAgent.id), exactAgent);
          calls.workingDirectories++;
          return profileDirectory;
        },
      },
      subagents: {
        list: () => ['fork'], getProvider: name => name === 'fork' ? { name } : undefined,
        resolveMaxDepth: () => 1,
        async startActivation() {
          calls.starts++;
          throw new Error('This fixture must never start a model');
        },
      },
    });
  }
  class ToolsService extends Service {
    constructor(ctx) { super(ctx, 'tools'); }
    get(name) { return tools.get(name); }
    register(definition) {
      return this.ctx.effect(() => {
        tools.set(definition.name, definition);
        return () => tools.delete(definition.name);
      });
    }
    guard(callback) {
      return this.ctx.effect(() => {
        guards.add(callback);
        return () => guards.delete(callback);
      });
    }
  }
  const providerFiber = root.plugin({
    name: 'cordis-test-services',
    apply(ctx) {
      for (const [name, value] of Object.entries(services)) {
        if (name === 'tools') new ToolsService(ctx);
        else ctx.provide(name, value);
      }
    },
  });
  await providerFiber;
  const pluginFiber = root.plugin(plugin, { enabled: true, mode: 'prompt' });
  await pluginFiber;
  await settleFibers(root);
  assert.equal(pluginFiber.state, 2, 'the actual plugin fiber is active');
  assert.ok(tools.has('orchestrator_plan'), 'the actual entry registered its real defineTool');
  t.after(async () => {
    try {
      await pluginFiber.dispose();
      await providerFiber.dispose();
      assert.equal(tools.size, 0, 'Cordis disposal removed owned tool registrations');
      assert.equal(guards.size, 0, 'Cordis disposal removed owned guards');
    } finally {
      // Check the exact resolved absolute temporary target before removing it.
      const target = await realpath(profileDirectory);
      assert.equal(dirname(target).toLowerCase(), parent.toLowerCase());
      assert.ok(basename(target).startsWith('dsh-orchestrator-cordis-'));
      assert.equal(target, resolve(profileDirectory));
      await rm(target, { recursive: true, force: false });
    }
  });
  return {
    root, pluginFiber, tools, calls, rootAgent, childAgent, liveAgents,
    execute: request => tools.get('orchestrator_plan').execute(request, {
      agent: rootAgent, signal: new AbortController().signal,
    }),
  };
}

test('real Cordis 4.0.5: undeclared service access throws while public get bridges it', async () => {
  assert.equal(cordisVersion, '4.0.5');
  const root = new Context();
  const agents = { get: id => id };
  const provider = root.plugin({ name: 'access-contract-provider', apply(ctx) { ctx.provide('agents', agents); } });
  await provider;
  let consumer;
  const probe = root.plugin({ name: 'access-contract-probe', apply(ctx) { consumer = ctx; } });
  await probe;
  try {
    assert.equal(Context.is(consumer), true);
    assert.throws(() => consumer.agents, /cannot get property "agents" without inject/);
    assert.equal(consumer.get('agents'), agents);
    assert.equal(consumer.get('agents').get('root'), 'root');
  } finally { await probe.dispose(); await provider.dispose(); }
});

test('real Cordis plugin lifecycle: root list joins optional initialization and reads an empty temporary store', async t => {
  const host = await createHost(t);
  const value = await host.execute({ action: 'list' });
  assert.deepEqual(value, { ok: true, plans: [] }, 'root list must not collapse undeclared services into FAILED');
  assert.equal(host.calls.starts, 0, 'read-only list must not start a provider or model');
  assert.equal(host.calls.workingDirectories, 0, 'list does not need a submission cwd');
  const repeated = await host.execute({ action: 'list' });
  assert.deepEqual(repeated, value, 'same live root can read repeatedly without losing its service collection');
});

test('real Cordis plugin lifecycle: child, missing, and same-id forged callers remain unauthorized', async t => {
  const host = await createHost(t);
  const tool = host.tools.get('orchestrator_plan');
  for (const caller of [host.childAgent, undefined, { ...host.rootAgent }]) {
    const value = await tool.execute({ action: 'list' }, { agent: caller, signal: new AbortController().signal });
    assert.equal(value.ok, false);
    assert.equal(value.code, 'UNAUTHORIZED', 'dependency access must not swallow the explicit authority result');
  }
  assert.equal(host.calls.starts, 0);
});

test('real Cordis plugin lifecycle: missing optional runtime stays available but cannot dispatch', async t => {
  const host = await createHost(t, { runtime: false });
  const value = await host.execute({ action: 'list' });
  assert.equal(value.ok, false);
  assert.equal(value.code, 'SUBAGENTS_UNAVAILABLE');
  assert.ok(host.tools.has('orchestrator_status'), 'headless context retains diagnostics');
  assert.equal(host.calls.starts, 0);
});
