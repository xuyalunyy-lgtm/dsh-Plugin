# 文档正文查找（workspace bundle）

包：`@local/dsh-document-body-search` 0.1.1。

## 使用

在 Harness 文件助手打开当前 PDF 或 Markdown，在文档顶部阅读器下拉中选择 **PDF 全文搜索** 或 **Markdown 源文搜索**。本插件以 `builtin` 优先级追加注册，**不替换原有默认阅读器**；可随时切回内置预览。

- 当前文档完整字节读取，受 Harness Host 文件大小限制；读取失败明确报错，不把前缀当全文。
- 字面量查找，大小写选项、全部匹配计数、上下项循环导航、高亮当前项。
- Enter 下一项、Shift+Enter 上一项、Esc 清空；阅读器内获得焦点时 Ctrl/Cmd+F 聚焦查找框。不劫持全应用快捷键。
- PDF 对全部页建立文字索引；命中切换并渲染对应页，页码框亦可直接定位。一个页面按容器宽度渲染，PDF.js TextLayer 内高亮可跨同页文本 span。
- Markdown 显示完整源文，包含 Markdown 标记；不是内置 Markdown 排版上的高亮。

## 安装与构建

已通过 Harness `plugin_manager install_bundle` 安装此目录；输出为 `application: applied`、`warnings: []`。

在本目录：

```powershell
npm.cmd install --ignore-scripts --no-audit --no-fund
npm.cmd run build
npm.cmd test
node --check client.js
```

构建把 PDF.js、Worker、CMap、标准字体全部嵌入本地 client.js，不使用远端 CDN。构建依赖仅 devDependencies，运行不安装 React 副本。插件在 ModuleLoader factory 内使用 Harness 提供的 React，并仅向公开 documentPreviews 和 sidebar.right.tab.document 注册新阅读器。没有修改 app.asar，没有访问或注入内置组件 DOM。

修改已安装的 JS 后需按 Harness 插件更新流程重新应用并重启/刷新确认模块代际；不要把文件已变或相同 slot id 当作页面代码已更新的证据。

## 测试与已知限制

- 9 项 Node 测试全部通过：真实两页 PDF 提取/页号/不转移源 buffer、中文跨 span、emoji UTF-16 偏移、字面正则符号、大小写折叠、完整大 Markdown 尾部、UTF-8/UTF-16/BOM/无效编码、旋转/UserUnit/CSS rounding 静态契约和本地中文 CMap/字体资源。
- 0.1.1 已经正式 remove_bundle 后重新 install_bundle，返回 `application: applied`、`warnings: []`。Host 安装状态已更新；没有浏览器刷新控制，建议刷新当前 Harness 页面以确保使用最新 Client 模块。
- 构建成功，Host 和 Client JS 语法检查通过。中英 metadata 和原创 SVG 图标检查通过。
- 没有可用浏览器控制，未验证实际点击、canvas/文本层视觉对齐、浅深色显示、图标在管理器里的渲染或浏览器控制台。实时注册验证由主会话进行并在最终报告说明。
- 扫描 PDF 需要 OCR；本插件不进行 OCR。加密 PDF 提示使用内置阅读器或解密副本。
- PDF 搜索基于 PDF.js 的提取顺序和文本，不跨页或换行模糊匹配；异常字体编码、复杂排版和图片文字可能不能正确提取。使用 PDF.js 的 JS 图像解码，特殊图像格式可能无法显示；可切回内置阅读器。
- 未实现注释/表单/签名交互、缩放控件、全文结果虚拟列表或 OCR；完整原阅读体验由保留的内置阅读器提供。
- 完整建立索引后才展示结果；超大文档/高频单字查询可能耗时或卡顿，当前无静默截断、匹配上限或部分全文误报。

第三方许可见 THIRD-PARTY-NOTICES.txt；图标为本项目原创。
