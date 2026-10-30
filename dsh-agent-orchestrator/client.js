window.__ModuleLoader__.load({
  id: '@local/dsh-agent-orchestrator',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const API = '/api/agent-orchestrator';
    const NS = 'agent-orchestrator';
    const MODE_NAMES = { strict: '严格模式', balanced: '平衡模式', prompt: '仅提示' };
    const MODE_NOTES = {
      strict: '辅助护栏：主智能体仅使用协调与只读白名单工具，默认拦截 shell、PTC、写入及未知插件工具；可能限制主智能体直接运行验收命令。任务图自动调度不依赖此模式。',
      balanced: '辅助护栏：仅拦截主智能体的 write / edit。shell、PTC 与其他插件工具仍可能写入，不提供完整实现隔离。',
      prompt: '默认：仅注入任务图规划与验收提示，不拦截工具。任务依赖和自动派工由实际调度器执行，不靠模型自觉维持队列。',
    };
    const css = `
      .ao-panel{box-sizing:border-box;width:100%;max-width:880px;min-width:0;margin:0 auto;padding:28px 24px 40px;color:var(--dsw-alias-label-primary,#202124);font-size:14px;line-height:1.65;overflow-wrap:anywhere}
      .ao-panel *{box-sizing:border-box}.ao-panel h2{margin:0;font-size:26px;line-height:1.3;letter-spacing:-.035em}.ao-panel h3{margin:0;font-size:16px;line-height:1.45}.ao-panel p{margin:8px 0}.ao-panel .ao-intro{color:var(--dsw-alias-label-secondary,#666);margin-top:10px}.ao-panel .ao-card{min-width:0;padding:22px;margin-top:18px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:14px;background:var(--dsw-alias-bg-layer-1,transparent)}
      .ao-panel .ao-heading,.ao-panel .ao-actions,.ao-panel .ao-switch-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}.ao-panel .ao-heading>*,.ao-panel .ao-switch-row>*{min-width:0;max-width:100%}.ao-panel .ao-actions{justify-content:flex-start}.ao-panel .ao-muted{font-size:12px;color:var(--dsw-alias-label-secondary,#666)}.ao-panel .ao-badge{display:inline-block;padding:3px 9px;border:1px solid var(--dsw-alias-border-l2,#bbb);border-radius:7px;font-size:12px;line-height:1.6;max-width:100%}
      .ao-panel button,.ao-panel input,.ao-panel textarea{font:inherit;color:inherit;max-width:100%;min-width:0}.ao-panel button{padding:9px 13px;border:1px solid var(--dsw-alias-border-l2,#aaa);border-radius:9px;background:var(--dsw-alias-bg-layer-2,transparent);font-size:13px;font-weight:600;cursor:pointer;white-space:normal}.ao-panel button.ao-primary{border-color:var(--dsw-alias-brand-primary,#3578df);color:var(--dsw-alias-brand-primary,#3578df)}.ao-panel button:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary,#3578df)}.ao-panel button:disabled{cursor:not-allowed;opacity:.5}.ao-panel :focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#3578df);outline-offset:4px}
      .ao-panel fieldset{min-width:0;margin:0;padding:0;border:0}.ao-panel fieldset:disabled{opacity:.7}.ao-panel legend{margin:0 0 10px;padding:0;font-size:14px;font-weight:600}.ao-panel .ao-field{display:flex;flex-direction:column;gap:7px;margin-top:20px}.ao-panel .ao-field>label{font-weight:600}.ao-panel input[type=number],.ao-panel textarea{padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#aaa);border-radius:9px;background:var(--dsw-alias-bg-base,transparent)}.ao-panel input[type=number]{width:130px}.ao-panel textarea{width:100%;min-height:110px;resize:vertical;font-family:monospace;font-size:12px;line-height:1.7}.ao-panel [aria-invalid=true]{border-color:var(--dsw-alias-state-error-primary,#b3261e)}
      .ao-panel .ao-switch-row{flex-wrap:nowrap;cursor:pointer;font-weight:600}.ao-panel input.ao-switch{appearance:none;position:relative;flex:0 0 44px;width:44px;height:25px;padding:0;margin:0;border:1px solid var(--dsw-alias-border-l2,#aaa);border-radius:15px;background:var(--dsw-alias-bg-layer-2,#ddd);cursor:pointer}.ao-panel input.ao-switch::before{content:'';position:absolute;left:3px;top:3px;width:17px;height:17px;border-radius:50%;background:var(--dsw-alias-label-secondary,#666)}.ao-panel input.ao-switch:checked{border-color:var(--dsw-alias-brand-primary,#3578df)}.ao-panel input.ao-switch:checked::before{left:22px;background:var(--dsw-alias-brand-primary,#3578df)}.ao-panel input.ao-switch:disabled{cursor:not-allowed}
      .ao-panel .ao-notice{margin-top:14px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2,#ccc);border-radius:9px;background:var(--dsw-alias-bg-base,transparent);font-size:12px}.ao-panel .ao-warning{border-left:3px solid var(--dsw-alias-state-warning-primary,#ad6a00)}.ao-panel .ao-error{border-left:3px solid var(--dsw-alias-state-error-primary,#b3261e)}.ao-panel .ao-success{border-left:3px solid var(--dsw-alias-brand-primary,#3578df)}.ao-panel .ao-mode-list{display:grid;gap:10px}.ao-panel .ao-mode{display:flex;align-items:flex-start;gap:11px;padding:13px;border:1px solid var(--dsw-alias-border-l1,#ccc);border-radius:10px;cursor:pointer}.ao-panel .ao-mode[data-selected=true]{border-color:var(--dsw-alias-brand-primary,#3578df);background:var(--dsw-alias-bg-base,transparent)}.ao-panel .ao-mode input{flex:0 0 auto;margin:5px 0 0;accent-color:var(--dsw-alias-brand-primary,#3578df)}.ao-panel .ao-mode strong{display:block;font-size:13px}.ao-panel .ao-mode small{display:block;margin-top:4px;color:var(--dsw-alias-label-secondary,#666);font-size:12px;line-height:1.65}
      .ao-panel .ao-divider{border-top:1px solid var(--dsw-alias-border-l1,#ddd);padding-top:18px;margin-top:20px}.ao-panel details>summary{cursor:pointer;font-size:13px;font-weight:600;border-radius:5px}.ao-panel details[open]>summary{margin-bottom:12px}.ao-panel .ao-kv{display:grid;grid-template-columns:minmax(100px,auto) minmax(0,1fr);gap:5px 18px;margin:14px 0 0;font-size:12px}.ao-panel .ao-kv dt{color:var(--dsw-alias-label-secondary,#666)}.ao-panel .ao-kv dd{margin:0;overflow-wrap:anywhere}.ao-panel .ao-savebar{margin-top:22px;padding-top:18px;border-top:1px solid var(--dsw-alias-border-l1,#ddd)}.ao-panel .ao-status{margin:10px 0 0;font-size:12px}.ao-panel .ao-readonly{white-space:pre-wrap;overflow-wrap:anywhere}.ao-panel .ao-warning-list{margin:6px 0;padding-left:20px}.ao-panel .ao-warning-list li{margin:5px 0}
      .ao-panel .ao-board-top{border-top:3px solid var(--dsw-alias-brand-primary,#3578df)}.ao-panel .ao-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:10px;margin:16px 0}.ao-panel .ao-metric{padding:11px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:9px;background:var(--dsw-alias-bg-base,transparent)}.ao-panel .ao-metric strong{display:block;font-size:22px;line-height:1.3;font-variant-numeric:tabular-nums}.ao-panel .ao-metric span{display:block;font-size:11px;color:var(--dsw-alias-label-secondary,#666);margin-top:4px}.ao-panel .ao-plan-list{display:grid;gap:9px;margin-top:14px}.ao-panel .ao-plan-button{text-align:left;width:100%;font-weight:400}.ao-panel .ao-plan-button[aria-pressed=true]{border-color:var(--dsw-alias-brand-primary,#3578df)}.ao-panel .ao-plan-button strong{display:block;font-size:13px}.ao-panel .ao-plan-button small{display:block;font-size:11px;line-height:1.6;color:var(--dsw-alias-label-secondary,#666);margin-top:3px}.ao-panel .ao-task{margin-top:12px;padding:13px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:9px}.ao-panel .ao-task>summary{font-weight:500}.ao-panel .ao-task-title{display:block;margin-bottom:4px}.ao-panel .ao-code{font-family:monospace;font-size:11px;overflow-wrap:anywhere}.ao-panel .ao-output{white-space:pre-wrap;margin:10px 0 0;font-size:12px;max-height:240px;overflow:auto;padding:11px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:7px;background:var(--dsw-alias-bg-base,transparent)}.ao-panel .ao-stale{font-weight:600;color:var(--dsw-alias-state-warning-primary,#ad6a00)}.ao-panel .ao-review-note{margin:10px 0;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1,#ddd)}
      @media(max-width:600px){.ao-panel{padding:18px 10px 28px}.ao-panel .ao-card{padding:16px;border-radius:11px}.ao-panel h2{font-size:23px}.ao-panel .ao-heading{align-items:flex-start}.ao-panel .ao-kv{grid-template-columns:1fr;gap:2px}.ao-panel .ao-kv dd{margin-bottom:7px}.ao-panel .ao-actions{align-items:stretch}.ao-panel .ao-actions button{flex:1 1 140px}}
      @media(forced-colors:active){.ao-panel input.ao-switch{appearance:auto}.ao-panel input.ao-switch::before{display:none}}
    `;

    function draftFrom(settings) {
      return {
        enabled: settings.enabled,
        mode: settings.mode,
        preferredParallelism: String(settings.preferredParallelism),
        independentReview: settings.independentReview,
        additionalAllowedTools: settings.additionalAllowedTools,
      };
    }
    function draftKey(draft) {
      return JSON.stringify([draft.enabled, draft.mode, draft.preferredParallelism, draft.independentReview, draft.additionalAllowedTools]);
    }
    function settingsFrom(draft) {
      if (!draft || typeof draft.enabled !== 'boolean' || typeof draft.independentReview !== 'boolean' || !Object.hasOwn(MODE_NAMES, draft.mode)) {
        return { error: '设置格式无效，请重新读取设置后再编辑。' };
      }
      const text = String(draft.preferredParallelism).trim();
      const parallelism = text === '' ? NaN : Number(text);
      if (!Number.isInteger(parallelism) || parallelism < 1 || parallelism > 16) {
        return { field: 'parallelism', error: '本插件总并发上限必须为 1–16 的整数；它不是宿主全局容量。' };
      }
      if (typeof draft.additionalAllowedTools !== 'string' || draft.additionalAllowedTools.trim().split(/[\s,]+/).filter(Boolean).some(name => !/^[a-zA-Z0-9_-]+$/.test(name))) {
        return { field: 'tools', error: '额外工具仅接受精确裸工具名，以逗号或空白分隔；不允许通配符、句点或命名空间。' };
      }
      return { settings: {
        enabled: draft.enabled,
        mode: draft.mode,
        preferredParallelism: parallelism,
        independentReview: draft.independentReview,
        additionalAllowedTools: draft.additionalAllowedTools.trim(),
      } };
    }
    function snapshotFrom(result) {
      const value = result;
      if (!value || value.ok !== true || typeof value.revision !== 'string' || !value.revision || !value.settings || typeof value.settings.preferredParallelism !== 'number') {
        throw Object.assign(new Error('unrecognized'), { code: 'MALFORMED_RESPONSE' });
      }
      const parsed = settingsFrom(draftFrom(value.settings));
      if (!parsed.settings) throw Object.assign(new Error('unrecognized'), { code: 'MALFORMED_RESPONSE' });
      const warnings = Array.isArray(value.warnings) ? value.warnings.filter(item => typeof item === 'string').map(item => item.slice(0, 1200)).slice(0, 12) : [];
      return { revision: value.revision, settings: parsed.settings, warnings };
    }
    function failureMessage(code, method) {
      if (code === 'CONFLICT') return '版本冲突：设置已被其他页面或进程修改。本次未覆盖它，草稿已保留。请重新读取并核对已保存状态，再决定是否放弃草稿。';
      if (code === 'INVALID_SETTINGS' || code === 'INVALID_REQUEST' || code === 'VALIDATION_ERROR' || code === 'BAD_REQUEST') return '设置未通过服务器校验，未确认保存。请检查输入后重试，或重新读取设置核对。';
      if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') return '当前页面无权读取或保存设置。请通过现有 DSH 页面重新进入，不要在此粘贴任何凭据。';
      if (code === 'MALFORMED_RESPONSE') return '服务器响应无法识别。请核对插件安装与 Host 版本，再重新读取设置。';
      if (method === 'PUT') return '保存结果未确认，草稿已保留。请先重新读取设置并核对，不要连续重复保存。';
      return '无法读取设置。请检查 DSH 是否仍在运行、插件是否完成安装，然后重试。';
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const PLAN_STATES = { active: '调度中', paused: '已暂停', completed: '执行完成，待验收', failed: '执行失败', cancelled: '已取消', interrupted: '已中断，需显式恢复' };
        const PAUSE_REASONS = { disabled: '插件已关闭新派工', parentUnavailable: '原父会话当前不可用', providerUnavailable: '执行 provider 当前不可用', waitingCapacity: '等待宿主可用容量', needsReconcile: '重启或关闭后的执行状态需核对并重绑定', userPaused: '用户已暂停', awaitingExplicitResume: '已重绑定，等待明确恢复', cleanupUncertain: '执行清理未确认，调度器已隔离，需人工核对；不能按普通暂停恢复' };
        const TASK_STATES = { pending: '等待依赖', ready: '等待派工', starting: '启动中', running: '执行中', succeeded: '执行完成，未独立验收', failed: '执行失败', cancelled: '已取消', blocked: '已阻塞', interrupted: '已中断' };
        const number = value => Number.isInteger(value) && value >= 0 ? value : null;
        const readableNumber = value => number(value) === null ? '未知' : String(value);
        const safeText = (value, limit = 1600) => typeof value === 'string' ? value.slice(0, limit) : '';
        const when = value => {
          if (!((typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim()))) return '未知';
          const date = new Date(value);
          return Number.isFinite(date.getTime()) ? date.toLocaleString() : '未知';
        };
        const listText = value => Array.isArray(value) ? value.filter(item => typeof item === 'string').join('、') || '无' : '未知';
        function validatePlan(value, details = false) {
          if (!value || typeof value.id !== 'string' || typeof value.title !== 'string' || !Object.hasOwn(PLAN_STATES, value.status) || !Number.isInteger(value.revision) || value.revision < 0 || !value.concurrency || ['starting', 'running', 'limit'].some(key => number(value.concurrency[key]) === null) || typeof value.counts !== 'object' || value.counts === null || (details && !Array.isArray(value.tasks))) {
            throw new Error('invalid plan snapshot');
          }
          if (details && value.tasks.some(task => !task || typeof task.id !== 'string' || typeof task.title !== 'string' || !Object.hasOwn(TASK_STATES, task.state) || !Array.isArray(task.dependsOn))) throw new Error('invalid task snapshot');
          return value;
        }
        function TaskBoard() {
          const uid = React.useId();
          const [data, setData] = React.useState(null);
          const [detail, setDetail] = React.useState(null);
          const [selected, setSelected] = React.useState('');
          const [busy, setBusy] = React.useState(false);
          const [error, setError] = React.useState('');
          const [stale, setStale] = React.useState(false);
          const [hidden, setHidden] = React.useState(typeof document !== 'undefined' && document.hidden);
          const [updated, setUpdated] = React.useState('');
          const alive = React.useRef(false);
          const pending = React.useRef(null);
          const timer = React.useRef(null);
          const selectedRef = React.useRef('');
          const generation = React.useRef(0);
          const halted = React.useRef(false);
          const snapshot = React.useRef(null);
          const visible = () => typeof document === 'undefined' || !document.hidden;
          function stopTimer() { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } }
          function needsRefresh(value) { return value?.plans?.some(plan => plan.status === 'active' || number(plan.concurrency?.running) > 0 || number(plan.concurrency?.starting) > 0); }
          function schedule(value) {
            stopTimer();
            if (alive.current && !halted.current && visible() && needsRefresh(value)) timer.current = setTimeout(() => { timer.current = null; void refresh(false); }, 3000);
          }
          async function read(url, signal) {
            const response = await fetch(url, { method: 'GET', credentials: 'same-origin', mode: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' }, signal });
            const result = await response.json();
            if (!response.ok || result?.ok !== true) throw new Error('task board unavailable');
            return result;
          }
          async function refresh(manual = true) {
            if (!alive.current || pending.current || !visible()) return;
            if (manual) halted.current = false;
            if (halted.current) return;
            stopTimer();
            const controller = new AbortController();
            const sequence = ++generation.current;
            pending.current = controller;
            setBusy(true);
            const timeout = setTimeout(() => controller.abort(), 15000);
            const current = () => alive.current && sequence === generation.current;
            let next = null;
            try {
              const result = await read(`${API}/plans`, controller.signal);
              if (!Array.isArray(result.plans) || !result.scheduler || typeof result.scheduler.available !== 'boolean' || typeof result.scheduler.enabled !== 'boolean' || number(result.scheduler.limit) === null) throw new Error('invalid task board');
              result.plans.forEach(plan => validatePlan(plan));
              next = { plans: result.plans, scheduler: result.scheduler, warnings: Array.isArray(result.warnings) ? result.warnings.filter(item => typeof item === 'string').slice(0, 12) : [] };
              let target = selectedRef.current;
              if (!next.plans.some(plan => plan.id === target)) target = next.plans[0]?.id || '';
              const detailed = target ? await read(`${API}/plans/${encodeURIComponent(target)}`, controller.signal) : null;
              if (detailed) validatePlan(detailed.plan, true);
              if (!current() || controller.signal.aborted || !visible()) return;
              snapshot.current = next;
              selectedRef.current = target;
              setData(next);
              setSelected(target);
              setDetail(detailed?.plan || null);
              setUpdated(new Date().toISOString());
              setStale(false);
              setError('');
            } catch {
              if (!current() || !visible()) return;
              halted.current = true;
              setStale(Boolean(snapshot.current));
              setError('任务看板读取失败，自动刷新已停止。已有内容仅为历史快照；请检查连接或插件版本后手动重试。此操作不会重试任务或发起模型请求。');
            } finally {
              clearTimeout(timeout);
              if (current()) {
                pending.current = null;
                setBusy(false);
                if (!halted.current) schedule(next || snapshot.current);
              }
            }
          }
          function selectPlan(planId) {
            if (pending.current) { pending.current.abort(); pending.current = null; generation.current++; }
            stopTimer();
            selectedRef.current = planId;
            setSelected(planId);
            setDetail(null);
            setBusy(false);
            void refresh(true);
          }
          React.useEffect(() => {
            alive.current = true;
            const onVisibility = () => {
              const isHidden = !visible();
              setHidden(isHidden);
              stopTimer();
              if (isHidden) {
                generation.current++;
                pending.current?.abort();
                pending.current = null;
                setBusy(false);
                if (snapshot.current) setStale(true);
              } else if (!halted.current) void refresh(false);
            };
            if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
            if (visible()) void refresh(true);
            return () => {
              alive.current = false;
              generation.current++;
              stopTimer();
              pending.current?.abort();
              pending.current = null;
              if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
            };
          }, []);
          const row = (title, value) => h(React.Fragment, { key: title }, h('dt', null, title), h('dd', null, value));
          const totals = data ? data.plans.reduce((sum, plan) => ({ starting: sum.starting + (number(plan.concurrency.starting) || 0), running: sum.running + (number(plan.concurrency.running) || 0) }), { starting: 0, running: 0 }) : null;
          const metric = (value, title) => h('div', { className: 'ao-metric', key: title }, h('strong', null, value), h('span', null, title));
          return h('section', { className: 'ao-card ao-board-top', 'aria-labelledby': `${uid}-board-title`, 'aria-busy': busy },
            h('div', { className: 'ao-heading' }, h('h3', { id: `${uid}-board-title` }, '任务看板'), h('button', { type: 'button', disabled: busy || hidden, onClick: () => { void refresh(true); } }, busy ? '正在读取…' : error ? '重试读取任务' : '刷新任务')),
            h('p', { className: 'ao-muted' }, '主模型通过 orchestrator_plan 提交结构化任务图，调度器按依赖与资源所有权自动派工。本页只读，不接受 parent agent、提示词或新任务输入。'),
            h('p', { className: 'ao-muted' }, '展示当前本地 profile 中经连接鉴权可见的任务摘要，不提供额外用户隔离。暂停、恢复、取消、重试与重绑定请在创建计划的原对话中操作。'),
            !data && busy && h('p', { role: 'status', className: 'ao-notice' }, '正在读取计划与实际执行状态…'),
            error && h('p', { role: 'alert', className: 'ao-notice ao-error' }, error),
            data && h(React.Fragment, null,
              h('div', { className: 'ao-metrics' }, metric(totals.running, '本插件任务实际运行中'), metric(totals.starting, '本插件任务启动中'), metric(readableNumber(data.scheduler.limit), '本插件总并发上限'), metric('未知', '宿主全局并发容量')),
              h('p', { className: 'ao-status' }, `调度器：${data.scheduler.available ? data.scheduler.enabled ? '可用，允许新派工' : '可用，已关闭新派工' : '不可用'}。${data.scheduler.errorCode ? `错误代码：${safeText(data.scheduler.errorCode, 100)}。` : ''}最后成功读取：${when(updated)}。`),
              h('p', { className: `ao-muted${stale ? ' ao-stale' : ''}`, role: 'status', 'aria-live': 'polite' }, stale ? '当前为历史快照，请勿将旧运行数当成实时状态。' : hidden ? '页面不可见，刷新已暂停。' : halted.current ? '自动刷新已停止。' : needsRefresh(data) ? '可见页面每次读取完成后等待 3 秒刷新；隐藏时暂停，不重叠请求。' : '当前没有活动任务，自动刷新已停止；可手动刷新发现新计划。'),
              data.warnings.length > 0 && h('ul', { className: 'ao-warning-list ao-muted' }, data.warnings.map((warning, index) => h('li', { key: index }, safeText(warning)))),
              data.plans.length === 0 ? h('p', { className: 'ao-notice' }, '尚无计划。请在对话中让主智能体调用 orchestrator_plan 提交任务图，而不是只描述并行偏好。') : h('div', { className: 'ao-plan-list', 'aria-label': '计划列表' }, data.plans.map(plan => h('button', { type: 'button', key: plan.id, className: 'ao-plan-button', 'aria-pressed': plan.id === selected, onClick: () => selectPlan(plan.id) },
                h('strong', null, safeText(plan.title, 200)), h('small', null, `${PLAN_STATES[plan.status]} · 运行 ${readableNumber(plan.concurrency.running)} / 启动 ${readableNumber(plan.concurrency.starting)} · 计划上限 ${readableNumber(plan.concurrency.limit)} · 更新 ${when(plan.updatedAt)}`), h('small', { className: 'ao-code' }, safeText(plan.id, 160))))),
              detail && detail.id === selected && h('section', { className: 'ao-divider', 'aria-label': '计划详情' },
                h('div', { className: 'ao-heading' }, h('h3', null, safeText(detail.title, 200)), h('span', { className: 'ao-badge' }, PLAN_STATES[detail.status])),
                detail.cancelRequested && h('p', { className: 'ao-notice ao-warning' }, '已请求取消；正在等待实际执行停止或事件回收，不能据此断言外部副作用已撤回。'),
                detail.pauseReason && h('p', { className: 'ao-notice ao-warning' }, `派工提示：${PAUSE_REASONS[detail.pauseReason] || safeText(detail.pauseReason, 200)}`),
                (detail.cleanupUncertain || detail.schedulerError?.code === 'TEARDOWN_UNCONFIRMED') && h('p', { className: 'ao-notice ao-error', role: 'alert' }, '执行清理未确认，整个调度器已隔离并停止新派工。请人工核对旧执行是否确已退出；普通 rebind、retry、resume、开关或重启不会解除隔离，本页不提供一键解除。'),
                detail.schedulerError && h('p', { className: 'ao-notice ao-error', role: 'alert' }, `调度器错误 ${safeText(detail.schedulerError.code, 100)}：${safeText(detail.schedulerError.message, 1000)}`),
                detail.needsReconcile && !detail.cleanupUncertain && detail.schedulerError?.code !== 'TEARDOWN_UNCONFIRMED' && h('p', { className: 'ao-muted' }, '恢复前请在原创建根会话核对实际副作用，执行 rebind，再显式 retry 或 resume；本页不会自动恢复或重放任务。'),
                h('dl', { className: 'ao-kv' }, row('计划标识', h('span', { className: 'ao-code' }, safeText(detail.id, 200))), row('版本', String(detail.revision)), row('创建时间', when(detail.createdAt)), row('更新时间', when(detail.updatedAt)), row('状态统计', Object.entries(detail.counts).filter(([, count]) => number(count) !== null).map(([state, count]) => `${TASK_STATES[state] || safeText(state, 60)} ${count}`).join('；') || '暂无统计')),
                detail.tasks.map(task => h('details', { className: 'ao-task', key: task.id },
                  h('summary', null, h('span', { className: 'ao-task-title' }, safeText(task.title, 200)), h('span', { className: 'ao-badge' }, TASK_STATES[task.state]), h('span', { className: 'ao-code' }, ` ${safeText(task.id, 160)}`)),
                  h('dl', { className: 'ao-kv' }, row('依赖任务', listText(task.dependsOn)), row('声明写入资源', listText(task.writeResources)), row('执行次数', readableNumber(task.attempt)), row('执行者', safeText(task.childId, 200) || '尚未绑定'), row('Provider', safeText(task.provider, 100) || '尚未分配')),
                  task.blockedReason && h('p', { className: 'ao-notice ao-warning' }, `阻塞原因：${safeText(task.blockedReason)}`),
                  task.failure && h('p', { className: 'ao-notice ao-error' }, `${safeText(task.failure.code, 100)}：${safeText(task.failure.message)}`),
                  task.result && h('div', { className: 'ao-review-note' }, h('strong', null, '执行结果摘要（未独立验收）'), h('pre', { className: 'ao-output' }, safeText(task.result.summary, 12000) || '执行者未提供文本摘要。'), h('p', { className: 'ao-muted' }, `${task.result.truncated ? '摘要已截断。' : ''}${task.result.stopReason ? `停止原因：${safeText(task.result.stopReason, 100)}。` : ''}执行完成不代表产物已验证；如需独立复核，应在任务图中显式创建依赖该任务的 reviewer 工作包。`))))),
              h('p', { className: 'ao-notice ao-warning' }, '任务看板没有 HTTP 控制权限。所有操作必须由原创建对话的 orchestrator_plan 工具校验真实父智能体范围；请勿把任务执行完成当成验收通过。')));
        }
        function Panel() {
          const id = React.useId();
          const [snapshot, setSnapshot] = React.useState(null);
          const [draft, setDraft] = React.useState(null);
          const [dirty, setDirty] = React.useState(false);
          const [busy, setBusy] = React.useState('');
          const [failure, setFailure] = React.useState(null);
          const [notice, setNotice] = React.useState('');
          const [conflict, setConflict] = React.useState(false);
          const [uncertain, setUncertain] = React.useState(false);
          const [reviewedLatest, setReviewedLatest] = React.useState(false);
          const [discardConfirm, setDiscardConfirm] = React.useState(false);
          const alive = React.useRef(false);
          const pending = React.useRef(null);
          const generation = React.useRef(0);
          const dirtyRef = React.useRef(false);
          const draftRevision = React.useRef(null);
          const baseline = React.useRef(null);
          const currentDraft = React.useRef(null);
          const saving = React.useRef(false);
          const blocked = React.useRef(false);
          const latest = React.useRef(null);

          function adopt(value) {
            const next = draftFrom(value.settings);
            baseline.current = draftKey(next);
            currentDraft.current = next;
            draftRevision.current = value.revision;
            dirtyRef.current = false;
            blocked.current = false;
            setDraft(next);
            setDirty(false);
            setConflict(false);
            setUncertain(false);
            setReviewedLatest(false);
            setDiscardConfirm(false);
          }
          async function request(method, body) {
            if (!alive.current || pending.current) return;
            const requestGeneration = ++generation.current;
            const controller = new AbortController();
            pending.current = controller;
            saving.current = method === 'PUT';
            setBusy(method === 'PUT' ? 'save' : 'load');
            setFailure(null);
            setNotice('');
            setDiscardConfirm(false);
            let timedOut = false;
            const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
            const current = () => alive.current && requestGeneration === generation.current;
            try {
              const response = await fetch(API, {
                method, credentials: 'same-origin', mode: 'same-origin', cache: 'no-store',
                headers: { accept: 'application/json', ...(method === 'PUT' ? { 'content-type': 'application/json' } : {}) },
                ...(method === 'PUT' ? { body: JSON.stringify(body) } : {}),
                signal: controller.signal,
              });
              let result;
              try { result = await response.json(); } catch { throw Object.assign(new Error('unrecognized'), { code: 'MALFORMED_RESPONSE' }); }
              if (!current() || controller.signal.aborted) return;
              if (!response.ok || result?.ok === false) {
                const code = response.status === 409 ? 'CONFLICT'
                  : response.status === 401 ? 'UNAUTHORIZED'
                    : response.status === 403 ? 'FORBIDDEN'
                      : response.status === 400 ? 'BAD_REQUEST'
                        : typeof result?.code === 'string' ? result.code : 'REQUEST_FAILED';
                throw Object.assign(new Error('request failed'), { code });
              }
              const value = snapshotFrom(result);
              latest.current = value;
              setSnapshot(value);
              if (method === 'PUT') {
                adopt(value);
                setNotice('设置已保存。调度器按新开关和本插件总并发上限控制后续派工；不强制取消已运行任务，不修改宿主全局容量或委派深度。');
              } else if (!dirtyRef.current && !blocked.current) {
                adopt(value);
              } else {
                setReviewedLatest(true);
                setNotice('已读取最新保存状态，未覆盖你的草稿，也未更换草稿开始编辑时的版本。请核对下方“已保存设置”。');
              }
            } catch (error) {
              if (!current() || (controller.signal.aborted && !timedOut)) return;
              const code = typeof error?.code === 'string' ? error.code : timedOut ? 'TIMEOUT' : 'REQUEST_FAILED';
              if (method === 'PUT' && code === 'CONFLICT') {
                blocked.current = true;
                setConflict(true);
                setReviewedLatest(false);
              } else if (method === 'PUT' && !['INVALID_SETTINGS', 'INVALID_REQUEST', 'VALIDATION_ERROR', 'BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN'].includes(code)) {
                blocked.current = true;
                setUncertain(true);
                setReviewedLatest(false);
              }
              setFailure({ message: failureMessage(code, method), code });
            } finally {
              clearTimeout(timer);
              if (current()) { pending.current = null; saving.current = false; setBusy(''); }
            }
          }
          React.useEffect(() => {
            alive.current = true;
            void request('GET');
            return () => {
              alive.current = false;
              generation.current++;
              pending.current?.abort();
              pending.current = null;
              saving.current = false;
            };
          }, []);
          function change(key, value) {
            if (saving.current || !currentDraft.current) return;
            const next = { ...currentDraft.current, [key]: value };
            currentDraft.current = next;
            const changed = draftKey(next) !== baseline.current;
            dirtyRef.current = changed;
            setDirty(changed);
            setDraft(next);
            setNotice('');
            setDiscardConfirm(false);
          }
          function save(event) {
            event.preventDefault();
            if (!currentDraft.current || !dirtyRef.current || pending.current || blocked.current || draftRevision.current === null) return;
            const parsed = settingsFrom(currentDraft.current);
            if (!parsed.settings) { setFailure({ message: parsed.error, field: parsed.field, code: 'LOCAL_VALIDATION' }); return; }
            void request('PUT', { expectedRevision: draftRevision.current, settings: parsed.settings });
          }
          function discard() {
            if (!latest.current || pending.current || (blocked.current && !reviewedLatest)) return;
            adopt(latest.current);
            setFailure(null);
            setNotice('已明确放弃草稿并采用最近读取的保存状态。现在可以重新编辑。');
          }
          const savedSettings = snapshot?.settings;
          const remoteChanged = snapshot && draftRevision.current && snapshot.revision !== draftRevision.current;
          const draftChanges = draft && savedSettings && draft.enabled !== savedSettings.enabled;
          const row = (title, value) => h(React.Fragment, { key: title }, h('dt', null, title), h('dd', null, value));
          const action = (label, onClick, disabled = false) => h('button', { type: 'button', onClick, disabled: Boolean(busy) || disabled }, label);
          return h('section', { className: 'ao-panel', 'aria-labelledby': `${id}-title`, 'aria-busy': Boolean(busy) },
            h('style', null, css),
            h('header', null,
              h('h2', { id: `${id}-title` }, '主控调度'),
              h('p', { className: 'ao-intro' }, '结构化任务图、事件驱动派工与真实执行状态。主智能体规划和验收，调度器负责依赖、资源所有权和并发队列。')),
            h(TaskBoard),
            h('aside', { className: 'ao-notice ao-warning', 'aria-label': '关闭范围说明' },
              h('strong', null, '关闭后停止新派工，不强制取消正在执行的任务。'),
              ' 同时停止本插件提示与辅助守卫；已发生的副作用不能撤回。其他用户级或项目级指令独立生效。插件总并发上限不等于宿主全局容量，也不会更改账号、模型、权限、审批或委派深度。'),
            !snapshot && busy === 'load' && h('p', { className: 'ao-notice', role: 'status' }, '正在读取主控调度设置…'),
            failure && h('div', { className: 'ao-notice ao-error', role: 'alert' }, h('p', null, failure.message),
              action(snapshot ? '重新读取设置（保留草稿）' : '重试读取设置', () => { void request('GET'); })),
            notice && h('p', { className: 'ao-notice ao-success', role: 'status', 'aria-live': 'polite' }, notice),
            snapshot && draft && h('form', { onSubmit: save },
              h('section', { className: 'ao-card', 'aria-labelledby': `${id}-switch-title` },
                h('div', { className: 'ao-heading' }, h('h3', { id: `${id}-switch-title` }, '启用与关闭'),
                  h('span', { className: 'ao-badge' }, `已保存：${savedSettings.enabled ? '已启用' : '已关闭'}`)),
                h('fieldset', { disabled: busy === 'save', className: 'ao-divider' },
                  h('label', { className: 'ao-switch-row', htmlFor: `${id}-enabled` },
                    h('span', null, '启用主控调度'),
                    h('input', { id: `${id}-enabled`, type: 'checkbox', role: 'switch', className: 'ao-switch', checked: draft.enabled, 'aria-describedby': `${id}-enabled-hint`, onChange: event => change('enabled', event.target.checked) })),
                  h('p', { className: 'ao-status', id: `${id}-enabled-hint` }, `当前草稿：${draft.enabled ? '开启' : '关闭'}${draftChanges ? '（尚未保存，开关状态与已保存值不同）' : '（与已保存开关一致）'}。修改仅在点击“保存设置”成功后生效。`))),
              h('section', { className: 'ao-card', 'aria-labelledby': `${id}-policy-title` },
                h('h3', { id: `${id}-policy-title` }, '调度配置与辅助护栏'),
                h('p', { className: 'ao-muted' }, draft.enabled ? '通过 orchestrator_plan 提交任务图后，实际派工由调度器管理。下方模式仅控制可选的根主智能体工具护栏，默认仅提示。' : '插件当前草稿为关闭：保存后停止新派工，但不强制取消已运行任务。仍可编辑配置供下次启用。'),
                h('fieldset', { disabled: busy === 'save', className: 'ao-divider' },
                  h('legend', null, '主智能体工具约束模式'),
                  h('div', { className: 'ao-mode-list' }, Object.keys(MODE_NAMES).map(mode =>
                    h('label', { key: mode, className: 'ao-mode', htmlFor: `${id}-${mode}`, 'data-selected': draft.mode === mode },
                      h('input', { type: 'radio', id: `${id}-${mode}`, name: `${id}-mode`, value: mode, checked: draft.mode === mode, 'aria-describedby': `${id}-${mode}-hint`, onChange: () => change('mode', mode) }),
                      h('span', null, h('strong', null, `${MODE_NAMES[mode]} · ${mode}`), h('small', { id: `${id}-${mode}-hint` }, MODE_NOTES[mode]))))),
                  h('p', { className: 'ao-muted' }, '这些是职责分工护栏，不是安全沙箱；权限与审批始终由宿主校验。')),
                h('fieldset', { disabled: busy === 'save' },
                  h('div', { className: 'ao-field' },
                    h('label', { htmlFor: `${id}-parallelism` }, '本插件总并发上限'),
                    h('input', { id: `${id}-parallelism`, type: 'number', inputMode: 'numeric', min: 1, max: 16, step: 1, required: true, value: draft.preferredParallelism, 'aria-describedby': `${id}-parallelism-hint`, 'aria-invalid': failure?.field === 'parallelism' ? true : undefined, onChange: event => change('preferredParallelism', event.target.value) }),
                    h('span', { id: `${id}-parallelism-hint`, className: 'ao-muted' }, '1–16 的整数，限制本插件所有计划同时启动与运行的任务总数。每计划另受 maxConcurrency 限制；宿主还可能有更低容量、权限或深度限制，因此不保证能实际开满。')),
                  h('div', { className: 'ao-divider' },
                    h('label', { className: 'ao-switch-row', htmlFor: `${id}-review` },
                      h('span', null, '提示创建独立审查任务'),
                      h('input', { id: `${id}-review`, type: 'checkbox', role: 'switch', className: 'ao-switch', checked: draft.independentReview, 'aria-describedby': `${id}-review-hint`, onChange: event => change('independentReview', event.target.checked) })),
                    h('p', { id: `${id}-review-hint`, className: 'ao-muted' }, '提醒主智能体在任务图中显式添加依赖实现任务的 reviewer 工作包；不会自动创建审查任务，也不会自动把执行结果标记为已验证。关闭后仍须验收实际交付。')),
                  h('details', { className: 'ao-divider' },
                    h('summary', null, '高级设置：额外放行工具'),
                    h('p', { className: 'ao-notice ao-warning', id: `${id}-tools-hint` }, '仅在 strict 模式生效。额外放行 shell、write、edit 或 PTC 等工具会削弱主智能体与实现者的职责隔离。默认留空；不要为消除一次报错而随意放行。'),
                    h('div', { className: 'ao-field' },
                      h('label', { htmlFor: `${id}-tools` }, '精确工具名（逗号或空白分隔）'),
                      h('textarea', { id: `${id}-tools`, value: draft.additionalAllowedTools, rows: 3, spellCheck: false, autoCapitalize: 'off', autoCorrect: 'off', 'aria-describedby': `${id}-tools-hint ${id}-tools-format`, 'aria-invalid': failure?.field === 'tools' ? true : undefined, onChange: event => change('additionalAllowedTools', event.target.value) }),
                      h('span', { id: `${id}-tools-format`, className: 'ao-muted' }, '仅允许字母、数字、下划线和连字符，不支持 * 通配符、functions. 前缀或模糊匹配。此处不需要填写任何 token 或凭据。'))))),
              h('section', { className: 'ao-card', 'aria-labelledby': `${id}-saved-title` },
                h('div', { className: 'ao-heading' }, h('h3', { id: `${id}-saved-title` }, '已保存设置'), action(busy === 'load' ? '正在读取…' : '重新读取（保留草稿）', () => { void request('GET'); })),
                h('dl', { className: 'ao-kv' },
                  row('插件开关', savedSettings.enabled ? '已启用' : '已关闭'),
                  row('约束模式', `${MODE_NAMES[savedSettings.mode]} · ${savedSettings.mode}`),
                  row('本插件总并发上限', `${savedSettings.preferredParallelism}（宿主全局容量未知）`),
                  row('独立审查', savedSettings.independentReview ? '鼓励' : '未启用此偏好'),
                  row('额外工具', h('span', { className: 'ao-readonly' }, savedSettings.additionalAllowedTools || '无（默认白名单）'))),
                snapshot.warnings.length > 0 && h('div', { className: 'ao-notice ao-warning' }, h('strong', null, 'Host 提示'), h('ul', { className: 'ao-warning-list' }, snapshot.warnings.map((warning, index) => h('li', { key: index }, warning))))),
              (remoteChanged || conflict || uncertain) && h('div', { className: 'ao-notice ao-warning', role: 'status' },
                h('p', null, conflict ? '版本冲突尚未处理。草稿与原编辑版本保持不变，保存已暂停。' : uncertain ? '上次保存结果未确认，保存已暂停。先读取已保存状态核对。' : '最近读取的保存版本已不同于草稿开始编辑时的版本。不会自动替换草稿或偷偷更新其版本。'),
                h('p', null, '请先重新读取并核对“已保存设置”，再明确放弃草稿采用最新值后重新编辑。')),
              h('div', { className: 'ao-savebar' },
                h('div', { className: 'ao-actions' },
                  h('button', { type: 'submit', className: 'ao-primary', disabled: Boolean(busy) || !dirty || conflict || uncertain }, busy === 'save' ? '正在保存…' : '保存设置'),
                  action('放弃草稿并采用最新设置', () => setDiscardConfirm(true), (!dirty && !conflict && !uncertain && !remoteChanged) || ((conflict || uncertain) && !reviewedLatest))),
                h('p', { className: 'ao-status', role: 'status', 'aria-live': 'polite' }, busy === 'save' ? '正在保存，请勿重复提交。' : dirty ? '有未保存的修改。切换上方开关不会立即保存；重新读取不会覆盖草稿。' : '当前没有未保存的修改。'),
                discardConfirm && h('div', { className: 'ao-notice ao-warning', role: 'group', 'aria-label': '确认放弃草稿' },
                  h('p', null, '确认放弃当前所有未保存修改，并采用“已保存设置”中最近读取的值？此操作不会写入服务器。'),
                  h('div', { className: 'ao-actions' }, action('确认放弃并采用最新值', discard), action('保留草稿', () => setDiscardConfirm(false)))))));
        }
        // Do not condition this entry on the enabled setting: users must be able to turn it back on.
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: NS, order: 13, label: () => '主控调度',
        }, Panel));
      },
    };
  },
});
