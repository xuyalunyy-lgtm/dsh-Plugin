import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, COORDINATOR_TOOLS, normalizeConfig, classifyAgent,
  decideTool, renderPolicy, buildStatus,
} from '../policy.js';

const policy = (changes = {}) => normalizeConfig({ ...DEFAULTS, ...changes });
const check = (name, role = 'coordinator', changes = {}) => decideTool({ name, role, config: policy(changes) });
const rejected = value => assert.equal(typeof value, 'string', 'denied calls provide an actionable reason');

function assertJsonSafe(value) {
  assert.notEqual(value, undefined);
  assert.doesNotThrow(() => JSON.stringify(value));
  assert.deepEqual(JSON.parse(JSON.stringify(value)), value);
}

test('defaults enable DAG scheduling with prompt auxiliary guard and a bounded plugin concurrency limit', () => {
  assert.equal(DEFAULTS.enabled, true);
  assert.equal(DEFAULTS.mode, 'prompt');
  assert.equal(DEFAULTS.preferredParallelism, 4);
  assert.equal(DEFAULTS.independentReview, true);
  assert.equal(DEFAULTS.additionalAllowedTools, '');
  const config = normalizeConfig({});
  for (const key of Object.keys(DEFAULTS)) assert.deepEqual(config[key], DEFAULTS[key]);
});

test('missing mode defaults to prompt without overwriting persisted strict or balanced settings', () => {
  assert.equal(normalizeConfig({}).mode, 'prompt');
  assert.equal(normalizeConfig({ mode: 'strict' }).mode, 'strict');
  assert.equal(normalizeConfig({ mode: 'balanced' }).mode, 'balanced');
  assert.deepEqual(Object.keys(normalizeConfig({})).sort(), Object.keys(DEFAULTS).sort());
  assert.equal(Object.keys(DEFAULTS).length, 5, 'existing settings contract stays at five fields');
  assert.equal(check('write'), undefined, 'default prompt is not a hard fallback guard');
});

test('configuration accepts current values from volatile get references', () => {
  let enabled = true;
  let mode = 'strict';
  let count = 4;
  const source = {
    enabled: { get: () => enabled }, mode: { get: () => mode },
    preferredParallelism: { get: () => count },
    independentReview: { get: () => false },
    additionalAllowedTools: { get: () => 'custom_read' },
  };
  const first = normalizeConfig(source);
  assert.equal(first.enabled, true);
  assert.equal(first.mode, 'strict');
  assert.equal(first.preferredParallelism, 4);
  assert.equal(first.independentReview, false);
  enabled = false; mode = 'prompt'; count = 8;
  const second = normalizeConfig(source);
  assert.equal(second.enabled, false);
  assert.equal(second.mode, 'prompt');
  assert.equal(second.preferredParallelism, 8);
});

test('invalid modes, non-booleans and invalid parallelism are rejected', () => {
  for (const mode of ['', 'automatic', 'STRICT', false, 1, null]) {
    assert.throws(() => normalizeConfig({ ...DEFAULTS, mode }), `mode ${String(mode)}`);
  }
  for (const key of ['enabled', 'independentReview']) {
    for (const value of ['true', 1, 0, null]) {
      assert.throws(() => normalizeConfig({ ...DEFAULTS, [key]: value }), `${key} ${String(value)}`);
    }
  }
  for (const preferredParallelism of [0, -1, 17, 1.5, '4', NaN, Infinity, null]) {
    assert.throws(() => normalizeConfig({ ...DEFAULTS, preferredParallelism }), String(preferredParallelism));
  }
  for (const preferredParallelism of [1, 4, 16]) {
    assert.equal(policy({ preferredParallelism }).preferredParallelism, preferredParallelism);
  }
});

