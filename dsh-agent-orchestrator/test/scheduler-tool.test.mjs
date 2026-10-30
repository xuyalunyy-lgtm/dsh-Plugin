import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, Config } from '../index.js';
import { validateJsonSchemaValue } from '@deepseek-ai/dsh-tools';

// Headless authorization and real defineTool schema checks. No injected runtime,
// filesystem store, profile edit, HTTP listener, or model request is created.
async function fixture(t) {
  const tools = [];
  const cleanup = [];
  const root = { id: 'tool-root', options: {}, session: { id: 'tool-root', header: { delegationDepth: 0 } } };
  let live = root;
  const ctx = {
    agents: { get: id => id === root.id ? live : undefined },
    systemPrompt: { section() {}, context() {}, getSectionOrder: () => 1, getContextOrder: () => 1 },
    tools: { guard() {}, get: () => undefined, register(tool) { tools.push(tool); return () => {}; } },
    effect(fn) { const dispose = fn(); if (typeof dispose === 'function') cleanup.push(dispose); return dispose; },
  };
  apply(ctx, Config({}));
  t.after(async () => { for (const dispose of cleanup.toReversed()) await dispose(); });
  return { root, tool: tools.find(tool => tool.name === 'orchestrator_plan'), replace(value) { live = value; } };
}
const submit = {
  action: 'submit', requestId: 'tool-submit-request-0001', plan: {
    title: 'Schema graph', maxConcurrency: 2,
    tasks: [
      { id: 'A', title: 'Implement A', prompt: 'Bounded implementation', writeResources: ['src/a.js'], acceptance: 'Provide test evidence' },
      { id: 'B', title: 'Review A', prompt: 'Read-only review', dependsOn: ['A'] },
    ],
  },
};

test('scheduler tool: real defineTool accepts a DAG without exposing parent binding or cwd author fields', async t => {
  const f = await fixture(t);
  assert.ok(f.tool);
  assert.deepEqual(validateJsonSchemaValue(f.tool.parameters, submit), []);
  for (const key of ['ownerSessionId', 'parentSessionId', 'parentBindingId', 'bindingId', 'cwd']) {
    assert.ok(!Object.hasOwn(f.tool.parameters.properties, key), `${key} must not be authored by the model`);
  }
});

test('scheduler tool: depth-one or stale lookalike Agent cannot acquire authority', async t => {
  const f = await fixture(t);
  const child = { ...f.root, options: { subagentDepth: 0 }, session: { id: f.root.id, header: { delegationDepth: 1 } } };
  for (const agent of [undefined, child, { ...f.root }]) {
    const result = await f.tool.execute(submit, { agent, signal: new AbortController().signal });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'UNAUTHORIZED');
  }
  const result = await f.tool.execute(submit, { agent: f.root, signal: new AbortController().signal });
  assert.equal(result.code, 'SUBAGENTS_UNAVAILABLE', 'real root passes authority but the missing subagents service is diagnosed without fabricating runtime');
});

test('scheduler tool: model-provided authority/path fields are rejected even for the real root', async t => {
  const f = await fixture(t);
  for (const key of ['ownerSessionId', 'parentSessionId', 'parentBindingId', 'bindingId', 'cwd']) {
    const result = await f.tool.execute({ ...submit, [key]: 'forged-private-value' }, { agent: f.root, signal: new AbortController().signal });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'INVALID_REQUEST');
    assert.doesNotMatch(JSON.stringify(result), /forged-private-value/);
  }
});
