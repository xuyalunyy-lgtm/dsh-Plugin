import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// This is a host-contract simulation, not proof of loading in a running DSH.
// The published schemastery package and plugin's index/policy are real. Only the
// two execution-host imports are substituted with their verified minimal shape.
// Node >= 22.15/23.5 supplies registerHooks without flags.
const depthModule = `
  export function delegationDepthOf(agent) {
    const runtime = agent.options.subagentDepth;
    if (runtime !== undefined && (!Number.isSafeInteger(runtime) || runtime < 0 || Object.is(runtime, -0))) {
      throw new TypeError('agent subagentDepth must be a non-negative safe integer');
    }
    return Math.max(agent.session.header.delegationDepth ?? 0, runtime ?? 0);
  }
`;
const toolModule = `export function defineTool(definition) { return definition; }`;
const mockSources = new Map([
  ['@deepseek-ai/dsh-subagent', depthModule],
  ['@deepseek-ai/dsh-tools', toolModule],
]);
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (mockSources.has(specifier)) return {
      url: `data:text/javascript,${encodeURIComponent(mockSources.get(specifier))}`,
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});
let plugin;
try { plugin = await import('../index.js'); }
finally { hook.deregister(); }

const makeAgent = (depth = 0, runtimeDepth) => ({
  id: `agent-${depth}-${runtimeDepth ?? 'unset'}`,
  options: runtimeDepth === undefined ? {} : { subagentDepth: runtimeDepth },
  session: { header: { delegationDepth: depth } },
});

function createHost() {
  const effects = [];
  const guards = [];
  const sections = [];
  const contexts = [];
  const registrations = [];
  const listeners = [];
  const known = new Map(['subagent', 'subagent_fork', 'subagent_codex'].map(name => [name, { name }]));
  function store(target, value) {
    const row = { value, active: true };
    target.push(row);
    // Host registrations are effect-owned and return an exact disposer.
    const dispose = () => { row.active = false; };
    effects.push(dispose);
    return dispose;
  }
  const ctx = {
    effect(factory) {
      const cleanup = factory();
      if (typeof cleanup === 'function') effects.push(cleanup);
      return cleanup;
    },
    on(event, callback) { return store(listeners, { event, callback }); },
    logger: { info() {}, warn() {}, debug() {} },
    tools: {
      guard(callback) { return store(guards, callback); },
      register(definition) { return store(registrations, definition); },
      get(name) { return known.get(name); },
      list() { return [...known.values()]; },
    },
    systemPrompt: {
      getSectionOrder(name) { return `section:${name}`; },
      getContextOrder(name) { return `context:${name}`; },
      section(definition) { return store(sections, definition); },
      context(definition) { return store(contexts, definition); },
    },
    subagents: {
      resolveMaxDepth() { return 1; },
      listProviders() { return []; },
    },
  };
  return {
    ctx, guards, sections, contexts, registrations, listeners,
    close() { for (const cleanup of effects.toReversed()) cleanup(); },
    guard(exec) {
      for (const { value, active } of guards) {
        if (!active) continue;
        const reason = value(exec);
        if (reason !== undefined) return reason;
      }
    },
  };
}

const settings = (extra = {}) => ({
  enabled: true, mode: 'prompt', preferredParallelism: 4,
  independentReview: true, additionalAllowedTools: '', ...extra,
});

// Assertions exercise the real index registration and policy behavior against
// the effect-owned registration shape verified in the published host API.

test('simulation: plugin exposes an installable host entry point', () => {
  assert.equal(typeof plugin.apply, 'function');
  assert.ok(Array.isArray(plugin.inject));
  assert.ok(plugin.inject.includes('tools'));
  assert.ok(plugin.inject.includes('systemPrompt'));
});

test('real schemastery: plugin schema validates saved settings and yields volatile references', () => {
  const configured = plugin.Config({});
  for (const key of ['enabled', 'mode', 'preferredParallelism', 'independentReview', 'additionalAllowedTools']) {
    assert.equal(typeof configured[key].get, 'function', key);
  }
  assert.equal(configured.enabled.get(), true);
  assert.equal(configured.mode.get(), 'prompt');
  assert.equal(configured.preferredParallelism.get(), 4);
  for (const mode of ['strict', 'balanced', 'prompt']) {
    assert.equal(plugin.Config({ mode }).mode.get(), mode);
  }
  for (const value of [
    { mode: 'automatic' }, { enabled: 'yes' }, { independentReview: 1 },
    { preferredParallelism: 0 }, { preferredParallelism: 17 }, { preferredParallelism: 1.5 },
    { additionalAllowedTools: '*' }, { additionalAllowedTools: 'functions.read' },
    { additionalAllowedTools: 'read;write' },
  ]) assert.throws(() => plugin.Config(value), JSON.stringify(value));
  assert.equal(plugin.Config({ additionalAllowedTools: 'custom_read, status-two' }).additionalAllowedTools.get(), 'custom_read, status-two');
});

