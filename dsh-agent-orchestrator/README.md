# 主控调度 · DSH Agent Orchestrator 0.3.1

**结构化任务图 + 事件驱动多智能体调度。** 主智能体提交目标、依赖和工作包后，插件负责就绪队列、并发上限、写入资源所有权、执行事件回收与持久状态；不再只是提示模型“请多开子智能体”。

- 主对话智能体：规划任务图、澄清接口、检查结果、决定重试与验收。
- 执行子智能体：完成工作包中的调查、实现、测试与修复。
- 调度器：自动启动已就绪且资源不冲突的任务，依赖完成后继续派工。
- 设置页：提供只读任务看板及调度配置。旧工具 guard 是辅助护栏，**默认 `mode: prompt`**，不是任务调度引擎。

> 执行完成不等于验收通过。本版任务结果明确保持 `verified: false`；需要独立审查时，主智能体必须在 DAG 中显式创建 reviewer 任务，并人工核对实际证据。插件不是安全沙箱，不承诺任意任务、任意 provider 都能启动，也不承诺副作用 exactly-once。

## 0.3.1 宿主接入修复

0.3.0 在真实 Cordis 4.0.5 插件上下文中直接读取未声明注入的 `agents`、`workingDirectory` 或 `profileContext`，可能在权限核验或初始化阶段抛出反射访问错误，令 `orchestrator_plan` 的 `submit`、`list` 都返回泛化的 `FAILED`。可选链不能阻止这种上下文属性访问异常。

0.3.1 改用宿主公开的 `ctx.get(name)` 查询可选服务；只有已声明注入的必需服务继续使用属性接口。仍严格检查 `agents.get(exec.agent.id) === exec.agent` 和根委派深度，不接受伪造父身份、不自动重放已有副作用，也不修改生产任务文件或锁。缺少运行服务、工作目录或绝对 profile 目录时分别返回 `AGENTS_UNAVAILABLE`、`SUBAGENTS_UNAVAILABLE`、`WORKING_DIRECTORY_UNAVAILABLE`、`PROFILE_UNAVAILABLE`；无法归类的初始化失败使用固定的 `SCHEDULER_INIT_FAILED`，不暴露原始异常或私人路径。原状态工具与 headless 基础能力不依赖这些可选服务。

此修复与真实模型 DAG 验收分开：安装源码或通过离线测试不代表真实子任务已成功运行，部署后仍须从真实根对话核验新工具及获授权的小型任务图。

## 兼容与安装

本版仅以 **DSH 0.2.1-rc.5** 为兼容目标，`dsh-subagent`、`dsh-tools`、`dsh-llm` peer 接口均固定为该版本；不再泛称兼容 rc.3。配置库仍为 `@deepseek-ai/schemastery ~3.18.5`。复用宿主 React、ModuleLoader、Web 服务与鉴权，不另起服务器或引入另一套前端依赖。

使用桌面安装版自带的官方 CLI 安装本地插件：

```powershell
& 'D:\deepseekH\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop add 'file:D:/xuyl/tool/DSH/dsh-agent-orchestrator'
```

已有相同 `file:` 目录安装时，管理器可能复用旧副本；命令退出成功不证明副本已更新。建议生成**新的版本化安装包**并通过官方管理器安装实际生成的路径，例如：

```powershell
# 在插件目录，用 DSH 自带的 Node/pnpm 执行；实际包名以 pack 输出为准。
pnpm pack --pack-destination releases
& 'D:\deepseekH\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop add 'file:D:/xuyl/tool/DSH/dsh-agent-orchestrator/releases/local-dsh-agent-orchestrator-0.3.1.tgz'
```

安装后核对 profile 实际解析副本版本为 **0.3.1**，发布内容包含 `runtime-adapter.js`、`store.js`、`scheduler.js`、`controller.js` 与 `client.js`。不要手改 `app.asar` 或缓存绕过安装。普通 npm CLI 可能拒绝操作桌面保留 profile，此时使用桌面附带 CLI。

**正常重启 DSH，再刷新原有 GUI，核验“设置 → 主控调度”及 `orchestrator_plan` 工具。** 新增任务服务/工具和客户端看板是否加载必须按当前实例验证；Host 热加载、源目录修改或离线测试不能替代安装副本与 GUI 验收。插件从不启动替代 Web 服务，仍使用原运行地址。

## 提交任务图

任务由主模型调用原生工具 **`orchestrator_plan`** 提交。工具从真实执行上下文取得根智能体、父会话与工作目录；浏览器不能传入任意 parent agent、提示词或计划 JSON 来创建任务。

任务图示例：A、B 独立，只读 reviewer C 依赖二者。下面是 `submit` 的主要结构。`provider` 若省略优先选择已注册的 `fork`；否则仅当恰好一个 provider 可用时自动选择，多个 provider 无明确选择会拒绝。可见或已注册不代表一定能初始化或有配额。

