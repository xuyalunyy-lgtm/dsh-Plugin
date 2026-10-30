# Desktop「重启应用…」菜单补丁

为当前 Windows DeepSeek Harness Desktop **0.2.1-rc.3** 的「应用」菜单增加真正的「重启应用…」。这是桌面壳补丁，不是主题插件；不注册网页重启 API 或 Agent 重启工具。

## 行为

- 发行版和开发版都显示「重启应用…」，移除开发版原有跳过确认的重启项。
- 每次都弹出确认，即使没有任务；默认按钮为「取消」，Escape/关闭均取消。
- 显示运行任务、定时任务/提醒警告，以及保存未提交输入和设置的提示。
- 任务检查失败、无可用 Host、正在退出、安装更新、强制更新阻塞或已有退出确认时拒绝重启。
- 反复点击合并为一次确认；确认后再次检查任务状态，新增任务类型要求重新确认。
- 确认后走原有 before-quit/finishQuit 生命周期，等待后台与桌面资源关闭，再计划 relaunch 并正常 quit；清理失败不 relaunch。
- 不绕过原退出流程，也不额外强杀进程。宿主原本的后台关闭实现自身有超时后的终止策略，补丁未改写它。
- 无法自动检测输入框草稿是否保存，只提供明确提醒。任务检查是时间点快照，无法承诺确认后绝不出现新任务。

## 当前状态

代码与候选归档已在工作区生成；**尚未替换正在运行的安装包**。需要完整退出应用后运行安装脚本。只点击窗口 X 可能会最小化到托盘，并不等于退出。

候选归档仅变更 `lib/main.js` 的引用，原归档的 packed 数据区逐字节保留，追加新入口；其他文件的头信息、链接、unpacked 标记和校验数据不变。安装保留原 `app.asar.unpacked`，不改可执行文件和用户 profile。

## 安装

1. 保存未提交输入，等待重要任务完成。
2. 通过 **应用 → 退出** 完全关闭 Harness。
3. 从外部 PowerShell 执行：

```powershell
pwsh -NoProfile -File "D:\xuyl\tool\DSH\dsh-desktop-quick-actions\Apply-Patch.ps1" -Action Apply
```

4. 正常启动 Harness，打开 **应用 → 重启应用…**。
5. 先测试取消；确认实际重启会中断任务，请自行选择合适时机。

安装脚本 0.1.1 已修复 PowerShell 空参数导致的 `File.Replace: The path is empty`，并新增真实文件安装/回滚测试。安装脚本发现本安装目录的程序仍在运行会拒绝实际替换，绝不结束进程。它会先核对原归档 SHA256，备份，校验候选内容，再用同目录临时文件原子替换。若自动更新已改变安装包，会拒绝覆盖。

## 回滚

完整退出应用，再执行：

```powershell
pwsh -NoProfile -File "D:\xuyl\tool\DSH\dsh-desktop-quick-actions\Apply-Patch.ps1" -Action Rollback
```

原归档备份位于 `D:\deepseekH\resources\app.asar.safe-restart-04b32e3a8728.bak`，首次尝试实际安装、替换前创建。即使替换失败，正确的备份也会保留。若当前已是原版，Rollback 直接报告无需回滚，不要求备份存在；若当前确为补丁版但备份缺失，则明确拒绝而不修改安装。回滚不删除备份。安装后出现启动问题时不要反复修改 EXE，直接回滚。

## 重新生成与测试

```powershell
npm ci --ignore-scripts --no-audit --no-fund
node --test test/*.test.mjs
node prepare.mjs "D:\deepseekH\resources\app.asar" ".\staging\release-0.2.1-rc.3-reviewed"
```

准备脚本要求输出不存在，且安装包版本/哈希与已审查的基线完全匹配；升级后的版本须重新审查，不能强行套用。基线入口副本 `baseline/main.js` 不提交到 Git；需要从原始 ASAR 用 `@electron/asar.extractFile` 提取用于补丁上下文测试。

本补丁非官方发行版，应用更新会覆盖它；不要假设升级后还有效。未触发真实重启的自动测试不能替代实际桌面验收。详见 REVIEW.md。