test('simulation: explicit strict guard blocks root writes while executor and unknown calls remain admitted', async () => {
  const host = createHost();
  await plugin.apply(host.ctx, settings({ mode: 'strict' }));
  assert.equal(host.guards.filter(row => row.active).length, 1);
  assert.equal(typeof host.guard({ name: 'write', agent: makeAgent(0) }), 'string');
  assert.equal(typeof host.guard({ name: 'pwsh', agent: makeAgent(0) }), 'string');
  assert.equal(typeof host.guard({ name: 'unregistered_mutation', agent: makeAgent(0) }), 'string');
  assert.equal(host.guard({ name: 'read', agent: makeAgent(0) }), undefined);
  assert.equal(host.guard({ name: 'subagent', agent: makeAgent(0) }), undefined);
  for (const name of ['write', 'edit', 'pwsh']) {
    assert.equal(host.guard({ name, agent: makeAgent(1) }), undefined);
    assert.equal(host.guard({ name }), undefined);
  }
  // A resumed child's persisted header cannot be weakened by runtime depth 0.
  assert.equal(host.guard({ name: 'write', agent: makeAgent(1, 0) }), undefined);
  host.close();
});

test('simulation: default prompt keeps root tools admitted and exposes DAG instructions', async () => {
  const host = createHost();
  await plugin.apply(host.ctx, settings());
  const root = makeAgent(0);
  assert.equal(host.guard({ name: 'write', agent: root }), undefined);
  assert.equal(host.guard({ name: 'pwsh', agent: root }), undefined);
  const section = host.sections.find(row => row.active)?.value;
  assert.match(section.text({ agent: root, scope: root }), /orchestrator_plan/);
  const status = host.registrations.find(row => row.active && row.value.name === 'orchestrator_status');
  assert.ok(status);
  assert.equal((await status.value.execute({}, { agent: root })).guardActive, false);
  host.close();
});

test('simulation: live ref configuration changes affect subsequent guard decisions', async () => {
  const host = createHost();
  let enabled = true;
  let mode = 'strict';
  await plugin.apply(host.ctx, settings({
    enabled: { get: () => enabled }, mode: { get: () => mode },
  }));
  const exec = { name: 'write', agent: makeAgent(0) };
  assert.equal(typeof host.guard(exec), 'string');
  enabled = false;
  assert.equal(host.guard(exec), undefined);
  enabled = true; mode = 'prompt';
  assert.equal(host.guard(exec), undefined);
  mode = 'balanced';
  assert.equal(typeof host.guard(exec), 'string');
  assert.equal(host.guard({ ...exec, name: 'pwsh' }), undefined);
  host.close();
});

test('simulation: standing role prompts and status tool are registered with owned cleanup', async () => {
  const host = createHost();
  await plugin.apply(host.ctx, settings({ mode: 'strict' }));
  const section = host.sections.find(row => row.active)?.value;
  const context = host.contexts.find(row => row.active)?.value;
  assert.ok(section, 'standing policy section registered');
  assert.ok(context, 'per-agent role context registered');
  assert.equal(section.order, 'section:TEAM_POLICY');
  assert.equal(context.order, 'context:TEAM_IDENTITY');
  assert.equal(context.required, true);
  const root = makeAgent(0);
  const child = makeAgent(1);
  assert.match(section.text({ agent: root, scope: root }), /subagent/);
  assert.match(context.text({ agent: root, scope: root }), /coordinator/);
  assert.match(context.text({ agent: child, scope: child }), /executor/);
  assert.match(context.text({}), /unknown/);
  const status = host.registrations.find(row => row.active && row.value.name === 'orchestrator_status');
  assert.ok(status, 'read-only status tool registered');
  assert.equal(typeof status.value.execute, 'function');
  assert.ok(status.value.output?.schema);
  assert.equal(typeof status.value.output?.render, 'function');
  assert.equal(status.value.isConcurrencySafe(), true);
  assert.deepEqual(status.value.parameters, {});
  const rootStatus = await status.value.execute({}, { agent: root });
  const childStatus = await status.value.execute({}, { agent: child });
  const unknownStatus = await status.value.execute({}, {});
  assert.equal(rootStatus.role, 'coordinator');
  assert.equal(rootStatus.guardActive, true);
  assert.equal(childStatus.role, 'executor');
  assert.equal(childStatus.guardActive, false);
  assert.equal(unknownStatus.role, 'unknown');
  assert.equal(unknownStatus.guardActive, false);
  assert.equal(rootStatus.runtimeCapacity, null);
  assert.deepEqual(rootStatus.delegationTools, ['subagent', 'subagent_fork', 'subagent_codex']);
  const output = status.value.output.render({}, rootStatus);
  assert.equal(output[0].type, 'text');
  assert.deepEqual(JSON.parse(output[0].text), rootStatus);
  host.close();
  assert.equal(host.guards.some(row => row.active), false);
  assert.equal(host.registrations.some(row => row.active), false);
  assert.equal(host.sections.some(row => row.active), false);
  assert.equal(host.contexts.some(row => row.active), false);
});
