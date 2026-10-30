window.__ModuleLoader__.load({
  id: '@local/dsh-codex-manager',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'codex-manager';
    const dictionaries = {
      zh: {
        title: 'Codex 管理', intro: '额度一目了然，连接与诊断各就其位。',
        overview: '连接概览', credentialNote: '本地凭证已发现不等于登录有效。',
        preferences: '额度提醒偏好', advanced: '高级设置', advancedHint: '协议版本与流空闲超时',
        fastRisk: '可能消耗更多额度或产生更高费用；保存后用于后续请求。', fastDetails: 'Fast 的适用范围',
        fastOn: '开启', fastOff: '关闭', fastSaved: '已保存的 Fast 配置', fastDraft: '当前草稿（未保存）',
        settingsHint: '先调整，再统一保存；不会修改登录凭据。',
        modelsSummary: '查看模型与输入能力', testSummary: '按需验证，测试会消耗额度', reportSummary: '本地生成，脱敏后再分享',
        saveReminder: '修改仅在保存后生效。',
        connection: '连接状态', refreshStatus: '刷新状态', loading: '正在读取连接状态…',
        adapter: '模型适配器', active: '已启用', inactive: '未启用', credential: '凭证状态',
        present: '已发现', missing: '未找到', invalid: '无效', unavailable: '暂不可读取',
        unknown: '未知', mode: '认证方式', chatgpt: 'ChatGPT 订阅', apikey: 'API Key',
        checkedAt: '检查时间', notChecked: '尚未检查', privacy: '此页面不展示令牌或凭证文件路径；不会切换账户或修改默认模型。',
        settings: '接入设置', proxy: '代理地址', proxyHint: '留空使用适配器原有的环境代理或直连行为。不要在代理地址中填写用户名或密码。',
        clientVersion: '客户端协议版本', streamIdleTimeoutMs: '流空闲超时（毫秒）',
        timeoutHint: '控制模型流多久没有新数据时中止，不是整轮生成的总时限。',
        fastMode: 'Fast：申请优先处理',
        fastHint: '默认关闭。保存后作用于此 profile 的全局 Codex 适配器后续请求，可能消耗更多额度；取决于模型和账号支持，不保证加速，不等于推理等级。不支持时不会静默重试降级。首次升级管理中心及适配器后请重启 DSH；开关仅表示配置偏好，不证明实际服务等级。',
        save: '保存设置', discard: '放弃草稿并采用最新状态', dirty: '有未保存的草稿；刷新状态不会覆盖草稿。',
        saved: '设置已保存。', saving: '正在保存…', invalidSettings: '请填写客户端协议版本，并将超时设为 5000–600000 的整数毫秒数。',
        conflict: '设置已在其他页面改变。本次保存未覆盖它，草稿已保留。先刷新状态核对，再放弃草稿并采用最新值，或重新编辑。',
        outdated: '远端设置已改变，当前草稿仍使用开始编辑时的版本，保存可能冲突。',
        models: '模型目录', refreshModels: '手动刷新目录', modelsLoading: '正在读取模型目录…',
        modelsHint: '刷新会访问模型目录，可能使用缓存回退；目录出现模型不代表已实测可用。',
        modelsEmpty: '尚未读取目录。点击“手动刷新目录”获取模型。', noModels: '目录为空，请检查连接状态后重试。',
        model: '模型', input: '输入能力', context: '上下文窗口', efforts: '推理等级',
        text: '文本', image: '图片', defaultEffort: '默认', notDeclared: '未声明',
        test: '文本连通性测试', testHint: '测试消耗当前 Codex 账号配额，只发送后端固定测试文本，不发送当前会话内容；不验证图片能力。',
        consent: '我了解测试会消耗配额', selectModel: '选择目录中的模型', runTest: '开始文本测试',
        testing: '正在测试，请勿重复提交…', testTimeout: '测试时限（秒）',
        testPassed: '测试通过', testFailed: '测试未通过', latency: '耗时（毫秒）', finishedAt: '完成时间',
        usage: '用量', inputTokens: '输入 token', outputTokens: '输出 token', cacheReadTokens: '缓存读取 token',
        reasoningTokens: '推理 token', totalTokens: '总 token', noDiagnostic: '尚未执行测试。',
        requestFailed: '请求失败，请检查连接后重试。', malformed: '服务器返回了无法识别的响应。',
        requestTimeout: '请求超时，结果未确认；请勿自动重复测试。', busy: '正在处理…',
        quotaTitle: '账号剩余额度', refreshQuota: '刷新额度', quotaLoading: '正在读取账号额度…',
        quotaHint: '每次打开本页时自动查询一次账号额度；之后可手动刷新，不轮询、不自动重试。百分比不是剩余 token 数，也不同于会话上下文余量。',
        quotaEmpty: '尚未读取额度，或旧数据已清除。点击“刷新额度”查询。', plan: '订阅计划',
        quotaApiKey: 'API Key 不支持查询订阅额度，请到 OpenAI 账单页面查看 API 用量与余额。',
        quotaUnavailable: '暂不可获取账号额度；未知数据不表示剩余 0%。', quotaNoWindows: '服务端未提供可显示的额度周期，暂不可获取剩余额度。',
        primaryWindow: '主要额度周期', secondaryWindow: '次要额度周期', remainingQuota: '剩余额度', windowDuration: '周期时长', resetAt: '额度重置日期（服务端）',
        quotaLimited: '查询时账号已达到使用限制；请等待重置并手动刷新确认，或检查账号状态。',
        quotaAllowed: '查询时服务端允许使用；实际请求仍以服务端校验为准。', quotaAllowanceUnknown: '查询时账号是否允许使用暂不可获取。',
        quotaDataUnavailable: '不可获取',
        dataExpiresAt: '数据过期时间', expiryHint: '仅为本地快照的历史判定时间，不是账号或订阅到期日。刷新只重新查询，不会重置服务端额度。', localTimeZone: '日期按浏览器本地时区显示',
        quotaUpdated: '额度更新于', lowQuotaThreshold: '低额度提醒阈值（%）', staleMinutes: '数据过期时限（分钟）',
        quotaPreferencesHint: '仅本页偏好，关闭页面后不保存；阈值 0 关闭提醒。时限 1–120 分钟，阈值 0–100%。',
        quotaStale: '此额度已过期或查询时间无法确认，仅作历史参考；请手动刷新。', quotaHistory: '历史快照',
        resetIn: '距离重置', resetDue: '已到重置时间，请刷新确认；不会自动推定恢复为 100%。',
        quotaLow: '剩余额度已低于或等于提醒阈值，请留意用量。',
        reportTitle: '脱敏诊断报告', generateReport: '手动生成报告', reportLoading: '正在生成本地诊断报告…',
        reportHint: '仅读取当前 Host 的安全状态及内存中的最近记录，不联网、不发送会话、不执行测试；重启后记录不保留。',
        reportEmpty: '尚未生成报告。', reportSnapshot: '报告是生成时的历史快照，后续操作可能改变状态。', reportGeneratedAt: '报告生成时间',
        reportPreview: '报告 JSON 预览（只读）', copyReport: '复制报告', copying: '正在复制…', reportCopied: '报告已复制。',
        reportCopyFallback: '无法使用剪贴板。请在下方报告框中手动选择文本并复制。',
        helpTitle: '使用与排错', helpFacts: '先区分状态',
        helpCredential: '凭证存在不代表登录有效：本地文件可读不等于服务端接受令牌；需要时先在 Codex CLI 或桌面端重新登录。',
        helpCatalog: '目录可见不代表模型可调用：目录可能来自缓存；只有主动连接测试才会发起真实模型请求。',
        helpQuota: '额度百分比不是剩余 token 数，也不是当前会话的上下文余量。额度查询失败不代表模型不可用，两者是不同接口。',
        helpSettings: '设置含义', helpProxy: '代理决定适配器如何访问服务。留空沿用环境代理或直连；请勿在地址中填写账号密码。',
        helpVersion: '客户端协议版本用于与 Codex 服务协商能力，不会升级本机 CLI 或模型。版本过旧可能影响目录或请求。',
        helpTimeout: '流空闲超时为 5000–600000 毫秒，表示多久没有新数据才中止，不是整轮生成的总时限。',
        helpFailures: '安全排错', helpAuth: 'AUTH：请检查 Codex 登录状态，必要时通过 Codex CLI 或桌面端重新登录；不要把令牌粘贴到此页面。',
        helpRateLimit: '429 / RATE_LIMIT：检查账号额度并等待重置或限流解除，不要连续重复测试。',
        helpNetwork: '连接失败或超时：检查代理地址、代理进程和网络。测试结果可能未确认，不要自动反复重试或切换账户。',
        helpScope: '能力与卸载边界', helpImages: '图片输入表示理解图片，不等于图片生成；本管理中心不接入音频、视频或图片生成。',
        helpUninstall: '卸载管理中心只移除管理界面与接口；原适配器设置仍保留，不删除登录凭证，也不卸载模型适配器。',
      },
      en: {
        title: 'Codex manager', intro: 'Quota at a glance. Connection and diagnostics, neatly organized.',
        overview: 'Connection overview', credentialNote: 'A local credential does not prove valid sign-in.',
        preferences: 'Quota warning preferences', advanced: 'Advanced settings', advancedHint: 'Protocol version and stream idle timeout',
        fastRisk: 'May consume more quota or cost more. Applies to subsequent requests after saving.', fastDetails: 'How Fast applies',
        fastOn: 'On', fastOff: 'Off', fastSaved: 'Saved Fast preference', fastDraft: 'Current draft (unsaved)',
        settingsHint: 'Adjust first, then save together. Sign-in credentials stay untouched.',
        modelsSummary: 'Explore models and input capabilities', testSummary: 'On-demand check; consumes quota', reportSummary: 'Generate locally, share a sanitized snapshot',
        saveReminder: 'Changes apply only after saving.',
        connection: 'Connection status', refreshStatus: 'Refresh status', loading: 'Reading connection status…',
        adapter: 'Model adapter', active: 'Active', inactive: 'Inactive', credential: 'Credential status',
        present: 'Present', missing: 'Missing', invalid: 'Invalid', unavailable: 'Unavailable',
        unknown: 'Unknown', mode: 'Authentication', chatgpt: 'ChatGPT subscription', apikey: 'API key',
        checkedAt: 'Checked at', notChecked: 'Not checked', privacy: 'This page never displays tokens or credential paths, switches accounts, or changes your default model.',
        settings: 'Connection settings', proxy: 'Proxy URL', proxyHint: 'Leave empty to retain the adapter’s environment-proxy or direct-connection behavior. Do not include a username or password in this URL.',
        clientVersion: 'Client protocol version', streamIdleTimeoutMs: 'Stream idle timeout (milliseconds)',
        timeoutHint: 'Limits how long a model stream may be idle, not the total generation duration.',
        fastMode: 'Fast: request priority processing',
        fastHint: 'Off by default. Saving applies to subsequent requests through the profile-wide Codex adapter and may consume more quota. Model/account support determines availability; speed is not guaranteed and this is not reasoning effort. Unsupported requests are not silently retried at a lower tier. Restart DSH after first upgrading both manager and adapter. This flag is a configured preference, not proof of the tier actually served.',
        save: 'Save settings', discard: 'Discard draft and adopt latest status', dirty: 'Unsaved draft. Refreshing status will not replace it.',
        saved: 'Settings saved.', saving: 'Saving…', invalidSettings: 'Enter a client protocol version and an integer timeout from 5000 to 600000 milliseconds.',
        conflict: 'Another page changed the settings. Your write was not applied and your draft is preserved. Refresh status to compare, then discard the draft and adopt the latest values, or edit again.',
        outdated: 'Remote settings changed. This draft still uses the revision captured when editing began; saving may conflict.',
        models: 'Model catalog', refreshModels: 'Refresh catalog manually', modelsLoading: 'Reading the model catalog…',
        modelsHint: 'Refresh queries the model catalog and may fall back to cached data. A catalog entry is not proof that inference works.',
        modelsEmpty: 'The catalog has not been loaded. Select “Refresh catalog manually” to fetch models.', noModels: 'The catalog is empty. Check the connection and try again.',
        model: 'Model', input: 'Input capabilities', context: 'Context window', efforts: 'Reasoning levels',
        text: 'Text', image: 'Image', defaultEffort: 'Default', notDeclared: 'Not declared',
        test: 'Text connection test', testHint: 'A test consumes your current Codex account quota. It sends only fixed backend test text, never the current conversation, and does not verify image input.',
        consent: 'I understand that testing consumes quota', selectModel: 'Select a catalog model', runTest: 'Run text test',
        testing: 'Testing; do not submit again…', testTimeout: 'Test time limit (seconds)',
        testPassed: 'Test passed', testFailed: 'Test did not pass', latency: 'Latency (milliseconds)', finishedAt: 'Finished at',
        usage: 'Usage', inputTokens: 'Input tokens', outputTokens: 'Output tokens', cacheReadTokens: 'Cache-read tokens',
        reasoningTokens: 'Reasoning tokens', totalTokens: 'Total tokens', noDiagnostic: 'No test has been run.',
        requestFailed: 'Request failed. Check the connection and try again.', malformed: 'The server returned an unrecognized response.',
        requestTimeout: 'Request timed out; the outcome is unconfirmed. Do not automatically repeat the test.', busy: 'Working…',
        quotaTitle: 'Account quota remaining', refreshQuota: 'Refresh quota', quotaLoading: 'Reading account quota…',
        quotaHint: 'Queries quota once each time this page opens. Refresh manually afterward; no polling or automatic retry. Percentages are not token counts or conversation context space.',
        quotaEmpty: 'Quota has not been loaded, or previous data was cleared. Select “Refresh quota” to query it.', plan: 'Plan',
        quotaApiKey: 'Subscription quota is not available for API-key authentication. Check API usage and balance on the OpenAI billing page.',
        quotaUnavailable: 'Account quota is currently unavailable. Unknown data does not mean 0% remaining.', quotaNoWindows: 'The server did not provide quota windows. Remaining quota is unavailable.',
        primaryWindow: 'Primary quota window', secondaryWindow: 'Secondary quota window', remainingQuota: 'Quota remaining', windowDuration: 'Window duration', resetAt: 'Quota reset date (server)',
        quotaLimited: 'The account was restricted when checked. Wait for reset and refresh to confirm, or check your account status.',
        quotaAllowed: 'The server allowed usage when checked; actual requests remain subject to server checks.', quotaAllowanceUnknown: 'Whether the account allowed usage when checked is unavailable.',
        quotaDataUnavailable: 'Unavailable',
        dataExpiresAt: 'Data expires at', expiryHint: 'Local snapshot freshness only, not account or subscription expiry. Refresh queries the server; it cannot reset quota.', localTimeZone: 'Dates use your browser’s local time zone',
        quotaUpdated: 'Quota updated', lowQuotaThreshold: 'Low-quota threshold (%)', staleMinutes: 'Data expiry (minutes)',
        quotaPreferencesHint: 'Page-only preferences; not saved after closing. Set threshold to 0 to disable warnings. Expiry: 1–120 minutes; threshold: 0–100%.',
        quotaStale: 'This quota is expired or its query time cannot be verified. It is historical only; refresh manually.', quotaHistory: 'Historical snapshot',
        resetIn: 'Time until reset', resetDue: 'The reset time has arrived. Refresh to confirm; quota is never assumed to return to 100%.',
        quotaLow: 'Remaining quota is at or below your warning threshold. Watch your usage.',
        reportTitle: 'Sanitized diagnostic report', generateReport: 'Generate report manually', reportLoading: 'Generating the local diagnostic report…',
        reportHint: 'Reads only safe Host state and recent in-memory records. No network call, conversation submission, or model test. Records do not survive restart.',
        reportEmpty: 'No report has been generated.', reportSnapshot: 'This report is a historical snapshot at generation time. Later operations may change the state.', reportGeneratedAt: 'Report generated at',
        reportPreview: 'Report JSON preview (read-only)', copyReport: 'Copy report', copying: 'Copying…', reportCopied: 'Report copied.',
        reportCopyFallback: 'Clipboard access is unavailable. Select the text in the report box and copy it manually.',
        helpTitle: 'Usage and troubleshooting', helpFacts: 'Understand the status',
        helpCredential: 'A present credential does not prove valid sign-in: a readable local file does not mean the server accepts the token. Sign in again through Codex CLI or Desktop when needed.',
        helpCatalog: 'A catalog entry does not prove inference works: the catalog may be cached. Only an explicit connection test makes a real model request.',
        helpQuota: 'Quota percentages are not remaining token counts or conversation context space. A failed quota query does not mean the model is unavailable; they use different endpoints.',
        helpSettings: 'What the settings mean', helpProxy: 'The proxy controls how the adapter reaches the service. Empty retains environment proxy or direct behavior. Never include credentials in the URL.',
        helpVersion: 'Client protocol version negotiates Codex service capabilities; it does not upgrade your local CLI or model. An old version may affect catalogs or requests.',
        helpTimeout: 'Stream idle timeout is 5000–600000 milliseconds without new data, not the total time allowed for a generation.',
        helpFailures: 'Troubleshoot safely', helpAuth: 'AUTH: check Codex sign-in and sign in again through Codex CLI or Desktop if needed. Never paste tokens into this page.',
        helpRateLimit: '429 / RATE_LIMIT: check account quota and wait for reset or rate-limit recovery. Avoid repeated tests.',
        helpNetwork: 'Connection failure or timeout: check the proxy URL, running proxy and network. The test outcome may be unknown; do not automatically retry repeatedly or switch accounts.',
        helpScope: 'Capabilities and uninstall behavior', helpImages: 'Image input means image understanding, not image generation. This manager does not add audio, video or image generation.',
        helpUninstall: 'Uninstalling the manager removes only its UI and endpoints. Original adapter settings remain; sign-in credentials and the model adapter are not deleted.',
      },
    };
    const css = `
      .cm-panel{width:100%;max-width:960px;min-width:0;margin:0 auto;padding:28px 24px 40px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6;overflow-wrap:anywhere}
      .cm-panel *{box-sizing:border-box}.cm-panel h2{font-size:26px;letter-spacing:-.035em;line-height:1.25;margin:0}.cm-panel h3{font-size:16px;line-height:1.4;margin:0}.cm-panel h4{font-size:14px;margin:0}.cm-panel p{margin:8px 0}.cm-panel .cm-muted{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.65}.cm-panel .cm-header{margin-bottom:22px}.cm-panel .cm-eyebrow{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);margin-bottom:8px}
      .cm-panel .cm-card{min-width:0;margin-top:16px;padding:22px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1)}.cm-panel .cm-heading,.cm-panel .cm-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.cm-panel .cm-heading>*,.cm-panel .cm-actions>*{min-width:0;max-width:100%}.cm-panel .cm-actions{justify-content:flex-start;margin-top:18px}.cm-panel .cm-heading button{margin-left:auto}
      .cm-panel button,.cm-panel input,.cm-panel select,.cm-panel textarea{font:inherit;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-base);padding:9px 12px;max-width:100%;min-width:0}.cm-panel button{cursor:pointer;font-size:12px;font-weight:600;background:var(--dsw-alias-bg-layer-2);white-space:normal;overflow-wrap:anywhere}.cm-panel button:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}.cm-panel button.cm-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}.cm-panel button:disabled{cursor:not-allowed;opacity:.5}.cm-panel :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:4px}.cm-panel input[aria-invalid=true]{border-color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
      .cm-panel fieldset{margin:0;padding:0;border:0;min-width:0}.cm-panel fieldset:disabled{opacity:.7}.cm-panel .cm-field{display:flex;flex-direction:column;gap:7px;margin-top:16px;font-size:13px;font-weight:500}.cm-panel .cm-field .cm-muted{font-weight:400}.cm-panel .cm-field input,.cm-panel .cm-field select{width:100%;min-width:0}.cm-panel .cm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 20px}.cm-panel .cm-kv{display:grid;grid-template-columns:minmax(100px,auto) minmax(0,1fr);gap:7px 18px;margin:14px 0 0;font-size:12px}.cm-panel .cm-kv dt{color:var(--dsw-alias-label-secondary)}.cm-panel .cm-kv dd{margin:0;overflow-wrap:anywhere}
      .cm-panel .cm-badge{display:inline-block;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:3px 8px;margin:2px 5px 2px 0;font-size:11px;line-height:1.5;max-width:100%}.cm-panel .cm-status-line{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 6px}.cm-panel .cm-status-line .cm-badge{margin:0}.cm-panel .cm-status-line b{font-weight:600}.cm-panel .cm-connection{background:var(--dsw-alias-bg-base)}
      .cm-panel .cm-table-wrap{max-width:100%;overflow-x:auto;margin-top:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px}.cm-panel .cm-table{width:100%;min-width:600px;border-collapse:collapse;text-align:left;font-size:12px}.cm-panel .cm-table th,.cm-panel .cm-table td{padding:12px;vertical-align:top;border-bottom:1px solid var(--dsw-alias-border-l1)}.cm-panel .cm-table tr:last-child td{border-bottom:0}.cm-panel .cm-table th{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base);font-weight:500}.cm-panel .cm-model-id{font-family:monospace;overflow-wrap:anywhere}.cm-panel .cm-model-name{font-size:11px;color:var(--dsw-alias-label-secondary)}
      .cm-panel .cm-notice{padding:11px 13px;margin-top:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-base);font-size:12px;overflow-wrap:anywhere}.cm-panel .cm-error{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}.cm-panel .cm-consent{display:flex;align-items:flex-start;gap:9px;margin-top:16px;font-size:13px}.cm-panel .cm-consent input{flex:0 0 auto;margin-top:5px;accent-color:var(--dsw-alias-brand-primary)}.cm-panel .cm-diagnostic{margin-top:18px;padding-top:16px;border-top:1px solid var(--dsw-alias-border-l1)}.cm-panel output{overflow-wrap:anywhere}
      .cm-panel .cm-quota-card{margin-top:0;border-top:3px solid var(--dsw-alias-brand-primary)}.cm-panel .cm-quota-window{margin-top:16px;padding:20px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base)}.cm-panel .cm-quota-value{display:block;font-size:clamp(32px,6vw,46px);font-weight:650;letter-spacing:-.045em;line-height:1.2;font-variant-numeric:tabular-nums}.cm-panel .cm-quota-progress{display:block;appearance:none;width:100%;height:9px;margin:18px 0;border:0;border-radius:8px;overflow:hidden;accent-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}.cm-panel .cm-quota-progress::-webkit-progress-bar{background:var(--dsw-alias-bg-layer-2)}.cm-panel .cm-quota-progress::-webkit-progress-value{background:var(--dsw-alias-brand-primary);border-radius:8px}.cm-panel .cm-quota-progress::-moz-progress-bar{background:var(--dsw-alias-brand-primary);border-radius:8px}.cm-panel .cm-quota-meta{display:flex;flex-wrap:wrap;gap:5px 20px;margin-top:12px;font-size:11px;color:var(--dsw-alias-label-secondary)}.cm-panel .cm-quota-meta span{min-width:0}.cm-panel .cm-quota-window .cm-kv{font-size:11px}
      .cm-panel .cm-reset-block{margin-top:14px;padding:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}.cm-panel .cm-reset-block .cm-kv{margin:0;font-size:13px}.cm-panel .cm-reset-block strong{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
      .cm-panel .cm-inset{margin-top:18px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l1)}.cm-panel summary{cursor:pointer;border-radius:6px;line-height:1.5}.cm-panel summary::marker{color:var(--dsw-alias-label-secondary)}.cm-panel .cm-inset>summary{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}.cm-panel .cm-fold>summary{font-size:15px;font-weight:600}.cm-panel .cm-summary-note{display:block;margin:4px 0 0 18px;font-size:12px;font-weight:400;color:var(--dsw-alias-label-secondary)}.cm-panel .cm-fold[open]>summary{margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .cm-panel .cm-fast{margin-top:20px;padding:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base)}.cm-panel .cm-switch-row{display:flex;justify-content:space-between;align-items:center;gap:16px;font-weight:600;cursor:pointer}.cm-panel .cm-switch-row span{min-width:0}.cm-panel input.cm-switch{appearance:none;position:relative;flex:0 0 42px;width:42px;height:24px;padding:0;margin:0;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-2);cursor:pointer}.cm-panel input.cm-switch::before{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-secondary)}.cm-panel input.cm-switch:checked{border-color:var(--dsw-alias-brand-primary)}.cm-panel input.cm-switch:checked::before{left:21px;background:var(--dsw-alias-brand-primary)}.cm-panel input.cm-switch:disabled{cursor:not-allowed}.cm-panel .cm-fast-state{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:9px}.cm-panel .cm-fast-risk{font-size:12px;margin-top:10px}.cm-panel .cm-savebar{margin-top:20px;padding-top:16px;border-top:1px solid var(--dsw-alias-border-l1)}
      .cm-panel .cm-report-preview{display:block;width:100%;min-height:220px;resize:vertical;font-family:monospace;font-size:12px;line-height:1.6;tab-size:2}.cm-panel .cm-history{font-size:11px;color:var(--dsw-alias-label-secondary)}.cm-panel .cm-help summary{font-weight:600;font-size:13px}.cm-panel .cm-help h4{font-size:13px;margin:18px 0 6px}.cm-panel .cm-help ul{margin:0;padding-left:20px;font-size:12px;color:var(--dsw-alias-label-secondary)}.cm-panel .cm-help li{margin:7px 0}.cm-panel .cm-copy-status{font-size:12px;color:var(--dsw-alias-label-secondary)}
      @media(max-width:600px){.cm-panel{padding:16px 10px 28px}.cm-panel .cm-card{padding:16px;border-radius:12px}.cm-panel .cm-grid{grid-template-columns:1fr}.cm-panel .cm-quota-window{padding:14px}.cm-panel .cm-heading{align-items:flex-start}.cm-panel .cm-kv{grid-template-columns:1fr;gap:2px}.cm-panel .cm-kv dd{margin-bottom:8px}.cm-panel .cm-fast{padding:12px}.cm-panel .cm-actions{gap:8px}.cm-panel .cm-summary-note{margin-left:0}}
      @media(forced-colors:active){.cm-panel input.cm-switch{appearance:auto}.cm-panel input.cm-switch::before{display:none}}
    `;
    // Local freshness deadline; never a subscription expiry or server reset date.
    function quotaDataExpiry(checkedAt, staleMinutes, now) {
      if (typeof checkedAt !== 'string' || !checkedAt.trim() || !Number.isFinite(now)) return null;
      const checked = Date.parse(checkedAt);
      const minutes = typeof staleMinutes === 'string' && staleMinutes.trim() ? Number(staleMinutes) : typeof staleMinutes === 'number' ? staleMinutes : NaN;
      if (!Number.isFinite(checked) || checked > now || !Number.isInteger(minutes) || minutes < 1 || minutes > 120) return null;
      const expiry = checked + minutes * 60000;
      return Number.isFinite(new Date(expiry).getTime()) ? new Date(expiry).toISOString() : null;
    }
    function settingsDraft(settings) {
      return {
        proxy: typeof settings.proxy === 'string' ? settings.proxy : '',
        clientVersion: typeof settings.clientVersion === 'string' ? settings.clientVersion : '',
        streamIdleTimeoutMs: String(settings.streamIdleTimeoutMs),
        fastMode: settings.fastMode === true,
      };
    }
    // Pure quota display rules (no I/O).
    function integerPreference(value, min, max) {
      if (String(value).trim() === '') return null;
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
    }
    function quotaSnapshotState(quota, now, staleMinutes) {
      const checked = quota?.checkedAt ? new Date(quota.checkedAt).getTime() : NaN;
      // Missing/invalid/future timestamps cannot establish freshness, including clock skew.
      const age = Number.isFinite(checked) && checked <= now ? now - checked : null;
      const expiry = integerPreference(staleMinutes, 1, 120);
      return { age, stale: age === null || expiry === null || age >= expiry * 60000 };
    }
    function quotaWindowState(item, snapshot, now, threshold) {
      const value = item?.remainingPercent;
      const remaining = typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
      const reset = item?.resetAt ? new Date(item.resetAt).getTime() : NaN;
      const resetKnown = Number.isFinite(reset);
      const resetDue = resetKnown && reset <= now;
      const historical = snapshot.stale || resetDue;
      const warning = integerPreference(threshold, 0, 100);
      return { remaining, reset, resetKnown, resetDue, historical, low: !historical && resetKnown && remaining !== null && warning !== null && warning > 0 && remaining <= warning };
    }
    // Page-open request sequence: status first, one quota attempt, no retries.
    async function refreshQuotaOnOpen(run, isOpen) {
      if (!isOpen()) return;
      const result = await run('status');
      if (!isOpen() || result?.ok !== true) return;
      const state = result.state;
      if (state?.adapter?.active !== true || state?.credential?.state !== 'present') return;
      await run('quota');
    }
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'en', dictionaries.en));
        ctx.effect(() => ctx.locale.register(NS, 'zh', dictionaries.zh));
        const t = ctx.locale.bind(NS);
        function Panel() {
          const localeSnapshot = React.useSyncExternalStore(fn => ctx.locale.subscribe(fn), () => ctx.locale.getSnapshot());
          const [state, setState] = React.useState(null);
          const [draft, setDraft] = React.useState(null);
          const [dirty, setDirty] = React.useState(false);
          const [busy, setBusy] = React.useState('');
          const [error, setError] = React.useState(null);
          const [notice, setNotice] = React.useState('');
          const [models, setModels] = React.useState(null);
          const [modelsAt, setModelsAt] = React.useState('');
          const [model, setModel] = React.useState('');
          const [consent, setConsent] = React.useState(false);
          const [diagnostic, setDiagnostic] = React.useState(null);
          const [quota, setQuota] = React.useState(null);
          const [clock, setClock] = React.useState(Date.now);
          const [lowQuotaThreshold, setLowQuotaThreshold] = React.useState('20');
          const [staleMinutes, setStaleMinutes] = React.useState('10');
          const [report, setReport] = React.useState(null);
          const [copyStatus, setCopyStatus] = React.useState('');
          const [copying, setCopying] = React.useState(false);
          const copyGeneration = React.useRef(0);
          const alive = React.useRef(false);
          const requestId = React.useRef(0);
          const pending = React.useRef(null);
          const dirtyRef = React.useRef(false);
          const draftRevision = React.useRef(null);
          const instanceId = React.useId();
          function adopt(next, saved = false) {
            if (!next || typeof next.revision !== 'string' || !next.settings || !next.adapter || !next.credential) {
              throw Object.assign(new Error('malformed'), { localKey: 'malformed' });
            }
            if (saved) dirtyRef.current = false;
            setState(next);
            if (!dirtyRef.current) {
              draftRevision.current = next.revision;
              setDraft(settingsDraft(next.settings));
              setDirty(false);
            }
          }
          async function run(action, extra) {
            if (!alive.current || pending.current) return;
            const id = ++requestId.current;
            const controller = new AbortController();
            pending.current = controller;
            setBusy(action);
            // Reports are timestamped snapshots; any new Host operation invalidates the preview.
            setReport(null);
            copyGeneration.current++;
            setCopyStatus('');
            setCopying(false);
            if (action === 'quota') setQuota(null);
            setError(null);
            setNotice('');
            const timeoutMs = action === 'test' ? (state?.limits?.testTimeoutMs || 45000) + 5000 : 30000;
            let timedOut = false;
            const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
            const current = () => alive.current && id === requestId.current;
            try {
              const response = await fetch('/codex-manager/api', {
                method: 'POST', credentials: 'same-origin', mode: 'same-origin',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                body: JSON.stringify({ action, ...extra }), signal: controller.signal,
              });
              const result = await response.json();
              if (!current() || controller.signal.aborted) return;
              if (!result || result.ok !== true || !response.ok) {
                throw Object.assign(new Error(typeof result?.error === 'string' ? result.error : ''), { code: result?.code });
              }
              if (action === 'status') adopt(result.state);
              if (action === 'saveSettings') {
                // The saved revision was captured before editing, never substituted by a background read.
                adopt(result.state, true);
                setQuota(null);
                setNotice('saved');
              }
              if (action === 'models') {
                if (!Array.isArray(result.models)) throw Object.assign(new Error('malformed'), { localKey: 'malformed' });
                setModels(result.models);
                setModelsAt(result.checkedAt || '');
                setModel(previous => result.models.some(item => item.id === previous) ? previous : (result.models[0]?.id || ''));
              }
              if (action === 'test') {
                if (!result.diagnostic || typeof result.diagnostic.ok !== 'boolean') throw Object.assign(new Error('malformed'), { localKey: 'malformed' });
                setDiagnostic(result.diagnostic);
              }
              if (action === 'quota') {
                if (!result.quota || !['available', 'unsupported', 'unavailable'].includes(result.quota.state) || !Array.isArray(result.quota.windows)) {
                  throw Object.assign(new Error('malformed'), { localKey: 'malformed' });
                }
                setClock(Date.now());
                setQuota(result.quota);
              }
              if (action === 'report') {
                if (result.report?.format !== 'dsh-codex-manager-diagnostic' || result.report.version !== 1) {
                  throw Object.assign(new Error('malformed'), { localKey: 'malformed' });
                }
                setReport(result.report);
              }
              return result;
            } catch (failure) {
              if (!current()) return;
              if (controller.signal.aborted && !timedOut) return;
              setQuota(null);
              setError({
                localKey: timedOut ? 'requestTimeout' : failure.code === 'CONFLICT' ? 'conflict' : (failure.localKey || 'requestFailed'),
                code: typeof failure.code === 'string' ? failure.code : '',
                message: !timedOut && !failure.localKey && failure.code !== 'CONFLICT' ? String(failure.message || '') : '',
              });
            } finally {
              clearTimeout(timer);
              if (current()) { pending.current = null; setBusy(''); }
            }
          }
          React.useEffect(() => {
            alive.current = true;
            let open = true;
            void refreshQuotaOnOpen(run, () => open && alive.current);
            return () => {
              open = false;
              alive.current = false;
              requestId.current++;
              copyGeneration.current++;
              pending.current?.abort();
              pending.current = null;
            };
          }, []);
          React.useEffect(() => {
            if (!quota) return undefined;
            // Page-local clock only. This timer never calls a Host action or the network.
            setClock(Date.now());
            const timer = setInterval(() => { if (alive.current) setClock(Date.now()); }, 30000);
            return () => clearInterval(timer);
          }, [quota]);
          function change(key, value) {
            dirtyRef.current = true;
            setDirty(true);
            setNotice('');
            setDraft(previous => ({ ...previous, [key]: value }));
          }
          function save(event) {
            event.preventDefault();
            if (!draft || !dirty || draftRevision.current === null) return;
            const timeout = Number(draft.streamIdleTimeoutMs);
            if (!draft.clientVersion.trim() || !Number.isInteger(timeout) || timeout < 5000 || timeout > 600000) {
              setError({ localKey: 'invalidSettings' }); return;
            }
            run('saveSettings', {
              expectedRevision: draftRevision.current,
              settings: { proxy: draft.proxy.trim(), clientVersion: draft.clientVersion.trim(), streamIdleTimeoutMs: timeout, fastMode: draft.fastMode },
            });
          }
          function discard() {
            if (!state || busy) return;
            dirtyRef.current = false;
            draftRevision.current = state.revision;
            setDraft(settingsDraft(state.settings));
            setDirty(false);
            setError(null);
            setNotice('');
          }
          const button = (key, onClick, disabled, more) => h('button', { type: 'button', onClick, disabled: Boolean(busy || disabled), ...more }, t(key));
          const date = value => {
            if (!value) return t('notChecked');
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? t('notChecked') : parsed.toLocaleString();
          };
          const number = (value, options) => new Intl.NumberFormat(localeSnapshot.active, options).format(value);
          const duration = seconds => {
            if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return t('quotaDataUnavailable');
            const [divisor, unit] = seconds >= 86400 ? [86400, 'day'] : seconds >= 3600 ? [3600, 'hour'] : seconds >= 60 ? [60, 'minute'] : [1, 'second'];
            return number(seconds / divisor, { style: 'unit', unit, unitDisplay: 'long', maximumFractionDigits: 1 });
          };
          const quotaDate = value => value && Number.isFinite(new Date(value).getTime()) ? date(value) : t('quotaDataUnavailable');
          const warningThreshold = integerPreference(lowQuotaThreshold, 0, 100);
          const snapshot = quotaSnapshotState(quota, clock, staleMinutes);
          const quotaAge = snapshot.age;
          const quotaStale = snapshot.stale;
          const relativeAge = milliseconds => {
            if (milliseconds === null) return t('quotaDataUnavailable');
            const seconds = Math.floor(milliseconds / 1000);
            const [divisor, unit] = seconds >= 86400 ? [86400, 'day'] : seconds >= 3600 ? [3600, 'hour'] : seconds >= 60 ? [60, 'minute'] : [1, 'second'];
            return new Intl.RelativeTimeFormat(localeSnapshot.active, { numeric: 'auto' }).format(-Math.floor(seconds / divisor), unit);
          };
          const reportText = report ? JSON.stringify(report, null, 2) : '';
          async function copyReport() {
            if (!reportText || copying || busy) return;
            const generation = ++copyGeneration.current;
            setCopyStatus('');
            setCopying(true);
            try {
              if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('clipboard unavailable');
              await navigator.clipboard.writeText(reportText);
              if (alive.current && generation === copyGeneration.current) setCopyStatus('reportCopied');
            } catch (failure) {
              if (alive.current && generation === copyGeneration.current) setCopyStatus('reportCopyFallback');
            } finally {
              if (alive.current && generation === copyGeneration.current) setCopying(false);
            }
          }
          const quotaWindows = quota?.state === 'available' ? quota.windows.filter(item => item && ['primary', 'secondary'].includes(item.kind)) : [];
          const quotaRestricted = quota?.limitReached === true || quota?.allowed === false;
          const row = (key, value) => h(React.Fragment, { key }, h('dt', null, t(key)), h('dd', null, value));
          const field = (key, type, hint) => h('label', { className: 'cm-field', htmlFor: `${instanceId}-${key}` },
            h('span', null, t(key)),
            h('input', {
              id: `${instanceId}-${key}`, type, value: draft[key], autoComplete: 'off', spellCheck: false,
              onChange: event => change(key, event.target.value),
              ...(type === 'number' ? { min: 5000, max: 600000, step: 1, required: true } : {}),
              ...(key === 'clientVersion' ? { required: true } : {}),
              ...(hint ? { 'aria-describedby': `${instanceId}-${key}-hint` } : {}),
            }),
            hint && h('span', { id: `${instanceId}-${key}-hint`, className: 'cm-muted' }, t(hint)));
          const credentialState = ['present', 'missing', 'invalid', 'unavailable'].includes(state?.credential?.state) ? state.credential.state : 'unknown';
          const mode = ['chatgpt', 'apikey'].includes(state?.credential?.mode) ? state.credential.mode : 'unknown';
          const usageKeys = ['inputTokens', 'outputTokens', 'totalTokens', 'cacheReadTokens', 'reasoningTokens'];
          return h('main', { className: 'cm-panel', 'aria-busy': Boolean(busy) },
            h('style', null, css),
            h('header', { className: 'cm-header' }, h('div', { className: 'cm-eyebrow' }, 'CODEX / ', t('overview')), h('h2', null, t('title')), h('p', { className: 'cm-muted' }, t('intro'))),
            h('div', { role: 'status', 'aria-live': 'polite' },
              busy && h('p', { className: 'cm-muted' }, t(({ status: 'loading', saveSettings: 'saving', models: 'modelsLoading', test: 'testing', quota: 'quotaLoading', report: 'reportLoading' })[busy] || 'busy')),
              notice && h('p', null, t(notice))),
            error && h('div', { className: 'cm-notice cm-error', role: 'alert' },
              h('strong', null, t(error.localKey)),
              error.code && h('div', { className: 'cm-model-id' }, error.code),
              error.message && h('div', null, error.message)),
            h('section', { className: 'cm-card cm-quota-card', 'aria-labelledby': `${instanceId}-quota` },
              h('div', { className: 'cm-heading' }, h('h3', { id: `${instanceId}-quota` }, t('quotaTitle')), button('refreshQuota', () => run('quota'), !state, { className: 'cm-primary' })),
              h('p', { className: 'cm-muted' }, t('quotaHint')),
              !quota ? h('p', { className: 'cm-muted' }, t('quotaEmpty')) : h(React.Fragment, null,
                h('div', { className: 'cm-quota-meta' }, h('span', null, t('plan'), ': ', typeof quota.plan === 'string' && quota.plan.trim() ? quota.plan : t('quotaDataUnavailable')), h('span', null, t('quotaUpdated'), ': ', relativeAge(quotaAge)), h('span', null, t('checkedAt'), ': ', quotaDate(quota.checkedAt)), h('span', null, t('dataExpiresAt'), ': ', quotaDate(quotaDataExpiry(quota.checkedAt, staleMinutes, clock)))),
                h('p', { className: 'cm-muted' }, t('expiryHint')),
                quotaStale && h('p', { className: 'cm-notice', role: 'status' }, t('quotaStale')),
                quotaRestricted && h('p', { className: 'cm-notice cm-error', role: 'status' }, quotaStale && h('span', { className: 'cm-badge' }, t('quotaHistory')), t('quotaLimited')),
                quota.state !== 'available' || quotaWindows.length === 0 ? h('p', { className: 'cm-notice' }, t(quota.reason === 'API_KEY' ? 'quotaApiKey' : quota.reason === 'NO_WINDOWS' || (quota.state === 'available' && quotaWindows.length === 0) ? 'quotaNoWindows' : 'quotaUnavailable')) :
                  h(React.Fragment, null,
                    !quotaRestricted && h('p', { className: 'cm-muted' }, t(quota.allowed === true ? 'quotaAllowed' : 'quotaAllowanceUnknown')),
                    quotaWindows.map((item, index) => {
                      const { remaining, reset: resetMs, resetKnown, resetDue, historical, low } = quotaWindowState(item, snapshot, clock, lowQuotaThreshold);
                      const label = t(item.kind === 'primary' ? 'primaryWindow' : 'secondaryWindow');
                      const amount = remaining === null ? t('quotaDataUnavailable') : number(remaining / 100, { style: 'percent', maximumFractionDigits: 1 });
                      return h('div', { className: 'cm-quota-window', key: `${item.kind}-${index}` },
                        h('div', { className: 'cm-heading' }, h('div', null, h('h4', null, label), h('span', { className: 'cm-muted' }, t('remainingQuota'))), h('span', { className: 'cm-quota-value' }, amount)),
                        historical && h('p', { className: 'cm-history' }, t('quotaHistory')),
                        remaining !== null && h('progress', { className: 'cm-quota-progress', value: remaining, max: 100, 'aria-label': `${label} · ${t('remainingQuota')}`, 'aria-valuetext': historical ? `${amount} · ${t('quotaHistory')}` : amount }),
                        low && h('p', { className: 'cm-notice', role: 'status' }, t('quotaLow')),
                        resetDue && h('p', { className: 'cm-notice', role: 'status' }, t('resetDue')),
                        h('div', { className: 'cm-reset-block' },
                          h('dl', { className: 'cm-kv' }, row('resetAt', h('strong', null, quotaDate(item.resetAt))), row('resetIn', resetDue ? t('resetDue') : resetKnown ? duration(Math.ceil((resetMs - clock) / 1000)) : t('quotaDataUnavailable'))),
                          h('p', { className: 'cm-muted' }, t('localTimeZone'), ': ', Intl.DateTimeFormat().resolvedOptions().timeZone || t('unknown'))),
                        h('dl', { className: 'cm-kv' }, row('windowDuration', duration(item.windowSeconds))));
                    }))),
              h('details', { className: 'cm-inset' }, h('summary', null, t('preferences')), h('div', { className: 'cm-grid' },
                h('label', { className: 'cm-field', htmlFor: `${instanceId}-quota-threshold` },
                  h('span', null, t('lowQuotaThreshold')),
                  h('input', { id: `${instanceId}-quota-threshold`, type: 'number', min: 0, max: 100, step: 1, value: lowQuotaThreshold, onChange: event => setLowQuotaThreshold(event.target.value), 'aria-invalid': warningThreshold === null, 'aria-describedby': `${instanceId}-quota-preferences` })),
                h('label', { className: 'cm-field', htmlFor: `${instanceId}-quota-stale` },
                  h('span', null, t('staleMinutes')),
                  h('input', { id: `${instanceId}-quota-stale`, type: 'number', min: 1, max: 120, step: 1, value: staleMinutes, onChange: event => setStaleMinutes(event.target.value), 'aria-invalid': integerPreference(staleMinutes, 1, 120) === null, 'aria-describedby': `${instanceId}-quota-preferences` }))),
              h('p', { id: `${instanceId}-quota-preferences`, className: 'cm-muted' }, t('quotaPreferencesHint')))),
            h('section', { className: 'cm-card cm-connection', 'aria-labelledby': `${instanceId}-connection` },
              h('div', { className: 'cm-heading' }, h('h3', { id: `${instanceId}-connection` }, t('connection')), button('refreshStatus', () => run('status'))),
              state && h('div', { className: 'cm-status-line' }, h('span', { className: 'cm-badge' }, t('adapter'), ': ', t(state.adapter.active ? 'active' : 'inactive'), ' · codex'), h('span', { className: 'cm-badge' }, t('credential'), ': ', t(credentialState)), h('span', { className: 'cm-badge' }, t(mode))),
              h('p', { className: 'cm-muted' }, t('credentialNote')),
              state && h('p', { className: 'cm-muted' }, t('checkedAt'), ': ', date(state.checkedAt)),
              h('p', { className: 'cm-muted' }, t('privacy'))),
            h('section', { className: 'cm-card', 'aria-labelledby': `${instanceId}-settings` },
              h('h3', { id: `${instanceId}-settings` }, t('settings')), h('p', { className: 'cm-muted' }, t('settingsHint')),
              draft && h('form', { onSubmit: save },
                h('fieldset', { disabled: Boolean(busy) },
                  field('proxy', 'text', 'proxyHint'),
                  h('div', { className: 'cm-fast' },
                    h('label', { className: 'cm-switch-row', htmlFor: `${instanceId}-fastMode` },
                      h('span', null, t('fastMode')),
                      h('input', { id: `${instanceId}-fastMode`, className: 'cm-switch', type: 'checkbox', role: 'switch', 'aria-checked': draft.fastMode, checked: draft.fastMode, onChange: event => change('fastMode', event.target.checked), 'aria-describedby': `${instanceId}-fastMode-hint ${instanceId}-fastMode-state` })),
                    h('div', { id: `${instanceId}-fastMode-state`, className: 'cm-fast-state', 'aria-live': 'polite' },
                      h('span', null, t('fastSaved'), ': ', t(state.settings.fastMode === true ? 'fastOn' : 'fastOff')),
                      draft.fastMode !== (state.settings.fastMode === true) && h('span', { className: 'cm-badge' }, t('fastDraft'), ': ', t(draft.fastMode ? 'fastOn' : 'fastOff'))),
                    h('p', { id: `${instanceId}-fastMode-hint`, className: 'cm-fast-risk' }, t('fastRisk')),
                    h('details', { className: 'cm-inset' }, h('summary', null, t('fastDetails')), h('p', { className: 'cm-muted' }, t('fastHint')))),
                  h('details', { className: 'cm-inset', onInvalidCapture: event => { event.currentTarget.open = true; } },
                    h('summary', null, t('advanced'), h('span', { className: 'cm-summary-note' }, t('advancedHint'))),
                    h('div', { className: 'cm-grid' }, field('clientVersion', 'text'), field('streamIdleTimeoutMs', 'number', 'timeoutHint'))),
                  dirty && h('p', { className: 'cm-muted' }, t('dirty')),
                  dirty && state.revision !== draftRevision.current && h('p', { className: 'cm-notice' }, t('outdated')),
                  h('div', { className: 'cm-actions cm-savebar' }, h('button', { type: 'submit', className: 'cm-primary', disabled: !dirty || Boolean(busy) }, t('save')), button('discard', discard, !dirty), h('span', { className: 'cm-muted' }, t('saveReminder')))))),
            h('details', { className: 'cm-card cm-fold' },
              h('summary', null, t('models'), h('span', { className: 'cm-summary-note' }, t('modelsSummary'))),
              h('div', { className: 'cm-actions' }, button('refreshModels', () => run('models'), !state)),
              h('p', { className: 'cm-muted' }, t('modelsHint')),
              modelsAt && h('p', { className: 'cm-muted' }, t('checkedAt'), ': ', date(modelsAt)),
              models === null ? h('p', { className: 'cm-muted' }, t('modelsEmpty')) : models.length === 0 ? h('p', { className: 'cm-muted' }, t('noModels')) :
                h('div', { className: 'cm-table-wrap', tabIndex: 0, role: 'region', 'aria-label': t('models') },
                  h('table', { className: 'cm-table' },
                    h('thead', null, h('tr', null, ['model', 'input', 'context', 'efforts'].map(key => h('th', { key, scope: 'col' }, t(key))))),
                    h('tbody', null, models.map(item => h('tr', { key: item.id },
                      h('td', null, h('div', { className: 'cm-model-id' }, item.id), item.name !== item.id && h('div', { className: 'cm-model-name' }, item.name)),
                      h('td', null, (item.inputModalities || []).length ? item.inputModalities.map(value => h('span', { className: 'cm-badge', key: value }, value === 'text' || value === 'image' ? t(value) : value)) : t('notDeclared')),
                      h('td', null, Number.isFinite(item.contextWindow) ? item.contextWindow.toLocaleString() : t('notDeclared')),
                      h('td', null, (item.efforts || []).length ? item.efforts.join(' / ') : t('notDeclared'), item.defaultEffort && h('div', { className: 'cm-muted' }, t('defaultEffort'), ': ', item.defaultEffort)))))))),
            h('details', { className: 'cm-card cm-fold' },
              h('summary', null, t('test'), h('span', { className: 'cm-summary-note' }, t('testSummary'))), h('p', { className: 'cm-muted' }, t('testHint')),
              h('p', { className: 'cm-muted' }, t('testTimeout'), ': ', (state?.limits?.testTimeoutMs || 45000) / 1000),
              h('label', { className: 'cm-field', htmlFor: `${instanceId}-model` }, h('span', null, t('selectModel')),
                h('select', { id: `${instanceId}-model`, value: model, disabled: Boolean(busy || !models?.length), onChange: event => { setModel(event.target.value); setDiagnostic(null); } },
                  !models?.length && h('option', { value: '' }, t('selectModel')),
                  (models || []).map(item => h('option', { value: item.id, key: item.id }, item.name === item.id ? item.id : `${item.name} · ${item.id}`)))),
              h('label', { className: 'cm-consent' }, h('input', { type: 'checkbox', checked: consent, disabled: Boolean(busy), onChange: event => setConsent(event.target.checked) }), h('span', null, t('consent'))),
              h('div', { className: 'cm-actions' }, button('runTest', () => { setDiagnostic(null); run('test', { model }); }, !consent || !model || !state?.adapter?.active)),
              diagnostic ? h('div', { className: 'cm-diagnostic', role: 'status' },
                h('strong', { className: diagnostic.ok ? '' : 'cm-error' }, t(diagnostic.ok ? 'testPassed' : 'testFailed')),
                h('dl', { className: 'cm-kv' }, row('model', diagnostic.model), row('latency', diagnostic.latencyMs), row('finishedAt', date(diagnostic.finishedAt))),
                diagnostic.code && h('p', { className: 'cm-model-id' }, diagnostic.code),
                diagnostic.message && h('p', null, diagnostic.message),
                diagnostic.usage && h('div', null, h('h4', null, t('usage')), h('dl', { className: 'cm-kv' }, usageKeys.filter(key => Number.isFinite(diagnostic.usage[key])).map(key => row(key, diagnostic.usage[key].toLocaleString()))))) : h('p', { className: 'cm-muted' }, t('noDiagnostic'))),
            h('details', { className: 'cm-card cm-fold' },
              h('summary', null, t('reportTitle'), h('span', { className: 'cm-summary-note' }, t('reportSummary'))),
              h('div', { className: 'cm-actions' }, button('generateReport', () => run('report'))),
              h('p', { className: 'cm-muted' }, t('reportHint')),
              !report ? h('p', { className: 'cm-muted' }, t('reportEmpty')) : h(React.Fragment, null,
                h('p', { className: 'cm-muted' }, t('reportSnapshot')),
                h('dl', { className: 'cm-kv' }, row('reportGeneratedAt', date(report.generatedAt))),
                h('label', { className: 'cm-field', htmlFor: `${instanceId}-report-preview` },
                  h('span', null, t('reportPreview')),
                  h('textarea', { id: `${instanceId}-report-preview`, className: 'cm-report-preview', readOnly: true, value: reportText, spellCheck: false, rows: 12 })),
                h('div', { className: 'cm-actions' }, button(copying ? 'copying' : 'copyReport', copyReport, copying)),
                copyStatus && h('p', { className: 'cm-copy-status', role: 'status', 'aria-live': 'polite' }, t(copyStatus)))),
            h('details', { className: 'cm-card cm-help' },
              h('summary', null, t('helpTitle')),
              [['helpFacts', ['helpCredential', 'helpCatalog', 'helpQuota']],
                ['helpSettings', ['helpProxy', 'helpVersion', 'helpTimeout']],
                ['helpFailures', ['helpAuth', 'helpRateLimit', 'helpNetwork']],
                ['helpScope', ['helpImages', 'helpUninstall']]].map(([heading, items]) => h(React.Fragment, { key: heading },
                h('h4', null, t(heading)), h('ul', null, items.map(key => h('li', { key }, t(key))))))));
        }
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: NS, order: 12, label: () => t('title'),
        }, Panel));
      },
    };
  },
});
