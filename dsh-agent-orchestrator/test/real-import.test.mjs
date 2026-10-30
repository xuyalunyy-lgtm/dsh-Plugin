import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, Config } from '../index.js';
import { delegationDepthOf } from '@deepseek-ai/dsh-subagent';
import { validateJsonSchemaValue } from '@deepseek-ai/dsh-tools';

// No module hooks in this file. Real published dependencies compile defineTool
// author schemas; the context is still a host-contract simulation, not a GUI run.
test('real host imports: defineTool compiles output schema and status values satisfy it', async () => {
  const tools = [];
  const cleanups = [];
  let guard;
  const ctx = {
    effect(factory) {
      const disposer = factory();
      if (typeof disposer === 'function') cleanups.push(disposer);
      return disposer;
    },
    systemPrompt: {
      section() { return () => {}; },
      context() { return () => {}; },
      getSectionOrder() { return 1; },
      getContextOrder() { return 1; },
    },
    tools: {
      guard(value) { guard = value; return () => {}; },
      get(name) { return name === 'subagent' ? { name } : undefined; },
      register(value) { tools.push(value); return () => {}; },
    },
  };
  const config = Config({});
  assert.equal(config.mode.get(), 'prompt', 'real default is the non-blocking auxiliary guard');
  assert.equal(Config({ mode: 'strict' }).mode.get(), 'strict', 'persisted strict is not migrated away');
  await apply(ctx, config);
  assert.equal(typeof guard, 'function');
  const statusTool = tools.find(tool => tool.name === 'orchestrator_status');
  assert.ok(statusTool);
  assert.ok(statusTool.output?.schema);
  assert.ok(Array.isArray(statusTool.output.schema.required), 'real defineTool compiles required author fields');
  assert.ok(statusTool.output.schema.required.includes('role'));
  assert.ok(statusTool.output.schema.required.includes('runtimeCapacity'));
  const root = { options: {}, session: { header: { delegationDepth: 0 } } };
  const child = { options: { subagentDepth: 0 }, session: { header: { delegationDepth: 1 } } };
  assert.equal(delegationDepthOf(root), 0);
  assert.equal(delegationDepthOf(child), 1);
  for (const [agent, role] of [[root, 'coordinator'], [child, 'executor'], [undefined, 'unknown']]) {
    const value = await statusTool.execute({}, { agent });
    assert.equal(value.role, role);
    assert.equal(value.guardActive, false, 'default prompt does not hard-block any role');
    assert.equal(value.preferredParallelismIsCapacity, false);
    assert.equal(value.runtimeCapacity, null);
    assert.ok(value.warnings.some(warning => /本插件.*并发上限/.test(warning)));
    const violations = validateJsonSchemaValue(statusTool.output.schema, value);
    assert.deepEqual(violations, [], `real status schema accepts ${role}`);
    assert.deepEqual(JSON.parse(statusTool.output.render({}, value)[0].text), value);
  }
  for (const cleanup of cleanups.toReversed()) cleanup();
});
