import { createHash } from 'node:crypto';

export const BASELINE_MAIN_SHA256 = 'f42ed25b0b844a63e515a3aff93dee89b781dae7fcbbbbfc93e04d95ad399ec1';

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Desktop update-policy anchor differs or is duplicated');
  return source.replace(before, after);
}

/** Patch only the reviewed shell settings and update entry points, not Host or account traffic. */
export function patchSource(source) {
  if (createHash('sha256').update(source).digest('hex') !== BASELINE_MAIN_SHA256) throw new Error('Desktop main differs from the reviewed update-policy baseline');
  let result = replaceOnce(source,
    'const defaults = { updates: { allowTestAuthPopupWindow: false } };',
    'const defaults = { updates: { enabled: false, allowTestAuthPopupWindow: false } };');
  result = replaceOnce(result,
    '\t\tconst allow = value.updates?.allowTestAuthPopupWindow;',
    '\t\tconst enabled = value.updates?.enabled;\n\t\tif (enabled !== void 0 && typeof enabled !== "boolean") throw new Error("updates.enabled must be true or false");\n\t\tconst allow = value.updates?.allowTestAuthPopupWindow;');
  result = replaceOnce(result,
    'return { updates: { allowTestAuthPopupWindow: allow ?? false } };',
    'return { updates: { enabled: enabled ?? false, allowTestAuthPopupWindow: allow ?? false } };');
  result = replaceOnce(result,
    '\tconst automaticCheck = () => {\n\t\tif (!quitting)',
    '\tconst automaticCheck = () => {\n\t\tif (!desktopSettings.updates.enabled) return;\n\t\tif (!quitting)');
  result = replaceOnce(result,
    '\tconst openUpdatePrompt = (manual = false) => {\n\t\tif (authenticationOperation !== void 0)',
    '\tconst openUpdatePrompt = (manual = false) => {\n\t\tif (!desktopSettings.updates.enabled) return ordinaryMessageBox({\n\t\t\ttype: "info",\n\t\t\ttitle: locale.id.startsWith("zh") ? "DSH 更新已禁用" : "DSH updates disabled",\n\t\t\tmessage: locale.id.startsWith("zh") ? "当前构建已关闭更新检查、下载和安装。" : "Update checks, downloads and installation are disabled in this build.",\n\t\t\tdetail: locale.id.startsWith("zh") ? "如需重新启用，将 desktop/settings.json 中的 updates.enabled 设为 true，然后正常重启 DSH。" : "To re-enable, set updates.enabled to true in desktop/settings.json and restart DSH normally."\n\t\t});\n\t\tif (authenticationOperation !== void 0)');
  result = replaceOnce(result,
    '\t\t\tlabel: currentDesktopLocale().messages.checkUpdatesMenu,\n\t\t\tclick: () => {',
    '\t\t\tlabel: desktopSettings.updates.enabled ? currentDesktopLocale().messages.checkUpdatesMenu : currentDesktopLocale().id.startsWith("zh") ? "更新已禁用" : "Updates disabled",\n\t\t\tenabled: desktopSettings.updates.enabled,\n\t\t\tclick: () => {');
  result = replaceOnce(result,
    '\tconst policyConfig = resolveDesktopPolicyConfig(app.isPackaged ?',
    '\tconst policyConfig = !desktopSettings.updates.enabled ? void 0 : resolveDesktopPolicyConfig(app.isPackaged ?');
  return result;
}
