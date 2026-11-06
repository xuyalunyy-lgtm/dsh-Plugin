import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { win32 } from 'node:path';
import vm from 'node:vm';
import { BASELINE_MAIN_SHA256, patchSource } from '../patch.mjs';

// Extract text only: never import the Electron main entry or touch real settings.
const require = createRequire(new URL('../../../dsh-desktop-quick-actions/package.json', import.meta.url));
const asar = require('@electron/asar');
const archive = fileURLToPath(new URL('../../../../dsh_app/resources/app.asar', import.meta.url));
const original = asar.extractFile(archive, 'lib/main.js').toString('utf8');
const patched = patchSource(original);

function section(source, start, end) {
  const first = source.indexOf(start);
  assert.notEqual(first, -1, `missing start: ${start}`);
  assert.equal(source.indexOf(start, first + start.length), -1, `ambiguous start: ${start}`);
  const last = source.indexOf(end, first + start.length);
  assert.notEqual(last, -1, `missing end: ${end}`);
  return source.slice(first, last);
}
const settingsSource = section(patched, 'function record$1(value) {', '\n//#endregion\n//#region lib/types/locale-cache.js');
const automaticSource = section(patched, '\tconst automaticCheck = () => {', '\n\tpowerMonitor.on("resume", automaticCheck);');
const promptSource = section(patched, '\tconst openUpdatePrompt = (manual = false) => {', '\n\tlet authenticationOperation;');
const ipcSource = section(patched, '\tipcMain.handle(DESKTOP_IPC.updatesOpen, async (event) => {', '\n\tlet promptOperation;');
const policySource = section(patched, '\tconst developmentPolicy = app.isPackaged ?', '\n\tautomaticCheck();');
const menuSource = section(patched, '\t\t{\n\t\t\tlabel: desktopSettings.updates.enabled ?', '\n\t\t...process.platform').trim().replace(/,$/, '');
const plain = value => JSON.parse(JSON.stringify(value));

function settings(raw, { missing = false, readFailure = false } = {}) {
  let text = raw;
  const calls = [];
  const scope = vm.createContext({
    join: win32.join,
    console: { warn: () => calls.push('warn') },
    readFileSync() {
      calls.push('read');
      if (readFailure) throw Object.assign(new Error('unreadable fixture'), { code: 'EACCES' });
      if (missing && text === undefined) throw Object.assign(new Error('missing fixture'), { code: 'ENOENT' });
      return text;
    },
    mkdirSync() { calls.push('mkdir'); },
    writeFileSync(_path, value, options) {
      calls.push('write');
      assert.equal(options.flag, 'wx');
      text = value;
    },
  });
  vm.runInContext(`${settingsSource}\nglobalThis.read = readDesktopSettings;`, scope);
  return { value: plain(scope.read('X:\\isolated-user-data')), calls, text };
}

for (const [name, value, expected] of [
  ['missing updates object', {}, false],
  ['missing enabled field', { updates: { allowTestAuthPopupWindow: true } }, false],
  ['explicit false', { updates: { enabled: false } }, false],
  ['explicit true', { updates: { enabled: true } }, true],
]) {
  test(`settings: ${name}`, () => {
    const result = settings(JSON.stringify(value));
    assert.equal(result.value.updates.enabled, expected);
    assert.equal(result.value.updates.allowTestAuthPopupWindow, value.updates?.allowTestAuthPopupWindow ?? false);
    assert.deepEqual(result.calls, ['read']);
  });
}

test('settings: absent document creates disabled defaults through stub ports only', () => {
  const result = settings(undefined, { missing: true });
  assert.deepEqual(result.value, { updates: { enabled: false, allowTestAuthPopupWindow: false } });
  assert.deepEqual(JSON.parse(result.text), result.value);
  assert.deepEqual(result.calls, ['read', 'mkdir', 'write', 'read']);
});

test('settings: invalid enabled, structure, JSON and unreadable input all remain disabled', () => {
  for (const value of [null, [], { updates: [] }, { updates: { enabled: null } }, { updates: { enabled: 'true' } }, { updates: { enabled: 1 } }, { updates: { enabled: true, allowTestAuthPopupWindow: 'yes' } }]) {
    const result = settings(JSON.stringify(value));
    assert.deepEqual(result.value, { updates: { enabled: false, allowTestAuthPopupWindow: false } });
    assert.deepEqual(result.calls, ['read', 'warn']);
  }
  for (const result of [settings('{'), settings('{}', { readFailure: true })]) {
    assert.equal(result.value.updates.enabled, false);
    assert.deepEqual(result.calls, ['read', 'warn']);
  }
});

