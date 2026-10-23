# Git 可视化插件维护

此目录是 dsh-git-visualizer 的独立开发目录。后续修改应在本目录进行，不再维护父目录的旧源码副本。

- Git 读取与写入均须经过 repository-discovery.mjs 校验仓库选择。用户已要求集成常见 Git 操作；写操作必须白名单化、在 UI 明确确认并在服务端校验，不支持任意命令、强推、硬重置或丢弃改动。
- 保留会话根目录下 0–5 级扫描、资源预算和符号链接防护。
- 客户端使用 DSH ModuleLoader；不另起 Web 服务。
- 测试：`node --test --test-isolation=none test/*.test.mjs`，需要 Git 在 PATH 中。
- file: 安装是独立副本，修改源码不等于更新当前 GUI；部署后验证安装文件并提示用户重启。
- 当前桌面 profile 已于 2026-10-22 修正为 file:D:/xuyl/tool/DSH/dsh-git-visualizer（含两份 pnpm lock）；安装副本已同步到 0.5.0。后续升级仍应核验版本与文件哈希，不要假设源码会自动同步。
- 提交及所有写操作禁用本地 hooks，提交禁 GPG 签名；仅快进 Pull、非强制显式 upstream Push。网络非交互，保留已配置凭据助手。修改这些边界需用户明确授权。
- 用户已授权增加本地分支创建/删除功能；创建固定已确认 HEAD，删除须额外确认、禁当前分支/其他 worktree 占用/未合并到当前 HEAD 的分支，并保留 Git 原生 -d 检查；禁止强制删除及删除远程分支。
- 真实写入测试只能用临时仓库和本地 bare 远程，不能对用户工程自动执行写操作。
