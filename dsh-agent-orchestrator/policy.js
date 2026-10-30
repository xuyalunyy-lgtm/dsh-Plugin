// Pure policy for the DAG scheduler and its auxiliary guard, not a security sandbox.
export const DEFAULTS = Object.freeze({
  enabled: true,
  mode: 'prompt',
  preferredParallelism: 4,
  independentReview: true,
  additionalAllowedTools: '',
});

export const COORDINATOR_TOOLS = Object.freeze([
  'read', 'read_image', 'glob', 'grep', 'web_search', 'web_fetch',
  'ask_user_question', 'todo_write',
  'subagent', 'subagent_fork', 'subagent_codex', 'send_message',
  'interrupt_agent', 'list_agents', 'job_list', 'job_output', 'job_kill',
  'get_goal', 'create_goal', 'update_goal', 'working_directory',
  'skill', 'load_workspace_dependencies', 'present', 'exit_plan_mode',
  'orchestrator_plan', 'orchestrator_status',
]);

const MODES = new Set(['strict', 'balanced', 'prompt']);
const BARE_TOOL_NAME = /^[a-zA-Z0-9_-]+$/;

function unref(value) {
  // Cordis volatile configuration fields may be ordinary values or Ref objects.
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    return value.get();
  }
  return value;
}

function allowedNames(value) {
  return value.trim() === '' ? [] : value.trim().split(/[\s,]+/).filter(Boolean);
}

export function normalizeConfig(input = {}) {
  const source = unref(input);
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('主控调度配置必须是对象。');
  }
  const config = {};
  for (const key of Object.keys(DEFAULTS)) {
    const value = unref(source[key]);
    config[key] = value === undefined ? DEFAULTS[key] : value;
  }
  if (typeof config.enabled !== 'boolean') throw new TypeError('enabled 必须是布尔值。');
  if (!MODES.has(config.mode)) throw new TypeError('mode 必须是 strict、balanced 或 prompt。');
  if (!Number.isInteger(config.preferredParallelism) || config.preferredParallelism < 1 || config.preferredParallelism > 16) {
    throw new TypeError('preferredParallelism 必须是 1–16 的整数；它是本插件 scheduler 的并发上限，不代表 host 全局并发容量。');
  }
  if (typeof config.independentReview !== 'boolean') throw new TypeError('independentReview 必须是布尔值。');
  if (typeof config.additionalAllowedTools !== 'string') throw new TypeError('additionalAllowedTools 必须是工具名字符串。');
  const names = allowedNames(config.additionalAllowedTools);
  if (names.some((name) => !BARE_TOOL_NAME.test(name))) {
    throw new TypeError('额外放行工具必须是精确的裸工具名，仅允许字母、数字、下划线和连字符；不支持通配符或命名空间。');
  }
  config.additionalAllowedTools = [...new Set(names)].join(', ');
  return config;
}

export function classifyAgent(agent, depthResolver) {
  if (!agent || typeof depthResolver !== 'function') return { role: 'unknown', depth: null };
  try {
    const depth = depthResolver(agent);
    if (!Number.isSafeInteger(depth) || depth < 0) return { role: 'unknown', depth: null };
    return { role: depth === 0 ? 'coordinator' : 'executor', depth };
  } catch {
    return { role: 'unknown', depth: null };
  }
}

export function decideTool({ name, role, config }) {
  if (!config.enabled || role !== 'coordinator' || config.mode === 'prompt') return undefined;
  if (config.mode === 'balanced') {
    if (name !== 'write' && name !== 'edit') return undefined;
  } else if (config.mode === 'strict') {
    const extra = allowedNames(config.additionalAllowedTools);
    if (COORDINATOR_TOOLS.includes(name) || extra.includes(name)) return undefined;
  } else {
    throw new TypeError('主控调度配置错误：未知 mode。');
  }
  return `主控调度辅助守卫（${config.mode}）：主智能体不能调用 ${String(name)}，请优先通过 orchestrator_plan 提交结构化任务图，由运行时派给执行子智能体；无法调度时说明具体阻碍，不自动解除规则。strict 默认仅放行原生协调/只读工具，run_code/PTC 和 shell 不放行；本守卫不是安全沙箱。`;
}

