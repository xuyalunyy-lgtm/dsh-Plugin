# VS Code 打开修复（Windows）

适用于已审查的 DSH Desktop **0.2.1-rc.3、0.2.1-rc.5**。复用官方应用目录、路由及鉴权，只在启动 `Code.exe` / `Code - Insiders.exe` 时过滤继承的 `ELECTRON_RUN_AS_NODE`；应用适配器显式指定的环境变量仍优先。不修改全局环境，也不修改安装包。

## rc.5 适配记录

- rc.5 的 `dsh-host-open-in-app` 包清单版本及依赖元数据发生变化。
- 已核对的五个实现文件（入口、路由、internals、resolver、catalog）与原 rc.3 基线逐字节一致。
- 仅增加 rc.5 包清单的精确 SHA-256 白名单；实现文件仍全部固定哈希。未知清单、实现变化、文件不可读或私有接口不可用时继续回退官方实现，不强行打补丁。
- 新增回归断言：清单及任意一个固定实现文件变化，或读取失败，必须拒绝启用修复。

## 部署及验证

当前 desktop profile 直接引用本目录的 `index.mjs`，没有独立构建或复制步骤；但源码更新不等于当前 Host 已重新加载。正常重启 DSH 并刷新原 GUI 后，再从原界面的“在 VS Code 中打开”入口验收。不要启动替代 Web 服务。

离线测试（不会启动 VS Code、绑定端口或修改 profile）：

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
& 'D:\deepseekH\DeepSeek Harness.exe' 'D:\xuyl\tool\DSH\dsh-open-in-app-fix\test.mjs' 'D:\deepseekH\resources\app.asar\dsh'
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

`acceptance.mjs` 会调用真实目录探测及启动器，尝试在 VS Code 打开本工作区；它仍是内存路由验收，不等同于当前 GUI 的鉴权请求或视觉验收。
