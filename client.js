window.__ModuleLoader__.load({
  id: 'dsh-focus-calendar',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const zh = {
      title:'专注日历', subtitle:'安排好今天，一次专注一件事。', back:'返回聊天', today:'今天', prev:'上个月', next:'下个月', prevDay:'前一天', nextDay:'后一天', selectedDate:'查看日期',
      tasks:'每日安排', empty:'这一天还没有安排，先添加一件重要的事。', noPending:'这一天的任务都完成了，做得不错！', noCompleted:'还没有已完成任务。', taskTitle:'要做的事情', time:'时间（可选）', add:'添加待办', save:'保存修改', cancel:'取消', edit:'编辑 / 改日期', remove:'删除', confirmDelete:'确认删除', complete:'标记完成', undo:'标记未完成',
      all:'全部', pending:'未完成', completed:'已完成', filter:'筛选任务', newTask:'新增待办', editing:'正在编辑', targetDate:'安排日期 / 移动到', editHint:'修改日期后保存，即可将任务移到那一天。', enterHint:'回车添加，添加后可继续输入；中文选词不会提交。', draftHint:'草稿保留在当前标签页，切换日期、关闭面板或刷新后可继续。关闭标签页或换设备不保留。', draftMemory:'浏览器草稿存储不可用，当前仅在内存中保留；刷新或退出可能丢失。', draftBadge:'未提交草稿', exitEdit:'退出编辑', deleted:'已删除', added:'已添加到', updated:'已保存到', moved:'已移动到', showDate:'查看该日期', allDay:'未设时间', dateProgress:'完成 / 总数', legend:'下方数字为完成数 / 总数；今天有文字标记，选中日期有边框。', saving:'正在保存…', missingTask:'原任务已被删除或不可用，草稿仍保留。', saveAsNew:'另存为新待办', dismiss:'关闭提示',
      focus:'专注计时', focusHint:'一次只做一件事，结束后休息一下。', start:'开始专注', pause:'暂停', resume:'继续', reset:'重置', rest:'开始休息', idle:'准备开始', running:'专注中', paused:'已暂停', breaking:'休息中',
      reminders:'健康休息提醒', eye:'休息眼睛', body:'活动身体', enable:'开启', disable:'关闭', off:'未开启', minutes:'分钟', interval:'每隔',
      settings:'时间设置', focusMinutes:'每次专注', eyeMinutes:'护眼间隔', bodyMinutes:'活动间隔', breakMinutes:'短休息', settingsHint:'1–240 分钟；保存后在下次启动或下一周期生效。',
      notify:'允许系统通知', granted:'系统通知已允许', denied:'系统通知未获允许，请在浏览器权限中设置；页面内仍会提醒。', unsupported:'此环境不支持系统通知，页面内提醒仍可用。',
      eyeAlert:'让眼睛休息一下：看看远处约 20 秒，放松视线。', bodyAlert:'起身走动一下，轻轻活动肩颈和身体。', focusAlert:'本次专注完成！可以休息一下了。', breakAlert:'休息结束，准备好后再开始下一次专注。', ack:'知道了', open:'打开日历',
      noteTitle:'使用说明', note:'已保存的待办和设置在本机跨会话共享。关闭此面板不会停止计时。系统通知需要 DSH 和页面运行，电脑休眠时不能准时弹出，恢复后显示未确认提醒。待办时间仅用于排序，不单独触发通知。',
      loading:'正在读取日历…', error:'操作失败', syncError:'状态同步失败', retry:'重试', saved:'已保存', remaining:'剩余', shortcut:'Alt + Shift + F 打开日历', weekdays:'一 二 三 四 五 六 日', timezone:'日期按本机时区显示', stopFirst:'请先重置当前计时，再开始休息',
    };
    const en = {
      title:'Focus Calendar', subtitle:'Plan your day. Focus on one thing at a time.', back:'Back to chat', today:'Today', prev:'Previous month', next:'Next month', prevDay:'Previous day', nextDay:'Next day', selectedDate:'Selected date',
      tasks:'Daily plan', empty:'Nothing planned yet. Add one important task.', noPending:'All tasks for this day are complete. Well done!', noCompleted:'No completed tasks yet.', taskTitle:'What needs doing?', time:'Time (optional)', add:'Add task', save:'Save changes', cancel:'Cancel', edit:'Edit / change date', remove:'Delete', confirmDelete:'Confirm delete', complete:'Mark complete', undo:'Mark incomplete',
      all:'All', pending:'To do', completed:'Done', filter:'Filter tasks', newTask:'New task', editing:'Editing task', targetDate:'Scheduled date / move to', editHint:'Change the date and save to move this task.', enterHint:'Enter adds a task and lets you keep typing. IME candidate selection does not submit.', draftHint:'Drafts stay in this tab across date changes, panel closure and refresh. Closing the tab or changing devices does not preserve drafts.', draftMemory:'Browser draft storage is unavailable. Drafts are in memory only and may be lost on refresh or exit.', draftBadge:'Unsaved draft', exitEdit:'Leave editor', deleted:'Deleted', added:'Added to', updated:'Saved to', moved:'Moved to', showDate:'View that day', allDay:'No time set', dateProgress:'Done / total', legend:'Day counts show done / total. Today has a label; the selected day has a border.', saving:'Saving…', missingTask:'The original task is no longer available. Your draft is preserved.', saveAsNew:'Save as a new task', dismiss:'Dismiss notice',
      focus:'Focus timer', focusHint:'One thing at a time. Take a break when you finish.', start:'Start focus', pause:'Pause', resume:'Resume', reset:'Reset', rest:'Take a break', idle:'Ready', running:'Focusing', paused:'Paused', breaking:'On a break',
      reminders:'Healthy break reminders', eye:'Rest your eyes', body:'Move your body', enable:'Enable', disable:'Disable', off:'Off', minutes:'min', interval:'Every',
      settings:'Timer settings', focusMinutes:'Focus duration', eyeMinutes:'Eye-rest interval', bodyMinutes:'Movement interval', breakMinutes:'Short break', settingsHint:'1–240 minutes. Changes apply on the next start or cycle.',
      notify:'Allow system notifications', granted:'System notifications allowed', denied:'Notifications are not allowed. Check browser permissions; in-page reminders still work.', unsupported:'System notifications are unavailable. In-page reminders still work.',
      eyeAlert:'Rest your eyes: look into the distance for about 20 seconds.', bodyAlert:'Stand up, walk around, and gently move your shoulders and body.', focusAlert:'Focus session complete! Time for a break.', breakAlert:'Break complete. Start another focus session when ready.', ack:'Got it', open:'Open calendar',
      noteTitle:'How it works', note:'Saved tasks and settings are stored locally and shared across sessions. Closing this panel does not stop timers. System notifications require DSH and this page to stay running. Sleeping computers cannot notify on time; pending reminders appear on return. Task times sort the plan but do not trigger notifications.',
      loading:'Loading calendar…', error:'Operation failed', syncError:'State sync failed', retry:'Retry', saved:'Saved', remaining:'Remaining', shortcut:'Alt + Shift + F opens the calendar', weekdays:'Mo Tu We Th Fr Sa Su', timezone:'Dates use the local time zone', stopFirst:'Reset the current timer before starting a break',
    };
    Object.assign(zh, {
      backupTitle:'备份与恢复', exportBackup:'导出 JSON 备份', backupFile:'选择备份 JSON（最大 4 MiB）', backupLocal:'仅在本机处理与下载，不发送到外部服务。未提交草稿不包含在备份中。', previewBackup:'验证并预览', importBackup:'确认导入', importMerge:'合并', importReplace:'替换', mergeHint:'合并保留本机冲突任务和本机设置，仅加入未冲突记录。', importStop:'两种导入模式都会停止专注计时和健康提醒，并清除待显示/延后的提醒。', replaceHint:'替换将覆盖当前任务、回收站和设置；系统会先自动保留一份旧数据恢复副本。', replaceConfirm:'我确认用这份备份替换当前任务、回收站和设置。', previewCounts:'导入预览', backupTasks:'任务数', backupTrash:'回收站记录数', backupRange:'任务日期范围', backupAdded:'可新增记录', backupConflicts:'冲突记录', backupDuplicates:'重复记录', backupSettings:'备份中的设置', previewScope:'新增 / 冲突 / 重复计数包含任务和回收站记录。导入不会延长回收站原 30 天保留期限，已过期记录会过滤。', imported:'导入完成。当前标签页的未提交草稿仍然保留。', invalidBackup:'不是有效的专注日历 v1 备份。', backupTooLarge:'文件不能超过 4 MiB。', backupReadFailed:'读取 JSON 失败，请检查文件。', recoveryTitle:'自动保留的旧恢复副本', recoveryPreview:'预览恢复副本（替换模式）', recoveryHint:'只预览，不会立即恢复；仍需确认替换。', recoveryMissing:'尚无旧恢复副本。', fileReady:'备份已选中，请验证并预览。', previewRequired:'文件或模式改变后需要重新预览。', downloaded:'备份已交给浏览器下载。',
      trashTitle:'回收站', trashEmpty:'回收站为空。', trashHint:'删除的任务保留 30 天，之后自动过期。导入不会延长原保留期限，过期记录会被过滤。恢复沿用任务原始数据。', deletedAt:'删除时间', retention:'剩余保留天数', restore:'恢复任务', restored:'已恢复到', undoDelete:'撤销删除', purge:'永久删除', purgeConfirm:'确认永久删除', purgeWarning:'永久删除后无法撤销。', purged:'已永久删除',
      focusTask:'专注此任务', currentTask:'当前专注任务', unlinkedFocus:'未关联任务', focusTotal:'累计专注', focusRounds:'完成轮数', focusSegment:'本段进行中', continueFocus:'继续专注', finishTask:'标记任务完成', focusUnavailable:'请先结束或重置当前计时；已完成任务不能开始专注。', taskUnavailable:'关联任务已不存在或已完成。', snooze5:'稍后 5 分钟', snooze10:'稍后 10 分钟', snoozedTitle:'已延后提醒', snoozedHint:'延后期间不重复通知，到期后重新提醒。', noRange:'无日期',
    });
    Object.assign(en, {
      backupTitle:'Backup & restore', exportBackup:'Export JSON backup', backupFile:'Choose backup JSON (up to 4 MiB)', backupLocal:'Processed and downloaded locally; never sent to external services. Unsaved drafts are not included.', previewBackup:'Validate & preview', importBackup:'Confirm import', importMerge:'Merge', importReplace:'Replace', mergeHint:'Merge keeps local conflicting records and local settings, adding only non-conflicting records.', importStop:'Both modes stop focus timers and health reminders, and clear pending and snoozed alerts.', replaceHint:'Replace overwrites tasks, trash and settings. A recovery copy of the previous data is saved automatically first.', replaceConfirm:'I confirm replacing current tasks, trash and settings with this backup.', previewCounts:'Import preview', backupTasks:'Tasks', backupTrash:'Trash records', backupRange:'Task date range', backupAdded:'New records', backupConflicts:'Conflicts', backupDuplicates:'Duplicates', backupSettings:'Settings in backup', previewScope:'New/conflict/duplicate counts include both tasks and trash records. Import does not extend the original 30-day trash retention; expired records are filtered out.', imported:'Import complete. Unsaved drafts in this tab have been preserved.', invalidBackup:'Not a valid Focus Calendar v1 backup.', backupTooLarge:'The file must not exceed 4 MiB.', backupReadFailed:'Could not read JSON. Check the file.', recoveryTitle:'Previous recovery copy', recoveryPreview:'Preview recovery copy (replace mode)', recoveryHint:'Preview only. Replacement confirmation is still required.', recoveryMissing:'No previous recovery copy yet.', fileReady:'Backup selected. Validate and preview before importing.', previewRequired:'Changing the file or mode requires a fresh preview.', downloaded:'Backup handed to the browser for download.',
      trashTitle:'Trash', trashEmpty:'Trash is empty.', trashHint:'Deleted tasks are retained for 30 days, then expire automatically. Import does not extend the original retention period; expired records are filtered out. Restore uses the original task data.', deletedAt:'Deleted', retention:'Retention days remaining', restore:'Restore task', restored:'Restored to', undoDelete:'Undo deletion', purge:'Delete permanently', purgeConfirm:'Confirm permanent deletion', purgeWarning:'Permanent deletion cannot be undone.', purged:'Permanently deleted',
      focusTask:'Focus on task', currentTask:'Current focus task', unlinkedFocus:'No task linked', focusTotal:'Total focus', focusRounds:'Completed rounds', focusSegment:'Current segment', continueFocus:'Continue focusing', finishTask:'Mark task complete', focusUnavailable:'Finish or reset the current timer first. Completed tasks cannot start focus.', taskUnavailable:'The linked task is missing or complete.', snooze5:'Snooze 5 min', snooze10:'Snooze 10 min', snoozedTitle:'Snoozed reminders', snoozedHint:'No repeat notification while snoozed. It will reappear when due.', noRange:'No dates',
    });
    Object.assign(zh,{pendingWrite:'保存结果待确认：只能重试原请求，不能修改其内容。',retryOriginal:'重试原请求 / 确认结果',pendingWrites:'待确认的任务操作',journalUnavailable:'无法保存请求凭证，操作未发送。请允许此标签页存储后重试。',journalFull:'待确认请求已达256条，请先处理现有请求。',writeExpired:'此请求已超过7天防重复保留期，不能自动重试。请先核对任务列表。',releaseChecked:'我已核对列表，了解原操作可能已成功，解除此请求锁。',releaseRequest:'确认解除请求锁',conflictDraft:'原任务已改变或草稿缺少版本信息。不会覆盖他人修改；本地草稿已保留。',reloadOriginal:'用最新任务替换草稿',reloadConfirm:'确认丢弃本地修改并加载最新任务',copyNew:'另存为新待办',newerUnsaved:'原请求已确认，但较新的草稿修改尚未保存，请核对后再次保存。',confirmedSave:'已确认原请求保存成功',writePolicy:'任务写入防重复回执保留7天（最多4096条）。凭证仅在当前标签页保存；关闭标签页、换设备或超过保留期前请确认结果。',writeFailed:'保存失败，草稿保留；请检查提示后重试。'});
    Object.assign(en,{pendingWrite:'Save result unknown. Retry only the original request; its content is locked.',retryOriginal:'Retry original / confirm result',pendingWrites:'Unconfirmed task operations',journalUnavailable:'Could not persist the request receipt. Nothing was sent. Allow tab storage and retry.',journalFull:'256 pending requests reached. Resolve existing requests first.',writeExpired:'The 7-day deduplication window has elapsed. Automatic retry is blocked. Check your task list first.',releaseChecked:'I checked the task list and understand the original operation may have succeeded. Release this request lock.',releaseRequest:'Confirm releasing request lock',conflictDraft:'The original task changed or this draft has no baseline. Your draft is preserved; other edits will not be overwritten.',reloadOriginal:'Replace draft with latest task',reloadConfirm:'Discard local edits and load latest task',copyNew:'Save as a new task',newerUnsaved:'The original request is confirmed, but newer draft changes are not saved. Review and save again.',confirmedSave:'Original save confirmed',writePolicy:'Successful write receipts last 7 days (maximum 4096). Pending requests are stored in this tab only. Confirm results before closing the tab, changing devices or expiry.',writeFailed:'Save failed. Your draft is preserved; review the error before retrying.'});
    const css = `
.fc{height:100%;overflow:auto;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-family:inherit;font-size:14px;line-height:1.5;padding:20px clamp(12px,2.5vw,32px)}
.fc *,.fc-toast *{box-sizing:border-box}.fc-wrap{max-width:1120px;margin:auto}.fc-head,.fc-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.fc-head{justify-content:space-between;margin-bottom:16px}.fc h1{font-size:24px;font-weight:650;margin:0 0 3px}.fc h2{font-size:16px;font-weight:600;margin:0}.fc p{margin:7px 0 12px}.fc-muted{color:var(--dsw-alias-label-secondary);font-size:12px}.fc-grid{display:grid;grid-template-columns:minmax(300px,1.45fr) minmax(240px,1fr);gap:16px;align-items:start}.fc-stack{display:grid;gap:16px;min-width:0}.fc-card{padding:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);min-width:0}
.fc button,.fc input,.fc-toast button{font:inherit;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);padding:6px 10px;min-height:34px;max-width:100%}.fc button,.fc-toast button{cursor:pointer}.fc button:hover,.fc-toast button:hover{background:var(--dsw-alias-interactive-bg-hover)}.fc button:disabled,.fc input:disabled,.fc button[aria-disabled=true],.fc-toast button:disabled{opacity:.5;cursor:default}.fc button:focus-visible,.fc input:focus-visible,.fc summary:focus-visible,.fc-toast button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.fc .fc-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);font-weight:600}.fc-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin-top:10px}.fc-week{text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px;padding:2px}.fc .fc-day{min-height:56px;padding:4px 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;border-color:transparent}.fc .fc-day[data-selected=true]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}.fc .fc-day[data-today=true]{font-weight:750}.fc-day small{font-size:10px;line-height:12px;color:var(--dsw-alias-label-secondary)}.fc .fc-day[data-complete=true] small{color:var(--dsw-alias-state-success-primary)}.fc-day em{font-size:9px;line-height:11px;font-style:normal;color:var(--dsw-alias-brand-primary)}
.fc-datebar{margin-top:12px}.fc-datebar input{flex:1;min-width:130px}.fc-timer{font-size:46px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:2px;margin:10px 0}.fc-status{font-size:12px;color:var(--dsw-alias-brand-primary)}.fc-task{padding:11px 0;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:9px;align-items:flex-start;flex-wrap:wrap}.fc-task[data-editing=true]{border-left:3px solid var(--dsw-alias-brand-primary);padding-left:8px}.fc-task input[type=checkbox]{min-height:18px;width:18px;height:18px;margin-top:3px;accent-color:var(--dsw-alias-brand-primary)}.fc-task-text{flex:1;min-width:100px;overflow-wrap:anywhere}.fc-task-text[data-done=true]{text-decoration:line-through;color:var(--dsw-alias-label-secondary)}.fc-task-actions{display:flex;gap:5px;flex-wrap:wrap}.fc .fc-small{font-size:12px;padding:4px 7px;min-height:30px}.fc-form{display:grid;gap:9px;margin:12px 0 16px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}.fc-form[data-editing=true]{border-color:var(--dsw-alias-brand-primary)}.fc-form input{min-width:0;width:100%}.fc-form label,.fc-settings label{display:grid;gap:4px;font-size:12px}.fc-form-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fc-form .fc-hint{margin:0}.fc-form-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.fc-settings{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fc-health{padding:10px 0;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;justify-content:space-between;align-items:center;gap:10px}.fc-filter{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.fc-filter button[aria-pressed=true]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}.fc-progress{height:5px;width:100%;display:block;accent-color:var(--dsw-alias-state-success-primary);margin:8px 0 12px}.fc-notice{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 10px;margin-bottom:12px;overflow-wrap:anywhere}.fc-notice-text{flex:1;min-width:0}.fc-error{color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}.fc-badge{font-size:11px;color:var(--dsw-alias-brand-primary)}.fc-footer{margin-top:18px}.fc-footer summary,.fc-card summary{cursor:pointer}.fc-toast{position:fixed;right:20px;top:70px;width:min(360px,calc(100vw - 40px));max-height:70vh;overflow:auto;pointer-events:auto;color:var(--dsw-alias-label-primary);font-size:14px}.fc-toast article{border:1px solid var(--dsw-alias-brand-primary);border-radius:12px;background:var(--dsw-alias-bg-overlay);padding:16px;margin-bottom:10px}.fc-toast p{margin:8px 0 14px}.fc-toast .fc-row{display:flex;gap:8px;flex-wrap:wrap}@media(max-width:760px){.fc-grid{grid-template-columns:1fr}.fc{padding:12px}.fc-card{padding:12px}.fc-task-actions{margin-left:auto}}@media(max-width:380px){.fc-form-fields,.fc-settings{grid-template-columns:1fr}}
`;

    const featureCss=`.fc-backup-file{display:grid;gap:6px;margin:14px 0;font-size:12px}.fc-backup-modes{margin:10px 0}.fc-backup-modes label,.fc-confirm{display:flex;align-items:flex-start;gap:7px;font-size:12px}.fc-backup-modes input,.fc-confirm input{width:16px;height:16px;min-height:16px;margin-top:2px;accent-color:var(--dsw-alias-brand-primary)}.fc-confirm{margin:12px 0}.fc-preview,.fc-recovery{margin-top:14px;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l1)}.fc-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}.fc-metrics dt{font-size:12px;color:var(--dsw-alias-label-secondary)}.fc-metrics dd{margin:0;font-variant-numeric:tabular-nums}.fc-trash-row{padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l1);overflow-wrap:anywhere}.fc-trash-row .fc-row{margin-top:8px}.fc-snoozed{margin-top:12px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:10px}.fc-task-focus{font-size:11px;color:var(--dsw-alias-label-secondary)}.fc-current-task{overflow-wrap:anywhere;margin:6px 0}.fc-toast .fc-alert-actions{margin-top:8px}`;

    // BEGIN PURE HELPERS — exercised directly by Node tests, without a DOM.
    const dayKey = d => `${String(d.getFullYear()).padStart(4,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    function localDate(key) {
      if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
      const [y,m,d] = key.split('-').map(Number);
      if (y < 1 || y > 9999) return null;
      const result = new Date(2000,0,1,12);
      result.setFullYear(y,m-1,d);
      return dayKey(result) === key ? result : null;
    }
    function shiftDate(key, days) {
      const date = localDate(key); if (!date) return key;
      date.setDate(date.getDate()+days);
      return date.getFullYear() >= 1 && date.getFullYear() <= 9999 ? dayKey(date) : key;
    }
    function shiftMonth(key, count) {
      const date = localDate(key); if (!date) return key;
      const day = date.getDate(); date.setDate(1); date.setMonth(date.getMonth()+count);
      if (date.getFullYear() < 1 || date.getFullYear() > 9999) return key;
      const end = new Date(date); end.setMonth(end.getMonth()+1,0);
      date.setDate(Math.min(day,end.getDate())); return dayKey(date);
    }
    function selectTasks(tasks, date, filter='all') {
      return tasks.filter(task => task.date === date && (filter === 'all' || (filter === 'done' ? task.done : !task.done)))
        .sort((a,b) => Number(a.done)-Number(b.done) || (a.time || '99:99').localeCompare(b.time || '99:99'));
    }
    function dayStats(tasks) {
      const result = Object.create(null);
      for (const task of tasks) { const entry = result[task.date] ||= {total:0,done:0}; entry.total++; if (task.done) entry.done++; }
      return result;
    }
    function composingEnter(event, composing, endedAt, now) {
      return event.key === 'Enter' && (composing || event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229 || event.nativeEvent?.keyCode === 229 || now-endedAt < 80);
    }
    const emptyDraft = date => ({title:'',time:'',date});
    const sameDraft = (a,b) => !!a && !!b && a.title === b.title && a.time === b.time && a.date === b.date;
    function createDraftStore(storage, today) {
      const storageKey = 'dsh-focus-calendar.drafts.v1';
      const validDraft = d => d && typeof d.title === 'string' && d.title.length <= 200 && localDate(d.date) && typeof d.time === 'string' && (d.time === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(d.time));
      let drafts = Object.create(null), view = {date:today,filter:'all',editing:null}, persistent = !!storage;
      try {
        const raw = storage?.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.version !== 1 || !saved.drafts || typeof saved.drafts !== 'object') throw Error('Invalid draft data');
          for (const [key,value] of Object.entries(saved.drafts)) {
            if ((key.startsWith('new:') && localDate(key.slice(4)) || key.startsWith('edit:') && key.length > 5) && validDraft(value)) drafts[key] = {...value};
          }
          if (localDate(saved.view?.date)) view.date = saved.view.date;
          if (['all','pending','done'].includes(saved.view?.filter)) view.filter = saved.view.filter;
          if (typeof saved.view?.editing === 'string' && drafts['edit:'+saved.view.editing]) view.editing = saved.view.editing;
        }
      } catch { persistent = false; }
      let revision=0;
      const watchers=new Set();
      const persist = () => {
        try { if (!storage) throw Error('No storage'); storage.setItem(storageKey,JSON.stringify({version:1,view,drafts})); persistent=true; } catch { persistent=false; }
        revision++;watchers.forEach(fn=>fn());
      };
      return {
        subscribe(fn){watchers.add(fn);return()=>watchers.delete(fn);},
        getSnapshot:()=>revision,
        get persistent(){return persistent;},
        getView:()=>({...view}),
        setView(patch){view={...view,...patch};persist();},
        get(key,fallback){return {...(drafts[key] || fallback)};},
        has:key=>Object.hasOwn(drafts,key),
        set(key,value){if (!validDraft(value)) return false;drafts[key]={...value};persist();return true;},
        drop(key){delete drafts[key];persist();},
        clearIfUnchanged(key,sent){if (!sameDraft(drafts[key],sent)) return false;delete drafts[key];persist();return true;},
        atomicSettlement(mutate){
          // Unlike best-effort typing drafts, successful write settlement must be durable.
          // Stage every draft/view change together; publish only after setItem succeeds.
          const nextDrafts=JSON.parse(JSON.stringify(drafts));let nextView={...view};
          const staged={
            get:(key,fallback)=>({...((nextDrafts[key])||fallback)}),has:key=>Object.hasOwn(nextDrafts,key),
            set(key,value){if(!validDraft(value))throw Error('draftSettlementFailed');nextDrafts[key]={...value};},
            drop(key){delete nextDrafts[key];},getView:()=>({...nextView}),setView(patch){nextView={...nextView,...patch};},
            clearIfUnchanged(key,sent){if(!sameDraft(nextDrafts[key],sent))return false;delete nextDrafts[key];return true;},
          };
          const result=mutate(staged);
          try{if(!storage)throw Error('No storage');storage.setItem(storageKey,JSON.stringify({version:1,view:nextView,drafts:nextDrafts}));}
          catch{persistent=false;revision++;watchers.forEach(fn=>fn());throw Error('draftSettlementFailed');}
          drafts=nextDrafts;view=nextView;persistent=true;revision++;watchers.forEach(fn=>fn());return result;
        },
      };
    }
    const WRITE_TTL=7*86400000;
    const taskWriteActions=['add','update','delete','restore','trashPurge'];
    const cloneJson=value=>JSON.parse(JSON.stringify(value));
    const hasEditToken=token=>typeof token==='string'&&/^[a-f0-9]{64}$/.test(token);
    function createWriteJournal(storage){
      const storageKey='dsh-focus-calendar.writes.v1';
      let entries=Object.create(null),revision=0,usable=!!storage;
      const listeners=new Set();
      const validRecord=record=>record&&typeof record.key==='string'&&record.key.length<=256&&Number.isSafeInteger(record.createdAt)&&record.createdAt>=0&&record.payload&&taskWriteActions.includes(record.payload.action)&&typeof record.payload.requestId==='string'&&record.payload.requestId.length>=16&&record.payload.requestId.length<=128;
      try{const raw=storage?.getItem(storageKey);if(raw){const saved=JSON.parse(raw);if(saved.version!==1||!Array.isArray(saved.entries)||saved.entries.length>256||!saved.entries.every(validRecord))throw Error('invalid journal');for(const record of saved.entries){if(entries[record.key])throw Error('duplicate journal key');entries[record.key]=record;}}}catch{usable=false;}
      const persist=next=>{
        if(!usable)throw Error('journalUnavailable');
        try{storage.setItem(storageKey,JSON.stringify({version:1,entries:Object.values(next)}));}catch{throw Error('journalUnavailable');}
        entries=next;revision++;listeners.forEach(fn=>fn());
      };
      return {
        subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},getSnapshot:()=>revision,
        list:()=>cloneJson(Object.values(entries)),get:key=>entries[key]?cloneJson(entries[key]):null,
        begin(key,payload,now,requestId,draft){
          if(entries[key])throw Error('pendingWrite');
          if(Object.keys(entries).length>=256)throw Error('journalFull');
          const record={key,createdAt:now,payload:{...cloneJson(payload),requestId},...(draft?{draft:cloneJson(draft)}:{})};
          if(!validRecord(record))throw Error('journalUnavailable');persist({...entries,[key]:record});return cloneJson(record);
        },
        remove(key,requestId){if(entries[key]?.payload.requestId!==requestId)return false;const next={...entries};delete next[key];persist(next);return true;},
      };
    }
    function settleEditorReceipt(drafts,record,receipt){
      if(!record.key.startsWith('editor:')||!record.draft)return {cleared:false,newer:false};
      if(drafts.atomicSettlement)return drafts.atomicSettlement(staged=>settleEditorReceipt(staged,record,receipt));
      const key=record.key.slice(7),current=drafts.get(key);
      // A crash may leave a durable cleared draft plus an unremoved request journal.
      if(!drafts.has(key))return {cleared:true,newer:false};
      if(sameDraft(current,record.draft)){
        drafts.clearIfUnchanged(key,current);
        const view=drafts.getView();
        if(key==='new:'+view.date&&!view.editing)drafts.setView({filter:'all'});
        return {cleared:true,newer:false};
      }
      // Never discard text changed while an old network result was unresolved.
      if(record.payload.action==='update')drafts.set(key,{...current,expectedToken:receipt.taskToken});
      else if(record.payload.action==='add'&&receipt.taskId&&!drafts.has('edit:'+receipt.taskId)){
        drafts.set('edit:'+receipt.taskId,{...current,expectedToken:receipt.taskToken});drafts.drop(key);
        const view=drafts.getView();if(key==='new:'+view.date&&!view.editing)drafts.setView({editing:receipt.taskId});
      }
      return {cleared:false,newer:true};
    }
    const BACKUP_MAX_BYTES=4*1024*1024;
    function backupShape(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&value.format==='dsh-focus-calendar'&&value.version===1&&Number.isFinite(value.exportedAt)&&Array.isArray(value.tasks)&&Array.isArray(value.trash)&&!!value.settings&&typeof value.settings==='object'&&!Array.isArray(value.settings);}
    function parseBackup(text,size){
      if(size>BACKUP_MAX_BYTES)throw Error('backupTooLarge');
      let value;try{value=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error('backupReadFailed');}
      if(!backupShape(value))throw Error('invalidBackup');return value;
    }
    function focusStats(task,focus,now){
      const stored=Number.isFinite(task?.focusMs)?Math.max(0,task.focusMs):0;
      const active=focus?.kind==='focus'&&focus.status==='running'&&focus.taskId===task?.id&&Number.isFinite(focus.segmentStartedAt)&&Number.isFinite(focus.endsAt);
      const segment=active?Math.max(0,Math.min(now,focus.endsAt)-focus.segmentStartedAt):0;
      return {minutes:Math.floor((stored+segment)/60000),rounds:Number.isFinite(task?.focusRounds)?Math.max(0,task.focusRounds):0,segment};
    }
    const retentionDays=(deletedAt,now)=>Math.max(0,Math.ceil((deletedAt+30*86400000-now)/86400000));
    const alertOccurrence=alert=>`${alert.id}:${alert.at}`;
    function canImport(backup,preview,mode,confirmed){return backupShape(backup)&&!!preview&&typeof preview.token==='string'&&preview.token.length>0&&(mode==='merge'||mode==='replace'&&confirmed);}
    async function actionThenAck(call,action,args,alertId){
      const first=await call(action,args);if(!first?.ok)return first;
      return call('ack',{id:alertId});
    }
    // END PURE HELPERS
    const fmt = ms => { const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
    function Icon({size=22}) {return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true},h('rect',{x:3,y:5,width:18,height:17,rx:4}),h('path',{d:'M7 2v6M17 2v6M3 11h18M12 14v3l2 1'}));}

    return {inject:['slots','locale','layout'],apply(ctx) {
      ctx.effect(()=>ctx.locale.register('focus-calendar','zh',zh));
      ctx.effect(()=>ctx.locale.register('focus-calendar','en',en));
      const t=ctx.locale.bind('focus-calendar');
      let storage;try {storage=window.sessionStorage;} catch { /* Memory-only drafts remain usable. */ }
      const drafts=createDraftStore(storage,dayKey(new Date()));
      const journal=createWriteJournal(storage),writeLocks=new Set();
      const pendingDrafts=new Set();
      let snapshot={state:null,error:'',syncError:'',busy:false,clock:Date.now(),serverOffset:0,revision:0};
      const listeners=new Set(),abort=new AbortController();
      let dead=false,queue=Promise.resolve(),pollTimer;
      const publish=patch=>{if(dead)return;snapshot={...snapshot,...patch,revision:snapshot.revision+1};listeners.forEach(f=>f());};
      const subscribe=f=>{listeners.add(f);return()=>listeners.delete(f);};
      const notifySeen=new Set(),notifications=new Set(),notificationTimers=new Set();
      const notify=state=>{
        for(const a of state.alerts){
          const occurrence=alertOccurrence(a);if(notifySeen.has(occurrence))continue;notifySeen.add(occurrence);
          try {
            if(localStorage.getItem('focus-calendar.notifications')!=='yes'||!('Notification'in window)||Notification.permission!=='granted')continue;
            const key='focus-calendar.notice.'+a.kind;if(localStorage.getItem(key)===occurrence)continue;localStorage.setItem(key,occurrence);
            const n=new Notification(t('title'),{body:t(a.kind+'Alert'),tag:'focus-calendar-'+a.kind});
            n.onclick=()=>{window.focus();ctx.layout.selectPanel('focus-calendar');n.close();};notifications.add(n);
            const timer=setTimeout(()=>{n.close();notifications.delete(n);notificationTimers.delete(timer);},15000);notificationTimers.add(timer);
          } catch { /* Notification failures must not hide in-page reminders. */ }
        }
      };
      async function requestFull(input){
        const response=await fetch('/focus-calendar/api',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:abort.signal});
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        const result=await response.json();
        if(!result.ok){publish(input.action==='read'?{syncError:result.error||t('error')}:{error:result.error||t('error')});return result;}
        publish({state:result.state,...(input.action==='read'?{syncError:''}:{error:''}),clock:Date.now(),serverOffset:result.state.now-Date.now()});
        if(!dead)notify(result.state);return result;
      }
      function actFull(action,args={}) {
        // One serialized transport for old state-only callers and extended responses.
        // Background reads never disable a focused input; only user actions set busy.
        const mutating=action!=='read';
        const run=queue.then(async()=>{
          if(mutating)publish({busy:true,error:''});
          try{return await requestFull({action,...args});}
          catch(e){publish(mutating?{error:e.message}:{syncError:e.message});return {ok:false,error:e.message,code:'NETWORK_UNCERTAIN'};}
          finally{if(mutating)publish({busy:false});}
        });
        queue=run.catch(()=>{});return run;
      }
      async function act(action,args={}) {const result=await actFull(action,args);return result.ok?result.state:null;}
      async function retryWrite(record){
        if(writeLocks.has(record.key))return {ok:false,code:'PENDING_EXISTS',error:t('pendingWrite')};
        if(Date.now()-record.createdAt>=WRITE_TTL)return {ok:false,code:'REQUEST_EXPIRED',error:t('writeExpired')};
        writeLocks.add(record.key);publish({});
        try{
          const {action,...args}=record.payload;
          const result=await actFull(action,args);
          if(!result.ok){
            if(['CONFLICT','INVALID_REQUEST','RECEIPT_CAPACITY'].includes(result.code)){
              journal.remove(record.key,record.payload.requestId);
              if(result.code==='CONFLICT')await act('read');
            }
            return result;
          }
          if(result.receipt?.requestId!==record.payload.requestId)return {ok:false,code:'NETWORK_UNCERTAIN',error:t('pendingWrite')};
          // Persist the complete draft/view settlement before removing the request ID.
          // Either failure leaves the same request recoverable across a page reload.
          const draftResult=settleEditorReceipt(drafts,record,result.receipt);
          journal.remove(record.key,record.payload.requestId);
          return {...result,draftResult};
        }catch(e){return {ok:false,code:'NETWORK_UNCERTAIN',error:t(e.message==='journalUnavailable'?'journalUnavailable':'pendingWrite')};}
        finally{writeLocks.delete(record.key);publish({});}
      }
      async function taskWrite(action,args,key='row:'+args.id,draft){
        try{
          if(action!=='add'&&!hasEditToken(args.expectedToken))return {ok:false,code:'CONFLICT',error:t('conflictDraft')};
          const record=journal.begin(key,{action,...args},Date.now(),'fc-'+crypto.randomUUID(),draft);
          const result=await retryWrite(record);if(!result.ok)publish({error:result.error});return result;
        }catch(e){const result={ok:false,code:'LOCAL_WRITE_BLOCKED',error:t(e.message)};publish({error:result.error});return result;}
      }
      const useStore=()=>{React.useSyncExternalStore(f=>ctx.locale.subscribe(f),()=>ctx.locale.getSnapshot());return React.useSyncExternalStore(subscribe,()=>snapshot);};
      const button=(key,fn,props={})=>h('button',{type:'button',onClick:fn,...props},t(key));

      function PendingWrites(){
        const {busy}=useStore();React.useSyncExternalStore(journal.subscribe,journal.getSnapshot);
        const [checked,setChecked]=React.useState(null),[message,setMessage]=React.useState('');
        const mounted=React.useRef(false);React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
        const entries=journal.list();
        const retry=async record=>{const result=await retryWrite(record);if(result.ok&&result.draftResult?.cleared&&record.key.startsWith('editor:edit:')&&drafts.getView().editing===record.key.slice(12))drafts.setView({editing:null,filter:'all'});if(mounted.current)setMessage(result.ok?t(result.draftResult?.newer?'newerUnsaved':'confirmedSave'):result.error);};
        return h('details',{className:'fc-card',open:entries.length>0},h('summary',null,t('pendingWrites'),' · ',entries.length),
          h('p',{className:'fc-muted'},t('writePolicy')),...entries.map(record=>{
            const expired=Date.now()-record.createdAt>=WRITE_TTL;
            return h('div',{className:'fc-trash-row',key:record.payload.requestId},h('strong',null,record.draft?.title||record.payload.title||record.payload.id||record.payload.action),h('p',{className:'fc-muted'},record.payload.action,' · ',t(expired?'writeExpired':'pendingWrite')),
              !expired?button('retryOriginal',()=>retry(record),{disabled:busy||writeLocks.has(record.key)}):h(React.Fragment,null,
                h('label',{className:'fc-confirm'},h('input',{type:'checkbox',checked:checked===record.payload.requestId,onChange:e=>setChecked(e.target.checked?record.payload.requestId:null)}),t('releaseChecked')),
                button('releaseRequest',()=>{try{journal.remove(record.key,record.payload.requestId);setChecked(null);}catch{setMessage(t('journalUnavailable'));}},{disabled:checked!==record.payload.requestId||busy})));
          }),message&&h('p',{role:'status'},message));
      }
      function BackupPanel(){
        const {state:s,busy}=useStore();
        const [backup,setBackup]=React.useState(null),[preview,setPreview]=React.useState(null),[mode,setMode]=React.useState('merge');
        const [confirmed,setConfirmed]=React.useState(false),[working,setWorking]=React.useState(''),[localError,setLocalError]=React.useState(''),[message,setMessage]=React.useState('');
        const file=React.useRef(null),download=React.useRef(null),downloadUrl=React.useRef(null),downloadTimer=React.useRef(null);
        const active=React.useRef(false),generation=React.useRef(0),operation=React.useRef(null);
        React.useEffect(()=>{active.current=true;return()=>{active.current=false;generation.current++;if(downloadTimer.current)clearTimeout(downloadTimer.current);if(downloadUrl.current)URL.revokeObjectURL(downloadUrl.current);if(file.current)file.current.value='';};},[]);
        const resetPreview=()=>{generation.current++;setPreview(null);setConfirmed(false);setLocalError('');setMessage('');};
        const run=async(kind,fn)=>{
          if(operation.current)return;operation.current=kind;setWorking(kind);setLocalError('');
          try{await fn();}catch(e){if(active.current)setLocalError(e.message||t('error'));}
          finally{operation.current=null;if(active.current)setWorking('');}
        };
        const readPreview=async(value,version)=>{
          const result=await actFull('importPreview',{backup:value});
          if(!active.current||version!==generation.current)return;
          if(!result.ok)throw Error(result.error);
          if(!result.preview||typeof result.preview.token!=='string')throw Error(t('invalidBackup'));
          setPreview(result.preview);
        };
        const chooseFile=event=>{
          if(operation.current)return;
          const selected=event.target.files?.[0];resetPreview();setBackup(null);setMode('merge');
          if(!selected)return;
          const version=generation.current;
          run('file',async()=>{
            if(selected.size>BACKUP_MAX_BYTES)throw Error(t('backupTooLarge'));
            let value;try{value=parseBackup(await selected.text(),selected.size);}catch(e){throw Error(t(['backupTooLarge','backupReadFailed','invalidBackup'].includes(e.message)?e.message:'backupReadFailed'));}
            if(!active.current||version!==generation.current)return;
            setBackup(value);setMessage(t('fileReady'));
          });
        };
        const changeMode=next=>{if(operation.current)return;resetPreview();setMode(next);};
        const exportFile=()=>run('export',async()=>{
          const result=await actFull('export');if(!result.ok)throw Error(result.error);if(!active.current)return;
          if(!backupShape(result.backup))throw Error(t('invalidBackup'));
          if(downloadTimer.current)clearTimeout(downloadTimer.current);if(downloadUrl.current)URL.revokeObjectURL(downloadUrl.current);
          const url=URL.createObjectURL(new Blob([JSON.stringify(result.backup,null,2)],{type:'application/json;charset=utf-8'}));
          downloadUrl.current=url;
          download.current.href=url;download.current.download=`focus-calendar-${dayKey(new Date())}.json`;download.current.click();
          downloadTimer.current=setTimeout(()=>{URL.revokeObjectURL(url);if(downloadUrl.current===url)downloadUrl.current=null;downloadTimer.current=null;},30000);
          setMessage(t('downloaded'));
        });
        const recoveryPreview=()=>{
          if(operation.current)return;resetPreview();setBackup(null);setMode('replace');if(file.current)file.current.value='';const version=generation.current;
          run('recovery',async()=>{
            const result=await actFull('recoveryExport');if(!result.ok)throw Error(result.error);
            if(!active.current||version!==generation.current)return;if(!backupShape(result.backup))throw Error(t('invalidBackup'));
            setBackup(result.backup);await readPreview(result.backup,version);
          });
        };
        const previewFile=()=>{if(!backup||operation.current)return;resetPreview();const version=generation.current;run('preview',()=>readPreview(backup,version));};
        const importFile=()=>{
          if(operation.current||!canImport(backup,preview,mode,confirmed))return;
          const selected=backup,selectedMode=mode,token=preview.token;
          run('import',async()=>{
            const result=await actFull('import',{backup:selected,mode:selectedMode,token});if(!result.ok)throw Error(result.error);
            if(!active.current)return;
            resetPreview();setBackup(null);setMode('merge');if(file.current)file.current.value='';setMessage(t('imported'));
          });
        };
        const locked=!!working;
        const metric=(label,value)=>h('div',{key:label},h('dt',null,t(label)),h('dd',null,String(value??0)));
        return h('details',{className:'fc-card'},h('summary',null,t('backupTitle')),
          h('p',{className:'fc-muted'},t('backupLocal')),h('a',{ref:download,hidden:true,'aria-hidden':true}),
          button('exportBackup',exportFile,{disabled:locked||busy}),
          h('label',{className:'fc-backup-file'},t('backupFile'),h('input',{ref:file,type:'file',accept:'.json,application/json',disabled:locked,onChange:chooseFile})),
          h('div',{className:'fc-row fc-backup-modes'},...['merge','replace'].map(value=>h('label',{key:value},h('input',{type:'radio',name:'fc-import-mode',checked:mode===value,disabled:locked,onChange:()=>changeMode(value)}),t(value==='merge'?'importMerge':'importReplace')))),
          h('p',{className:'fc-muted'},t(mode==='merge'?'mergeHint':'replaceHint')),h('p',{className:'fc-muted'},t('importStop')),
          backup&&button('previewBackup',previewFile,{disabled:locked||busy}),
          preview&&h('section',{'aria-label':t('previewCounts'),className:'fc-preview'},h('strong',null,t('previewCounts')),
            h('dl',{className:'fc-metrics'},metric('backupTasks',preview.taskCount),metric('backupTrash',preview.trashCount),metric('backupAdded',preview.added),metric('backupConflicts',preview.conflicts),metric('backupDuplicates',preview.duplicates)),
            h('p',{className:'fc-muted'},t('backupRange'),': ',preview.from||t('noRange'),' — ',preview.to||t('noRange')),
            h('p',{className:'fc-muted'},t('previewScope')),h('strong',null,t('backupSettings')),
            h('dl',{className:'fc-metrics'},...['focusMinutes','eyeMinutes','bodyMinutes','breakMinutes'].map(key=>metric(key,`${preview.settings?.[key]??'—'} ${t('minutes')}`))),
            mode==='replace'&&h('label',{className:'fc-confirm'},h('input',{type:'checkbox',checked:confirmed,disabled:locked,onChange:e=>setConfirmed(e.target.checked)}),t('replaceConfirm')),
            button('importBackup',importFile,{className:'fc-primary',disabled:locked||busy||!canImport(backup,preview,mode,confirmed)})),
          backup&&!preview&&h('p',{className:'fc-muted'},t('previewRequired')),
          h('div',{className:'fc-recovery'},h('strong',null,t('recoveryTitle')),s?.recovery?h(React.Fragment,null,
            h('p',{className:'fc-muted'},new Date(s.recovery.createdAt).toLocaleString(ctx.locale.getLocale().active),' · ',t('backupTasks'),': ',s.recovery.taskCount),
            button('recoveryPreview',recoveryPreview,{disabled:locked||busy}),h('p',{className:'fc-muted'},t('recoveryHint'))):h('p',{className:'fc-muted'},t('recoveryMissing'))),
          locked&&h('p',{role:'status',className:'fc-muted'},t('saving')),localError&&h('p',{role:'alert',className:'fc-error'},localError),message&&h('p',{role:'status',className:'fc-muted'},message));
      }
      function TrashPanel(){
        const {state:s,busy,clock}=useStore();const [confirm,setConfirm]=React.useState(null),[message,setMessage]=React.useState(''),[failure,setFailure]=React.useState('');const lock=React.useRef(false),mounted=React.useRef(false);
        React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
        const run=async(action,item)=>{if(lock.current||busy)return;lock.current=true;setFailure('');try{const result=await taskWrite(action,{id:item.task.id,expectedToken:action==='trashPurge'?confirm?.token:item.task.editToken});if(!mounted.current)return;if(!result.ok){setFailure(result.error);return;}setConfirm(null);setMessage(action==='restore'?t('restored')+' '+item.task.date:t('purged'));}finally{lock.current=false;}};
        const trash=[...(s?.trash||[])].sort((a,b)=>b.deletedAt-a.deletedAt);
        return h('details',{className:'fc-card'},h('summary',null,t('trashTitle'),' · ',trash.length),h('p',{className:'fc-muted'},t('trashHint')),
          trash.length?trash.map(item=>h('article',{className:'fc-trash-row',key:item.task.id},h('strong',null,item.task.title),h('div',{className:'fc-muted'},item.task.date,' ',item.task.time||''),
            h('div',{className:'fc-muted'},t('deletedAt'),': ',new Date(item.deletedAt).toLocaleString(ctx.locale.getLocale().active)),h('div',{className:'fc-muted'},t('retention'),': ',retentionDays(item.deletedAt,clock+snapshot.serverOffset)),
            h('div',{className:'fc-row'},button('restore',()=>run('restore',item),{disabled:busy,className:'fc-small'}),confirm?.id===item.task.id?h(React.Fragment,null,h('span',{className:'fc-error'},t('purgeWarning')),button('purgeConfirm',()=>run('trashPurge',item),{disabled:busy,className:'fc-small'}),button('cancel',()=>setConfirm(null),{className:'fc-small'})):button('purge',()=>setConfirm({id:item.task.id,token:item.task.editToken}),{disabled:busy,className:'fc-small'})))):h('p',{className:'fc-muted'},t('trashEmpty')),
          message&&h('p',{role:'status',className:'fc-muted'},message),failure&&h('p',{role:'alert',className:'fc-error'},failure));
      }

      // A stable component identity and draft key prevent polling from remounting inputs.
      function TaskEditor({date,taskId,task,focusToken,onExit,onSaved}) {
        const {busy}=useStore();
        const key=taskId?'edit:'+taskId:'new:'+date,writeKey='editor:'+key;
        React.useSyncExternalStore(drafts.subscribe,drafts.getSnapshot);
        React.useSyncExternalStore(journal.subscribe,journal.getSnapshot);
        const getValue=()=>drafts.get(key,task?{title:task.title,time:task.time,date:task.date}:emptyDraft(date));
        const value=getValue(),pending=journal.get(writeKey);
        const [saving,setSaving]=React.useState(false),[failure,setFailure]=React.useState(''),[reloadConfirm,setReloadConfirm]=React.useState(false);
        const input=React.useRef(null),form=React.useRef(null),mounted=React.useRef(false);
        const composing=React.useRef(false),compositionEndedAt=React.useRef(-Infinity);
        const locked=saving||pendingDrafts.has(key)||!!pending;
        const missing=!!taskId&&!task;
        const stale=!!taskId&&(missing||!hasEditToken(value.expectedToken)||value.expectedToken!==task.editToken);
        React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
        React.useEffect(()=>{if(focusToken.key===key)input.current?.focus();},[focusToken,key]);
        const change=patch=>{if(locked)return;drafts.set(key,{...getValue(),...patch});};
        const submit=async(event,asNew=false)=>{
          event.preventDefault();
          if(composing.current||Date.now()-compositionEndedAt.current<80||pendingDrafts.has(key)||saving||busy)return;
          const sent=getValue(),existing=journal.get(writeKey);
          if(!existing&&(!sent.title.trim()||!localDate(sent.date)||stale&&!asNew)){setFailure(t(stale?'conflictDraft':'writeFailed'));return;}
          if(existing&&asNew){setFailure(t('pendingWrite'));return;}
          pendingDrafts.add(key);setSaving(true);setFailure('');
          try {
            const keepFocus=()=>mounted.current&&!!form.current?.contains(document.activeElement);
            const result=existing?await retryWrite(existing):await taskWrite(taskId&&!asNew?'update':'add',{...(taskId&&!asNew?{id:taskId,expectedToken:sent.expectedToken}:{}),title:sent.title.trim(),time:sent.time,date:sent.date},writeKey,sent);
            if(!result.ok){if(mounted.current)setFailure(result.error||t('writeFailed'));return;}
            if(result.draftResult?.newer){publish({error:t('newerUnsaved')});return;}
            const currentView=drafts.getView();
            if(mounted.current&&result.draftResult?.cleared){
              onSaved({key:result.receipt.replayed?'confirmedSave':taskId&&!asNew?(task&&task.date!==sent.date?'moved':'updated'):'added',date:sent.date},!!taskId,keepFocus());
              if(!taskId&&keepFocus())input.current?.focus();
            }
            if(taskId&&currentView.editing===taskId&&result.draftResult?.cleared)drafts.setView({editing:null,filter:'all'});
          } finally {pendingDrafts.delete(key);publish({});if(mounted.current)setSaving(false);}
        };
        const keyboard=event=>{
          if(composingEnter(event,composing.current,compositionEndedAt.current,Date.now())){event.preventDefault();return;}
          if(event.key==='Escape'&&taskId&&!composing.current&&!event.nativeEvent?.isComposing&&!saving){event.preventDefault();onExit();}
        };
        const reload=()=>{
          if(!task||locked)return;
          if(!reloadConfirm){setReloadConfirm(true);return;}
          drafts.set(key,{title:task.title,time:task.time,date:task.date,expectedToken:task.editToken});setReloadConfirm(false);setFailure('');
        };
        return h('form',{ref:form,className:'fc-form','data-editing':!!taskId,'aria-busy':saving,onSubmit:submit,onKeyDown:keyboard},
          h('div',{className:'fc-form-head'},h('strong',null,t(taskId?'editing':'newTask')),h('span',{className:'fc-badge'},saving?t('saving'):pending?t('pendingWrite'):drafts.has(key)?t('draftBadge'):'')),
          h('label',null,t('taskTitle'),h('input',{ref:input,value:value.title,readOnly:locked,required:true,maxLength:200,placeholder:t('taskTitle'),onChange:e=>change({title:e.target.value}),onCompositionStart:()=>{composing.current=true;},onCompositionEnd:()=>{composing.current=false;compositionEndedAt.current=Date.now();}})),
          h('div',{className:'fc-form-fields'},
            taskId&&h('label',null,t('targetDate'),h('input',{type:'date',value:value.date,min:'0001-01-01',max:'9999-12-31',readOnly:locked,required:true,onChange:e=>{if(localDate(e.target.value))change({date:e.target.value});}})),
            h('label',null,t('time'),h('input',{type:'time',value:value.time,readOnly:locked,onChange:e=>change({time:e.target.value})}))),
          stale&&!pending&&h('p',{role:'alert',className:'fc-error fc-hint'},t('conflictDraft')),
          pending&&h('p',{role:'status',className:'fc-muted'},t(Date.now()-pending.createdAt>=WRITE_TTL?'writeExpired':'pendingWrite')),
          failure&&h('p',{role:'alert',className:'fc-error'},failure),
          h('div',{className:'fc-row'},pending?button('retryOriginal',e=>submit(e),{disabled:saving||busy||Date.now()-pending.createdAt>=WRITE_TTL}):h('button',{type:'submit',className:'fc-primary','aria-disabled':saving||busy||!value.title.trim()||stale},t(saving?'saving':taskId?'save':'add')),
            stale&&!pending&&button('copyNew',e=>{if(form.current?.reportValidity())submit(e,true);},{disabled:saving||busy||!value.title.trim()}),
            stale&&task&&!pending&&button(reloadConfirm?'reloadConfirm':'reloadOriginal',reload,{disabled:saving||busy}),
            taskId&&button('exitEdit',onExit,{disabled:saving})),
          h('p',{className:'fc-muted fc-hint'},t(taskId?'editHint':'enterHint')),
          h('p',{className:'fc-muted fc-hint'},t(drafts.persistent?'draftHint':'draftMemory')));
      }

      function Panel(){
        const {state:s,error,syncError,busy,clock}=useStore();
        React.useSyncExternalStore(drafts.subscribe,drafts.getSnapshot);
        const {date,filter,editing}=drafts.getView();
        const [focusToken,setFocusToken]=React.useState({key:null,nonce:0}),[deleting,setDeleting]=React.useState(null);
        const [settings,setSettings]=React.useState(null),[notice,setNotice]=React.useState(null),[message,setMessage]=React.useState('');
        const opLock=React.useRef(false);
        const setCurrent=patch=>drafts.setView(patch);
        const chooseDate=next=>{if(!localDate(next))return;setCurrent({date:next,editing:null});setDeleting(null);setFocusToken(current=>({key:null,nonce:current.nonce+1}));};
        const beginEdit=task=>{
          if(busy)return;
          if(!drafts.has('edit:'+task.id))drafts.set('edit:'+task.id,{title:task.title,time:task.time,date:task.date,expectedToken:task.editToken});
          setCurrent({editing:task.id});setDeleting(null);setFocusToken(current=>({key:'edit:'+task.id,nonce:current.nonce+1}));
        };
        const exitEdit=(focus=true)=>{setCurrent({editing:null});setFocusToken(current=>({key:focus?'new:'+drafts.getView().date:null,nonce:current.nonce+1}));};
        const runTask=async(action,args,success)=>{
          if(opLock.current||busy)return;opLock.current=true;
          try{const result=taskWriteActions.includes(action)?await taskWrite(action,args):await actFull(action,args);if(result.ok){success?.(result.state,result);return true;}return false;}finally{opLock.current=false;}
        };
        const permission=async()=>{try{if(!('Notification'in window)){setMessage(t('unsupported'));return;}const p=await Notification.requestPermission();if(p==='granted'){localStorage.setItem('focus-calendar.notifications','yes');setMessage(t('granted'));}else setMessage(t('denied'));}catch{setMessage(t('unsupported'));}};
        const now=clock+snapshot.serverOffset,today=dayKey(new Date(clock)),chosen=localDate(date);
        const month=new Date(chosen);month.setDate(1);
        const stats=dayStats(s?.tasks||[]),day=stats[date]||{total:0,done:0};
        const tasks=selectTasks(s?.tasks||[],date,filter),task=s?.tasks.find(x=>x.id===editing);
        const remaining=s?(s.focus.status==='running'?s.focus.endsAt-now:s.focus.status==='paused'?s.focus.remainingMs:s.settings.focusMinutes*60000):0;
        const cells=Array.from({length:(month.getDay()+6)%7},(_,i)=>h('span',{key:'blank'+i}));
        const lastDay=new Date(month);lastDay.setMonth(lastDay.getMonth()+1,0);
        for(let d=1;d<=lastDay.getDate();d++){
          const current=new Date(month);current.setDate(d);const key=dayKey(current),progress=stats[key];
          cells.push(h('button',{key,type:'button',className:'fc-day','data-selected':key===date,'data-today':key===today,'data-complete':!!progress&&progress.done===progress.total,'aria-pressed':key===date,'aria-current':key===today?'date':undefined,'aria-label':key+(key===today?' '+t('today'):'')+(progress?` ${t('dateProgress')} ${progress.done}/${progress.total}`:''),onClick:()=>chooseDate(key)},
            h('span',null,String(d)),h('small',null,progress?`${progress.done}/${progress.total}`:'\u00a0'),h('em',null,key===today?t('today'):'\u00a0')));
        }
        const errorNotice=(text,kind)=>h('div',{className:'fc-notice fc-error',role:'alert'},h('span',{className:'fc-notice-text'},t(kind==='syncError'?'syncError':'error'),': ',text),button('retry',()=>act('read'),{disabled:busy}),button('dismiss',()=>publish({[kind]:''}),{className:'fc-small'}));
        return h('section',{className:'fc','aria-label':t('title')},h('style',null,css+featureCss),h('div',{className:'fc-wrap'},
          h('header',{className:'fc-head'},h('div',null,h('h1',null,t('title')),h('div',{className:'fc-muted'},t('subtitle'))),button('back',()=>ctx.layout.selectPanel(null))),
          error&&errorNotice(error,'error'),syncError&&errorNotice(syncError,'syncError'),
          !s?h('p',{role:'status'},t('loading')):h('div',{className:'fc-grid'},
            h('div',{className:'fc-stack'},
              h('section',{className:'fc-card','aria-label':t('selectedDate')},
                h('div',{className:'fc-head',style:{marginBottom:0}},h('strong',null,month.toLocaleDateString(ctx.locale.getLocale().active,{year:'numeric',month:'long'})),
                  h('div',{className:'fc-row'},h('button',{type:'button','aria-label':t('prev'),title:t('prev'),onClick:()=>chooseDate(shiftMonth(date,-1)),disabled:shiftMonth(date,-1)===date},'‹'),button('today',()=>chooseDate(dayKey(new Date())),{className:'fc-small'}),h('button',{type:'button','aria-label':t('next'),title:t('next'),onClick:()=>chooseDate(shiftMonth(date,1)),disabled:shiftMonth(date,1)===date},'›'))),
                h('div',{className:'fc-calendar'},...t('weekdays').split(' ').map(w=>h('span',{className:'fc-week',key:w},w)),...cells),
                h('div',{className:'fc-row fc-datebar'},button('prevDay',()=>chooseDate(shiftDate(date,-1)),{className:'fc-small',disabled:shiftDate(date,-1)===date}),h('input',{type:'date','aria-label':t('selectedDate'),value:date,min:'0001-01-01',max:'9999-12-31',onChange:e=>chooseDate(e.target.value)}),button('nextDay',()=>chooseDate(shiftDate(date,1)),{className:'fc-small',disabled:shiftDate(date,1)===date})),
                h('p',{className:'fc-muted',style:{marginBottom:0}},t('legend'))),
              h('section',{className:'fc-card'},
                h('div',{className:'fc-head',style:{marginBottom:6}},h('div',null,h('h2',null,t('tasks')),h('div',{className:'fc-muted'},date,' · ',chosen.toLocaleDateString(ctx.locale.getLocale().active,{weekday:'long'}))),button('newTask',()=>exitEdit(),{className:'fc-small'})),
                h('div',{className:'fc-row fc-muted'},`${day.done} / ${day.total} ${t('completed')}`),h('progress',{className:'fc-progress',value:day.done,max:Math.max(1,day.total),'aria-label':t('dateProgress')}),
                notice&&h('div',{className:'fc-notice',role:'status'},h('span',{className:'fc-notice-text'},t(notice.key),' ',notice.date||''),notice.date&&notice.date!==date&&button('showDate',()=>chooseDate(notice.date),{className:'fc-small'}),notice.undoId&&(s.trash||[]).some(entry=>entry.task.id===notice.undoId)&&button('undoDelete',()=>runTask('restore',{id:notice.undoId,expectedToken:notice.undoToken},()=>setNotice({key:'restored'})),{className:'fc-small',disabled:busy}),button('dismiss',()=>setNotice(null),{className:'fc-small'})),
                h(TaskEditor,{key:editing?'edit:'+editing:'new:'+date,date,taskId:editing,task,focusToken,onExit:()=>exitEdit(),onSaved:(next,wasEditing,keepFocus)=>{setNotice(next);if(wasEditing)setFocusToken(current=>({key:keepFocus?'new:'+drafts.getView().date:null,nonce:current.nonce+1}));}}),
                h('div',{className:'fc-filter',role:'group','aria-label':t('filter')},...['all','pending','done'].map(value=>h('button',{type:'button',key:value,className:'fc-small','aria-pressed':filter===value,onClick:()=>setCurrent({filter:value})},t(value==='done'?'completed':value),' ',value==='all'?day.total:value==='done'?day.done:day.total-day.done))),
                tasks.length?tasks.map(item=>h('div',{className:'fc-task',key:item.id,'data-editing':editing===item.id},
                  h('input',{type:'checkbox',checked:item.done,disabled:busy,'aria-label':t(item.done?'undo':'complete')+': '+item.title,onChange:e=>runTask('update',{id:item.id,done:e.target.checked,expectedToken:item.editToken})}),
                  h('div',{className:'fc-task-text','data-done':item.done},h('div',null,item.title),h('div',{className:'fc-muted'},item.time||t('allDay')),h('div',{className:'fc-task-focus'},t('focusTotal'),': ',focusStats(item,s.focus,now).minutes,' ',t('minutes'),' · ',t('focusRounds'),': ',focusStats(item,s.focus,now).rounds),focusStats(item,s.focus,now).segment>0&&h('div',{className:'fc-task-focus'},t('focusSegment'),': ',fmt(focusStats(item,s.focus,now).segment))),
                  h('div',{className:'fc-task-actions'},button('focusTask',()=>runTask('focusStart',{id:item.id}),{className:'fc-small',disabled:busy||item.done||s.focus.status!=='idle',title:item.done||s.focus.status!=='idle'?t('focusUnavailable'):t('focusTask')}),button('edit',()=>beginEdit(item),{className:'fc-small',disabled:busy,'aria-label':t('edit')+': '+item.title}),
                    deleting?.id===item.id?h(React.Fragment,null,button('confirmDelete',()=>runTask('delete',{id:item.id,expectedToken:deleting.token},(resultState,result)=>{drafts.drop('edit:'+item.id);setDeleting(null);if(drafts.getView().editing===item.id)exitEdit(false);setNotice({key:'deleted',undoId:item.id,undoToken:result.receipt.taskToken});}),{className:'fc-small',disabled:busy}),button('cancel',()=>setDeleting(null),{className:'fc-small'})):button('remove',()=>setDeleting({id:item.id,token:item.editToken}),{className:'fc-small',disabled:busy,'aria-label':t('remove')+': '+item.title}))
                )):h('p',{className:'fc-muted'},t(day.total===0?'empty':filter==='pending'?'noPending':'noCompleted')))),
            h('div',{className:'fc-stack'},
              h('section',{className:'fc-card'},h('h2',null,t('focus')),h('p',{className:'fc-muted'},t('focusHint')),s.focus.status!=='idle'&&s.focus.taskId&&h('div',{className:'fc-current-task'},t('currentTask'),': ',s.tasks.find(item=>item.id===s.focus.taskId)?.title||t('taskUnavailable')),h('div',{className:'fc-status'},t(s.focus.status==='idle'?'idle':s.focus.status==='paused'?'paused':s.focus.kind==='break'?'breaking':'running')),h('div',{className:'fc-timer','aria-label':t('remaining')},fmt(remaining)),
                h('div',{className:'fc-row'},s.focus.status==='running'?button('pause',()=>act('focusPause'),{disabled:busy}):s.focus.status==='paused'?button('resume',()=>act('focusResume'),{disabled:busy,className:'fc-primary'}):button('start',()=>act('focusStart'),{disabled:busy,className:'fc-primary'}),button('reset',()=>act('focusReset'),{disabled:busy||s.focus.status==='idle'}),button('rest',()=>act('breakStart'),{disabled:busy||s.focus.status!=='idle',title:t('stopFirst')}))),
              h('section',{className:'fc-card'},h('h2',null,t('reminders')),...['eye','body'].map(kind=>h('div',{className:'fc-health',key:kind},h('div',null,h('strong',null,t(kind)),h('div',{className:'fc-muted'},t('interval'),' ',s.settings[kind+'Minutes'],' ',t('minutes'),' · ',s.reminders[kind].running?fmt(s.reminders[kind].nextAt-now):t('off'))),h('button',{type:'button',role:'switch','aria-checked':s.reminders[kind].running,'aria-label':t(kind),disabled:busy,onClick:()=>act(s.reminders[kind].running?'remindersStop':'remindersStart',{kind})},t(s.reminders[kind].running?'disable':'enable')))),(s.snoozed||[]).length>0&&h('div',{className:'fc-snoozed'},h('strong',null,t('snoozedTitle')),h('p',{className:'fc-muted'},t('snoozedHint')),...s.snoozed.map(alert=>h('div',{className:'fc-muted',key:alert.id},t(alert.kind+'Alert'),' · ',fmt(alert.dueAt-now)))),h('p',null,button('notify',permission,{className:'fc-small'})),message&&h('p',{className:'fc-muted',role:'status'},message)),
              h(PendingWrites),h(BackupPanel),h(TrashPanel),
              h('details',{className:'fc-card'},h('summary',null,t('settings')),h('form',{className:'fc-form',onSubmit:async e=>{e.preventDefault();if(await act('settings',{settings:settings||s.settings})){setSettings(null);setMessage(t('saved'));}}},h('div',{className:'fc-settings'},...['focusMinutes','eyeMinutes','bodyMinutes','breakMinutes'].map(key=>h('label',{key},t(key)+' ('+t('minutes')+')',h('input',{type:'number',min:1,max:240,step:1,required:true,value:(settings||s.settings)[key],readOnly:busy,onChange:e=>setSettings({...s.settings,...settings,[key]:e.target.value===''?'':Number(e.target.value)})})))),h('p',{className:'fc-muted'},t('settingsHint')),h('button',{type:'submit',disabled:busy},t('save')))))
          ),
          h('details',{className:'fc-footer fc-muted'},h('summary',null,t('noteTitle')),h('p',null,t('note')),h('p',null,t('draftHint'))),h('p',{className:'fc-muted'},t('shortcut'),' · ',t('timezone'))));
      }
      function Alerts(){
        const {state:s,busy,error}=useStore();const lock=React.useRef(false);
        const run=async(fn)=>{if(lock.current||busy)return;lock.current=true;try{await fn();}finally{lock.current=false;}};
        if(!s?.alerts.length)return null;
        return h('aside',{className:'fc-toast','aria-label':t('reminders')},h('style',null,css+featureCss),...s.alerts.map(a=>{
          const task=a.taskId?s.tasks.find(item=>item.id===a.taskId):null;
          const canContinue=s.focus.status==='idle'&&(!a.taskId||task&&!task.done);
          return h('article',{key:a.id,role:'status'},h('strong',null,t('title')),h('p',null,t(a.kind+'Alert')),
            a.taskId&&h('p',null,task?.title||t('taskUnavailable')),
            a.kind==='focus'&&h('div',{className:'fc-row fc-alert-actions'},
              button('continueFocus',()=>run(()=>actionThenAck(actFull,'focusStart',a.taskId?{id:a.taskId}:{},a.id)),{disabled:busy||!canContinue,title:!canContinue?t('focusUnavailable'):t('continueFocus')}),
              button('rest',()=>run(()=>actionThenAck(actFull,'breakStart',{},a.id)),{disabled:busy||s.focus.status!=='idle',title:t('stopFirst')}),
              a.taskId&&button('finishTask',()=>run(()=>actionThenAck((action,args)=>action==='update'?taskWrite(action,args):actFull(action,args),'update',{id:a.taskId,done:true,expectedToken:task?.editToken},a.id)),{disabled:busy||!task||task.done})),
            h('div',{className:'fc-row fc-alert-actions'},button('snooze5',()=>run(()=>actFull('snooze',{id:a.id,minutes:5})),{disabled:busy}),button('snooze10',()=>run(()=>actFull('snooze',{id:a.id,minutes:10})),{disabled:busy})),
            h('div',{className:'fc-row fc-alert-actions'},button('ack',()=>run(()=>actFull('ack',{id:a.id})),{disabled:busy}),button('open',()=>ctx.layout.selectPanel('focus-calendar'))));
        }),error&&h('p',{className:'fc-error',role:'alert'},error));
      }
      ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'focus-calendar',order:15,label:()=>t('title')},Icon));
      ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'focus-calendar'},Panel));
      ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'focus-calendar-alerts',order:30},Alerts));
      ctx.effect(()=>{
        let active=true;
        async function poll(){if(!active)return;await act('read');if(active)pollTimer=setTimeout(poll,snapshot.state&&(snapshot.state.focus.status==='running'||snapshot.state.reminders.eye.running||snapshot.state.reminders.body.running||(snapshot.state.snoozed||[]).length)?2000:10000);}
        poll();const tick=setInterval(()=>publish({clock:Date.now()}),1000);
        const key=e=>{if(e.altKey&&e.shiftKey&&e.code==='KeyF'&&!e.repeat){e.preventDefault();ctx.layout.selectPanel('focus-calendar');}};
        window.addEventListener('keydown',key);
        return()=>{active=false;dead=true;abort.abort();clearTimeout(pollTimer);clearInterval(tick);for(const timer of notificationTimers)clearTimeout(timer);for(const n of notifications)n.close();window.removeEventListener('keydown',key);listeners.clear();};
      });
    }};
  },
});