test('allowlist extension accepts exact bare names and rejects globs or executable syntax', () => {
  const additionalAllowedTools = 'custom_read,custom-status\nother_tool finalTool';
  for (const name of ['custom_read', 'custom-status', 'other_tool', 'finalTool']) {
    assert.equal(check(name, 'coordinator', { mode: 'strict', additionalAllowedTools }), undefined);
  }
  rejected(check('custom_read_suffix', 'coordinator', { mode: 'strict', additionalAllowedTools }));
  rejected(check('CUSTOM_READ', 'coordinator', { mode: 'strict', additionalAllowedTools }));
  for (const value of ['*', 'custom_*', 'functions.read', 'tool/name', 'x;write', 'x()', ['read'], null]) {
    assert.throws(() => normalizeConfig({ ...DEFAULTS, additionalAllowedTools: value }), String(value));
  }
});

test('role identity distinguishes root, child and unavailable identity without guessing', () => {
  const root = {};
  const child = {};
  assert.deepEqual(classifyAgent(root, agent => { assert.equal(agent, root); return 0; }), { role: 'coordinator', depth: 0 });
  assert.deepEqual(classifyAgent(child, agent => { assert.equal(agent, child); return 1; }), { role: 'executor', depth: 1 });
  assert.deepEqual(classifyAgent(child, () => 5), { role: 'executor', depth: 5 });
  let called = false;
  for (const absent of [undefined, null]) {
    assert.deepEqual(classifyAgent(absent, () => { called = true; return 0; }), { role: 'unknown', depth: null });
  }
  assert.equal(called, false);
  assert.deepEqual(classifyAgent(root, () => { throw new Error('unavailable header'); }), { role: 'unknown', depth: null });
  for (const invalid of [undefined, null, -1, 0.5, NaN, Infinity, '0']) {
    assert.deepEqual(classifyAgent(root, () => invalid), { role: 'unknown', depth: null });
  }
});

test('strict coordinator allows inspection and coordination tool names', () => {
  assert.ok(Array.isArray(COORDINATOR_TOOLS));
  for (const name of COORDINATOR_TOOLS) {
    assert.equal(typeof name, 'string');
    assert.equal(check(name, 'coordinator', { mode: 'strict' }), undefined, name);
  }
  for (const name of [
    'read', 'read_image', 'glob', 'grep', 'web_search', 'web_fetch',
    'ask_user_question', 'todo_write', 'subagent', 'subagent_fork', 'subagent_codex',
    'send_message', 'interrupt_agent', 'list_agents', 'job_list', 'job_output', 'job_kill',
    'get_goal', 'create_goal', 'update_goal', 'working_directory', 'skill',
    'load_workspace_dependencies', 'present', 'exit_plan_mode', 'orchestrator_plan', 'orchestrator_status',
  ]) assert.equal(check(name, 'coordinator', { mode: 'strict' }), undefined, name);
});

test('strict coordinator denies writes, shell, workflow and unknown future mutation tools', () => {
  for (const name of ['write', 'edit', 'pwsh', 'shell', 'bash', 'run_code', 'workflow', 'create_worktree', 'plugin_mutate', 'unknown_tool', 'orchestrator_plan_suffix', 'ORCHESTRATOR_PLAN']) {
    rejected(check(name, 'coordinator', { mode: 'strict' }));
  }
});

test('executors keep implementation tools and do not inherit coordinator denylist', () => {
  for (const mode of ['strict', 'balanced', 'prompt']) {
    for (const name of ['write', 'edit', 'pwsh', 'unknown_mutation', 'create_worktree']) {
      assert.equal(check(name, 'executor', { mode }), undefined, `${mode}: ${name}`);
    }
  }
});

test('unknown identity is not silently treated as a coordinator', () => {
  for (const name of ['write', 'edit', 'pwsh', 'unknown_mutation']) {
    assert.equal(check(name, 'unknown'), undefined, name);
  }
  const status = buildStatus({ role: 'unknown', depth: null, config: policy(), delegationTools: [] });
  assertJsonSafe(status);
  assert.match(JSON.stringify(status), /unknown/i);
});

test('balanced mode only blocks direct write/edit and explicitly remains bypassable via shell', () => {
  for (const name of ['write', 'edit']) rejected(check(name, 'coordinator', { mode: 'balanced' }));
  for (const name of ['pwsh', 'unknown_tool', 'workflow', 'create_worktree']) {
    assert.equal(check(name, 'coordinator', { mode: 'balanced' }), undefined, name);
  }
  assert.ok(renderPolicy({ role: 'coordinator', config: policy({ mode: 'balanced' }) }).length > 0);
});

