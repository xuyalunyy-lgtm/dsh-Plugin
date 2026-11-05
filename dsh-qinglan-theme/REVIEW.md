# 分阶段审查记录

## 布局与主要组件主题协调：1.6.0（2026-11-05）

- 本轮优化设置页卡片层级、导航、主题色卡及背景预览/参数布局。宽窄切换使用面板container查询，双列为minmax(0,...)，自然DOM/Tab顺序不重排；外/内字段集禁用、上传与保存队列、确认Escape/回焦接线保持。
- 原生md/lg/xl/panel圆角沿当前rc1真实变量收紧；当前聊天列宽有用户拖拽优先与embedded局部定义，未抢写全局width，未增加会被子元素遮蔽的阴影覆盖。
- 固定白图标info按钮采用主题对应深brand，dark映射到同色浅组；悬停朝black加深。面板主按钮使用原配对primary/foreground。
- 独立审查发现新danger文字跟随宿主error色会在浅palette拆对，已改为label-primary文字+语义边框；selected tab hover被通用hover盖过，已用更具体规则保留选中层。
- 最终复审无阻塞，主控和独立既有158项均通过；最后两处样式修正读回确认，未因同一结果重复执行测试。未新增测试/模拟DOM。
- 安装1.6.0 application=applied、warnings=[]；实时Theme新增radius变量，settings.section中local-qinglan active，确认更新运行层和页面注册。
- 不改变Host外观数据、方案或图片，无生成类选择器和宿主根替换。CSS清理包含删除宽泛preview span定位与重复声明。
- 仍无真实浏览器布局截图、窄栏滚动/Tab实测或新info配色的专项自动对比度检查；安装与token注册不是视觉验收。


## 选区引用悬浮按钮：1.5.6（2026-11-05）

- 当前宿主已为0.2.2-rc.1；精确message-quotes源码确认「引用文本」是QuoteSelection按钮，普通背景button-floating-fill、前景label-primary，悬停与focus-visible背景button-floating-hover。
- 此前仅覆盖floating-hover，遗漏普通背景。本轮只补floating-fill=raised表面；同变量的聊天回到底部按钮也使用label-primary，配对一致。
- 不替换text-interaction Slot，不改选区、引用插入或按钮事件，不动用户主题、图片、方案和Host数据。
- 独立复审无阻塞；同一surfaces循环提供完整light/dark对，沿用同NS原子替换与关闭/卸载释放，无额外资源。
- 既有158项检查、语法和diff检查通过；没有新增测试。既有对比度检查覆盖复用的前景与普通/悬停纯色表面，不执行按钮挂接、焦点或选区交互。
- 安装1.5.6 application=applied、warnings=[]；实时Theme清单出现button-floating-fill，确认新增覆盖逻辑已运行。
- 尚无刷新后引用按钮的浏览器计算样式或视觉验收，不将新增变量注册等同于最终画面通过。


## 表单与原生控件：1.5.5（2026-11-04）

- 用户子智能体设置截图：数值输入使用 fields 的第三层背景，保存文字也使用第三层作反色前景；此前仅覆盖前两层，导致白底浅字和保存文字拆对。
- 已核对精确rc5 SettingsForm、fields、Input、Tag、SegmentedTabs、Checkbox、Switch及子智能体真实调用；补齐bg-layer-3=raised、bg-layer-4=selected、label-dimmed=secondary。
- 模型候选使用裸checkbox，由浏览器绘制。当前layout文档确认html由presenter写入color-scheme；插件只在body显式设置所选palette的scheme及brand accent，覆盖继承而不抢写html或宿主偏好。
- 样式沿用Background现有启用与卸载路径，不依赖背景图或渐变开关；关闭后恢复宿主继承，不使用!important或全局文字色。
- 独立复审无阻塞，既有158项检查通过；语法和diff检查通过。没有新增测试，既有检查未执行body层叠、原生checkbox绘制或保存交互。
- 保存按钮原有禁用条件、opacity .4、校验和写入逻辑未改；禁用状态灰淡不等于需要强制启用。
- 安装结果1.5.5 application=applied、warnings=[]；实时Theme出现bg-layer-3/-4和label-dimmed，确认新增token覆盖已运行。部署时没有浏览器计算样式或自动截图验收证据。
- 收尾复核：代码提交43bb0bd的配色映射、body样式继承、启用/关闭/卸载路径及变更范围未发现阻塞问题；本轮没有功能变更，复用同一代码此前独立审查及158项通过结果，不重复运行测试。
- 2026-11-04用户反馈“效果没有问题”，记录为当前实际查看界面的人工视觉确认；不据此推断所有配色、交互状态或平台已验收。
- 未修改用户已保存的主题、图片或方案；html自身画布/视口滚动条和显式自有scheme的后代不在body规则保证范围内。


