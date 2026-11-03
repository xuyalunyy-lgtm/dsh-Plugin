# DSH Plugin Collection

本仓库汇总多个 DeepSeek Harness（DSH）插件或桌面修复工具的当前源码快照。每个子目录独立维护；**仓库根目录不是一个可直接安装的 npm 插件包**。

## 插件索引

| 目录 | 当前版本 | 功能 | 使用说明 |
| --- | --- | --- | --- |
| `dsh-codex-break-defense` | 1.4.0 | Codex 开发约束与防御性冗余提醒 | [README](./dsh-codex-break-defense/README.md) |
| `dsh-codex-manager` | 0.4.1 | Codex 现有连接、Fast、配额、代理和脱敏诊断管理 | [README](./dsh-codex-manager/README.md) |
| `dsh-codex-subscription` | 0.2.1 | `dsh-llm-codex` 订阅模型适配器 | [README](./dsh-codex-subscription/README.md) |
| `dsh-desktop-quick-actions` | 0.1.1 | Windows Desktop 重启确认菜单补丁 | [README](./dsh-desktop-quick-actions/README.md) |
| `dsh-document-search` | 0.4.0 | 当前 PDF / Markdown 文档全文搜索与定位 | [README](./dsh-document-search/README.md) |
| `dsh-focus-calendar` | 1.3.0 | 待办、专注计时、健康提醒与备份恢复 | [README](./dsh-focus-calendar/README.md) |
| `dsh-git-visualizer` | 0.6.0 | Git 多仓库检索、差异、提交、分支及安全同步 | [README](./dsh-git-visualizer/README.md) |
| `dsh-open-in-app-fix` | 独立脚本 | Windows 在 VS Code 中打开的环境变量修复 | [README](./dsh-open-in-app-fix/README.md) |
| `dsh-qinglan-theme` | 1.5.4 | 青岚主题、柔和配色、本地背景及 Markdown / 侧栏对比度修复 | [README](./dsh-qinglan-theme/README.md) |
| `dsh-session-manager` | 1.3.0 | 会话跨工作区迁移、多选可恢复归档、空会话识别及工作区隐藏/显示 | [README](./dsh-session-manager/README.md) |

## SSH 同步与当前发布范围

- 仓库地址：[xuyalunyy-lgtm/dsh-Plugin](https://github.com/xuyalunyy-lgtm/dsh-Plugin)；SSH 地址为 `git@github.com:xuyalunyy-lgtm/dsh-Plugin.git`。贡献者页面仅用于浏览，不能作为 Git 推送地址。
- 2026-11-03 核对了八个独立插件仓库和两个无独立 Git 历史的工具 / 插件目录，合集共保留十个子项目。八个独立仓库的已跟踪源码及在应用中打开修复脚本与合集一致（忽略 LF / CRLF 差异），无需重复覆盖源码；会话管理插件保留已提交快照。
- 本次仅在既有 `main` 连接 Codex 管理器、Codex 适配器和青岚主题尚未连接的原始提交，并更新根文档；不创建分支、不改写原提交、不强制推送，也不新增 `history/*` 分支。
- 会话管理插件的本地在途改动按要求暂不发布，索引中的 1.3.0 是当前提交版本，不代表本地未提交草稿的版本。
- 后续从本合集现有 `main` 正常推送：`git push origin HEAD:refs/heads/main`。不要把各独立仓库的根树依次推到同一个目标 `main`，否则会丢失合集目录结构或产生非快进冲突。

## 使用与构建

1. 先阅读目标子目录的说明，确认它兼容的 DSH / Desktop 版本。不是所有项目都采用相同的安装方式；桌面归档补丁尤其不能当成普通插件直接加载。
2. 对有 `package.json` 的插件，在该子目录按其文档安装依赖、运行测试和构建，再通过 DSH 官方插件管理器安装对应包或版本化 tarball。不要把整个合集目录当成插件安装。
3. 首次加载或更新后，按宿主提示正常重启 / 刷新原有 GUI。源码更新不代表已安装副本自动更新；`file:` 目录安装也可能复用旧副本，应核对实际版本。
4. 各项目原文档保留了开发机器的示例路径。请改成自己的 DSH 安装目录、profile 与工作目录，不要原样套用本机绝对路径。
5. `dsh-document-search` 的 `client.js` 和 `src/pdf-assets.json` 是可再生的 PDF 支持 bundle，本源码快照不包含这两份构建产物。进入该目录后运行 `npm ci --ignore-scripts`、`npm run build` 生成；构建依赖与第三方声明仍保留。未构建不能直接按其客户端导出安装。
6. `dsh-codex-subscription/lib/` 以及其他插件直接维护的 `client.js` 是本快照必要的实现入口，已保留；不能一概把 `lib/` 或同名客户端当成可删除产物。
7. `dsh-desktop-quick-actions` 的 `baseline/`、`staging/` 和原始桌面归档不包含在仓库中。重新生成补丁前，须按照其说明从自己已审查的安装包提取基线，不能跳过版本和哈希校验。

## 快照与安全边界

- 当前 `main` 按源码快照整理，不创建嵌套仓库或 gitlink。首次整合连接了七个既有仓库的历史；后续加入 Codex Break defense，并将本次核对到的八个独立仓库 HEAD 全部连接到 `main`，原 commit 与 tag 对象不改写。首次整合的引用映射仅是历史记录，不代表这些分支目前仍存在；本次只推送既有 `main`，详见 [历史整合说明](./HISTORY.md)。历史旧树仍使用原仓库根路径，而非当前插件子目录路径；本地整合完成不等于已经推送。
- 未包含依赖目录、认证文件、SSH 密钥、用户数据、会话数据库、迁移备份、截图、日志、构建缓存、桌面安装归档或发布 tarball。
- 本地审计目录 `.publish-audit/` 记录源快照、排除项及逐文件 SHA-256，仅供发布前核对，已加入忽略规则，不随仓库公开；其中可能包含开发机路径。审计清单不是测试成功证明。
- 不要将真实 Token、私钥、带凭据的代理地址或账号配置加入本仓库。测试脚本中的固定假值与代码中的凭据读取逻辑不表示仓库携带真实凭据。
- 部分测试会读取已安装的 DSH 运行时，或需要 Git / Windows Desktop；请按各插件说明运行，不要把单个项目的测试结果外推为全部插件已验证。

## 许可与上游归属

各子目录保留自己的许可声明、上游链接与第三方 notices。本合集不以根级统一许可证覆盖各项目的许可，也不为缺少许可文件的目录补授许可。`dsh-codex-subscription` 文档保留其上游项目归属，文档搜索保留 PDF.js 及字体 / CMap 的第三方声明；再分发前请自行核对相应条款。
