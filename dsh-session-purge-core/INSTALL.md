# 永久删除宿主补丁：安装待验收

仅适用于 Desktop 0.2.2-rc.1 / c59d10aff167ad7eefead4b3a9082fb57c8fbfe8。当前独立候选已生成，**尚未替换正在运行的应用**。

## 验证

真实发行模块和隔离数据测试共54项通过，含空闲已加载Agent正常释放、运行/队列/维护拒绝、原生日志锁、日志世代删除、SQLite/缓存清理、失败重试及启动自动恢复。插件侧47项通过。不等于当前GUI已完成验收。

## 安装

1. 保存未提交输入，等其他任务结束，通过应用菜单**完全退出** DSH（仅关窗口可能留在托盘）。
2. 在外部 PowerShell 7 执行：

```powershell
pwsh -NoProfile -File "D:\xuyl\tool\DSH\dsh-Plugin\dsh-session-purge-core\Install-Patch.ps1" -Plan "D:\xuyl\tool\DSH\dsh-Plugin\dsh-session-purge-core\staging\candidate-final\plan.json"
```

3. 重新启动原DSH应用，回到此会话，告知“已安装重启”，再用新建验证会话做真实GUI验收。不要先删重要会话。

脚本校验原包、候选SHA256及安装目录，检测到运行中的应用则拒绝，不终止进程。保留原unpacked资源，不改用户数据，不创建备份。补丁非官方发行，应用升级会覆盖或使其不兼容；升级后必须重新核对。

## 范围

已归档、无活动任务可删除；空闲的工厂持有Agent会正常释放。不强停运行、维护、排队、关联活动。其他会话直接继承目标时拒绝，不级联删除。删除目标原始日志、搜索和投影缓存，不删除项目、共享附件或其他会话的历史副本。仅支持本版本单宿主共享存储方式，不支持旧版宿主同时访问相同存储。

候选SHA256: `849d46194ad0d0e82fff7296d5f5529d28e8af6cb2e0f2fc8cf596c8a01bf16c`
