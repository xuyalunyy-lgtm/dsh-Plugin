window.__ModuleLoader__.load({
  id: '@local/dsh-qinglan-theme',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'local-qinglan';
    const KEY = 'dsh.qinglan.presentation.v1';
    const defaults = { enabled: true, palette: 'green', opacity: 12, blur: 0, fit: 'cover', image: '', name: '', pattern: true };
    const palettes = {
      green: ['#f3f7ee', '#e8efdf', '#dce9d4', '#f5f8f0', '#c1d3b3', '#a0bd93', '#328049', '#263724', '#56694d', '#eaf1e3'],
      apricot: ['#faf5ed', '#f3eadc', '#eaddc9', '#fffaf3', '#ddcab1', '#c7ad8a', '#986437', '#3c3024', '#705b45', '#f4ecdf'],
      forest: ['#14231d', '#1d3027', '#294235', '#20362b', '#365943', '#55765c', '#93d4a3', '#e1f0de', '#adc4aa', '#192c23'],
      sky: ['#f1f7fc', '#e6eff8', '#d5e5f4', '#f7faff', '#b6ccdf', '#8daecb', '#28639c', '#203449', '#48627a', '#e8f1f9'],
      lavender: ['#f7f3fc', '#eee7f7', '#e3d9ef', '#fbf8ff', '#cdbce1', '#ad95c8', '#75469b', '#352641', '#655276', '#f0eaf8'],
      rose: ['#fff5f7', '#f7e8ed', '#eed8e1', '#fff9fb', '#dfbdca', '#c795aa', '#a13f65', '#432732', '#785363', '#f9edf1'],
      mint: ['#f0f9f7', '#e1f1ed', '#cfe6e0', '#f7fcfa', '#b0cfc6', '#82b2a4', '#206b5c', '#203c35', '#48665d', '#e6f4ef'],
      silver: ['#f6f7f9', '#eceef2', '#dfe3e9', '#fbfcfd', '#c1c8d2', '#9ca8b8', '#4f6484', '#28313e', '#535f70', '#eef0f4'],
      midnight: ['#131e30', '#1b2b42', '#263b56', '#1c2e46', '#38516c', '#577491', '#91bded', '#e4edf8', '#b1c3d9', '#17253a'],
      plum: ['#251b2f', '#32243e', '#443250', '#352740', '#604a6c', '#82688e', '#d1a5ec', '#f3e7fa', '#d1b9dd', '#2b2035'],
      coffee: ['#28201b', '#362b23', '#49382d', '#392d25', '#65503e', '#8d7057', '#e2b987', '#f7ecdf', '#d7c0a7', '#2f251e'],
      graphite: ['#1b1d22', '#26292f', '#343941', '#292d34', '#4b525d', '#707b8b', '#afc2df', '#edf0f5', '#bdc6d3', '#22252b'],
    };
    const paletteGroups = {
      lightPalettes: ['green', 'apricot', 'sky', 'lavender', 'rose', 'mint', 'silver'],
      darkPalettes: ['forest', 'midnight', 'plum', 'coffee', 'graphite'],
    };
    const names = ['bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-overlay', 'border-l1', 'border-l2', 'brand-primary', 'label-primary', 'label-secondary'];
    const dictionaries = {
      zh: { title: '青岚主题', intro: '柔和配色 · 自定义背景 · 即时预览', enabled: '启用自定义外观', green: '青岚 · 浅绿', apricot: '暖杏 · 米色', forest: '夜森 · 深绿', sky: '晴空 · 浅蓝', lavender: '雾紫 · 薰衣草', rose: '樱雪 · 浅粉', mint: '薄荷 · 青碧', silver: '云银 · 冷灰', midnight: '星海 · 深蓝', plum: '暮紫 · 暗紫', coffee: '摩卡 · 深棕', graphite: '曜石 · 炭灰', lightPalettes: '浅色主题 · 7 套', darkPalettes: '深色主题 · 5 套', selected: '已选中', palette: '主题配色', background: '背景图片', upload: '选择 / 更换背景图', remove: '移除图片', opacity: '背景显现度', blur: '背景模糊', fit: '图片铺放', cover: '铺满（裁切）', contain: '完整显示', repeat: '平铺', pattern: '显示植物光斑纹理', reset: '恢复默认外观', privacy: '图片仅保存在当前浏览器，不上传服务器。支持 PNG / JPEG / WebP，最大 3 MB。背景为不拦截点击的淡化装饰层；显现度越低，文字越清晰。', saved: '已保存到当前浏览器', failed: '本地保存失败，请检查浏览器存储空间或权限。', invalid: '请选择不超过 3 MB 的 PNG、JPEG 或 WebP 图片。', decode: '无法读取此图片，请换一张有效图片。', empty: '默认植物光斑', off: '关闭后恢复 Harness 原有主题；背景设置仍保留。' },
      en: { title: 'Qinglan Theme', intro: 'Soft palettes · Custom backgrounds · Live preview', enabled: 'Enable custom appearance', green: 'Qinglan · Sage', apricot: 'Warm · Apricot', forest: 'Night · Forest', sky: 'Sky · Blue', lavender: 'Mist · Lavender', rose: 'Blossom · Rose', mint: 'Mint · Teal', silver: 'Cloud · Silver', midnight: 'Midnight · Navy', plum: 'Dusk · Plum', coffee: 'Mocha · Brown', graphite: 'Obsidian · Graphite', lightPalettes: 'Light themes · 7', darkPalettes: 'Dark themes · 5', selected: 'Selected', palette: 'Color palette', background: 'Background image', upload: 'Choose / replace image', remove: 'Remove image', opacity: 'Background visibility', blur: 'Background blur', fit: 'Image placement', cover: 'Cover (crop)', contain: 'Contain', repeat: 'Tile', pattern: 'Botanical light texture', reset: 'Restore defaults', privacy: 'Images stay in this browser and are never uploaded. PNG / JPEG / WebP, up to 3 MB. The faint decorative layer never intercepts clicks; lower visibility improves text readability.', saved: 'Saved in this browser', failed: 'Could not save locally. Check browser storage space or permissions.', invalid: 'Choose a PNG, JPEG or WebP image up to 3 MB.', decode: 'Cannot decode this image. Please choose a valid image.', empty: 'Default botanical texture', off: 'Turning this off restores the original Harness theme and keeps your background preferences.' },
    };
    Object.assign(dictionaries.zh, {
      current: '当前配色', previewMode: '预览方式', effect: '实际效果', original: '查看原图',
      sampleTitle: '阅读效果预览', sampleText: '这是一段示例文字，用于检查背景是否影响阅读。',
      previewHint: '缩略示意：同步显现度、模糊、铺放和纹理；裁切范围随窗口尺寸变化。',
      inactive: '自定义外观已关闭，当前不会应用背景。', pending: '预览中，停止调整后自动保存…',
      resetParameters: '重置背景参数（保留图片）', resetAll: '恢复全部默认设置',
      resetWarning: '将恢复青岚配色，并移除已保存的背景图。此操作不可撤销。',
      confirmReset: '确认恢复并移除图片', cancel: '取消', resetHelp: '仅重置显现度、模糊、铺放和纹理，不改变配色或图片。',
      rawEmpty: '尚未选择背景图片', version: '版本 1.2.0',
    });
    Object.assign(dictionaries.en, {
      current: 'Current palette', previewMode: 'Preview mode', effect: 'Applied effect', original: 'Original image',
      sampleTitle: 'Readability preview', sampleText: 'Sample text to check whether your background interferes with reading.',
      previewHint: 'Scaled illustration using the same opacity, blur, placement and texture; cropping depends on window size.',
      inactive: 'Custom appearance is off; no background is applied.', pending: 'Previewing; saves when adjustment stops…',
      resetParameters: 'Reset background controls (keep image)', resetAll: 'Restore all defaults',
      resetWarning: 'This restores the Sage palette and removes the saved background image. This cannot be undone.',
      confirmReset: 'Restore and remove image', cancel: 'Cancel', resetHelp: 'Resets visibility, blur, placement and texture only. Keeps your palette and image.',
      rawEmpty: 'No background image selected', version: 'Version 1.2.0',
    });
    function sanitize(value) {
      const v = value && typeof value === 'object' ? value : {};
      return { enabled: typeof v.enabled === 'boolean' ? v.enabled : true,
        palette: Object.hasOwn(palettes, v.palette) ? v.palette : 'green',
        opacity: Number.isFinite(v.opacity) ? Math.max(0, Math.min(25, v.opacity)) : 12,
        blur: Number.isFinite(v.blur) ? Math.max(0, Math.min(16, v.blur)) : 0,
        fit: ['cover', 'contain', 'repeat'].includes(v.fit) ? v.fit : 'cover',
        image: typeof v.image === 'string' && v.image.length <= 4300000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v.image) ? v.image : '',
        name: typeof v.name === 'string' ? v.name.slice(0, 200) : '', pattern: v.pattern !== false };
    }
    // Pure persistence scheduler: preview is immediate, storage is coalesced.
    function createSaveQueue(commit, schedule = setTimeout, cancel = clearTimeout) {
      let pending, timer;
      function discard() {
        if (timer !== undefined) cancel(timer);
        timer = undefined; pending = undefined;
      }
      function flush() {
        if (timer !== undefined) cancel(timer);
        timer = undefined;
        if (pending === undefined) return true;
        const value = pending; pending = undefined;
        return commit(value);
      }
      function enqueue(value, deferred = false) {
        discard(); pending = value;
        if (!deferred) return flush();
        timer = schedule(flush, 250);
        return true;
      }
      return { enqueue, flush, discard };
    }
    function backgroundReset() {
      return { opacity: defaults.opacity, blur: defaults.blur, fit: defaults.fit, pattern: defaults.pattern };
    }
    function layerPresentation(s) {
      return { visible: s.enabled && Boolean(s.image || s.pattern), opacity: s.opacity / 100, blur: `blur(${s.blur}px)`, imageInset: s.fit === 'contain' ? 0 : -20 };
    }
    const css = `.ql-panel{max-width:720px;margin:0 auto;padding:24px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6}.ql-panel *{box-sizing:border-box}.ql-panel h2{font-size:22px;margin:0}.ql-muted{color:var(--dsw-alias-label-secondary);font-size:13px}.ql-card{padding:18px;margin:16px 0;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1)}.ql-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin:12px 0}.ql-panel button,.ql-panel select,.ql-upload{font:inherit;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:8px 12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);cursor:pointer}.ql-panel button[aria-pressed=true]{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.ql-panel :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}.ql-panel input{accent-color:var(--dsw-alias-brand-primary)}.ql-panel input[type=range]{width:min(240px,100%)}.ql-swatches{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.ql-theme-choice{min-width:0;text-align:left;display:flex;flex-direction:column;gap:8px}.ql-theme-art{display:flex;width:100%;height:28px;overflow:hidden;border-radius:6px}.ql-theme-art i{flex:1}.ql-theme-label{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px}.ql-theme-check{font-size:11px;color:var(--dsw-alias-label-secondary)}.ql-preview{height:150px;border-radius:12px;margin:12px 0;border:1px solid var(--dsw-alias-border-l1);overflow:hidden;position:relative;background:var(--dsw-alias-bg-base)}.ql-preview span{position:absolute;bottom:10px;left:12px;padding:4px 8px;border-radius:6px;background:var(--dsw-alias-bg-overlay);max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ql-error{color:var(--dsw-alias-state-error-primary)}@media(max-width:540px){.ql-panel{padding:14px}.ql-row{align-items:flex-start}}`;
    const panelCss = `
      .ql-header{padding-bottom:12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .ql-header h2{margin-bottom:10px}.ql-enable{display:flex;align-items:center;gap:8px}
      .ql-segments{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0}
      .ql-theme-choice{min-height:102px}.ql-theme-label{align-items:flex-start}
      .ql-theme-check{min-height:18px}.ql-preview{height:200px;isolation:isolate}
      .ql-sample{padding:20px;position:relative}.ql-sample p{margin:10px 0}
      .ql-raw-image{width:100%;height:100%;object-fit:contain;display:block}
      .ql-filename{overflow-wrap:anywhere}.ql-footer{border-top:1px solid var(--dsw-alias-border-l1);padding-top:16px}
      .ql-confirm{margin-top:12px;padding:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
      .ql-panel button:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}
      .ql-panel button:disabled{cursor:not-allowed;color:var(--dsw-alias-label-secondary);border-style:dashed}
      .ql-footer [role=status]{min-height:24px}
      @media(max-width:420px){.ql-swatches{grid-template-columns:repeat(auto-fit,minmax(125px,1fr))}.ql-segments button{flex:1}.ql-preview{height:220px}}
    `;
    return {
      inject: ['slots', 'theme', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'en', dictionaries.en));
        ctx.effect(() => ctx.locale.register(NS, 'zh', dictionaries.zh));
        const t = ctx.locale.bind(NS);
        let state = { ...defaults }, initialError = false;
        try { state = sanitize(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { initialError = true; }
        const listeners = new Set();
        const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
        let disposeTokens = () => {};
        function applyPalette() {
          if (!state.enabled) {
            disposeTokens(); disposeTokens = () => {};
            return;
          }
          const colors = palettes[state.palette];
          const tokens = {};
          names.forEach((name, i) => { tokens['--dsw-alias-' + name] = { light: colors[i], dark: colors[i] }; });
          tokens['--dsw-specific-sidebar-fill'] = { light: colors[9], dark: colors[9] };
          // Native Appearance selections use bg-module-platform, NOT bg-layer-*.
          // Keep semantic surfaces paired with the overridden foreground in both modes.
          const surfaces = {
            '--dsw-alias-bg-module-platform': colors[2],
            '--dsw-alias-interactive-bg-hover': colors[2],
            '--dsw-alias-settings-card-fill': colors[1],
            '--dsw-alias-settings-card-stroke': colors[5],
            '--dsw-alias-border-l3': colors[4],
            '--dsw-alias-border-l4': colors[5],
            '--dsw-alias-label-primary-dimmed': colors[8],
            '--dsw-alias-menu-icon': colors[8],
            '--dsw-alias-menu-group-header-fill': colors[3],
            '--dsw-menu-surface-fill': colors[3],
            '--dsw-specific-menu': colors[3],
          };
          for (const [name, value] of Object.entries(surfaces)) {
            tokens[name] = { light: value, dark: value };
          }
          // Replace the layer atomically; do not briefly expose mixed host colors.
          disposeTokens = ctx.theme.overrideTokens(NS, tokens);
        }
        let externalRevision = 0;
        let savedState = state;
        let saveStatus = initialError ? 'failed' : '';
        const notify = () => listeners.forEach(fn => fn());
        const saves = createSaveQueue(next => {
          try {
            localStorage.setItem(KEY, JSON.stringify(next));
            savedState = next; saveStatus = 'saved'; notify(); return true;
          } catch {
            const changed = state.enabled !== savedState.enabled || state.palette !== savedState.palette;
            state = savedState; saveStatus = 'failed';
            if (changed) applyPalette();
            notify(); return false;
          }
        });
        function update(patch, deferred = false) {
          const next = sanitize({ ...state, ...patch });
          const changed = next.enabled !== state.enabled || next.palette !== state.palette;
          state = next; saveStatus = 'pending';
          if (changed) applyPalette();
          notify();
          return saves.enqueue(next, deferred);
        }
        ctx.effect(() => {
          applyPalette();
          const onStorage = event => {
            if (event.storageArea !== localStorage || (event.key !== KEY && event.key !== null)) return;
            try {
              // Storage events are queued snapshots: reconcile against the latest value.
              const next = sanitize(JSON.parse(localStorage.getItem(KEY) || 'null'));
              externalRevision++;
              saves.discard(); state = savedState = next; saveStatus = '';
              applyPalette(); notify();
            } catch { /* Keep the last valid preference. */ }
          };
          const flush = () => saves.flush();
          const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
          window.addEventListener('storage', onStorage);
          window.addEventListener('pagehide', flush);
          document.addEventListener('visibilitychange', onVisibility);
          return () => {
            saves.flush(); saves.discard(); disposeTokens(); listeners.clear();
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('pagehide', flush);
            document.removeEventListener('visibilitychange', onVisibility);
          };
        });
        function useState() { return React.useSyncExternalStore(subscribe, () => state); }
        function useLocale() { React.useSyncExternalStore(fn => ctx.locale.subscribe(fn), () => ctx.locale.getSnapshot()); }
        function artwork(s) {
          if (s.image) return { backgroundImage: `url("${s.image}")`, backgroundSize: s.fit === 'repeat' ? 'auto 320px' : s.fit, backgroundRepeat: s.fit === 'repeat' ? 'repeat' : 'no-repeat', backgroundPosition: 'center' };
          const colors = palettes[s.palette];
          return { backgroundImage: `radial-gradient(ellipse at 5% 95%, ${colors[6]} 0%, transparent 48%),radial-gradient(ellipse at 90% 80%, ${colors[5]} 0%, transparent 50%)` };
        }
        // Narrow compatibility rule for the inspected settings navigation contract.
        // No generated class names, wildcard text rules, or changes to error/primary buttons.
        const settingsCompatibility = `
          [data-shortcut-modal="settings"] nav button[aria-current="true"] {
            background: var(--dsw-alias-bg-module-platform);
            color: var(--dsw-alias-label-primary);
            box-shadow: inset 3px 0 0 var(--dsw-alias-brand-primary);
          }
          [data-shortcut-modal="settings"] nav button[aria-current="true"] > span,
          [data-shortcut-modal="settings"] nav button[aria-current="true"] > svg {
            color: inherit;
          }
          [data-shortcut-modal="settings"] nav button:hover {
            background: var(--dsw-alias-interactive-bg-hover);
            color: var(--dsw-alias-label-primary);
          }
        `;
        function BackgroundLayers({ settings: s, fixed = false }) {
          const presentation = layerPresentation(s);
          if (!presentation.visible) return null;
          return h('div', { 'aria-hidden': true, style: { position: fixed ? 'fixed' : 'absolute', inset: 0, pointerEvents: 'none', userSelect: 'none', overflow: 'hidden', opacity: presentation.opacity } },
            h('div', { style: { position: 'absolute', inset: presentation.imageInset, ...artwork(s), filter: presentation.blur } }),
            s.pattern && h('div', { style: { position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 10px 10px, var(--dsw-alias-brand-primary) 0 3px, transparent 4px),radial-gradient(circle at 19px 10px, var(--dsw-alias-brand-primary) 0 3px, transparent 4px),radial-gradient(circle at 10px 19px, var(--dsw-alias-brand-primary) 0 3px, transparent 4px),radial-gradient(circle at 19px 19px, var(--dsw-alias-brand-primary) 0 3px, transparent 4px)', backgroundSize: '90px 90px', opacity: .4 } }));
        }
        function Background() {
          const s = useState();
          if (!s.enabled) return null;
          return h(React.Fragment, null, h('style', null, settingsCompatibility), h(BackgroundLayers, { settings: s, fixed: true }));
        }
        function Panel() {
          useLocale();
          const s = useState();
          const persistedStatus = React.useSyncExternalStore(subscribe, () => saveStatus);
          const [message, setMessage] = React.useState('');
          const [section, setSection] = React.useState('palette');
          const [preview, setPreview] = React.useState('effect');
          const [confirming, setConfirming] = React.useState(false);
          const fileRef = React.useRef(null);
          const cancelRef = React.useRef(null);
          const resetRef = React.useRef(null);
          const generation = React.useRef(0);
          const instanceId = React.useId();
          React.useEffect(() => () => { generation.current++; saves.flush(); }, []);
          React.useEffect(() => { if (confirming) cancelRef.current?.focus(); }, [confirming]);
          function change(patch, deferred = false) {
            setMessage(''); setConfirming(false);
            return update(patch, deferred);
          }
          function selectSection(next) { saves.flush(); setConfirming(false); setSection(next); }
          function closeConfirmation() { setConfirming(false); resetRef.current?.focus(); }
          async function upload(event) {
            const file = event.target.files?.[0]; event.target.value = '';
            if (!file) return;
            const ticket = ++generation.current;
            const sourceRevision = externalRevision;
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) { setMessage('invalid'); return; }
            try {
              const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
              const image = new Image(); image.src = data; await image.decode();
              if (ticket !== generation.current || sourceRevision !== externalRevision) return;
              change({ image: data, name: file.name });
            } catch { if (ticket === generation.current && sourceRevision === externalRevision) setMessage('decode'); }
          }
          const button = (key, action, props = {}) => h('button', { type: 'button', onClick: action, ...props }, t(key));
          const range = (key, max, unit) => h('div', { className: 'ql-row' },
            h('label', { htmlFor: `${instanceId}-${key}` }, t(key), ` · ${s[key]}${unit}`),
            h('input', { id: `${instanceId}-${key}`, type: 'range', min: 0, max, step: 1, value: s[key],
              onChange: e => change({ [key]: Number(e.target.value) }, true),
              onPointerUp: () => saves.flush(), onPointerCancel: () => saves.flush(),
              onKeyUp: () => saves.flush(), onBlur: () => saves.flush(),
            }));
          const status = message || persistedStatus;
          return h('section', { className: 'ql-panel', 'aria-label': t('title') }, h('style', null, css + panelCss),
            h('div', { className: 'ql-header' },
              h('h2', null, t('title')),
              h('label', { className: 'ql-enable' }, h('input', { type: 'checkbox', role: 'switch', 'aria-checked': s.enabled, checked: s.enabled, onChange: e => change({ enabled: e.target.checked }) }), t('enabled')),
              h('p', { className: 'ql-muted' }, t('current'), '：', t(s.palette), ' · ', t('version')),
              !s.enabled && h('p', { className: 'ql-muted' }, t('inactive')),
              h('div', { className: 'ql-segments', role: 'group', 'aria-label': t('title') },
                ['palette', 'background'].map(key => button(key, () => selectSection(key), { key, 'aria-pressed': section === key, 'aria-controls': `${instanceId}-content` })))),
            h('div', { id: `${instanceId}-content` },
            section === 'palette' && h('div', { className: 'ql-card' }, h('h3', null, t('palette')),
              Object.entries(paletteGroups).map(([group, keys]) => h('div', { key: group, role: 'group', 'aria-label': t(group) },
                h('h4', { className: 'ql-muted' }, t(group)),
                h('div', { className: 'ql-swatches' }, keys.map(key => h('button', {
                  key, type: 'button', className: 'ql-theme-choice', 'aria-pressed': s.palette === key,
                  onClick: () => change({ palette: key }),
                },
                  h('span', { className: 'ql-theme-art', 'aria-hidden': true }, [0, 2, 6, 7].map(index => h('i', { key: index, style: { background: palettes[key][index] } }))),
                  h('span', { className: 'ql-theme-label' }, t(key), h('span', { className: 'ql-theme-check', 'aria-hidden': true, style: { visibility: s.palette === key ? 'visible' : 'hidden' } }, '✓ ', t('selected')))
                )))
              ))),
            section === 'background' && h('div', { className: 'ql-card' }, h('h3', null, t('background')),
              h('div', { className: 'ql-segments', role: 'group', 'aria-label': t('previewMode') },
                ['effect', 'original'].map(key => button(key, () => setPreview(key), { key, 'aria-pressed': preview === key }))),
              h('div', { className: 'ql-preview', role: 'img', 'aria-label': t(preview) },
                preview === 'original'
                  ? (s.image ? h('img', { src: s.image, alt: s.name, className: 'ql-raw-image' }) : h('p', { className: 'ql-sample' }, t('rawEmpty')))
                  : h(React.Fragment, null,
                    h('div', { className: 'ql-sample' }, h('strong', null, t('sampleTitle')), h('p', null, t('sampleText')), h('p', { className: 'ql-muted' }, t('current'), '：', t(s.palette))),
                    h(BackgroundLayers, { settings: s }))),
              h('p', { className: 'ql-muted ql-filename' }, s.image ? s.name : t('empty')),
              h('p', { className: 'ql-muted' }, t('previewHint')),
              h('input', { ref: fileRef, type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true, onChange: upload }),
              h('div', { className: 'ql-row' }, button('upload', () => fileRef.current?.click()), button('remove', () => { generation.current++; change({ image: '', name: '' }); }, { disabled: !s.image })),
              range('opacity', 25, '%'), range('blur', 16, 'px'),
              h('label', { className: 'ql-row' }, t('fit'), h('select', { value: s.fit, onChange: e => change({ fit: e.target.value }) }, ['cover', 'contain', 'repeat'].map(key => h('option', { key, value: key }, t(key))))),
              h('label', { className: 'ql-row' }, t('pattern'), h('input', { type: 'checkbox', checked: s.pattern, onChange: e => change({ pattern: e.target.checked }) })),
              button('resetParameters', () => change(backgroundReset())),
              h('p', { className: 'ql-muted' }, t('resetHelp')),
              h('p', { className: 'ql-muted' }, t('privacy')))),
            h('div', { className: 'ql-footer' },
              button('resetAll', () => { saves.flush(); setConfirming(true); }, { ref: resetRef, 'aria-expanded': confirming, 'aria-controls': `${instanceId}-reset` }),
              confirming && h('div', { id: `${instanceId}-reset`, className: 'ql-confirm', role: 'group', 'aria-label': t('resetAll'),
                onKeyDown: e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeConfirmation(); } },
              }, h('p', null, t('resetWarning')),
                h('div', { className: 'ql-segments' },
                  button('cancel', closeConfirmation, { ref: cancelRef }),
                  button('confirmReset', () => { generation.current++; change(defaults); resetRef.current?.focus(); }))),
              h('p', { role: 'status', 'aria-live': 'polite', className: status && !['saved', 'pending'].includes(status) ? 'ql-error' : 'ql-muted' }, status ? t(status) : '')));
        }
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: NS + '-background', order: -100 }, Background));
        ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: NS, order: 5, label: () => t('title') }, Panel));
      },
    };
  },
});