function delegationNames(tools) {
  if (!Array.isArray(tools)) return [];
  return [...new Set(tools.filter((tool) => typeof tool === 'string' && BARE_TOOL_NAME.test(tool)))];
}

export function renderPolicy({ role, config, delegationTools = [] }) {
  if (!config.enabled) return '';
  if (role === 'executor') {
    return '你是执行型子智能体：直接完成父任务图分配的工作包，包括获授权的调查、实现、修改、验证与修复。遵守写入资源 owner、目录规则和原有用户改动；交付实现摘要、测试证据及未验证项。不要递归创建任务图或再次派工，orchestrator_plan 会拒绝 depth>0 的建图与控制调用；达到深度上限时直接完成自身任务。任务完成、审查节点完成和结果中的 verified:false 都不等于已通过独立验收，不得虚称已验证。';
  }
  if (role !== 'coordinator') {
    return '主控调度无法可靠识别当前智能体的委派深度，暂不施加主智能体工具守卫。请勿假称已确定根/子角色；通过 orchestrator_status 检查状态，遵守已有用户指令和工具限制，不虚称已提交任务图或启动执行者。';
  }
  const available = delegationNames(delegationTools);
  const lines = [
    '你是面向用户的主智能体（协调者），负责需求澄清、结构化 DAG 计划、依赖与写入资源 owner、异常协调、证据检查、最终验收与结果交付；插件运行时负责事件驱动调度与后继接续。',
    '执行型需求优先调用 orchestrator_plan 提交结构化任务图（action:submit，参数以工具 schema 为准），不要仅口头列计划或由主智能体逐条手工发子任务。代码/配置/文档实现、测试及修复均作为工作包；即使只改一行也应提交单节点计划。纯解释和无需实际执行的问答可直接回答，不强拆任务图。',
    `preferredParallelism=${config.preferredParallelism} 是本插件 scheduler 的实际并发上限（1–16），不是 host 全局 capacity 或可用槽位测量；任务图自身上限、provider 和宿主容量还可能进一步限制并行。不要把默认值或工具可见性当作启动保证。`,
    '每个节点写明目标、必要上下文、执行 prompt、依赖、可写资源及唯一 owner、禁止触碰范围、接口约定、验收标准与验证证据要求；用 dependsOn 表达前置依赖，用 writeResources 声明写入边界、acceptance 表达验收要求。同一资源不能由无依赖隔离的多个节点同时写入；共享接口先约定，整合修改也明确执行节点。',
    '图提交后，由运行时自动派发可运行节点，依据完成/失败事件推进状态，只有依赖成功完成才解锁后继；失败按图状态阻塞相关后继，不需要主智能体人工发送每一条后继任务。主线程用 orchestrator_plan 的 list/get 检查状态与异常，避免重复提交、重复派工或实现已在图内的工作；遇暂停、失败或需重试时按工具 schema 和当前 revision 操作，不把失败当成功。',
    '完成状态或结果摘要不证明实现正确；任务结果 verified:false 表示尚未独立验证，不能虚称已 verified。主智能体应核对实际差异、关键行为与验证证据；验收失败通过显式修复节点或受控重试处理，保持写入 owner 与依赖，不静默亲自接管实现。',
    config.independentReview
      ? '较大或高风险工作应在图中加入依赖实现节点的显式独立只读审查节点，检查需求、回归、安全和测试缺口；审查者不重复实现，审查完成仍不自动将结果标为 verified，主智能体负责最终验收。'
      : '独立审查偏好已关闭；不会因此自动生成审查节点，主智能体仍须检查实际交付与验收证据，不得将任务完成视为已验证。',
    '调度不可用时先在限制内做一次有针对性的诊断，不重复相同参数的失败调用；仍不可用则报告具体阻碍，征求用户是否恢复调度或临时授权主实现，不静默绕过计划系统。用户同意不自动解除辅助工具守卫。',
    'enabled 是插件调度总开关：关闭后停止新派工；配置变化不自动取消已运行任务。暂停、取消、重试及重启后的恢复应通过显式控制操作；重启中断的任务不能自动重放副作用，需原对话重新绑定后按工具约定重试。',
    '遵守系统、开发者、直接用户与更具体目录规则，不通过嵌套会话、外部智能体或配置变更规避权限、审批、并发或深度限制，不自行修改账号、模型或宿主容量。',
    `当前辅助守卫模式：${config.mode}。${config.mode === 'strict'
      ? '根主智能体仅能使用协调/只读白名单工具（包括 orchestrator_plan、orchestrator_status）及用户精确额外放行项；默认拒绝 shell、pwsh、bash、workflow、run_code/PTC、write、edit、create_worktree 及未知插件工具。严格模式要求原生工具调用；它不是安全沙箱，也不等于调度器。'
      : config.mode === 'balanced'
        ? '仅拦根主智能体 write/edit；shell、PTC 和其他插件工具仍可能写入，所以平衡模式不是实现隔离或安全沙箱，调度仍由任务图运行时负责。'
        : '仅提示、不拦截主智能体工具，避免在调度不可用时形成硬限制；不会自动代替任务图调度、不保证模型遵从，也不是安全沙箱。'}`,
    available.length
      ? `当前作用域可见委派工具：${available.join(', ')}。它们仅是可见性信息；正常执行优先由 orchestrator_plan 运行时调度，不因可见便宣称 provider、配额、权限、深度或容量可用。`
      : '当前作用域未发现传统委派工具；这不单独证明任务图运行时可用或不可用。先检查 orchestrator_plan/orchestrator_status 的实际状态，不假称已派发。',
  ];
  return lines.join('\n');
}

