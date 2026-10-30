import z from '@deepseek-ai/schemastery';
import { delegationDepthOf } from '@deepseek-ai/dsh-subagent';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { isAbsolute, join } from 'node:path';
import { API_PATH, PLANS_PATH, createController, createHttpHandler, createPlansHttpHandler } from './controller.js';
import {
  DEFAULTS, normalizeConfig, classifyAgent, decideTool, renderPolicy, buildStatus,
} from './policy.js';

export const name = 'agent-orchestrator';
export const description = '主控调度：主智能体规划派工与验收，执行子智能体负责具体实现。';
export const inject = ['systemPrompt', 'tools'];

export const Config = z.object({
  enabled: z.boolean().default(DEFAULTS.enabled).description('启用任务图调度与辅助策略；关闭停止新派工，不自动取消已运行任务。').volatile(),
  mode: z.union(['strict', 'balanced', 'prompt']).default(DEFAULTS.mode).description('strict：根主智能体仅放行协调/只读白名单；balanced：仅拦 write/edit；prompt：仅提示。不是安全沙箱。').volatile(),
  preferredParallelism: z.number().step(1).min(1).max(16).default(DEFAULTS.preferredParallelism).description('本插件同时执行任务的总上限；不是宿主剩余容量，也不会提高宿主限制。').volatile(),
  independentReview: z.boolean().default(DEFAULTS.independentReview).description('鼓励较大或高风险工作安排独立只读审查子智能体。').volatile(),
  additionalAllowedTools: z.string().pattern(/^[a-zA-Z0-9_\s,-]*$/).default(DEFAULTS.additionalAllowedTools).description('strict 模式额外放行的精确裸工具名，以逗号或空白分隔；不支持通配符。放行 shell 等工具会削弱职责隔离。').volatile(),
});

const DELEGATION_TOOLS = ['subagent', 'subagent_fork', 'subagent_codex'];

// Output schema uses the official author schema format (required on nodes).
const statusSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    role: { type: 'string', enum: ['coordinator', 'executor', 'unknown'], required: true },
    depth: { oneOf: [{ type: 'integer' }, { type: 'null' }], required: true },
    config: {
      type: 'object', required: true, additionalProperties: false,
      properties: {
        enabled: { type: 'boolean', required: true },
        mode: { type: 'string', enum: ['strict', 'balanced', 'prompt'], required: true },
        preferredParallelism: { type: 'integer', required: true },
        independentReview: { type: 'boolean', required: true },
        additionalAllowedTools: { type: 'string', required: true },
      },
    },
    delegationTools: { type: 'array', items: { type: 'string' }, required: true },
    guardActive: { type: 'boolean', required: true },
    guardScope: { type: 'string', required: true },
    preferredParallelismIsCapacity: { type: 'boolean', required: true },
    runtimeCapacity: { type: 'null', required: true },
    warnings: { type: 'array', items: { type: 'string' }, required: true },
  },
};

