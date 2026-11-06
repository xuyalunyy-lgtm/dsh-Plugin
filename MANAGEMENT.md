# 插件目录与发布管理

更新时间：2026-11-06。目标是保留正在使用的目录和安装链接，把“在哪里改、在哪里发布、何时部署”分开，而不是把所有目录合并或移动。

## 1. 唯一维护源

下表的路径相对工作区根目录 `DSH/`。`dsh-Plugin/` 是唯一云端发布仓库，远端为 [xuyalunyy-lgtm/dsh-Plugin](https://github.com/xuyalunyy-lgtm/dsh-Plugin)。独立源码仓库仅维护自己的插件，**不能把独立根树推送到合集的 main**。

| 项目 | 唯一维护源 | 合集中的发布路径 | 当前安装方式 |
| --- | --- | --- | --- |
| Codex Break defense | `dsh-codex-break-defense/` | 同名子目录 | `link:` 指向维护源 |
| Codex 管理中心 | `dsh-codex-manager/` | 同名子目录 | `link:` 指向维护源 |
| Codex 订阅适配器 | `dsh-codex-subscription/` | 同名子目录 | `link:` 指向维护源 |
| Desktop 快捷操作 | `dsh-desktop-quick-actions/` | 同名子目录 | 精确旧构建补丁，不是普通活动插件 |
| 文档搜索 | `dsh-document-search/` | 同名子目录 | `link:`；PDF 支持资源需构建 |
| 专注日历 | `dsh-focus-calendar/` | 同名子目录 | `link:` 指向维护源 |
| Git 工作台 | `dsh-git-visualizer/` | 同名子目录 | `file:` 独立安装副本，不能依赖源码自动更新 |
| 青岚主题 | `dsh-qinglan-theme/` | 同名子目录 | `link:` 指向维护源 |
| 在应用中打开修复 | `dsh-open-in-app-fix/` | 同名子目录 | profile 的独立修复入口引用维护源 |
| 嵌入式开发预设 | `dsh-embedded-preset/` | 同名子目录 | `link:` 指向维护源 |
| 会话管理器 | **`dsh-Plugin/dsh-session-manager/`** | 原地维护 | `link:` 指向合集中的该目录 |
| 永久删除宿主补丁 | **`dsh-Plugin/dsh-session-purge-core/`** | 原地维护 | 限定 Desktop 构建的外部安装补丁 |
| Desktop 更新策略 | **`dsh-Plugin/dsh-desktop-update-policy/`** | 原地维护 | 更新禁用候选，需完全退出后外部安装 |

工作区根部的 `dsh-session-manager/` 是 **1.3.0 非活动旧副本**，不是维护源、发布源或安装源。不要从它覆盖合集中的 1.5.1。暂时保留该目录、不删除或搬迁；先前项目和会话中可能仍有路径引用。

`.worktrees/` 是本地旧发布工作区，不是插件、DSH 本体源码或云端交付内容。`node_modules/`、构建缓存、补丁 `staging/`、安装归档、profile、凭据及会话数据库都不纳入发布。

### 需要特别防止的误操作

- Break defense 和专注日历的独立源码仓库曾配置与合集相同的 `origin`。这不是已发生的历史丢失，但说明必须核对所在仓库；本轮不擅自改动这些 remote。
- 订阅适配器保留第三方上游地址以尊重来源。本工作区的发布目标仍只有合集，不向该上游自动提交或推送。
- `link:` 只说明下一次模块加载来自哪个目录；已启动的 Host 不一定已经重载。`file:` 安装副本还需要按插件流程更新和核对版本。源码推送成功不等于当前 GUI 部署成功。

## 2. 统一检查与同步入口

发布清单在 [plugins.json](<plugins.json>)，生产管理工具在 [manage.mjs](<manage.mjs>)；不依赖第三方包。工具面向本地维护工作区，外部维护源按清单位于合集的同级目录；仅克隆合集来使用插件时，不需要创建所有维护源或执行 `sync`，直接阅读目标插件说明即可。先查看实际帮助：

```powershell
# 在 dsh-Plugin 目录执行；Node/Git 需可用
node manage.mjs --help
node manage.mjs check
node manage.mjs check --plugin dsh-codex-subscription
```

默认操作为只读检查：显示源版本、Git 状态及源/合集差异，不安装、修改 profile、提交或推送。Git 维护源仅采用已经跟踪的源码；静态目录采用逐文件清单；原地维护项目不做外部同步。仅换行符的差异不作为新功能更新。

需要同步时明确选择插件：

```powershell
node manage.mjs sync --plugin dsh-codex-subscription
```

同步前先在**唯一维护源**完成审查和现有相关检查；有独立 Git 的维护源还须先本地提交。静态清单源没有独立 Git 基线，显示 `dirty=n/a`，同步后在合集审查并提交。管理工具会拒绝脏 Git 源、目标插件已有改动、路径越界和链接文件；敏感路径拒绝，生成物 / 依赖等排除项只报告不复制。预检通过后才复制列出的新增/变更文件；目标缺源的额外文件只报告，不自动删除；已有但未由合集索引跟踪的目标文件一律拒绝覆盖，包括被忽略的本地文件。不提供全目录强制覆盖、备份副本或自动重试。

工具不是秘密扫描器：它以受审的跟踪清单、路径类别和明确静态清单限制发布范围，不能证明任意源码文本不含秘密。新增源码仍须人工看 diff，测试中的固定假值与凭据读取实现不等于可以把真实 auth 文件提交。

## 3. 发布到云端

管理工具不替你执行 Git 提交或网络推送。统一顺序：

1. 对唯一维护源运行所需的已有检查，审查实际差异；不为每次发布自动重测全部无关插件。
2. 用 `check` 核对源/合集差异，对明确插件执行 `sync`。
3. 更新根索引版本和 [HISTORY.md](<HISTORY.md>) 中的来源、验证结果及限制。
4. 在合集目录核对 `git rev-parse --show-toplevel`、`git remote get-url origin`、当前分支和暂存文件，明确列出要提交的文件，不用 `git add .`。
5. 通过现有凭据和严格 SSH 主机校验获取远端，确认没有未处理的分叉，再正常推送。不要改远端信任设置或强制覆盖。

```powershell
# 只能在 dsh-Plugin 发布仓库执行；不是各独立源码根目录
# Windows 可用已安装的 C:\Program Files\Git\cmd\git.exe
# 适用插件规则要求禁用 hooks、提交不签名
git fetch origin main
git diff --cached --check
git -c core.hooksPath=NUL -c commit.gpgSign=false commit -m "chore: sync reviewed plugin updates"
git -c core.hooksPath=NUL push origin HEAD:refs/heads/main
git ls-remote origin refs/heads/main
```

不要使用 `--force`、`--mirror`、`--all`，不要把多个独立仓库的根树依次推向同一个远端分支。远端提交需与本地 `HEAD` 核对；如果推送被拒绝，先审查远端新提交，不自动重置、变基或强推。

## 4. 本轮检查与优化

### 已处理

- 更新根目录的过期版本和维护源说明，明确会话管理器的唯一维护源例外。
- 建立明确清单和默认只读的发布工具，不移动目录、不改变现有安装链接或 Git remote。
- 订阅适配器 0.2.5：将 `modelsCacheFile` 加入现有模型目录缓存 key。热切换缓存文件后，下次请求不再复用上一个文件的目录；保留 60 秒 TTL、回退顺序和同路径文件内容更新策略。

### 仍需区分的限制

- Git 0.8.0 的新拓扑、加载更多和分页已有静态审查及既有回归，仍不能据此声称完成真实 GUI 图形验收。
- 老 Desktop 快捷操作补丁锁定旧构建，不可直接用于新的 Desktop。永久删除补丁也受精确构建和哈希限制。
- 本轮未对真实会话执行迁移、归档或删除；未改变账号、主题或真实凭据。没有为本轮增加新测试用例；目录缓存路径切换的专项动态覆盖仍有限。

## 5. DSH 自动更新与后续源码路线

详见 [DSH-UPDATES.md](<DSH-UPDATES.md>)。用户已进一步授权实施，[更新禁用候选](<dsh-desktop-update-policy/README.md>) 已生成并通过隔离检查，**尚未安装**；需完全退出 Desktop 后在外部安装并重启观察。不要把候选完成当成当前进程已经关闭更新，也不要把克隆、构建或替换本体称作同步普通插件。