export function buildStatus({ role, depth, config, delegationTools = [] }) {
  const knownRole = ['coordinator', 'executor'].includes(role) ? role : 'unknown';
  return {
    role: knownRole,
    depth: Number.isSafeInteger(depth) && depth >= 0 ? depth : null,
    config: { ...config },
    delegationTools: delegationNames(delegationTools),
    guardActive: config.enabled && knownRole === 'coordinator' && config.mode !== 'prompt',
    guardScope: config.mode === 'strict' ? 'root-native-tool-allowlist' : config.mode === 'balanced' ? 'root-write-edit-only' : 'prompt-only',
    preferredParallelismIsCapacity: false,
    runtimeCapacity: null,
    warnings: [
      `preferredParallelism=${config.preferredParallelism} 是本插件 scheduler 的并发上限，不代表 host 全局 capacity、已测可用槽位或可成功启动的数量；runtimeCapacity 未测量。`,
      '插件通过 DAG 与事件调度执行工作，工具守卫只是辅助而非安全沙箱；不会更改权限、审批、账号、模型、host 全局并发容量或委派深度。',
      'enabled 关闭时停止新派工；配置变化不会自动取消已运行任务，任务完成也不自动证明已通过验收（verified）。',
      ...(knownRole === 'unknown' ? ['无法可靠识别角色，未拦截工具；不得将未知角色当作根智能体。'] : []),
      ...(config.enabled && config.mode === 'strict' ? ['strict 默认阻断 run_code/PTC、shell 与未知插件工具；根主智能体需使用原生白名单工具，额外放行仅按精确工具名。'] : []),
      ...(allowedNames(config.additionalAllowedTools).length ? [`用户额外放行工具：${config.additionalAllowedTools}。仅在 strict 模式生效；放行 shell、写入或 PTC 等工具会削弱主控职责隔离，不构成安全保证。`] : []),
      ...(config.enabled && config.mode === 'balanced' ? ['balanced 仅拦 write/edit，shell、PTC 和插件工具仍可能写入。'] : []),
      ...(!config.enabled || config.mode === 'prompt' ? ['当前不施加工具拦截。'] : []),
    ],
  };
}
