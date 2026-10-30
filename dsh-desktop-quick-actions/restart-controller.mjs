// DSH local Desktop patch: main-process-only, no renderer/agent restart authority.
export function restartCopy(locale) {
  const zh = String(locale?.id || '').toLowerCase().startsWith('zh');
  return zh ? {
    menu: '重启应用…', title: '重启 DeepSeek Harness？', restart: '重启应用', cancel: '取消', ok: '确定',
    base: '应用窗口和后台 Host 将关闭后重新启动。请先保存未提交的输入和正在编辑的设置。',
    active: '检测到正在运行的任务：重启会中断这些任务。',
    scheduled: '检测到已启用的定时任务或提醒：应用关闭期间可能暂停，重启后能否继续取决于其恢复规则。',
    changed: '确认期间任务状态发生变化，请重新确认。',
    failedTitle: '尚未重启应用',
    failed: '无法安全确认当前任务状态，已取消本次重启。请稍后重试。',
  } : {
    menu: 'Restart Application…', title: 'Restart DeepSeek Harness?', restart: 'Restart Application', cancel: 'Cancel', ok: 'OK',
    base: 'The application window and its Host will close and start again. Save unsent input and pending settings first.',
    active: 'Running tasks were detected. Restarting will interrupt them.',
    scheduled: 'Scheduled tasks or reminders are armed. They may pause while the app is closed; resumption depends on their recovery rules.',
    changed: 'Task state changed while confirming. Please confirm again.',
    failedTitle: 'Application was not restarted',
    failed: 'Task state could not be checked safely. Restart was cancelled. Please try again later.',
  };
}

export async function finishRestartShutdown(options) {
  const results = await Promise.allSettled(options.cleanup.map(operation => Promise.resolve().then(operation)));
  for (const result of results) if (result.status === 'rejected') options.log?.(result.reason);
  try {
    if (options.shouldRelaunch() && results.every(result => result.status === 'fulfilled')) options.relaunch();
    else if (options.shouldRelaunch()) options.log?.(new Error('Relaunch cancelled because cleanup did not succeed'));
  } catch (error) { options.log?.(error); }
  finally { options.quit(); }
}

export function createRestartController(options) {
  let pending = null, disposed = false;
  const allowed = host => !disposed && options.canProceed() && options.getHost() === host;
  async function inspect(host) {
    let timer;
    try {
      const state = await Promise.race([
        Promise.resolve().then(() => host.inspectQuit()),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Restart inspection timed out')), options.timeoutMs ?? 4000); }),
      ]);
      if (!state || typeof state.activeTasks !== 'boolean' || typeof state.scheduledTasks !== 'boolean') throw new Error('Invalid restart inspection');
      return state;
    } finally { clearTimeout(timer); }
  }
  async function decide() {
    const host = options.getHost();
    if (!host || !allowed(host)) return false;
    try {
      let state = await inspect(host);
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!allowed(host)) return false;
        const copy = restartCopy(options.locale());
        const detail = [copy.base, state.activeTasks && copy.active, state.scheduledTasks && copy.scheduled, attempt > 0 && copy.changed].filter(Boolean).join('\n\n');
        const answer = await options.show({
          type: state.activeTasks || state.scheduledTasks ? 'warning' : 'question',
          title: copy.title, message: copy.title, detail,
          buttons: [copy.restart, copy.cancel], defaultId: 1, cancelId: 1, noLink: true,
        });
        if (answer?.response !== 0 || !allowed(host)) return false;
        const latest = await inspect(host);
        if (!allowed(host)) return false;
        if ((latest.activeTasks && !state.activeTasks) || (latest.scheduledTasks && !state.scheduledTasks)) {
          state = latest; continue;
        }
        // The shell marks a restart intent, then enters its ordinary before-quit path.
        // Relaunch is deliberately not scheduled until owned backend cleanup succeeds.
        options.requestQuit();
        return true;
      }
      throw new Error('Task state kept changing during restart confirmation');
    } catch (error) {
      options.log?.(error);
      if (allowed(host)) {
        const copy = restartCopy(options.locale());
        try { await options.show({ type: 'error', title: copy.failedTitle, message: copy.failed, buttons: [copy.ok], defaultId: 0, cancelId: 0, noLink: true }); }
        catch (showError) { options.log?.(showError); }
      }
      return false;
    }
  }
  return {
    request() {
      if (disposed) return Promise.resolve(false);
      if (pending) { options.focus?.(); return pending; }
      pending = Promise.resolve().then(decide).finally(() => { pending = null; });
      return pending;
    },
    get pending() { return pending !== null; },
    dispose() { disposed = true; },
  };
}