```json
{
  "action": "submit",
  "requestId": "read-only-dag-demo-0001",
  "plan": {
    "title": "并行调查后统一复核",
    "maxConcurrency": 2,
    "tasks": [
      {
        "id": "A",
        "title": "分析模块A",
        "prompt": "只读检查模块A，报告接口约束与风险；不要修改文件。",
        "dependsOn": [],
        "writeResources": [],
        "acceptance": "给出实际读取的文件位置、结论与未验证项。"
      },
      {
        "id": "B",
        "title": "分析模块B",
        "prompt": "只读检查模块B，报告依赖与测试边界；不要修改文件。",
        "dependsOn": [],
        "writeResources": [],
        "acceptance": "给出实际读取的文件位置、结论与未验证项。"
      },
      {
        "id": "C",
        "title": "交叉复核A与B",
        "prompt": "依据A和B的实际结果只读复核，列出一致结论、冲突与证据缺口。不要修改文件，不把其他任务成功直接当作验收通过。",
        "dependsOn": ["A", "B"],
        "writeResources": [],
        "acceptance": "指出证据支持的结论及仍需主智能体验收的部分。"
      }
    ]
  }
}
```

### 校验与边界

- 每计划 1–32 个任务；任务 ID 为 1–64 个字母、数字、下划线或连字符，必须唯一。依赖必须存在，禁止自依赖、重复依赖和循环。
- 每计划 `maxConcurrency` 为 1–8；本插件所有计划合计还受设置中的 `preferredParallelism` 1–16 限制。宿主自身可能有更低的容量、权限、深度或配额限制，不保证开满。
- `writeResources` 声明任务写入的文件或目录，按工作目录归一化。没有依赖顺序却声明相同或祖先/后代资源的任务会被拒绝；不要用不完整资源声明掩盖冲突。
- **资源所有权声明不是文件系统隔离。** 执行者仍须遵守实际沙箱、审批、目录规则和用户改动；不能宣称声明列表能阻止越界写入。
- `requestId` 为 16–128 字符，用于有界持久回执去重。同 ID 不同参数冲突；结果不明时先查询，必要时仅以原 ID、原参数重试，不能换 ID 自动重放副作用。
- 文本、任务数、存储记录和结果摘要均有边界。看板显示的是安全摘要，不是完整执行历史；`truncated` 表示输出已截断。

### 查询与控制

`orchestrator_plan` 提供以下动作，控制必须在**原创建计划的根对话**中执行，并使用刚读取的计划版本：

| action | 用途 | 主要输入 |
| --- | --- | --- |
| `submit` | 校验并持久化任务图，然后由调度器派工 | `requestId`、`plan`；可选 `provider` |
| `list` | 查询当前真实父会话的计划 | 无浏览器 parent 覆盖参数 |
| `get` | 读取计划和任务状态 | `jobId` |
| `pause` | 停止该计划后续派工，不强制停止已运行任务 | `jobId`、`expectedRevision`、`requestId` |
| `resume` | 恢复可调度计划，仍检查开关、provider 和父上下文 | 同上 |
| `cancel` | 请求取消计划，停止新派工并处理运行中的执行 | 同上 |
| `retry` | 显式重试指定失败/中断任务 | 同上，另含 `taskId` |
| `rebind` | 重启后在原根会话恢复真实父绑定 | `jobId`、`expectedRevision`、`requestId` |

实际工具 schema 是最终参数来源。控制操作遇到 `CONFLICT` 时，重新读取计划并人工核对，不要把旧动作换上新版本自动重放。取消请求不等于副作用已撤回，也不能将尚未实际停止的执行宣称为已取消完成。

## 事件、失败与重启

调度器依据实际 activation 生命周期与完成结果推进图，不以模型在文本中说“完成”为唯一状态来源。任务开始后占用插件并发与声明资源，结束后释放；失败依赖会阻塞后继任务，原因在看板展示。

- `succeeded` 只表示执行流程完成，**不表示独立验收通过**。产物与测试证据仍由主智能体或显式 reviewer 检查。
- 暂停与关闭 `enabled` 都是停止新派工，不强制取消已经运行的任务。关闭状态在队列派工和实际启动边界双重核对；不能据此撤回已开始的执行或外部副作用。
- 每个计划绑定的是同一会话中**精确的 Agent 实例代际（incarnation）**，不是仅凭可伪造或可复用的父 ID。进程或会话重建后，必须回到原创建根对话执行 `rebind`，不接受任意父智能体接管。
- Host/插件重启后，未确认完成的启动中或运行中任务标记 `interrupted`；**不会自动重放可能已有副作用的工作**。
- 原创建根会话恢复后先执行 `rebind`，再明确选择需要 `retry` 的任务。必须先检查文件、外部服务和既有产物，不能假定上次未完成就没有副作用。
- **清理结果不明确时全局停止派工（fail-closed）。** 若 activation 的 cleanup/teardown 无法确认完成，会持久化 `cleanupUncertain` 并使整个调度器停止新派工；跨重启也不会自动解除。必须先由人工确认旧执行确已退出，再按实际诊断结果处理，不是自动无限重试。普通 `rebind`/`retry`、插件开关或重启不能视为解隔离操作；本版不提供网页一键解除，也没有可宣称已实现的清除隔离 CLI 命令。
- 不承诺 exactly-once、不自动提高宿主并发/委派深度、不切换账号或模型、不绕过权限与审批。存储失败或父上下文不可用时应停止新派工并报告，而不是凭猜测继续执行。