test('prompt-only mode leaves execution unblocked while retaining instructions', () => {
  for (const name of ['write', 'edit', 'pwsh', 'unknown_mutation']) {
    assert.equal(check(name, 'coordinator', { mode: 'prompt' }), undefined, name);
  }
  assert.ok(renderPolicy({ role: 'coordinator', config: policy({ mode: 'prompt' }) }).length > 0);
});

test('disabled policy does not intercept calls or inject instructions for any role', () => {
  for (const role of ['coordinator', 'executor', 'unknown']) {
    for (const name of ['write', 'edit', 'pwsh', 'unknown_mutation']) {
      assert.equal(check(name, role, { enabled: false }), undefined);
    }
    assert.equal(renderPolicy({ role, config: policy({ enabled: false }) }), '');
  }
});

test('rendered role instructions are distinct and reflect configured parallelism', () => {
  const config = policy({ preferredParallelism: 7 });
  const root = renderPolicy({ role: 'coordinator', config, delegationTools: ['subagent', 'subagent_fork'] });
  const executor = renderPolicy({ role: 'executor', config });
  assert.equal(typeof root, 'string');
  assert.equal(typeof executor, 'string');
  assert.ok(root.length > 0);
  assert.ok(executor.length > 0);
  assert.notEqual(root, executor);
  assert.match(root, /7/);
  assert.match(root, /subagent/);
});

test('DAG policy directs structured submission, automatic successors and evidence-based acceptance', () => {
  const root = renderPolicy({ role: 'coordinator', config: policy({ preferredParallelism: 7 }) });
  for (const pattern of [
    /orchestrator_plan.*结构化任务图/, /action:submit/, /dependsOn/, /writeResources/, /acceptance/,
    /唯一 owner/, /运行时自动派发/, /完成\/失败事件推进状态/, /依赖成功完成才解锁后继/, /失败.*阻塞相关后继/, /list\/get/,
    /verified:false/, /不能虚称已 verified/, /显式独立只读审查节点/, /最终验收/,
    /preferredParallelism=7.*本插件 scheduler.*并发上限/, /不是 host 全局 capacity/,
    /即使只改一行也应提交单节点计划/, /纯解释.*问答可直接回答/, /配置变化不自动取消已运行任务/,
  ]) assert.match(root, pattern);
  assert.doesNotMatch(root, /这不是已生效容量|偏好 7 路并行/);
  const noReview = renderPolicy({ role: 'coordinator', config: policy({ independentReview: false }) });
  assert.match(noReview, /不会因此自动生成审查节点/);
  const executor = renderPolicy({ role: 'executor', config: policy() });
  assert.match(executor, /直接完成父任务图分配的工作包/);
  assert.match(executor, /不要递归创建任务图或再次派工/);
  assert.match(executor, /拒绝 depth>0/);
  assert.match(executor, /verified:false/);
});

test('status is JSON safe for each policy mode and never invents measured free capacity', () => {
  for (const mode of ['strict', 'balanced', 'prompt']) {
    for (const [role, depth] of [['coordinator', 0], ['executor', 1], ['unknown', null]]) {
      const status = buildStatus({ role, depth, config: policy({ mode }), delegationTools: ['subagent_fork'] });
      assertJsonSafe(status);
      assert.equal(status.role, role);
      assert.equal(status.depth, depth);
      assert.equal(status.config.mode, mode);
      assert.deepEqual(status.delegationTools, ['subagent_fork']);
      assert.equal(status.preferredParallelismIsCapacity, false);
      assert.equal(status.runtimeCapacity, null);
      assert.equal(status.guardActive, role === 'coordinator' && mode !== 'prompt');
      assert.ok(status.warnings.some(warning => /本插件.*并发上限/.test(warning) && /host.*capacity/.test(warning)));
      // The plugin concurrency limit is not a measurement of host occupancy.
      for (const key of ['availableSlots', 'freeSlots', 'remainingSlots']) {
        if (Object.hasOwn(status, key)) assert.equal(status[key], null, key);
      }
    }
  }
});
