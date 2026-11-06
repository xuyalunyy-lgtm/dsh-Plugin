# DSH 本体更新：当前事实与选择性更新方案

核对日期：2026-11-06。当前 Windows Desktop 为 **0.2.2-rc.1**，安装清单中的构建标识为 `c59d10aff167ad7eefead4b3a9082fb57c8fbfe8`。本机还带有已审查的宿主补丁，因此版本号相同不代表与官方发行归档逐字相同。

**最新进展：用户已授权实施，下述策略已制作成[精确构建候选补丁](<dsh-desktop-update-policy/README.md>)，尚未安装。**候选新增 `updates.enabled`，默认 false；需要完全退出 Desktop 后在外部执行安装器。当前运行中的 Desktop、用户设置、更新 feed、hosts、防火墙和缓存仍未修改，也没有克隆或升级 DSH 本体。以下“当前实现”指安装此候选前的基线。

## 1. 当前是否会自动更新？

答案需拆成三层：

| 行为 | 当前实现 | 本轮处理 |
| --- | --- | --- |
| 自动下载新安装包 | `autoUpdater.autoDownload = false` | 已是关闭状态，没有新增配置 |
| 正常退出时自动安装 | `autoUpdater.autoInstallOnAppQuit = false` | 已是关闭状态，没有新增配置 |
| 后台检查新版 / 强制更新策略 | 仍在启动、聚焦 / 恢复及周期检查中运行 | **未关闭**；当前没有公开完整开关 |

依据是已安装 Desktop 的 `lib/main.js`：15360–15381 行构造更新协调器，15374–15375 行明确关闭前两项；15392–15401、15506–15519 行仍允许元数据检查。自动检查调度默认 10 分钟，另有来自 manifest `dshMandatoryUpdatePolicy` 的独立策略查询。

### 需要注意的按钮行为

侧栏的“发现新版本 / 下载更新”并非纯信息页。它通过 `updates.open` 进入更新流程，已有可用版本时可能直接开始下载；安装仍需之后的任务检查与重启确认。保持当前补丁版本时，不要误点下载或“安装并重启”。

仅看到缓存里的安装包不能证明有新版待装；本轮看到的缓存文件名仍是当前 0.2.2-rc.1，未删除或执行它，也没有用缓存存在推断自动安装。

### 不要写这些无效开关

**未打本补丁的基线** `desktop/settings.json` 读取逻辑只识别 `updates.allowTestAuthPopupWindow`，它控制测试认证弹窗，不控制更新。直接往原版配置添加 `autoUpdate: false`、`updates.enabled: false` 会被忽略。新候选实现后才识别 `updates.enabled`，安装器会合并设为 false；它不是原版已有的官方开关。

同样，延长检查间隔不能阻止启动首次检查；改 channel 不是关闭；移除更新 feed 也不会关闭独立强制更新策略。隐藏界面提示不等于停止请求。

## 2. 彻底关闭的候选实现

已按以下边界新增精确构建策略补丁，而不是仅改一个原版不存在的配置项：

1. 单一持久化开关，明确控制普通自动检查、独立策略检查，以及手动下载 / 安装入口。
2. 在启动、聚焦、恢复、定时任务、菜单和 renderer IPC 入口都遵守同一策略；界面明确显示“更新已禁用”。
3. 保留现有账号、网络、任务、插件和用户存储功能，不通过全局断网、删 updater、hosts 或忽略 TLS 来实现。
4. 构建时校验当前版本、构建和文件哈希；先产生可审候选，在 Desktop **完全退出**后外部安装，再正常重启。不能热替换运行中的 ASAR。
5. 重启后观察一次启动、聚焦、恢复及超过默认检查周期，确认更新 feed 和 `/api/v0/check_client_update` 均无请求；仅提示消失不足以证明关闭。

候选构建与主入口语法检查通过；新增开关隔离回归 **23/23**，复用归档保留测试后总计 **24/24**。安装器 `-CheckOnly` 已确认当前归档 / 候选 hash 和运行中进程保护，未写入设置或安装文件。**当前仍未安装，因此不能宣称当前进程已停止检查。**完全退出后的安装与真实启动 / 聚焦 / 恢复 / 周期观察见[补丁说明](<dsh-desktop-update-policy/README.md>)。任何后续本体升级都须重新核对此设置与现有宿主补丁。

## 3. 要不要拉 DSH 开源代码？

### 仅更新普通插件：不需要

独立插件按自己的维护源、依赖和宿主公开接口更新即可。先检查兼容性、运行相关现有测试，再按 `link:` / `file:` 安装方式部署，不必为了一个插件拉整个 DSH 仓库。

### 要长期维护本体或挑选上游修复：建议建立独立源码工作树

官方仓库是 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)，本轮 API 核对默认分支为 **master**，不是 main。官方 [README](https://github.com/deepseek-ai/deepseek-harness/blob/master/README.md) 与 [开发指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/development.md) 说明了源码构建流程；当前指南要求 Node.js 24.9+ 和仓库固定的 pnpm。

**完整可构建工作树不等于完整 Git 历史。**可以先浅克隆一个已确认的官方 release ref，后续审查需要时再加深历史或获取特定提交。只下载零散文件或仅 fetch tags，并不能自动得到依赖一致、可以构建的项目。

建议未来位置放在插件目录之外，例如与 `DSH/` 并列的 `dsh-upstream/`，不要把本体源码、全部依赖和构建输出复制进插件发布仓库。本轮没有创建该目录或克隆。

### 当前不能承诺精确还原已安装构建

安装 manifest 声称的 `c59d10aff167ad7eefead4b3a9082fb57c8fbfe8` 在本轮 [公开 GitHub commit API 查询](https://api.github.com/repos/deepseek-ai/deepseek-harness/commits/c59d10aff167ad7eefead4b3a9082fb57c8fbfe8) 返回“找不到该 SHA”。因此不能直接建议 checkout 此 SHA 并声称得到相同源码；需先寻找可公开获取并验证的对应 ref / source release。

如果无法确认精确来源，可以选择另一已验证的官方版本作为**新基线**，但必须承认它不是当前本机构建，重新审查插件接口、持久化迁移和现有补丁，而不是假装无差别更新。

## 4. 选择性更新的正确边界

“选择性”优先指**选择上游修复提交并审查依赖关系**，不是把最新版单个 built 文件覆盖到旧 Desktop：

1. 固定并记录当前可获取的源码基线；保留本地修改为可审提交。
2. 阅读上游修复及其所依赖的提交、公共类型、生成元数据、会话格式和数据库变更。
3. 在源码工作树中选择必要提交；涉及不可拆分接口 / schema 迁移时一起更新，不能只复制调用方。
4. 按官方流程重新构建受影响 Host、Client、preload、Desktop 及原生模块，并运行所需检查。Web 源码启动与打包 Desktop 是不同交付路线。
5. 在独立开发环境和隔离数据中验证，再决定是否替换日常 Desktop。不要用真实会话删除或生产数据迁移做冒烟测试。

官方源码 Web 示例 `pnpm install` → `pnpm run build` → `pnpm dsh web` 是独立运行方式，**不是升级现有 Desktop 的安装说明**。Desktop 的 Electron 壳、bundled runtime、桥接和原生模块需要匹配；只替换 `dsh/` 或前端资源不能保证兼容。

仍需留意上游修复中的安全和数据完整性变更；关闭自动检查后不会自动提醒这些修复，后续由人工明确选择和审查。