for (const [enabled, quitting, expected] of [[false, false, []], [true, false, ['policy:foreground-or-resume', 'update']], [true, true, []]]) {
  test(`automatic check: enabled=${enabled}, quitting=${quitting}`, async () => {
    const calls = [];
    const scope = vm.createContext({
      desktopSettings: { updates: { enabled } }, quitting,
      mandatoryPolicy: { async check(reason) { calls.push(`policy:${reason}`); } },
      updateSchedule: { async check() { calls.push('update'); } },
      console: { error(error) { throw error; } },
    });
    vm.runInContext(`${automaticSource}\nglobalThis.run = automaticCheck;`, scope);
    scope.run();
    await Promise.resolve();
    assert.deepEqual(calls, expected);
  });
}

function promptFixture(enabled, state = { phase: 'idle' }, language = 'zh-CN') {
  const calls = [], notices = [], handlers = new Map();
  const forbidden = name => () => { throw new Error(`unexpected disabled call: ${name}`); };
  const allowed = (name, result) => async (...args) => { calls.push([name, ...args]); return result; };
  const scope = vm.createContext({
    desktopSettings: { updates: { enabled } },
    locale: { id: language, messages: { updateCheckTitle: 'Check updates', updateCurrent: 'Current version', updateCurrentDetail: 'Version {version}' } },
    ordinaryMessageBox: async options => { notices.push(plain(options)); return { response: 0 }; },
    updates: {
      get state() { if (!enabled) return forbidden('state')(); calls.push(['state']); return state; },
      install: enabled ? allowed('install', { phase: 'idle' }) : forbidden('install'),
    },
    updateSchedule: { check: enabled ? allowed('check', state) : forbidden('check') },
    checkPolicyManually: enabled ? allowed('policy') : forbidden('policy'),
    downloadUpdate: enabled ? allowed('download', { phase: 'idle' }) : forbidden('download'),
    showUpdateFailure: enabled ? allowed('showFailure') : forbidden('showFailure'),
    authenticatePolicy: forbidden('authentication'),
    policyAuth: { focus: forbidden('policyFocus') },
    updateDialog: { focus: forbidden('dialogFocus') },
    isMandatory: enabled ? () => false : forbidden('mandatory'),
    currentDialogWindow: enabled ? () => undefined : forbidden('window'),
    ordinaryDialogs: new Set(),
    updateJournal: { action: enabled ? name => calls.push(['journal', name]) : forbidden('journal') },
    flushQueuedPolicyAuthentication: enabled ? () => calls.push(['flushAuthentication']) : forbidden('flushAuthentication'),
    desktopErrorState: forbidden('errorState'),
    formatDesktopMessage: (_template, values) => values.version,
    app: { getVersion: () => '0.2.2-rc.1' },
    AbortController,
    DESKTOP_IPC: { updatesOpen: 'fixture:updates-open' },
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    assertProductSender: event => { assert.equal(event, 'owned-renderer'); calls.push(['sender']); },
  });
  vm.runInContext(`let promptOperation; let authenticationOperation;\n${promptSource}\n${ipcSource}\nglobalThis.open = openUpdatePrompt;`, scope);
  return { calls, notices, open: scope.open, ipc: () => handlers.get('fixture:updates-open')('owned-renderer') };
}

for (const [name, invoke, language] of [
  ['manual menu', fixture => fixture.open(true), 'zh-CN'],
  ['renderer IPC', fixture => fixture.ipc(), 'en'],
]) {
  test(`disabled ${name}: explicit info, no state read, policy, check, download or install`, async () => {
    const fixture = promptFixture(false, { phase: 'ready', version: 'new' }, language);
    await invoke(fixture);
    assert.deepEqual(fixture.calls, name === 'renderer IPC' ? [['sender']] : []);
    assert.equal(fixture.notices.length, 1);
    assert.equal(fixture.notices[0].type, 'info');
    assert.match(fixture.notices[0].title, /禁用|disabled/i);
    assert.match(fixture.notices[0].message, /关闭更新检查、下载和安装|checks, downloads and installation are disabled/);
    assert.match(fixture.notices[0].detail, /updates\.enabled.*true/);
  });
}

test('enabled manual check retains policy and update check then current-version info', async () => {
  const fixture = promptFixture(true);
  await fixture.open(true);
  assert.ok(fixture.calls.some(row => row[0] === 'policy' && row[1] === 'deferred'));
  assert.ok(fixture.calls.some(row => row[0] === 'check' && row[1] === true));
  assert.equal(fixture.notices[0].message, 'Current version');
});

test('enabled renderer IPC retains the ordinary idle-state update check', async () => {
  const fixture = promptFixture(true);
  await fixture.ipc();
  assert.deepEqual(fixture.calls[0], ['sender']);
  assert.ok(fixture.calls.some(row => row[0] === 'check' && row[1] === true));
});

