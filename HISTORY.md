# 历史整合说明

首次整合将九个插件或桌面工具的可发布源码放入各自子目录：七个项目已有 Git 历史，两个项目原先没有 Git 仓库。后续移除了 `dsh-agent-orchestrator`，加入 `dsh-codex-break-defense` 和 `dsh-session-manager`，当前合集包含十个子项目。以下首次整合数据保留为历史记录，不代表当前分支、标签或目录清单。

## 2026-11-04：同步已完成的源码更新

本次发布以 `85de9a6b026cb20573b9ecefd9bc283b382bf4da` 为合集基线，在既有 `main` 创建普通源码快照提交，不改写已有历史、不新建分支，也不额外导入下列源仓库的新提交对象：

| 源目录 | 本次快照来源 | 版本 / 范围 |
| --- | --- | --- |
| `dsh-codex-manager` | `96fc70c7f1c52900e441c53a7fb729e2ae8469e6` | 0.6.0，自动 / 固定代理模式和只读代理候选 |
| `dsh-codex-subscription` | `26a76b770941913c7f4636e1bbd7ff4ff4bc6782` | 0.2.2，Windows 静态系统代理解析 |
| `dsh-qinglan-theme` | `e141f3430130d73a397d60342638472e0697839a` | 1.5.5，表单表面和原生控件配色 |
| `dsh-embedded-preset` | 无独立 Git 的五文件源码目录 | 1.0.0，纯声明式嵌入式开发预设 |
| `dsh-open-in-app-fix` | 无独立 Git 的已验证源码目录 | 仅更新 README，说明停用官方模块后 `insert` 修复模块及当前安装根 |

新增预设后合集包含十一个子项目。其余五个独立仓库的已跟踪可发布源码无需更新；会话管理器保留此前已发布的 1.4.0 快照，正在编辑的新增工作区功能不纳入本次发布，不以父目录旧副本覆盖。

本次实际检查：Codex 管理中心客户端语法与全部 49 项已有测试通过（分两批运行，包含临时凭证夹具用例）；订阅适配器 13 项已有测试与离线装载契约检查通过；青岚两项语法检查与 89 项最小相关测试通过。未进行真实代理联网验证，不把测试结果外推为所有插件的全量验证。VS Code 修复在此前同日已完成离线测试、真实启动及用户当前 GUI 成功确认，本次复用该结论且只更新部署文档。

只包含源码、元数据及说明，不上传当前 desktop profile、代理地址、凭据、用户存储或安装状态。下列 2026-11-03 及首次整合内容为当时的历史记录，不能作为此次源 HEAD 已导入的声明。

## 2026-11-03：仅更新既有 main

本次先通过 SSH 获取并快进到远端 `main` 的 `5ac6a16732d52ce95a97b309ac8904e06ba53050`，保留青岚主题 1.5.4 的已有源码更新。核对独立仓库已跟踪文件后，源码与合集一致（忽略 LF / CRLF 差异），因此无需重新复制插件源码。

以下三个源 HEAD 的共六个原始提交尚未从合集 `main` 可达，本次通过保留当前源码树的多父合并连接它们；作者、日期、提交信息及 SHA 均不改写：

| 独立仓库 | 本次连接的原 HEAD | 新增原始提交数 |
| --- | --- | ---: |
| `dsh-codex-manager` | `282b87c2d7fcbc7a99b24f325ed8fe9bd88b1d8c` | 1 |
| `dsh-codex-subscription` | `1e8cbebd918995149a872c796d25c47eba022ed5` | 1 |
| `dsh-qinglan-theme` | `ef9e467e59e2c42561c8f33a02499f7f0ea84b13` | 4 |

其余五个独立仓库 HEAD 已从 `main` 可达：

| 独立仓库 | 已连接的原 HEAD |
| --- | --- |
| `dsh-codex-break-defense` | `20852b1e6e551161ce3e291c03355e9d9fb23175` |
| `dsh-desktop-quick-actions` | `6490b0f23aa360be871cc36d594c73ebe5337be2` |
| `dsh-document-search` | `4e95ca57ba6703293ca41e60b4c029872381e725` |
| `dsh-focus-calendar` | `67c25e8ae9d28ffcae6f21310b9da1454a0f6829` |
| `dsh-git-visualizer` | `e139c491eddac4389ec4054c03cd8ace7153e198` |

`dsh-open-in-app-fix` 和 `dsh-session-manager` 当前没有独立 Git 仓库；其已发布源码已在合集提交中。会话管理插件正在进行的本地未提交改动按用户选择保留在工作区，不纳入本次发布。

本次不新建本地或远端分支、不推送额外标签、不删除远端既有分支，不强制推送；仅将合集现有 `main` 通过 `git@github.com:xuyalunyy-lgtm/dsh-Plugin.git` 正常快进推送。首次整合时的 `history/*` 映射见下文，仅供追溯，不是当前引用清单。

## 首次整合保留方法

- 七个既有仓库全部引用可达的 **46 个原始提交**作为原对象导入，不 squash、不 filter、不重写作者、日期、提交信息或 commit SHA。
- 合集 `main` 的首次导入提交使用全部独特引用端点提交作为多个父提交；因此原提交从 `main` 可达，而不是只存在于一个未连接的对象库。
- 原历史中的文件仍位于各自原仓库的根路径；只在新的合集树中才放到插件子目录。历史提交没有被改写成带插件路径前缀的提交。查看旧提交时，应结合下方项目映射识别归属。
- 原分支映射为 `refs/heads/history/<插件名>/<原分支>`；原标签映射为 `refs/tags/history/<插件名>/<原标签>`，保留原 tag 对象 ID。
- 其他引用（包括 remote-tracking 和恢复的上游引用）保留到 `refs/heads/history/<插件名>/preserved/<原 refs/ 后缀>`，避免与新 `main` 或其他项目重名。
- `dsh-agent-orchestrator`、`dsh-open-in-app-fix` 原先没有 Git 历史，以当前快照首次导入；其他项目未提交的当前源码也包含在新的合集树中，不伪称它们已属于旧提交。
- 发布快照过滤依赖、凭据、备份、缓存和大型安装归档；**旧提交历史没有被过滤改写**。历史应另做敏感信息与许可审查，保留历史不表示其中每个版本都可运行或通过测试。
- 这里只说明本地对象与引用整合；是否已成功推送需要另以远端核验结果为准。

