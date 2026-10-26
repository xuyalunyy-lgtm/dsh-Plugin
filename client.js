window.__ModuleLoader__.load({
  id: '@local/dsh-codex-manager',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'codex-manager';
    const dictionaries = {
      zh: {
        title: 'Codex 管理', intro: '检查连接、编辑接入设置，以及手动验证模型。',
        connection: '连接状态', refreshStatus: '刷新状态', loading: '正在读取连接状态…',
        adapter: '模型适配器', active: '已启用', inactive: '未启用', credential: '凭证状态',
        present: '已发现', missing: '未找到', invalid: '无效', unavailable: '暂不可读取',
        unknown: '未知', mode: '认证方式', chatgpt: 'ChatGPT 订阅', apikey: 'API Key',
        checkedAt: '检查时间', notChecked: '尚未检查', privacy: '此页面不展示令牌或凭证文件路径；不会切换账户或修改默认模型。',
        settings: '接入设置', proxy: '代理地址', proxyHint: '留空使用适配器原有的环境代理或直连行为。不要在代理地址中填写用户名或密码。',
        clientVersion: '客户端协议版本', streamIdleTimeoutMs: '流空闲超时（毫秒）',
        timeoutHint: '控制模型流多久没有新数据时中止，不是整轮生成的总时限。',
        save: '保存设置', discard: '放弃草稿并采用最新状态', dirty: '有未保存的草稿；刷新状态不会覆盖草稿。',
        saved: '设置已保存。', saving: '正在保存…', invalidSettings: '请填写客户端协议版本，并将超时设为 1–2147483647 的整数毫秒数。',
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
        quotaTitle: '账号剩余额度', refreshQuota: '手动刷新额度', quotaLoading: '正在读取账号额度…',
        quotaHint: '仅点击按钮时查询账号订阅额度；百分比不换算成 token，和当前会话上下文余量不同。',
        quotaEmpty: '尚未读取额度，或旧数据已清除。点击“手动刷新额度”查询。', plan: '订阅计划',
        quotaApiKey: 'API Key 不支持查询订阅额度，请到 OpenAI 账单页面查看 API 用量与余额。',
        quotaUnavailable: '暂不可获取账号额度；未知数据不表示剩余 0%。', quotaNoWindows: '服务端未提供可显示的额度周期，暂不可获取剩余额度。',
        primaryWindow: '主要额度周期', secondaryWindow: '次要额度周期', remainingQuota: '剩余额度', windowDuration: '周期时长', resetAt: '重置时间',
        quotaLimited: '账号当前已达到使用限制，请等待额度重置或检查账号状态。',
        quotaAllowed: '服务端当前允许使用；实际请求仍以服务端校验为准。', quotaAllowanceUnknown: '账号是否允许使用暂不可获取。',
        quotaDataUnavailable: '不可获取',
      },
      en: {
        title: 'Codex manager', intro: 'Inspect the connection, edit adapter settings, and test models manually.',
        connection: 'Connection status', refreshStatus: 'Refresh status', loading: 'Reading connection status…',
        adapter: 'Model adapter', active: 'Active', inactive: 'Inactive', credential: 'Credential status',
        present: 'Present', missing: 'Missing', invalid: 'Invalid', unavailable: 'Unavailable',
        unknown: 'Unknown', mode: 'Authentication', chatgpt: 'ChatGPT subscription', apikey: 'API key',
        checkedAt: 'Checked at', notChecked: 'Not checked', privacy: 'This page never displays tokens or credential paths, switches accounts, or changes your default model.',
        settings: 'Connection settings', proxy: 'Proxy URL', proxyHint: 'Leave empty to retain the adapter’s environment-proxy or direct-connection behavior. Do not include a username or password in this URL.',
        clientVersion: 'Client protocol version', streamIdleTimeoutMs: 'Stream idle timeout (milliseconds)',
        timeoutHint: 'Limits how long a model stream may be idle, not the total generation duration.',
        save: 'Save settings', discard: 'Discard draft and adopt latest status', dirty: 'Unsaved draft. Refreshing status will not replace it.',
        saved: 'Settings saved.', saving: 'Saving…', invalidSettings: 'Enter a client protocol version and an integer timeout from 1 to 2147483647 milliseconds.',
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
        quotaTitle: 'Account quota remaining', refreshQuota: 'Refresh quota manually', quotaLoading: 'Reading account quota…',
        quotaHint: 'Queries subscription quota only when you select Refresh. Percentages are not converted to tokens and are separate from conversation context space.',
        quotaEmpty: 'Quota has not been loaded, or previous data was cleared. Select “Refresh quota manually” to query it.', plan: 'Plan',
        quotaApiKey: 'Subscription quota is not available for API-key authentication. Check API usage and balance on the OpenAI billing page.',
        quotaUnavailable: 'Account quota is currently unavailable. Unknown data does not mean 0% remaining.', quotaNoWindows: 'The server did not provide quota windows. Remaining quota is unavailable.',
        primaryWindow: 'Primary quota window', secondaryWindow: 'Secondary quota window', remainingQuota: 'Quota remaining', windowDuration: 'Window duration', resetAt: 'Resets at',
        quotaLimited: 'The account is currently restricted. Wait for the quota reset or check your account status.',
        quotaAllowed: 'The server currently allows usage; actual requests remain subject to server checks.', quotaAllowanceUnknown: 'Whether the account currently allows usage is unavailable.',
        quotaDataUnavailable: 'Unavailable',
      },
    };
    const css = `
      .cm-panel{max-width:940px;margin:0 auto;padding:24px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6}
      .cm-panel *{box-sizing:border-box}.cm-panel h2{font-size:22px;margin:0 0 6px}.cm-panel h3{font-size:16px;margin:0}
      .cm-panel p{margin:8px 0}.cm-muted{color:var(--dsw-alias-label-secondary);font-size:13px}
      .cm-card{margin-top:18px;padding:18px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
      .cm-heading,.cm-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.cm-actions{justify-content:flex-start;margin-top:14px}
      .cm-panel button,.cm-panel input,.cm-panel select{font:inherit;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);padding:8px 10px}
      .cm-panel button{cursor:pointer;background:var(--dsw-alias-bg-layer-2)}.cm-panel button:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}
      .cm-panel button:disabled{cursor:not-allowed;opacity:.6}.cm-panel :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}
      .cm-panel fieldset{margin:0;padding:0;border:0;min-width:0}.cm-panel fieldset:disabled{opacity:.7}
      .cm-field{display:flex;flex-direction:column;gap:6px;margin-top:14px}.cm-field input,.cm-field select{width:100%;min-width:0}
      .cm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px}.cm-kv{display:grid;grid-template-columns:minmax(120px,auto) minmax(0,1fr);gap:8px 18px;margin:14px 0 0}
      .cm-kv dt{color:var(--dsw-alias-label-secondary)}.cm-kv dd{margin:0;overflow-wrap:anywhere}
      .cm-badge{display:inline-block;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:1px 6px;margin:2px 5px 2px 0;white-space:nowrap;font-size:12px}
      .cm-table-wrap{overflow-x:auto;margin-top:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px}
      .cm-table{width:100%;min-width:650px;border-collapse:collapse;text-align:left;font-size:13px}.cm-table th,.cm-table td{padding:10px 12px;vertical-align:top;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .cm-table tr:last-child td{border-bottom:0}.cm-table th{color:var(--dsw-alias-label-secondary);font-weight:500}.cm-model-id{font-family:monospace;overflow-wrap:anywhere}.cm-model-name{font-size:12px;color:var(--dsw-alias-label-secondary)}
      .cm-notice{padding:10px 12px;margin-top:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow-wrap:anywhere}
      .cm-error{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}.cm-consent{display:flex;align-items:flex-start;gap:8px;margin-top:14px}.cm-consent input{margin-top:5px;accent-color:var(--dsw-alias-brand-primary)}
      .cm-diagnostic{margin-top:14px;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l1)}.cm-panel output{overflow-wrap:anywhere}
      .cm-quota-window{margin-top:14px;padding:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base)}.cm-quota-window h4{margin:0;font-size:14px}.cm-quota-value{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}.cm-quota-progress{display:block;width:100%;height:10px;margin:10px 0;accent-color:var(--dsw-alias-brand-primary)}
      @media(max-width:600px){.cm-panel{padding:14px}.cm-card{padding:14px}.cm-grid{grid-template-columns:1fr}.cm-heading{align-items:flex-start}.cm-kv{grid-template-columns:1fr;gap:2px}.cm-kv dd{margin-bottom:8px}}
    `;
    function settingsDraft(settings) {
      return {
        proxy: typeof settings.proxy === 'string' ? settings.proxy : '',
        clientVersion: typeof settings.clientVersion === 'string' ? settings.clientVersion : '',
        streamIdleTimeoutMs: String(settings.streamIdleTimeoutMs),
      };
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
                setQuota(result.quota);
              }
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
            run('status');
            return () => {
              alive.current = false;
              requestId.current++;
              pending.current?.abort();
              pending.current = null;
            };
          }, []);
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
              settings: { proxy: draft.proxy.trim(), clientVersion: draft.clientVersion.trim(), streamIdleTimeoutMs: timeout },
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
          const percentage = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
          const duration = seconds => {
            if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return t('quotaDataUnavailable');
            const [divisor, unit] = seconds >= 86400 ? [86400, 'day'] : seconds >= 3600 ? [3600, 'hour'] : seconds >= 60 ? [60, 'minute'] : [1, 'second'];
            return number(seconds / divisor, { style: 'unit', unit, unitDisplay: 'long', maximumFractionDigits: 1 });
          };
          const quotaDate = value => value && Number.isFinite(new Date(value).getTime()) ? date(value) : t('quotaDataUnavailable');
          const quotaWindows = quota?.state === 'available' ? quota.windows.filter(item => item && ['primary', 'secondary'].includes(item.kind)) : [];
          const quotaRestricted = quota?.limitReached === true || quota?.allowed === false;
          const row = (key, value) => h(React.Fragment, { key }, h('dt', null, t(key)), h('dd', null, value));
          const field = (key, type, hint) => h('label', { className: 'cm-field', htmlFor: `${instanceId}-${key}` },
            h('span', null, t(key)),
            h('input', {
              id: `${instanceId}-${key}`, type, value: draft[key], autoComplete: 'off', spellCheck: false,
              onChange: event => change(key, event.target.value),
              ...(type === 'number' ? { min: 1, max: 2147483647, step: 1, required: true } : {}),
              ...(key === 'clientVersion' ? { required: true } : {}),
              ...(hint ? { 'aria-describedby': `${instanceId}-${key}-hint` } : {}),
            }),
            hint && h('span', { id: `${instanceId}-${key}-hint`, className: 'cm-muted' }, t(hint)));
          const credentialState = ['present', 'missing', 'invalid', 'unavailable'].includes(state?.credential?.state) ? state.credential.state : 'unknown';
          const mode = ['chatgpt', 'apikey'].includes(state?.credential?.mode) ? state.credential.mode : 'unknown';
          const usageKeys = ['inputTokens', 'outputTokens', 'totalTokens', 'cacheReadTokens', 'reasoningTokens'];
          return h('main', { className: 'cm-panel', 'aria-busy': Boolean(busy) },
            h('style', null, css),
            h('h2', null, t('title')), h('p', { className: 'cm-muted' }, t('intro')),
            h('div', { role: 'status', 'aria-live': 'polite' },
              busy && h('p', { className: 'cm-muted' }, t(({ status: 'loading', saveSettings: 'saving', models: 'modelsLoading', test: 'testing', quota: 'quotaLoading' })[busy] || 'busy')),
              notice && h('p', null, t(notice))),
            error && h('div', { className: 'cm-notice cm-error', role: 'alert' },
              h('strong', null, t(error.localKey)),
              error.code && h('div', { className: 'cm-model-id' }, error.code),
              error.message && h('div', null, error.message)),
            h('section', { className: 'cm-card', 'aria-labelledby': `${instanceId}-connection` },
              h('div', { className: 'cm-heading' }, h('h3', { id: `${instanceId}-connection` }, t('connection')), button('refreshStatus', () => run('status'))),
              state && h('dl', { className: 'cm-kv' },
                row('adapter', h('span', { className: 'cm-badge' }, t(state.adapter.active ? 'active' : 'inactive'), ' · codex')),
                row('credential', t(credentialState)), row('mode', t(mode)), row('checkedAt', date(state.checkedAt))),
              h('p', { className: 'cm-muted' }, t('privacy'))),
            h('section', { className: 'cm-card', 'aria-labelledby': `${instanceId}-quota` },
              h('div', { className: 'cm-heading' }, h('h3', { id: `${instanceId}-quota` }, t('quotaTitle')), button('refreshQuota', () => run('quota'), !state)),
              h('p', { className: 'cm-muted' }, t('quotaHint')),
              !quota ? h('p', { className: 'cm-muted' }, t('quotaEmpty')) : h(React.Fragment, null,
                h('dl', { className: 'cm-kv' }, row('plan', typeof quota.plan === 'string' && quota.plan.trim() ? quota.plan : t('quotaDataUnavailable')), row('checkedAt', quotaDate(quota.checkedAt))),
                quotaRestricted && h('p', { className: 'cm-notice cm-error', role: 'status' }, t('quotaLimited')),
                quota.state !== 'available' || quotaWindows.length === 0 ? h('p', { className: 'cm-notice' }, t(quota.reason === 'API_KEY' ? 'quotaApiKey' : quota.reason === 'NO_WINDOWS' || (quota.state === 'available' && quotaWindows.length === 0) ? 'quotaNoWindows' : 'quotaUnavailable')) :
                  h(React.Fragment, null,
                    !quotaRestricted && h('p', { className: 'cm-muted' }, t(quota.allowed === true ? 'quotaAllowed' : 'quotaAllowanceUnknown')),
                    quotaWindows.map((item, index) => {
                      const remaining = percentage(item.remainingPercent);
                      const label = t(item.kind === 'primary' ? 'primaryWindow' : 'secondaryWindow');
                      const amount = remaining === null ? t('quotaDataUnavailable') : number(remaining / 100, { style: 'percent', maximumFractionDigits: 1 });
                      return h('div', { className: 'cm-quota-window', key: `${item.kind}-${index}` },
                        h('div', { className: 'cm-heading' }, h('h4', null, label), h('span', { className: 'cm-quota-value' }, amount)),
                        remaining !== null && h('progress', { className: 'cm-quota-progress', value: remaining, max: 100, 'aria-label': `${label} · ${t('remainingQuota')}`, 'aria-valuetext': amount }),
                        h('dl', { className: 'cm-kv' }, row('windowDuration', duration(item.windowSeconds)), row('resetAt', quotaDate(item.resetAt))));
                    })))),
            h('section', { className: 'cm-card', 'aria-labelledby': `${instanceId}-settings` },
              h('h3', { id: `${instanceId}-settings` }, t('settings')),
              draft && h('form', { onSubmit: save },
                h('fieldset', { disabled: Boolean(busy) },
                  field('proxy', 'text', 'proxyHint'),
                  h('div', { className: 'cm-grid' }, field('clientVersion', 'text'), field('streamIdleTimeoutMs', 'number', 'timeoutHint')),
                  dirty && h('p', { className: 'cm-muted' }, t('dirty')),
                  dirty && state.revision !== draftRevision.current && h('p', { className: 'cm-notice' }, t('outdated')),
                  h('div', { className: 'cm-actions' }, h('button', { type: 'submit', disabled: !dirty || Boolean(busy) }, t('save')), button('discard', discard, !dirty))))),
            h('section', { className: 'cm-card', 'aria-labelledby': `${instanceId}-models` },
              h('div', { className: 'cm-heading' }, h('h3', { id: `${instanceId}-models` }, t('models')), button('refreshModels', () => run('models'), !state)),
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
            h('section', { className: 'cm-card', 'aria-labelledby': `${instanceId}-test` },
              h('h3', { id: `${instanceId}-test` }, t('test')), h('p', { className: 'cm-muted' }, t('testHint')),
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
                diagnostic.usage && h('div', null, h('h4', null, t('usage')), h('dl', { className: 'cm-kv' }, usageKeys.filter(key => Number.isFinite(diagnostic.usage[key])).map(key => row(key, diagnostic.usage[key].toLocaleString()))))) : h('p', { className: 'cm-muted' }, t('noDiagnostic'))));
        }
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: NS, order: 12, label: () => t('title'),
        }, Panel));
      },
    };
  },
});