## 侧栏与共享控件：1.5.4（2026-11-03）

- 用户截图中「新会话」使用独立button-elevated-fill浅底，而文字已切浅；侧栏品牌版本徽标另用primary底+primary-inverted字。
- 读取同版本sidebar/workspace及Button/Pill/Switch/StateDot真实CSS与调用，按实际前景/背景配对覆盖，不增加全局文字规则。
- 补齐新会话常态/悬停、共享主按钮fill/hover/foreground、toolbar、ghost/Pill激活态、徽标反色；primary hover按远离前景的方向混色。
- 独立复审识别共享foreground也用于Switch与完成步骤check，已连带配对关闭态thumb与success绿，避免修按钮后引入状态图标低对比；未无依据更改error/warn。
- 最终复审无阻塞，既有158项测试与diff检查通过。本轮未新增测试，既有测试不直接执行新增按钮token或CSS color-mix。
- 安装结果1.5.4 application=applied、warnings=[]；实时Theme已出现elevated/primary/toolbar/foreground/inverted/switch等新覆盖变量，确认当前页面执行了新层。
- 不修改用户已保存的图片、方案或主题状态。仍无浏览器计算样式/截图验收，不能宣称所有原生组件跨平台已视觉通过。
- 平台范围：当前Windows/Web变量路径；macOS侧栏另有硬编码半透明白色背景分支，本补丁没有覆盖该分支。


## 背景去水印化：1.5.3（2026-11-02）

- 用户截图中的四点方块来自 BackgroundLayers 内固定90px平铺装饰层，已删除该层，不只是降低显现度。
- 保留无图片时的整幅柔和渐变并明确 no-repeat/100%；图片分支仍使用原 imagePlacement，主动选择的图片平铺不受影响。
- 保留 pattern 偏好字段、所有方案及Host存储结构；其当前用途是无图默认渐变开关。有图片时不叠加装饰，UI开关禁用但不改其值。
- Team 只读审查无功能阻塞；已同步当前README预览文案，历史版本说明保留原行为描述。
- 既有158项回归、语法与diff检查通过；未新增测试。测试不是四点图层删除的DOM/截图断言，确认来源为源码审查。
- 安装1.5.3 application=applied、warnings=[]；安装包版本读回1.5.3，实时shell.overlay仍有active背景注册。
- 视觉边界：没有浏览器控制，最终页面观感和旧模块是否经刷新替换仍需人工确认；无需重置用户外观或修改已保存方案。


## 聊天气泡 / 输入框：1.5.2（2026-11-02）

- 新截图显示用户气泡与输入框仍浅底浅字，前一 Markdown 修复只解决代码区域，不代表全部聊天控件已适配。
- 核对 rc.5 精确原生 CSS：用户 bubble 使用 specific-bubble + label-primary；Composer card/input 分别使用 specific-input-major + label-primary；placeholder 为 label-caption；add 使用 selector/hover-solid；send 使用 info-fill/hover + 固定白字。
- 仅补齐上述已确认使用的八个配色变量，并通过原有 theme.overrideTokens 双模式成对覆盖及 disposer 清理，不改宿主生成类或 DOM。
- Team 只读复审逐项匹配上述合同，无阻塞项；既有回归 158/158 通过。未新增测试用例，既有数值回归不是真实聊天控件渲染检查。
- 安装 1.5.2：application=applied、warnings=[]；实时 Client Theme 清单中新增 bubble/input-major/selector/caption/button 等变量，安装包版本已读回为1.5.2。
- 未更改当前主题、图片、方案或持久化数据。没有浏览器控制，刷新后的气泡/输入框实际视觉仍需用户确认。


## Markdown 深色兼容：1.5.1（2026-11-02）