export const PLAN_ACTIONS = ['submit', 'list', 'get', 'pause', 'resume', 'cancel', 'retry', 'rebind'];
export const planParameters = {
  action: { type: 'string', enum: PLAN_ACTIONS, required: true, description: 'submit提交依赖任务图；list/get读取本父会话任务；pause/resume/cancel/retry/rebind显式控制。' },
  requestId: { type: 'string', description: '写操作必填，16–128字符的唯一请求ID；不确定时以相同ID和参数重试。' },
  jobId: { type: 'string', description: 'get及控制操作的任务图ID，只能访问当前根会话拥有的图。' },
  expectedRevision: { type: 'integer', description: '控制操作必填：开始操作时读取的任务图revision。' },
  taskId: { type: 'string', description: 'retry指定失败/中断任务ID。' },
  provider: { type: 'string', description: 'submit可选：当前已注册的子智能体provider准确ID；省略优先实际注册的fork，否则仅在唯一provider时选择。' },
  plan: {
    type: 'object', additionalProperties: false,
    properties: {
      title: { type: 'string', required: true },
      maxConcurrency: { type: 'integer', description: '1–8且仍受本插件总上限及宿主限制。' },
      tasks: { type: 'array', required: true, items: {
        type: 'object', additionalProperties: false, properties: {
          id: { type: 'string', required: true }, title: { type: 'string', required: true },
          prompt: { type: 'string', required: true },
          dependsOn: { type: 'array', items: { type: 'string' } },
          writeResources: { type: 'array', items: { type: 'string' } },
          acceptance: { type: 'string' },
        },
      } },
    },
  },
};
const PLAN_ERRORS = Object.freeze({
  UNAUTHORIZED: '仅当前真实根会话可以访问或控制其任务图。',
  INVALID_REQUEST: '任务图请求参数无效。', INVALID_PLAN: '任务图定义无效，请核对依赖、写入资源和任务范围。',
  CONFLICT: '任务图已更新，请重新读取后核对。', NOT_FOUND: '本会话未找到该任务图。',
  SCHEDULER_UNAVAILABLE: '任务调度尚未就绪，请核对插件是否已加载及当前 profile 的任务存储状态。',
  AGENTS_UNAVAILABLE: '当前宿主未提供可用的 agents 服务，无法核验真实根会话；请检查宿主服务与插件加载状态。',
  SUBAGENTS_UNAVAILABLE: '当前宿主未提供完整的 subagents 服务，不能调度子任务；请启用宿主子智能体服务后重试。',
  WORKING_DIRECTORY_UNAVAILABLE: '无法取得根会话的 workingDirectory 服务或工作目录；请检查宿主工作目录服务与会话状态。',
  PROFILE_UNAVAILABLE: '无法确定当前 profile 的绝对目录；请检查宿主 profileContext 或 DSH_PROFILE_DIR，未改用共享目录。',
  SCHEDULER_INIT_FAILED: '任务调度初始化失败；请核对宿主服务及任务存储状态，未输出原始异常或本机路径。',
  PROVIDER_UNAVAILABLE: '无法唯一选择可用provider，请先核对已注册provider。',
  PARENT_UNAVAILABLE: '原任务的父会话授权已失效，请在原根会话明确 rebind 后恢复。',
  INVALID_STATE: '当前任务状态不允许此操作，请先读取任务图并核对。',
  RECOVERY_REQUIRED: '任务需要人工核对与明确重新绑定，不能自动恢复。',
  DISABLED: '调度器已关闭新派工，请先在设置中启用。',
  LIMIT_REACHED: '任务存储或调度数量达到上限。',
  REQUEST_CONFLICT: '同一请求ID已用于不同参数，请勿替换原始意图。',
  STORE_LOCKED: '调度存储被其他实例占用。', STORE_CORRUPT: '调度数据损坏，未自动重置。',
  STORE_UNAVAILABLE: '当前profile无法提供隔离的任务存储。',
  STORE_WRITE_FAILED: '任务状态写入未确认，已停止新派工。',
  STORE_FAILED: '任务存储操作失败，调度器已停止继续修改。',
  TEARDOWN_UNCONFIRMED: '子任务收尾尚未确认，不能释放其资源或重放任务，请先核对实际执行。',
  CYCLE: '任务依赖包含循环，请调整依赖后重新提交。',
  WRITE_CONFLICT: '任务声明的写入资源存在冲突，请调整依赖或资源归属。',
  BINDING_LIMIT_REACHED: '父任务绑定数量达到上限，请检查已有任务图或重新加载调度器。',
  FAILED: '任务图操作失败；未输出原始异常或本机路径。',
});
function planFailure(error) {
  const code = Object.hasOwn(PLAN_ERRORS, error?.code) ? error.code : 'FAILED';
  return { ok: false, code, error: PLAN_ERRORS[code] };
}
function coded(code) { return Object.assign(new Error(PLAN_ERRORS[code]), { code }); }

