# 修复关闭搜索时无法删除

适用于已安装上一版永久删除补丁的Desktop0.2.2-rc.1。当前原包SHA256须为849d46194ad0d0e82fff7296d5f5529d28e8af6cb2e0f2fc8cf596c8a01bf16c。

本次只更新SQLite查询模块，不开启全文搜索。删除维护有旧索引时清理记录，无索引时不创建数据库。侧栏垃圾桶图标通过插件重新加载已应用，刷新页面即可。

验证：4项真实派生存储测试；2项已加载空闲会话端到端测试（搜索开启及never），never仍拒绝搜索，删除成功。尚未安装到当前运行实例。

完全退出DSH（包括托盘）后在外部PowerShell7执行：

```powershell
pwsh -NoProfile -File "D:\xuyl\tool\DSH\dsh-Plugin\dsh-session-purge-core\Install-Patch.ps1" -Plan "D:\xuyl\tool\DSH\dsh-Plugin\dsh-session-purge-core\staging\candidate-never-fix\plan.json"
```

重启后再尝试新建验证会话的永久删除。候选SHA256：12b95a06a6cd37bfe7d0505e8a23afa3e7b26d42e7d5c078b10463e96c13a008。
