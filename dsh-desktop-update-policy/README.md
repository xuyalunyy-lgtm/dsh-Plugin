# Desktop 更新策略补丁 · 0.2.2-rc.1

**状态：候选已生成、隔离检查通过，尚未安装到正在运行的 DSH。**

本目录实现用户明确要求的本机构建冻结策略：关闭普通更新检查、独立强制更新策略查询和手动下载 / 安装入口。不改账号、任务、业务网络、插件设置或会话数据。它是非官方、精确构建的 Desktop 壳补丁，**不是 Cordis 插件，不是 DSH 通用更新包**。

## 作用与开关

补丁新增 Electron shell 设置：

```json
{
  "updates": {
    "enabled": false
  }
}
```

设置路径为 Electron userData 下的 `desktop/settings.json`，与 DSH profile 分开。保留原来的 `allowTestAuthPopupWindow` 等已存字段；安装器只合并写入 `updates.enabled=false`。

- 本补丁的默认值为 **false**；没有字段、设置不可读或无效时也不会意外重新开启更新。显式 `true` 后正常重启，恢复上游原更新流程。
- 禁用时，启动、窗口聚焦、系统恢复的自动检查共同入口直接返回，普通轮询不会启动；强制更新策略配置不解析、不构造 policy / auth / mandatory UI，因而没有策略请求或周期 timer。
- 原生更新菜单显示“更新已禁用”并不可点击。renderer 更新入口仍先验证发送者；若被显式调用，仅显示禁用说明，不检查、下载或安装，也不把 idle 状态改为错误。
- 沿用原来的 `autoDownload=false`、`autoInstallOnAppQuit=false`。没有修改更新 feed、hosts、TLS、代理或全局网络，也没有清理更新缓存。
- 状态保持原有 `idle`，所以普通新版提示不会出现；不是只隐藏按钮来伪装已经停止请求。

## 精确基线

| 项目 | 固定值 |
| --- | --- |
| Desktop | `0.2.2-rc.1` |
| manifest build | `c59d10aff167ad7eefead4b3a9082fb57c8fbfe8` |
| 当前已补丁归档 SHA-256 | `12b95a06a6cd37bfe7d0505e8a23afa3e7b26d42e7d5c078b10463e96c13a008` |
| 原 `lib/main.js` SHA-256 | `f42ed25b0b844a63e515a3aff93dee89b781dae7fcbbbbfc93e04d95ad399ec1` |
| 候选 `lib/main.js` SHA-256 | `4687629ea6ce4d20081153370d3bff1997d1ee525f6f20f331a135caf06969c7` |
| 候选归档 SHA-256 | `d3a21eeeb96cc3fe7e844f5c773db0ad1abbdd9c2f1bcf6c4f2d387ffd5575a0` |

以当前归档为基线，而非恢复旧官方归档。候选仅追加替换 `lib/main.js` 的内容并更新 ASAR 元数据，原 payload 前缀逐字保留，其余条目和 `app.asar.unpacked` 不变；因此不撤销已安装的永久删除等宿主补丁。基线不符会拒绝，不自动兼容其他版本或重复应用。

## 构建与检查

需要本地已准备的 `@electron/asar` 3.4.1，当前位置为工作区 `dsh-desktop-quick-actions/node_modules/`；不随本目录发布，不在脚本内自动安装依赖。运行 Node 24：

```powershell
node --check patch.mjs
node --check prepare.mjs
node --test test/policy.test.mjs
node prepare.mjs staging
```

`prepare` 的输出目录必须不存在；不会覆盖上次候选。该步骤只读当前安装归档，生成独立主入口、候选 ASAR 和计划，不执行 Desktop。默认 `staging/` 已忽略，计划含本机路径，不上传云端。变换与测试均以安装前的精确基线为输入；安装完成后再次对已补丁入口运行它们会主动拒绝，不能据此重复应用补丁。

现有 ASAR 构建器复用 [archive.mjs](<../dsh-session-purge-core/archive.mjs>) 的原 payload / 条目 hash 核对。新增隔离回归 **23/23 通过**：用纯 ASAR 提取和 VM 中的真实函数片段，验证设置、自动 / 手动 / IPC 入口、策略装配、菜单及恢复原行为路径。未启动 Electron 或 Host、未访问更新服务、未读写真实设置。

这些检查不是部署后的实际网络观察。安装后仍需按下面步骤验收。

## 安装（由用户在外部执行）

先保存未发送输入、结束需要保留的任务，再通过应用菜单 **完全退出 DSH，包括托盘**。仅关闭窗口可能仍在后台。不要在本会话中启动等待安装任务，也不要强杀进程。

在外部 PowerShell 7 执行：

```powershell
pwsh -NoProfile -File "D:\xuyl\tool\DSH\dsh-Plugin\dsh-desktop-update-policy\Install-Patch.ps1"
```

只检查、不写入：

```powershell
pwsh -NoProfile -File "D:\xuyl\tool\DSH\dsh-Plugin\dsh-desktop-update-policy\Install-Patch.ps1" -CheckOnly
```

安装器固定核对安装路径、构建、原包与候选 hash；发现安装目录内有进程运行即拒绝，不结束进程。校验后先在同目录准备临时归档与设置，保留其他设置并写入禁用标志，再替换归档；不创建备份，不删除 unpacked 资源或用户数据。若异常中止，保留现场和临时文件，先核对当前 hash，不自动重试或宣称回滚。

安装后手动启动原 `DeepSeek Harness.exe`，确认：

1. 原生菜单显示“更新已禁用”，原有更新提示不再出现。
2. 启动、窗口切换 / 聚焦、系统恢复后无更新请求；至少观察超过原默认 10 分钟周期。观察仅针对更新 feed 和 `/api/v0/check_client_update`，不读取认证内容。
3. 插件、账号、任务和既有本机宿主补丁正常；检查安装归档 hash 为上述候选值。

如果需要恢复上游更新机制，只把 `updates.enabled` 改为 `true`，然后正常重启。**这会重新允许上游普通检查、策略查询及用户触发下载 / 安装**，应先评估官方升级是否覆盖本机补丁。应用升级或再次修改 ASAR 后，本目录必须重新核对，不直接沿用旧计划。
