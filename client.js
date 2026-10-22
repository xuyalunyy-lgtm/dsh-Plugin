window.__ModuleLoader__.load({
  id: '@local/dsh-qinglan-theme',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'local-qinglan';
    const KEY = 'dsh.qinglan.presentation.v1';
    const defaults = { enabled: true, palette: 'green', opacity: 12, blur: 0, fit: 'cover', image: '', name: '', pattern: true };
    const palettes = {
      green: ['#f3f7ee', '#e8efdf', '#dce9d4', '#f5f8f0', '#c1d3b3', '#a0bd93', '#328049', '#263724', '#596d50', '#eaf1e3'],
      apricot: ['#faf5ed', '#f3eadc', '#eaddc9', '#fffaf3', '#ddcab1', '#c7ad8a', '#986437', '#3c3024', '#78644d', '#f4ecdf'],
      forest: ['#14231d', '#1d3027', '#294235', '#20362b', '#365943', '#55765c', '#93d4a3', '#e1f0de', '#adc4aa', '#192c23'],
    };
    const names = ['bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-overlay', 'border-l1', 'border-l2', 'brand-primary', 'label-primary', 'label-secondary'];
    const dictionaries = {
      zh: { title: '青岚主题', intro: '柔和配色 · 自定义背景 · 即时预览', enabled: '启用自定义外观', green: '青岚 · 浅绿', apricot: '暖杏 · 米色', forest: '夜森 · 深绿', palette: '主题配色', background: '背景图片', upload: '选择 / 更换背景图', remove: '移除图片', opacity: '背景显现度', blur: '背景模糊', fit: '图片铺放', cover: '铺满（裁切）', contain: '完整显示', repeat: '平铺', pattern: '显示植物光斑纹理', reset: '恢复默认外观', privacy: '图片仅保存在当前浏览器，不上传服务器。支持 PNG / JPEG / WebP，最大 3 MB。背景为不拦截点击的淡化装饰层；显现度越低，文字越清晰。', saved: '已保存到当前浏览器', failed: '本地保存失败，请检查浏览器存储空间或权限。', invalid: '请选择不超过 3 MB 的 PNG、JPEG 或 WebP 图片。', decode: '无法读取此图片，请换一张有效图片。', empty: '默认植物光斑', off: '关闭后恢复 Harness 原有主题；背景设置仍保留。' },
      en: { title: 'Qinglan Theme', intro: 'Soft palettes · Custom backgrounds · Live preview', enabled: 'Enable custom appearance', green: 'Qinglan · Sage', apricot: 'Warm · Apricot', forest: 'Night · Forest', palette: 'Color palette', background: 'Background image', upload: 'Choose / replace image', remove: 'Remove image', opacity: 'Background visibility', blur: 'Background blur', fit: 'Image placement', cover: 'Cover (crop)', contain: 'Contain', repeat: 'Tile', pattern: 'Botanical light texture', reset: 'Restore defaults', privacy: 'Images stay in this browser and are never uploaded. PNG / JPEG / WebP, up to 3 MB. The faint decorative layer never intercepts clicks; lower visibility improves text readability.', saved: 'Saved in this browser', failed: 'Could not save locally. Check browser storage space or permissions.', invalid: 'Choose a PNG, JPEG or WebP image up to 3 MB.', decode: 'Cannot decode this image. Please choose a valid image.', empty: 'Default botanical texture', off: 'Turning this off restores the original Harness theme and keeps your background preferences.' },
    };
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
    const css = `.ql-panel{max-width:720px;margin:0 auto;padding:24px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6}.ql-panel *{box-sizing:border-box}.ql-panel h2{font-size:22px;margin:0}.ql-muted{color:var(--dsw-alias-label-secondary);font-size:13px}.ql-card{padding:18px;margin:16px 0;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1)}.ql-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin:12px 0}.ql-panel button,.ql-panel select,.ql-upload{font:inherit;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:8px 12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);cursor:pointer}.ql-panel button[aria-pressed=true]{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.ql-panel :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}.ql-panel input{accent-color:var(--dsw-alias-brand-primary)}.ql-panel input[type=range]{width:min(240px,100%)}.ql-swatches{display:flex;flex-wrap:wrap;gap:12px}.ql-preview{height:150px;border-radius:12px;margin:12px 0;border:1px solid var(--dsw-alias-border-l1);overflow:hidden;position:relative;background:var(--dsw-alias-bg-base)}.ql-preview span{position:absolute;bottom:10px;left:12px;padding:4px 8px;border-radius:6px;background:var(--dsw-alias-bg-overlay);max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ql-error{color:var(--dsw-alias-state-error-primary)}@media(max-width:540px){.ql-panel{padding:14px}.ql-row{align-items:flex-start}}`;
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
        ctx.effect(() => { applyPalette(); return () => { disposeTokens(); listeners.clear(); }; });
        function update(patch) {
          const next = sanitize({ ...state, ...patch });
          try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { return false; }
          const changed = next.enabled !== state.enabled || next.palette !== state.palette;
          state = next;
          if (changed) applyPalette();
          listeners.forEach(fn => fn());
          return true;
        }
        ctx.effect(() => {
          const onStorage = event => {
            if (event.key !== KEY && event.key !== null) return;
            try { state = sanitize(JSON.parse(event.newValue || 'null')); applyPalette(); listeners.forEach(fn => fn()); } catch { /* Keep the last valid preference. */ }
          };
          window.addEventListener('storage', onStorage);
          return () => window.removeEventListener('storage', onStorage);
        });
        function useState() { return React.useSyncExternalStore(subscribe, () => state); }
        function useLocale() { React.useSyncExternalStore(fn => ctx.locale.subscribe(fn), () => ctx.locale.getSnapshot()); }
        function artwork(s) {
          if (s.image) return { backgroundImage: `url("${s.image}")`, backgroundSize: s.fit === 'repeat' ? 'auto 320px' : s.fit, backgroundRepeat: s.fit === 'repeat' ? 'repeat' : 'no-repeat', backgroundPosition: 'center' };
          return { backgroundImage: 'radial-gradient(ellipse at 5% 95%, #58c986 0%, transparent 48%),radial-gradient(ellipse at 90% 80%, #9cbc75 0%, transparent 50%)' };
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
        function Background() {
          const s = useState();
          if (!s.enabled) return null;
          return h(React.Fragment, null, h('style', null, settingsCompatibility),
            (s.image || s.pattern) && h('div', { 'aria-hidden': true, style: { position: 'fixed', inset: 0, pointerEvents: 'none', userSelect: 'none', overflow: 'hidden', opacity: s.opacity / 100 } },
            h('div', { style: { position: 'absolute', inset: -20, ...artwork(s), filter: `blur(${s.blur}px)` } }),
            s.pattern && h('div', { style: { position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 10px 10px, #76ad79 0 3px, transparent 4px),radial-gradient(circle at 19px 10px, #76ad79 0 3px, transparent 4px),radial-gradient(circle at 10px 19px, #76ad79 0 3px, transparent 4px),radial-gradient(circle at 19px 19px, #76ad79 0 3px, transparent 4px)', backgroundSize: '90px 90px', opacity: .4 } })));
        }
        function Panel() {
          useLocale();
          const s = useState();
          const [message, setMessage] = React.useState(initialError ? 'failed' : '');
          const fileRef = React.useRef(null);
          const generation = React.useRef(0);
          React.useEffect(() => () => { generation.current++; }, []);
          function change(patch) { setMessage(update(patch) ? 'saved' : 'failed'); }
          async function upload(event) {
            const file = event.target.files?.[0]; event.target.value = '';
            if (!file) return;
            const ticket = ++generation.current;
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) { setMessage('invalid'); return; }
            try {
              const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
              const image = new Image(); image.src = data; await image.decode();
              if (ticket !== generation.current) return;
              change({ image: data, name: file.name });
            } catch { if (ticket === generation.current) setMessage('decode'); }
          }
          const button = (key, action, props = {}) => h('button', { type: 'button', onClick: action, ...props }, t(key));
          const range = (key, max, unit) => h('label', { className: 'ql-row' }, h('span', null, t(key), ` · ${s[key]}${unit}`), h('input', { type: 'range', min: 0, max, value: s[key], onChange: e => change({ [key]: Number(e.target.value) }) }));
          return h('section', { className: 'ql-panel', 'aria-label': t('title') }, h('style', null, css),
            h('h2', null, t('title')), h('p', { className: 'ql-muted' }, t('intro')),
            h('div', { className: 'ql-card' }, h('label', { className: 'ql-row' }, t('enabled'), h('input', { type: 'checkbox', role: 'switch', 'aria-checked': s.enabled, checked: s.enabled, onChange: e => change({ enabled: e.target.checked }) })), h('p', { className: 'ql-muted' }, t('off'))),
            h('div', { className: 'ql-card' }, h('h3', null, t('palette')), h('div', { className: 'ql-swatches' }, Object.keys(palettes).map(key => button(key, () => change({ palette: key }), { key, 'aria-pressed': s.palette === key })))),
            h('div', { className: 'ql-card' }, h('h3', null, t('background')),
              h('div', { className: 'ql-preview' }, h('div', { style: { position: 'absolute', inset: 0, ...artwork(s), filter: `blur(${s.blur}px)` } }), h('span', null, s.image ? s.name : t('empty'))),
              h('input', { ref: fileRef, type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true, onChange: upload }),
              h('div', { className: 'ql-row' }, button('upload', () => fileRef.current?.click()), button('remove', () => { generation.current++; change({ image: '', name: '' }); }, { disabled: !s.image })),
              range('opacity', 25, '%'), range('blur', 16, 'px'),
              h('label', { className: 'ql-row' }, t('fit'), h('select', { value: s.fit, onChange: e => change({ fit: e.target.value }) }, ['cover', 'contain', 'repeat'].map(key => h('option', { key, value: key }, t(key))))),
              h('label', { className: 'ql-row' }, t('pattern'), h('input', { type: 'checkbox', checked: s.pattern, onChange: e => change({ pattern: e.target.checked }) })),
              h('p', { className: 'ql-muted' }, t('privacy'))),
            button('reset', () => { generation.current++; change(defaults); }),
            h('p', { role: 'status', 'aria-live': 'polite', className: message && message !== 'saved' ? 'ql-error' : 'ql-muted' }, message ? t(message) : ''));
        }
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: NS + '-background', order: -100 }, Background));
        ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: NS, order: 5, label: () => t('title') }, Panel));
      },
    };
  },
});