## 设置 → 主控调度

### 只读任务看板

顶部看板显示计划状态、依赖、执行次数、provider/子智能体标识、声明写入资源、结果摘要、失败与阻塞原因，以及**实际运行中 / 启动中**任务数。

- 显示本插件实际总并发上限；宿主全局容量若未提供就显示**未知**。不会显示“已开满”或把设置值当成实际活跃数。
- 任务执行完成显示“执行完成，未独立验收”；不会因为全图成功就自动显示 verified。
- 本地连接鉴权允许查看当前 profile 摘要，**不是新增的多用户隔离**。摘要不返回完整 prompt 或凭据，但仍可能包含任务名称、资源路径与输出，应按本机访问权限保护。
- 看板 HTTP 接口**仅 GET**。不提供伪可用的暂停/重试按钮；所有控制回到原创建对话的工具，由真实父上下文校验权限。
- 页面可见且有活动任务时，每次读取结束后等 **3 秒**再刷新，不重叠；页面隐藏时暂停并取消请求，恢复可见后读取。网络/鉴权/格式失败停止自动刷新，保留历史快照并明确标旧，须手动重试。无活动任务则停止刷新，可手动发现新计划。
- 看板刷新与设置表单完全独立，不覆盖正在编辑的草稿；不发送模型请求、不自动重试任务、不读取 token。

复用宿主 HTTP 与鉴权：

- `GET /api/agent-orchestrator/plans` → `{ok, plans, warnings, scheduler:{available,errorCode?,enabled,limit,runtimeCapacity:null}}`。
- `GET /api/agent-orchestrator/plans/<encodedJobId>` → `{ok, plan, permissions:{control:false}, warnings}`。
- 不提供通过浏览器指定 owner/parent 或创建计划的接口。

### 配置

| 配置项 | 默认值 | 含义 |
| --- | --- | --- |
| `enabled` | `true` | 允许任务图新派工及辅助策略；关闭不强制取消已运行任务。 |
| `mode` | `prompt` | 辅助工具 guard：`prompt` 仅提示，`balanced` 只拦根主智能体 `write/edit`，`strict` 使用精确协调/只读白名单。 |
| `preferredParallelism` | `4` | **本插件所有任务实际总并发上限**，整数 1–16，统计启动中和运行中；不是宿主全局容量。 |
| `independentReview` | `true` | 提醒主模型显式添加 reviewer DAG 任务；不会自动创建 reviewer 或自动标记验证通过。 |
| `additionalAllowedTools` | 空 | strict 模式额外放行精确裸工具名，逗号/空白分隔，不支持 glob 或命名空间。 |

更改开关只是草稿，须点击**保存设置**并确认成功。保存使用 `GET /api/agent-orchestrator` 读取的设置版本，通过 `PUT` 提交 `{expectedRevision,settings}`；这与计划的数字版本不是同一类 revision。冲突时保留草稿，重新读取核对，不自动覆盖。失败或结果不明不能当作保存成功。

strict 默认拒绝 shell、`run_code`/PTC、写入及未知插件工具；并非 PTC 兼容安全实现。balanced 未覆盖 shell/其他插件写入，prompt 不阻断工具。额外放行任何可写工具会削弱职责隔离。所有模式都不是安全沙箱，执行子智能体仍服从宿主权限、审批与目录限制。

关闭/卸载插件不会删除其他用户级、项目级指令。本机本对话曾新增的静态强制委派段已按用户另行授权迁移到插件管理；不是插件安装、保存或卸载的自动行为，也不代表其他环境已迁移。

## 开发、发布与验证

要求 Node.js 22.15.0 或以上，推荐使用 DSH 自带 Node 24.x/pnpm。只在本插件目录安装依赖：

```powershell
pnpm install --ignore-scripts
pnpm run check
pnpm test
```

发布模块：`index.js` 宿主入口、`runtime-adapter.js` 真实父上下文/activation 适配、`store.js` 持久状态、`scheduler.js` 图校验与事件调度、`policy.js` 辅助策略、`controller.js` 配置与只读看板 HTTP、`client.js` 设置与任务看板。

单元测试、假 provider 测试和 VM 界面测试不等于真实模型或浏览器端到端验收。真实 DAG 验收应只做获授权的短只读任务，记录真实 activation、依赖启动顺序和完成状态，明确额度消耗；不得为“测试并行”无限重试。安装副本、已构建客户端和当前 GUI 都须核验，不能用源文件存在替代。

## 卸载

通过 DSH 插件管理页或桌面 CLI 移除：

```powershell
& 'D:\deepseekH\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop remove '@local/dsh-agent-orchestrator'
```

按宿主提示重启并刷新原 GUI。移除插件不撤销已发生的文件修改和外部副作用，不保证已经发出的执行立即停止；应先在原创建对话中处理活动计划并核对实际状态。已有用户/项目指令保留。