// Cordis service properties are guarded by the plugin's inject declaration.
// Optional chaining does not protect ctx.agents/ctx.profileContext: the proxy
// throws before ?. can run. get() is the public optional-service lookup API.
function optionalService(context, name) {
  try {
    if (typeof context?.get === 'function') return context.get(name);
    // Lightweight/headless test contexts may be ordinary objects without get().
    return context?.[name];
  } catch { return undefined; }
}
function runtimeServices(context) {
  const agents = optionalService(context, 'agents');
  if (!agents || typeof agents.get !== 'function') throw coded('AGENTS_UNAVAILABLE');
  const subagents = optionalService(context, 'subagents');
  if (!subagents || ['list', 'getProvider', 'resolveMaxDepth', 'startActivation'].some(method => typeof subagents[method] !== 'function')) {
    throw coded('SUBAGENTS_UNAVAILABLE');
  }
  return { agents, subagents };
}

export function apply(ctx, config) {
  // Validate once at mounting too; never silently downgrade an invalid mode.
  normalizeConfig(config);
  const schedulerState = { scheduler: null, adapter: null, errorCode: 'SCHEDULER_UNAVAILABLE', ready: Promise.resolve(null) };

  function wakeScheduler(options) {
    try { Promise.resolve(schedulerState.scheduler?.wake(options)).catch(() => {}); }
    catch { /* Status is reported without leaking runtime exceptions. */ }
  }
  function assertOwner(exec) {
    const agent = exec?.agent;
    if (!agent || classifyAgent(agent, delegationDepthOf).role !== 'coordinator') throw coded('UNAUTHORIZED');
    const agents = optionalService(ctx, 'agents');
    if (!agents || typeof agents.get !== 'function') throw coded('AGENTS_UNAVAILABLE');
    let current;
    try { current = agents.get(agent.id); } catch { throw coded('AGENTS_UNAVAILABLE'); }
    if (current !== agent) throw coded('UNAUTHORIZED');
    return agent;
  }
  async function schedulerReady() {
    // A missing optional runtime dependency means inject() has not activated;
    // distinguish that from a valid root request or a storage/init failure.
    if (!schedulerState.scheduler) runtimeServices(ctx);
    await schedulerState.ready;
    return schedulerState.scheduler;
  }

  function scopedDelegationTools(scope) {
    return DELEGATION_TOOLS.filter((tool) => ctx.tools.get(tool, scope) !== undefined);
  }

  function state(agent, scope = agent) {
    return {
      ...classifyAgent(agent, delegationDepthOf),
      config: normalizeConfig(config),
      delegationTools: scopedDelegationTools(scope),
    };
  }

  ctx.systemPrompt.section({
    name: 'local:agent-orchestrator:policy',
    order: ctx.systemPrompt.getSectionOrder('TEAM_POLICY'),
    interpolate: false,
    text: (context) => renderPolicy(state(context.agent, context.scope)),
  });

  ctx.systemPrompt.context({
    name: 'local:agent-orchestrator:runtime',
    order: ctx.systemPrompt.getContextOrder('TEAM_IDENTITY'),
    required: true,
    interpolate: false,
    text: (context) => {
      const value = state(context.agent, context.scope);
      if (!value.config.enabled) return '';
      const status = buildStatus(value);
      return `主控调度状态：${JSON.stringify({
        role: status.role,
        depth: status.depth,
        mode: status.config.mode,
        preferredParallelism: status.config.preferredParallelism,
        guardActive: status.guardActive,
        delegationTools: status.delegationTools,
        runtimeCapacity: status.runtimeCapacity,
      })}。并行设置是本插件总上限，不是宿主剩余容量；工具可见不保证可启动。${status.role === 'unknown' ? '角色未知，未施加工具拦截。' : ''}`;
    },
  });

  ctx.tools.guard((exec) => {
    const value = state(exec.agent, exec.agent);
    return decideTool({ name: exec.name, role: value.role, config: value.config });
  });

  const statusTool = defineTool({
    name: 'orchestrator_status',
    description: '读取当前智能体主控调度状态、角色、配置、可见委派工具与守卫边界。不修改设置，不把偏好并行数当成运行时容量。',
    parameters: {},
    output: {
      schema: statusSchema,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: (_args, exec) => buildStatus(state(exec.agent, exec.agent)),
    isConcurrencySafe: () => true,
  });
  ctx.effect(() => ctx.tools.register(statusTool));
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'orchestrator_plan',
    description: '提交和管理本根会话的依赖任务图；调度器自动并行派工、事件接续和持久化。必须真实根会话授权，不接受任意父会话或工作目录。',
    parameters: planParameters,
    output: {
      schema: { type: 'object', additionalProperties: true, properties: { ok: { type: 'boolean', required: true } } },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(request, exec) {
      try {
        const parent = assertOwner(exec);
        const allowed = ['action', 'requestId', 'jobId', 'expectedRevision', 'taskId', 'provider', 'plan'];
        if (!request || typeof request !== 'object' || Array.isArray(request)
          || Object.keys(request).some(key => !allowed.includes(key)) || !PLAN_ACTIONS.includes(request.action)) throw coded('INVALID_REQUEST');
        const action = request.action;
        const writing = !['get', 'list'].includes(action);
        if (writing && (typeof request.requestId !== 'string' || request.requestId.length < 16 || request.requestId.length > 128)) throw coded('INVALID_REQUEST');
        if (!['submit', 'list'].includes(action) && (typeof request.jobId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(request.jobId))) throw coded('INVALID_REQUEST');
        if (writing && action !== 'submit' && (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0)) throw coded('INVALID_REQUEST');
        exec?.signal?.throwIfAborted();
        const scheduler = await schedulerReady();
        assertOwner(exec); // Parent may have gone away while initialization waited.
        if (!scheduler) throw coded(schedulerState.errorCode);
        const ownerSessionId = parent.id;
        if (action === 'list') return { ok: true, plans: await scheduler.list({ ownerSessionId }) };
        if (action === 'get') return { ok: true, plan: await scheduler.get({ ownerSessionId, jobId: request.jobId }) };
        if (action === 'submit') {
          const workingDirectory = optionalService(ctx, 'workingDirectory');
          if (!workingDirectory || typeof workingDirectory.ensure !== 'function') throw coded('WORKING_DIRECTORY_UNAVAILABLE');
          const providers = schedulerState.adapter.providers();
          let provider = request.provider;
          if (provider === undefined) provider = providers.includes('fork') ? 'fork' : providers.length === 1 ? providers[0] : undefined;
          if (typeof provider !== 'string' || !providers.includes(provider)) throw coded('PROVIDER_UNAVAILABLE');
          let cwd;
          try { cwd = await workingDirectory.ensure(parent, exec.signal); }
          catch { throw coded('WORKING_DIRECTORY_UNAVAILABLE'); }
          if (typeof cwd !== 'string' || !isAbsolute(cwd)) throw coded('WORKING_DIRECTORY_UNAVAILABLE');
          assertOwner(exec);
          exec?.signal?.throwIfAborted();
          const { bindingId } = schedulerState.adapter.bindParent(parent.id, parent);
          return { ok: true, plan: await scheduler.submit({ ownerSessionId, cwd, provider, parentBindingId: bindingId, requestId: request.requestId, plan: request.plan }) };
        }
        // Only a root-authorized explicit rebind mints a new per-job capability.
        // The engine publishes it to that job only after revision/state checks
        // commit; get/list/resume/retry never silently adopt a new incarnation.
        const binding = action === 'rebind' ? schedulerState.adapter.bindParent(parent.id, parent) : null;
        return { ok: true, plan: await scheduler.control({
          ownerSessionId, jobId: request.jobId, action, expectedRevision: request.expectedRevision,
          requestId: request.requestId, ...(request.taskId === undefined ? {} : { taskId: request.taskId }),
          ...(binding === null ? {} : { parentBindingId: binding.bindingId }),
        }) };
      } catch (error) { return planFailure(error); }
    },
    isConcurrencySafe: request => ['get', 'list'].includes(request.action),
  })));

  if (typeof ctx.inject === 'function') {
    // Never recover a live Agent from a stored id: the runtime adapter rechecks
    // exact live parent authority for each admitted activation.
    ctx.inject(['subagents', 'agents'], (runtime) => {
      let disposed = false;
      let store;
      let adapter;
      let scheduler;
      const ready = (async () => {
        try {
          runtimeServices(runtime);
          const profileContext = optionalService(runtime, 'profileContext');
          const profile = profileContext?.dir ?? profileContext?.home ?? process.env.DSH_PROFILE_DIR;
          if (typeof profile !== 'string' || !isAbsolute(profile)) throw coded('PROFILE_UNAVAILABLE');
          const [{ openJobStore }, { createRuntimeAdapter }, { createScheduler }] = await Promise.all([
            import('./store.js'), import('./runtime-adapter.js'), import('./scheduler.js'),
          ]);
          store = await openJobStore({ directory: join(profile, 'plugin-data', 'agent-orchestrator') });
          adapter = createRuntimeAdapter(runtime);
          scheduler = createScheduler({ store, adapter, readConfig: () => normalizeConfig(config) });
          await scheduler.init();
          if (disposed) return null;
          schedulerState.adapter = adapter;
          schedulerState.scheduler = scheduler;
          schedulerState.errorCode = null;
          return scheduler;
        } catch (error) {
          schedulerState.errorCode = Object.hasOwn(PLAN_ERRORS, error?.code) ? error.code : 'SCHEDULER_INIT_FAILED';
          await scheduler?.close?.().catch(() => {});
          await adapter?.close?.().catch(() => {});
          await store?.close?.().catch(() => {});
          return null;
        }
      })().catch(() => {
        schedulerState.errorCode = 'SCHEDULER_INIT_FAILED';
        return null;
      });
      schedulerState.ready = ready;
      runtime.effect(() => async () => {
        disposed = true;
        await ready;
        schedulerState.scheduler = null;
        schedulerState.adapter = null;
        schedulerState.errorCode = 'SCHEDULER_UNAVAILABLE';
        try { await scheduler?.close?.(); }
        finally { try { await adapter?.close?.(); } finally { await store?.close?.(); } }
      });
      if (typeof runtime.on === 'function') {
        runtime.on('subagent/end', () => wakeScheduler({ capacityReleased: true }));
        runtime.on('agent/disposed', () => wakeScheduler());
      }
      // Volatile fields have no public change subscription. A bounded wake
      // notices enabled/limit changes without replaying task results or polling models.
      runtime.effect(() => {
        const timer = setInterval(() => wakeScheduler(), 1000);
        timer.unref?.();
        return () => clearInterval(timer);
      });
    });
  }

  // Optional web/profile services: keep the original headless contract intact.
  // This registration is independent of enabled, so a disabled policy can be
  // inspected and re-enabled from the settings page without reloading the plugin.
  if (typeof ctx.inject === 'function') {
    const ownerFiber = ctx.fiber;
    ctx.inject(['configEditor', 'connection', 'webServer'], (web) => {
      const controller = createController({
        configEditor: web.configEditor,
        readConfig: () => config,
        validateConfig: value => Config(value),
        ownerFiber,
        onSaved: wakeScheduler,
      });
      web.effect(() => () => controller.close());
      web.effect(() => web.webServer.register({
        kind: 'exact', path: API_PATH,
        handler: createHttpHandler(web.connection, controller.dispatch),
      }));
      const plansHandler = createPlansHttpHandler(web.connection, schedulerReady, () => config);
      web.effect(() => web.webServer.register({ kind: 'exact', path: PLANS_PATH, handler: plansHandler }));
      web.effect(() => web.webServer.register({ kind: 'prefix', path: `${PLANS_PATH}/`, handler: plansHandler }));
    });
  }
}

export default { name, description, inject, Config, apply };