- 用户截图指出深色主题的行内代码浅底浅字。对照同版本原生 MarkdownText 样式，code 没有独立 color，会继承 label-primary；独立 markdown-inline-code 背景先前未被插件覆盖。
- 新增纯 markdownTokens 生成器，行内/代码块/标题栏/分段/标签背景与主要文字配对；链接、行号和 9 类 Shiki 语法 token 按所选主题深浅提供完整 light/dark 覆盖，而非沿用宿主原生模式。
- Team 独立只读审查：无阻塞项。核对实际控件 CSS 与 ThemeRuntime 同 source 替换/释放合同，未发现颜色层残留或强制全局代码同色问题。
- 新增 61 项数值/挂接检查，全量 158 项通过；语法与 diff --check 通过。
- 安装最终 application=applied、version=1.5.1、warnings=[]。实时 Client Theme.listTokens 已出现新增 Markdown/Shiki 变量，证明当前页面执行了新覆盖逻辑，不仅是磁盘版本变更。
- 没有修改用户已保存的配色、图片、方案或 Host 文档；本轮不存在存储结构升级。
- 验证边界：对比度针对纯色表面；独立审查和实时 token 注册不等于计算样式/截图验收。当前无浏览器控制，实际截图效果需刷新页面后确认。


## 位置调整与最终验证：1.5.0

- 独立审查结论：无阻塞项；97/97 测试通过，2026-10-26 恢复工作后再次全量通过。
- 重点核对：旧 current / preset 缺少 positionX/Y 时按 50 补齐，不在读取时写盘；显式 0/100 保留；Host 严格验证整数范围；方案保存/应用保留位置；参数重置回到中心。
- 实际图片在可见边界内定位，不再被 overscan 裁掉边缘；预览和全局共用 imagePlacement。
- 首次安装发现上游命名约束漏测：带连字符的存储域被拒绝。读取实际 bundled UNIT_NAME_RE 确认只允许小写字母、数字、下划线，修正为 local_qinglan_theme，并在 Host 集成测试补齐名称约束。
- 命名修复经另一次独立审查通过。上游在打开后端前校验名称，因此失败的旧名称没有产生需迁移的域数据。
- 最终安装 application=applied、version=1.5.0、warnings=[]；实时 settings.section 中 local-qinglan active=true。
- 实际 qinglan_theme read 成功；故意用不匹配 expectedRevision 的写入被拒绝，前后读均 revision=0、initialized=false，无测试数据写入，保留首次迁移机会。
- 已检查安装包中英文说明及原创 SVG 图标资源；不等于视觉渲染验收。
- 仍未验证：真实页面刷新后的全部视觉状态、文件选择和多窗口交互、真实进程重启后的完整读写周期。详见 VERIFICATION.md。


## 命名方案：1.4.0

- 独立审查结论：无阻塞项，90/90 测试通过。
- 重点核对：方案与当前外观共同拥有图片引用；先持久化后清理；失败不污染内存；重置保留方案；名称/ID/数量边界；旧 v1 文档兼容。
- UI 与工具都使用同一串行操作及版本检查；删除有二次确认，应用方案会使旧图片解码操作失效。
- 已按审查建议澄清重置文案：清除的是当前背景，已保存方案仍可重新应用。
- 限制：未做真实浏览器视觉与焦点交互验收。


## 持久存储：1.3.0

- 独立审查发现并修正：focus/visibility 双重刷新可排队读回旧状态，覆盖已接受草稿。现在并发 load 复用同一个 Promise。
- 复验：无剩余阻塞项，75/75 检查通过。
- 核心仓库覆盖版本冲突、重启读取、迁移保护、图片先写/文档后提交、失败恢复、清理与输入边界；异步 Client 测试覆盖乱序回复、重复刷新和冲突后恢复。
- Host 集成测试加载实际入口与 Zod，使用真实 Request/Response 和注入的 Domain/Connection 替身验证路由及工具共用状态。
- 限制：Connection 身份认证由已发现的上游 API 契约负责，测试不是实际认证绕过测试；未做真实浏览器交互。关闭入口与仓库 drain 分别测试，并非真实进程关停实验。


## 检查点：1.2.0

- 范围：12 套配色、分区预览、延迟保存、安全重置及相关测试。
- 独立审查发现并已修正：跨标签页 storage 事件的历史快照回退；外部重置后旧图片解码结果再次保存。
- 修复：读取当前存储值，并通过外部更新代次使旧图片操作失效。
- 审查复验结论：本范围未发现剩余阻塞项，可以提交检查点。
- 测试：配色 28 项；设置 11 项（含新增接线断言）。
- 限制：未进行浏览器交互或真实多标签页实测；源码断言不是端到端测试。localStorage 仍为 last-writer-wins，后续由带版本校验的 Host 持久存储替代。