for (const [phase, operation] of [['available', 'download'], ['ready', 'install']]) {
  test(`enabled existing ${phase} state retains ${operation}`, async () => {
    const fixture = promptFixture(true, { phase, version: 'fixture-version' });
    await fixture.open();
    assert.ok(fixture.calls.some(row => row[0] === operation && row[1] === 'fixture-version'));
    assert.ok(!fixture.calls.some(row => row[0] === 'check'));
  });
}

function policyFixture(enabled, { packaged = true, malformed = false } = {}) {
  const calls = [];
  const config = { authentication: 'anonymous', origin: 'https://fixture.invalid', allowedPageOrigins: ['https://fixture.invalid'] };
  const scope = vm.createContext({
    desktopSettings: { updates: { enabled } },
    app: { isPackaged: packaged, getVersion: () => 'fixture-version' },
    process: { env: { DSH_DESKTOP_MANDATORY_UPDATE_CONFIG: malformed ? '{' : JSON.stringify(config) }, platform: 'win32', arch: 'x64' },
    manifest: { get dshMandatoryUpdatePolicy() { calls.push('manifest'); if (malformed) throw new Error('fixture bad manifest'); return config; } },
    resolveDesktopPolicyConfig(value) { calls.push('resolve'); return value; },
    resources: { dsh: 'fixture-runtime' }, readDesktopRuntime: () => ({ release: { version: 'fixture-version' } }),
    updateChannel: 'fixture-channel', locale: { id: 'zh-CN' },
    DesktopMandatoryUpdatePolicy: class {
      constructor() { calls.push('construct-policy'); }
      async check(reason) { calls.push(`check:${reason}`); return {}; }
    },
    DesktopMandatoryUpdateWindow: class { constructor() { calls.push('construct-window'); } },
    DesktopPolicyTestAuth: class { constructor() { throw new Error('unexpected auth construction'); } },
    updateOverlays: {}, fileURLToPath: () => 'fixture-preload', URL,
    currentDialogWindow: () => undefined,
    downloadUpdate: () => { throw new Error('unexpected download'); },
    isQuitting: () => false,
    console: { error(error) { throw error; } },
  });
  return {
    calls,
    run() {
      vm.runInContext(`let mandatoryPolicy, mandatoryUI, policyAuth; let policyAuthenticationQueued = false;\n${policySource.replaceAll('import.meta.url', '"file:///fixture/main.js"')}\nglobalThis.policy = mandatoryPolicy;`, scope);
      return scope.policy;
    },
  };
}

for (const packaged of [true, false]) {
  test(`disabled policy: packaged=${packaged}, malformed configuration is neither parsed nor constructed`, () => {
    const fixture = policyFixture(false, { packaged, malformed: true });
    assert.equal(fixture.run(), undefined);
    assert.deepEqual(fixture.calls, []);
  });
}

test('enabled policy preserves configuration resolution, construction and launch check', async () => {
  const fixture = policyFixture(true);
  assert.ok(fixture.run());
  await Promise.resolve();
  assert.deepEqual(fixture.calls, ['manifest', 'resolve', 'construct-policy', 'construct-window', 'check:launch']);
});

test('enabled development policy still parses and rejects malformed JSON', () => {
  const fixture = policyFixture(true, { packaged: false, malformed: true });
  assert.throws(() => fixture.run(), /JSON|property name/i);
  assert.deepEqual(fixture.calls, []);
});

for (const [enabled, language, label] of [[false, 'zh-CN', '更新已禁用'], [false, 'en', 'Updates disabled'], [true, 'zh-CN', 'Original check label']]) {
  test(`menu: enabled=${enabled}, language=${language}`, () => {
    const calls = [];
    const menu = vm.runInNewContext(`(${menuSource})`, {
      desktopSettings: { updates: { enabled } },
      currentDesktopLocale: () => ({ id: language, messages: { checkUpdatesMenu: 'Original check label' } }),
      openUpdatePrompt: manual => calls.push(manual),
    });
    assert.equal(menu.label, label);
    assert.equal(menu.enabled, enabled);
    if (enabled) { menu.click(); assert.deepEqual(calls, [true]); }
  });
}

test('transform accepts only the precise baseline and preserves download/install opt-in flags', () => {
  assert.equal(createHash('sha256').update(original).digest('hex'), BASELINE_MAIN_SHA256);
  assert.notEqual(patched, original);
  for (const line of ['this.updater.autoDownload = false;', 'this.updater.autoInstallOnAppQuit = false;']) {
    assert.ok(original.includes(line));
    assert.equal(patched.split(line).length, original.split(line).length);
  }
  assert.throws(() => patchSource(patched), /baseline/);
  assert.throws(() => patchSource(original.replace('const automaticCheck = () => {', 'const automaticCheckChanged = () => {')), /baseline|anchor/);
  assert.throws(() => patchSource(original + '\nconst automaticCheck = () => {};\n'), /baseline|anchor/);
});