## 项目历史来源

| 插件 | 原 HEAD | 原可达提交数 | 保留引用数 |
| --- | --- | ---: | ---: |
| `dsh-codex-manager` | `c244d30a850e40d062120829e15f536e628c364d` | 1 | 1 |
| `dsh-codex-subscription` | `bf5ce87d2c647573c93c20291e39b0fdbf9da06a` | 14 | 5 |
| `dsh-desktop-quick-actions` | `6490b0f23aa360be871cc36d594c73ebe5337be2` | 2 | 1 |
| `dsh-document-search` | `4e95ca57ba6703293ca41e60b4c029872381e725` | 8 | 6 |
| `dsh-focus-calendar` | `67c25e8ae9d28ffcae6f21310b9da1454a0f6829` | 8 | 1 |
| `dsh-git-visualizer` | `e139c491eddac4389ec4054c03cd8ace7153e198` | 7 | 1 |
| `dsh-qinglan-theme` | `38ef286291d6c16b649051d331f6d344d7a8deaa` | 6 | 1 |

## 引用映射

| 插件 | 原引用 | 合集引用 | 原对象 ID |
| --- | --- | --- | --- |
| `dsh-codex-manager` | `refs/heads/main` | `refs/heads/history/dsh-codex-manager/main` | `c244d30a850e40d062120829e15f536e628c364d` |
| `dsh-codex-subscription` | `refs/heads/fix/codex-tool-history-multimodal` | `refs/heads/history/dsh-codex-subscription/fix/codex-tool-history-multimodal` | `bf5ce87d2c647573c93c20291e39b0fdbf9da06a` |
| `dsh-codex-subscription` | `refs/heads/main` | `refs/heads/history/dsh-codex-subscription/main` | `255db85103ca88e665af5215c031c9b169f6132c` |
| `dsh-codex-subscription` | `refs/recovered-upstream/heads/main` | `refs/heads/history/dsh-codex-subscription/preserved/recovered-upstream/heads/main` | `255db85103ca88e665af5215c031c9b169f6132c` |
| `dsh-codex-subscription` | `refs/remotes/origin/HEAD` | `refs/heads/history/dsh-codex-subscription/preserved/remotes/origin/HEAD` | `255db85103ca88e665af5215c031c9b169f6132c` |
| `dsh-codex-subscription` | `refs/remotes/origin/main` | `refs/heads/history/dsh-codex-subscription/preserved/remotes/origin/main` | `255db85103ca88e665af5215c031c9b169f6132c` |
| `dsh-desktop-quick-actions` | `refs/heads/main` | `refs/heads/history/dsh-desktop-quick-actions/main` | `6490b0f23aa360be871cc36d594c73ebe5337be2` |
| `dsh-document-search` | `refs/heads/main` | `refs/heads/history/dsh-document-search/main` | `4e95ca57ba6703293ca41e60b4c029872381e725` |
| `dsh-document-search` | `refs/tags/v0.1.2` | `refs/tags/history/dsh-document-search/v0.1.2` | `848e129a4fa75eaa7d3b0fb64b32262a91467034` |
| `dsh-document-search` | `refs/tags/v0.2.0` | `refs/tags/history/dsh-document-search/v0.2.0` | `0ff8512926a71bf7a0bd78c3c3d3bbaf8b1c569c` |
| `dsh-document-search` | `refs/tags/v0.2.1` | `refs/tags/history/dsh-document-search/v0.2.1` | `f11d86d7b6647dfeb22c9c0262eb45e3e1d46e6b` |
| `dsh-document-search` | `refs/tags/v0.3.0` | `refs/tags/history/dsh-document-search/v0.3.0` | `2632aa3c5b2c2215f7b57e90a2a6a96e0e561fd3` |
| `dsh-document-search` | `refs/tags/v0.4.0` | `refs/tags/history/dsh-document-search/v0.4.0` | `4e95ca57ba6703293ca41e60b4c029872381e725` |
| `dsh-focus-calendar` | `refs/heads/main` | `refs/heads/history/dsh-focus-calendar/main` | `67c25e8ae9d28ffcae6f21310b9da1454a0f6829` |
| `dsh-git-visualizer` | `refs/heads/main` | `refs/heads/history/dsh-git-visualizer/main` | `e139c491eddac4389ec4054c03cd8ace7153e198` |
| `dsh-qinglan-theme` | `refs/heads/main` | `refs/heads/history/dsh-qinglan-theme/main` | `38ef286291d6c16b649051d331f6d344d7a8deaa` |

## 浅克隆恢复与上游归属

`dsh-codex-subscription` 原开发目录是浅克隆；准备阶段仅在隔离镜像中从其文档所列公开上游补齐可达历史，原开发目录及其改动未被修改。可达提交数为 14，保留原本地修复分支与原上游引用。

各插件许可、上游作者与第三方声明仍以子目录文档和原历史为准。本合集没有增加覆盖全部子项目的统一许可证。
