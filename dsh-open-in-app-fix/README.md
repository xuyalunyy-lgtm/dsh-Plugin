# VS Code 打开修复（Windows）

适用于已审查的 DSH Desktop **0.2.1-rc.3、0.2.1-rc.5、0.2.2-rc.1**。复用官方应用目录、路由及鉴权，只在启动 `Code.exe` / `Code - Insiders.exe` 时过滤继承的 `ELECTRON_RUN_AS_NODE`；应用适配器显式指定的环境变量仍优先。不修改全局环境，也不修改安装包。

## 0.2.2-rc.1 适配记录

- 该版更新了包清单中的 DSH、Cordis、Loader 与 Schemastery 依赖版本；旧白名单拒绝新清单后会回退官方实现，导致原有 VS Code 启动问题再次出现。
- 复核新版包清单，并确认五个固定实现文件的 SHA-256 均与既有审查基线一致；仅新增该版清单的精确哈希，不放宽实现文件校验，不修改启动路径或鉴权。
- 继续使用当前运行时的凭据过滤环境，仅为 VS Code 子进程移除继承的 `ELECTRON_RUN_AS_NODE`；当前运行时新增的代理环境处理仍保留。
- 更新后运行既有离线测试及真实启动验收；实际 GUI 是否已加载新版须另行确认，未加载时正常重启 DSH，不能只凭源码更新认定已生效。

## rc.5 适配记录

- rc.5 的 `dsh-host-open-in-app` 包清单版本及依赖元数据发生变化。
- 已核对的五个实现文件（入口、路由、internals、resolver、catalog）与原 rc.3 基线逐字节一致。
- 仅增加 rc.5 包清单的精确 SHA-256 白名单；实现文件仍全部固定哈希。未知清单、实现变化、文件不可读或私有接口不可用时继续回退官方实现，不强行打补丁。
- 新增回归断言：清单及任意一个固定实现文件变化，或读取失败，必须拒绝启用修复。

## 部署及验证

当前 desktop profile 在 `cordis.patch.yml` 中停用官方 `open-in-app` 条目，并通过 `insert` 添加独立的 `open-in-app-local-fix` 条目，引用本目录的 `index.mjs`，保留官方的探测、图标和启动超时配置；没有独立构建或复制步骤。注意：patch 中的 `name` 是原模块名称的匹配断言，不是替换字段；给原条目直接写入修复模块路径会触发名称不匹配而跳过整条 patch。修复器从 Host 的 `argv[2]` 获取当前运行时根，不依赖旧安装目录。

```yaml
- id: open-in-app
  name: '@deepseek-ai/dsh-host-open-in-app'
  disabled: true
- insert:
    - id: open-in-app-local-fix
      name: file:///D:/xuyl/tool/DSH/dsh-open-in-app-fix/index.mjs
      config:
        probeTimeoutMs: 10000
        iconTimeoutMs: 10000
        launchWatchMs: 1000
```

VS Code 使用注册表或安装目录根下的 `Code.exe`；当前用户安装为 `C:\Users\Administrator\AppData\Local\Programs\Microsoft VS Code\Code.exe`。不要改指向随更新变化的版本子目录或 `resources/app`。

配置或源码更新不等于当前 Host 已重新加载。正常重启 DSH 并刷新原 GUI 后，再从原界面的“在 VS Code 中打开”入口验收。不要启动替代 Web 服务。

离线测试（不会启动 VS Code、绑定端口或修改 profile）：

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
& 'D:\xuyl\tool\dsh_app\DeepSeek Harness.exe' 'D:\xuyl\tool\DSH\dsh-open-in-app-fix\test.mjs' 'D:\xuyl\tool\dsh_app\resources\app.asar\dsh'
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

`acceptance.mjs` 会调用真实目录探测及启动器，尝试在 VS Code 打开本工作区；它仍是内存路由验收，不等同于当前 GUI 的鉴权请求或视觉验收。
