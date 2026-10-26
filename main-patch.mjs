import { readFileSync } from 'node:fs';
export const BASELINE_MAIN_SHA256 = 'f05dd366f6c468bedd83f07372bc59d3d6b3f6bcc6950565c8b4173597e3ba93';
export const PATCH_MARKER = '// DSH_DESKTOP_SAFE_RESTART_PATCH_v1';
function once(source, before, after) {
  const at = source.indexOf(before);
  if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('Desktop patch context mismatch: ' + before.slice(0, 100));
  return source.slice(0, at) + after + source.slice(at + before.length);
}
export function patchMain(original) {
  if (original.includes(PATCH_MARKER)) throw new Error('Desktop restart patch already applied');
  let source = original;
  const controller = readFileSync(new URL('./restart-controller.mjs', import.meta.url), 'utf8').replaceAll('export function ', 'function ').replaceAll('export async function ', 'async function ');
  source = once(source, 'async function main() {', PATCH_MARKER + '\n' + controller + '\nasync function main() {');
  source = once(source, '\tlet quitting = false;\n\tlet startup;', '\tlet quitting = false;\n\tlet restartRequested = false;\n\tlet startup;');
  const oldDevMenu = `\t\t...development ? [
\t\t\t{ type: "separator" },
\t\t\t{
\t\t\t\tlabel: currentDesktopLocale().messages.reloadPageMenu,
\t\t\t\trole: "reload"
\t\t\t},
\t\t\t{
\t\t\t\tlabel: currentDesktopLocale().messages.restartAppHostMenu,
\t\t\t\tclick: () => {
\t\t\t\t\tif (quitting) return;
\t\t\t\t\tapp.relaunch();
\t\t\t\t\tquitWithoutConfirmation();
\t\t\t\t}
\t\t\t}
\t\t] : [],`;
  const newMenu = `\t\t{ type: "separator" },
\t\t{
\t\t\tlabel: restartCopy(currentDesktopLocale()).menu,
\t\t\tclick: () => { void restartController.request(); }
\t\t},
\t\t...development ? [{
\t\t\tlabel: currentDesktopLocale().messages.reloadPageMenu,
\t\t\trole: "reload"
\t\t}] : [],`;
  source = once(source, oldDevMenu, newMenu);
  const controllerInit = `\tconst restartController = createRestartController({
\t\tlocale: currentDesktopLocale,
\t\tgetHost: () => backend.host,
\t\tcanProceed: () => !quitting && !shuttingDown && !sessionEnding && !shellInstallerOwnsQuit && updateState.phase !== "installing" && !isMandatory() && !ordinaryDialogs.size && !quitConfirmation?.pending,
\t\tshow: async (options) => {
\t\t\tconst parent = currentDialogWindow();
\t\t\tif (parent === void 0 || parent.isDestroyed()) return { response: options.cancelId ?? 1 };
\t\t\tconst controller = new AbortController();
\t\t\tordinaryDialogs.add(controller);
\t\t\ttry {
\t\t\t\tconst answer = await dialog.showMessageBox(parent, options);
\t\t\t\treturn controller.signal.aborted ? { response: options.cancelId ?? 1 } : answer;
\t\t\t} finally { ordinaryDialogs.delete(controller); }
\t\t},
\t\tfocus: () => { const window = currentDialogWindow(); if (window !== void 0 && !window.isDestroyed()) { window.show(); window.focus(); } },
\t\tlog: (error) => console.error("desktop restart:", error),
\t\trequestQuit: () => { restartRequested = true; app.quit(); }
\t});
`;
  // Called only by menu events after main() has finished binding quitConfirmation.
  source = once(source, '\tconst applicationItems = () => [', controllerInit + '\tconst applicationItems = () => [');
  source = once(source, '\t\tquitConfirmation.dispose();\n\t\tbackgroundNotice?.dispose();', '\t\trestartController.dispose();\n\t\tquitConfirmation.dispose();\n\t\tbackgroundNotice?.dispose();');
  const oldFinish = `\t\tPromise.all([
\t\t\tPromise.resolve(mandatoryPolicy?.dispose()).then(() => policyAuth?.dispose()),
\t\t\tbackend.close(),
\t\t\tplatformView.dispose().catch((error) => {
\t\t\t\tconsole.error(error);
\t\t\t})
\t\t]).catch((error) => {
\t\t\tconsole.error(error);
\t\t}).finally(() => {
\t\t\tapp.quit();
\t\t});`;
  const newFinish = `\t\tif (restartRequested) {
\t\t\trequireCleanStop = true;
\t\t\tupdateStopFailure = void 0;
\t\t}
\t\tvoid finishRestartShutdown({
\t\t\tcleanup: [
\t\t\t\t() => Promise.resolve(mandatoryPolicy?.dispose()).then(() => policyAuth?.dispose()),
\t\t\t\tasync () => { await backend.close(); if (restartRequested && updateStopFailure !== void 0) throw updateStopFailure; },
\t\t\t\t() => platformView.dispose()
\t\t\t],
\t\t\tshouldRelaunch: () => restartRequested && !shellInstallerOwnsQuit && !sessionEnding,
\t\t\trelaunch: () => app.relaunch(),
\t\t\tquit: () => app.quit(),
\t\t\tlog: (error) => console.error("desktop shutdown:", error)
\t\t});`;
  source = once(source, oldFinish, newFinish);
  source = once(source, '\t\tif (shellInstallerOwnsQuit) {\n\t\t\tshuttingDown = true;', '\t\tif (shellInstallerOwnsQuit) {\n\t\t\trestartRequested = false;\n\t\t\trestartController.dispose();\n\t\t\tshuttingDown = true;');
  const beforeQuit = `\t\tif (skipQuitConfirmation || sessionEnding) {
\t\t\tfinishQuit();
\t\t\treturn;
\t\t}`;
  const newBeforeQuit = `\t\tif (sessionEnding) restartRequested = false;
\t\tif (restartRequested) {
\t\t\tif (updateState.phase === "installing" || isMandatory()) { restartRequested = false; return; }
\t\t\tfinishQuit();
\t\t\treturn;
\t\t}
\t\tif (restartController.pending && !sessionEnding && !skipQuitConfirmation) return;
\t\tif (skipQuitConfirmation || sessionEnding) {
\t\t\tfinishQuit();
\t\t\treturn;
\t\t}`;
  source = once(source, beforeQuit, newBeforeQuit);
  return source;
}
