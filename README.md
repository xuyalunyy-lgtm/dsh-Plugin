# 文档搜索 · dsh-document-search

DeepSeek Harness 文件助手插件：为当前 PDF 与 Markdown 文档提供全文关键词搜索、高亮、匹配计数和导航。

- 插件显示名称：**文档搜索** / **Document Search**
- 包名与 Loader 注册标识：`dsh-document-search`
- 当前版本：**0.2.0**
- 独立本地 Git 仓库；默认分支 `main`，未配置远程仓库。

## 使用

1. 在文件助手中打开 PDF 或 Markdown。
2. 点击文档顶部、刷新图标左侧的 **PDF** 或 **Markdown** 文字按钮。注意：不是最右侧的文件夹按钮。
3. 选择 **PDF 全文搜索** 或 **Markdown 源文搜索**。
4. 输入关键词，用 **上一项 / 下一项** 导航。支持区分大小写；PDF 可自动跳转命中页，也可手动输入页码。

搜索框中 `Enter` 下一项、`Shift+Enter` 上一项、`Esc` 清空。阅读器内部有焦点时，`Ctrl/Cmd+F` 聚焦搜索框，不劫持整个应用的快捷键。

本插件以 `builtin` 优先级追加阅读器，**不替换内置默认阅读器**。Markdown 搜索显示完整源文，包含标记语法，不是排版后预览中的高亮。PDF 搜索读取全部页面文字，按单页适宽显示命中页。

## 开发与构建

本项目的依赖版本由 [package-lock.json](package-lock.json) 锁定。使用已安装的 Node.js 和 npm，在仓库目录执行：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
node --check client.js
```

先构建再测试。构建会生成浏览器 bundle 和本地 PDF 字体/CMap 数据。PDF.js、Worker 与支持资源全部内嵌，不使用 CDN，也不另装 React 运行时。

源码入口：[Client](src/client.cjs)、[搜索算法](src/search.mjs)、[样式](src/style.css)、[构建脚本](build.mjs)。

## 安装与升级

在 Harness 中通过 `plugin_manager` 安装本项目的绝对目录：

```json
{"action":"install_bundle","target":"D:\\xuyl\\tool\\DSH\\dsh-document-search"}
```

0.2.0 是旧包 `@local/dsh-document-body-search` 的命名迁移：应先通过插件管理器移除旧包，再安装新包，避免两个阅读器重复注册。原始文档不会被修改。

重新构建不会保证已打开页面立刻加载新代码。更新时遵循插件管理器返回的 `application` 和 `warnings`；如提示先移除再安装，使用官方管理流程。完成后刷新整个 Harness 页面，并重新选择搜索阅读器。包名迁移后原有标签页可能恢复内置阅读器，这是预期行为。

## Git 管理

- `main`：日常开发分支。
- `v0.1.2`：改名前、已修复 PDF Worker 的基线快照。
- `v0.2.0`：统一命名后的版本。
- Git 跟踪源码、测试、文档、图标、包清单、依赖锁文件和第三方许可。
- [忽略规则](.gitignore) 排除依赖目录、生成的浏览器 bundle、内嵌 PDF 资源以及本地临时文件。新克隆或切换版本后应重新构建。

```powershell
git status
git log --oneline --decorate
git diff v0.1.2..v0.2.0
git switch -c feature/my-change
```

尚未设置远程地址，也没有推送到任何平台。使用 Harness Git 工作台时可选择本项目目录作为仓库。

## 验证与限制

自动测试涵盖真实两页 PDF 文字提取、页号关联、中文跨 span 匹配、UTF-16/emoji 偏移、字面量匹配、大小写选项、长 Markdown 文末搜索、编码错误处理、本地 CMap/字体、PDF 旋转/UserUnit/CSS rounding 契约，以及 **Worker 文本打包后作为 ES 模块加载**。命名迁移也有包名、模块 ID、注册标识与语言资源一致性测试。

0.1.2 修复了把模块对象当作 Worker 源码的问题，用户已确认该版本 PDF 可以正常显示。自动测试不等于完整浏览器视觉验证；复杂 PDF 的文本层对齐和主题显示仍需实看。

- 文件完整读取受 Harness Host 文件大小限制，读取失败会明确报错，不把部分内容当全文。
- 扫描 PDF 需要先 OCR；本插件不执行 OCR。加密 PDF 请使用合适的外部阅读器或解密副本。
- PDF 基于提取后的文字进行字面量搜索，不进行跨页/跨换行模糊匹配；异常字体、复杂排版和图片文字可能无法正确提取。
- 不提供注释、表单、签名交互或缩放控件；需要完整阅读体验时切回内置或外部阅读器。
- 超大文档、高频单字匹配可能耗时或卡顿；未实现结果虚拟化。

第三方许可见 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。插件图标为原创，命名迁移沿用原图标。
