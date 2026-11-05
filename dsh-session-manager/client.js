window.__ModuleLoader__.load({
  id: 'dsh-session-manager',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const zh = {
      purgeUnavailable:'当前宿主尚未提供此会话的删除凭证；请核对补丁安装及会话活动状态。', purge:'永久删除', confirmPurge:'确认永久删除', purgeNote:'永久删除此会话的原始聊天日志和搜索记录，不能恢复。仅支持已归档且无活动任务的会话，空闲已加载会话会先正常释放；不会删除项目文件或其他会话中已有的历史副本。',
      title:'会话管理', subtitle:'把对话整理好，在需要的工作区接着聊。', back:'返回聊天', refresh:'刷新', create:'新建会话',
      active:'会话', archived:'已删除 / 归档', allWorkspaces:'全部工作区', workspace:'工作区', search:'搜索标题、会话 ID 或目录',
      loading:'正在读取会话…', empty:'没有找到会话', emptyHint:'试试其他筛选，或在工作区中新建一个会话。', retry:'重试',
      open:'打开', move:'移动', remove:'删除', restore:'恢复', cancel:'取消', confirmMove:'确认迁移', confirmDelete:'确认删除', confirmRestore:'确认恢复',
      target:'目标工作区', selectWorkspace:'请选择工作区', noWorkspace:'请先在侧栏添加一个工作区。', ungrouped:'未分组',
      idle:'空闲', running:'运行中', unreadable:'暂不可读', deleted:'已归档', updated:'最近更新', sessionId:'会话 ID', actions:'操作',
      safeNote:'移动会在目标工作区生成承接历史的新会话 ID，成功后归档原会话；不会移动项目文件。删除为可恢复归档，不会永久擦除日志。',
      moveNote:'完整历史承接到目标工作区后，原会话将归档。新会话使用新的 ID。目标、提醒、团队和子智能体的历史记录会保留；旧提醒与团队/子智能体不转移到新会话，目标不会自动继续。旧文件引用仍指向原位置。请先结束实际运行或排队任务；迁移期间勿在其他标签页修改相关会话。',
      deleteNote:'会话将从活动列表移到归档，聊天记录保留，可在“已删除 / 归档”恢复。归档会取消置顶。',
      restoreNote:'会话将回到原工作区；不会恢复原来的置顶和已停止的任务。', createNote:'在选定的工作区中创建一个空白会话。',
      busy:'正在处理…', failed:'操作失败', success:'操作已完成', pending:'请求结果尚未确认。不要另建请求，请使用相同请求重试。',
      retryOriginal:'重试原请求', journalFailed:'无法保存操作凭证，尚未发送请求。请允许当前标签页存储后重试。',
      pendingHint:'此标签页有待确认操作；请先重试确认结果，再进行其他修改。', dismiss:'关闭提示', next:'下一页', prev:'上一页',
      page:'本页', total:'总数', archivedHint:'包含系统已有的归档会话；不会自动永久清理。', unavailable:'运行中会话请先结束任务，再移动或删除。',
      completedOpen:'打开新会话', refreshFirst:'列表已刷新。请核对最新状态后重新操作。', from:'源会话',
      batchDelete:'删除所选', confirmBatchDelete:'确认批量删除', selected:'已选择', selectAllPage:'全选本页', selectEmptyPage:'选择本页空会话', clearSelection:'清空选择', selectSession:'选择会话', emptySession:'空会话', batchHint:'只操作本页勾选项；切换筛选、翻页或刷新会清空选择。', batchDeleteNote:'所选会话将逐个移入可恢复归档，不会永久擦除日志。运行中或状态变化的项目会跳过，并列出失败原因。', batchResults:'逐项结果', batchSucceeded:'已归档', batchFailed:'未删除',
      addWorkspace:'添加工作区…', addingWorkspace:'正在添加工作区…', workspaceAdded:'工作区已添加到列表。', workspaceAlreadyHidden:'此目录对应的工作区已隐藏，可在下方「已隐藏的工作区」恢复。',
      clearSearch:'清除筛选', completed:'已完成（未读）', statusDone:'已完成', statusApproval:'等待审批', statusPlanReview:'等待计划审阅', statusAnswer:'等待回答', statusSubagentsRunning:'{n} 个子智能体运行中',
      browser:'工作区浏览器', browserSearch:'筛选工作区、会话标题或 ID', manage:'打开会话管理', collapseAll:'全部折叠', expandAll:'全部展开', hiddenWorkspaces:'已隐藏的工作区', sidebarToggle:'使用独立侧栏浏览器', sidebarNote:'记住此客户端的选择，刷新或重启后自动恢复；取消勾选会恢复原生列表。', sidebarFailed:'独立侧栏注册失败，已保留原生列表：', sidebarPreferenceError:'无法保存侧栏偏好，本次选择可能无法跨重启保留：', untitled:'新会话', defaultWorkspace:'默认工作区', noSessions:'暂无会话', visibilityConnecting:'正在连接工作区显示设置…', visibilityError:'显示设置正在重连，保留上次显示结果；连接恢复前暂停修改。', listError:'工作区目录正在重连，保留上次列表；连接恢复前暂停修改。', noVisibleWorkspaces:'所有工作区均已隐藏，可在下方展开隐藏列表恢复显示。', initialConnection:'正在加载工作区；可稍后重试或打开会话管理。', archive:'归档', confirmArchive:'确认归档', archiveNote:'会话将移到已归档列表，聊天记录保留，可随时恢复。不会永久删除日志，也不会强制停止正在运行的任务。', archivedSessions:'已归档会话', activeSessions:'活动会话', statusWaiting:'等待交互', sidebarScope:'按标题和 ID 筛选当前会话目录，不搜索消息正文。',
      workspaceVisibility:'工作区可见性', visibilityHint:'点击眼睛隐藏/显示本页及独立侧栏中的工作区和会话；隐藏项保留恢复入口。不改变原生侧栏数据，不会归档、删除或停止任务。', hideWorkspace:'隐藏工作区', showWorkspace:'显示工作区', workspaceVisible:'已显示', workspaceHidden:'已隐藏', showHidden:'显示已隐藏的会话', visibilityUnavailable:'请刷新后重试可见性设置', visibleCount:'显示中',
    };
    const en = {
      purgeUnavailable:'The Host has not provided a deletion revision for this session. Check the patch installation and session activity.', purge:'Delete permanently', confirmPurge:'Confirm permanent deletion', purgeNote:'Permanently erase this session’s original chat log and search records. This cannot be undone. Only archived sessions without active work are supported. Idle loaded sessions are released normally before deletion. Project files and history copies in other sessions are not deleted.',
      title:'Session Manager', subtitle:'Organize conversations. Continue in the right workspace.', back:'Back to chat', refresh:'Refresh', create:'New session',
      active:'Sessions', archived:'Deleted / archived', allWorkspaces:'All workspaces', workspace:'Workspace', search:'Search title, session ID or directory',
      loading:'Loading sessions…', empty:'No sessions found', emptyHint:'Try another filter or create a session in a workspace.', retry:'Retry',
      open:'Open', move:'Move', remove:'Delete', restore:'Restore', cancel:'Cancel', confirmMove:'Confirm migration', confirmDelete:'Confirm deletion', confirmRestore:'Confirm restore',
      target:'Destination workspace', selectWorkspace:'Choose a workspace', noWorkspace:'Add a workspace in the sidebar first.', ungrouped:'Ungrouped',
      idle:'Idle', running:'Running', unreadable:'Unavailable', deleted:'Archived', updated:'Updated', sessionId:'Session ID', actions:'Actions',
      safeNote:'Moving creates a new session ID with inherited history in the destination, then archives the original. Project files stay in place. Deletion is recoverable archival, not permanent erasure.',
      moveNote:'The original is archived after its full history is inherited in the destination. The new session has a new ID. Goal, reminder, team and subagent history is preserved. Old reminders and team/subagent ownership do not transfer; goals do not continue automatically. File references keep their original locations. Finish running or queued work first and do not modify these sessions in other tabs during migration.',
      deleteNote:'Move this conversation to the archive while preserving its history. Restore it from Deleted / archived. Archiving removes its pin.',
      restoreNote:'Return the session to its original workspace. Previous pins and stopped tasks are not restored.', createNote:'Create a blank conversation in the selected workspace.',
      busy:'Working…', failed:'Operation failed', success:'Operation completed', pending:'The request result is unknown. Retry the same request rather than creating another.',
      retryOriginal:'Retry original request', journalFailed:'Could not save the operation receipt. Nothing was sent. Allow storage in this tab and retry.',
      pendingHint:'This tab has an unconfirmed operation. Retry it before making other changes.', dismiss:'Dismiss notice', next:'Next page', prev:'Previous page',
      page:'On this page', total:'Total', archivedHint:'Includes sessions already archived by DSH. No automatic permanent removal.', unavailable:'Finish running work before moving or deleting a session.',
      completedOpen:'Open new session', refreshFirst:'The list was refreshed. Review the latest state and try again.', from:'Source session',
      batchDelete:'Delete selected', confirmBatchDelete:'Confirm bulk deletion', selected:'Selected', selectAllPage:'Select this page', selectEmptyPage:'Select empty on this page', clearSelection:'Clear selection', selectSession:'Select session', emptySession:'Empty session', batchHint:'Only checked rows on this page are affected. Filters, page changes and refresh clear the selection.', batchDeleteNote:'Selected sessions are archived individually and remain recoverable. Running or changed sessions are skipped with an individual failure reason. Logs are not permanently erased.', batchResults:'Individual results', batchSucceeded:'Archived', batchFailed:'Not deleted',
      addWorkspace:'Add workspace…', addingWorkspace:'Adding workspace…', workspaceAdded:'Workspace added to the list.', workspaceAlreadyHidden:'This directory belongs to a hidden workspace. Restore it under Hidden workspaces below.',
      clearSearch:'Clear filter', completed:'Completed (unread)', statusDone:'Completed', statusApproval:'Awaiting approval', statusPlanReview:'Awaiting plan review', statusAnswer:'Awaiting answer', statusSubagentsRunning:'{n} subagents running',
      browser:'Workspace Explorer', browserSearch:'Filter workspaces, session titles or IDs', manage:'Open Session Manager', collapseAll:'Collapse all', expandAll:'Expand all', hiddenWorkspaces:'Hidden workspaces', sidebarToggle:'Use independent sidebar browser', sidebarNote:'Remembers this client’s choice across reloads and restarts. Uncheck to restore the native list.', sidebarFailed:'Independent sidebar registration failed; the native list is retained:', sidebarPreferenceError:'Could not save the sidebar preference; this choice may not survive a restart:', untitled:'New session', defaultWorkspace:'Default workspace', noSessions:'No sessions', visibilityConnecting:'Connecting workspace visibility…', visibilityError:'Visibility reconnecting. Showing the last loaded list; changes are paused.', listError:'Workspace catalog reconnecting. Showing the last loaded list; changes are paused.', noVisibleWorkspaces:'All workspaces are hidden. Expand Hidden workspaces below to restore them.', initialConnection:'Loading workspaces. Retry shortly or open Session Manager.', archive:'Archive', confirmArchive:'Confirm archival', archiveNote:'Move this conversation to Archived, keeping its history for restoration. No permanent erasure or forced cancellation of running work.', archivedSessions:'Archived sessions', activeSessions:'Active sessions', statusWaiting:'Waiting for interaction', sidebarScope:'Filters the current session catalog by title and ID, not message content.',
      workspaceVisibility:'Workspace visibility', visibilityHint:'Click an eye to hide/show workspaces and their sessions here and in the independent sidebar. Recovery controls remain available. Native sidebar data is unchanged. No archival, deletion or task cancellation.', hideWorkspace:'Hide workspace', showWorkspace:'Show workspace', workspaceVisible:'Visible', workspaceHidden:'Hidden', showHidden:'Show hidden sessions', visibilityUnavailable:'Refresh before changing visibility', visibleCount:'Visible',
    };
    const css = `
.sm{height:100%;overflow:auto;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:inherit;font-size:14px;line-height:1.5;padding:24px clamp(16px,3vw,40px)}
.sm *,.sm-modal *{box-sizing:border-box}.sm-wrap{max-width:1120px;margin:auto}.sm-head{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:24px}.sm h1{font-size:24px;font-weight:650;letter-spacing:-.4px;margin:0 0 5px}.sm p{margin:4px 0}.sm-muted{color:var(--dsw-alias-label-secondary);font-size:12px}.sm-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sm button,.sm input,.sm select,.sm-modal button,.sm-modal select{font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;min-height:34px;padding:6px 12px}.sm button,.sm-modal button{cursor:pointer}.sm button:hover,.sm-modal button:hover{background:var(--dsw-alias-interactive-bg-hover)}.sm button:disabled,.sm-modal button:disabled{opacity:.45;cursor:default}.sm button:focus-visible,.sm input:focus-visible,.sm select:focus-visible,.sm-modal button:focus-visible,.sm-modal select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.sm .sm-primary,.sm-modal .sm-primary{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);font-weight:600}.sm .sm-danger,.sm-modal .sm-danger{color:var(--dsw-alias-state-error-primary)}.sm-tabs{display:flex;gap:20px;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:18px}.sm-tabs button{border:0;border-radius:0;background:transparent;padding:10px 2px;border-bottom:2px solid transparent;color:var(--dsw-alias-label-secondary)}.sm-tabs button[aria-pressed=true]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary);font-weight:600}
.sm-filters{display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap}.sm-filters input{flex:1;min-width:200px;min-height:38px}.sm-filters select{max-width:340px;min-height:38px}.sm-note{display:flex;gap:9px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:12px 14px;font-size:12px;color:var(--dsw-alias-label-secondary);margin:16px 0 20px}.sm-note svg{flex:none;margin-top:2px}.sm-list{border-top:1px solid var(--dsw-alias-border-l1)}.sm-item{display:flex;gap:16px;align-items:flex-start;padding:17px 3px;border-bottom:1px solid var(--dsw-alias-border-l1)}.sm-avatar{height:34px;width:34px;border-radius:10px;display:grid;place-items:center;flex:none;color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}.sm-info{flex:1;min-width:0}.sm-name{font-weight:600;overflow-wrap:anywhere}.sm-path{overflow-wrap:anywhere;margin-top:5px}.sm-id{font-family:ui-monospace,monospace;overflow-wrap:anywhere;font-size:11px}.sm-meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:6px}.sm-tag{font-size:11px;padding:1px 7px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}.sm-tag[data-running=true]{color:var(--dsw-alias-brand-primary)}.sm-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.sm-actions button{font-size:12px;padding:4px 9px;min-height:30px}.sm-empty{text-align:center;padding:54px 20px}.sm-empty h2{font-size:16px;font-weight:600;margin:12px 0 6px}.sm-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:18px 0}.sm-alert{border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:12px 14px;margin-bottom:16px;overflow-wrap:anywhere;background:var(--dsw-alias-bg-layer-1)}.sm-alert[data-error=true]{border-color:var(--dsw-alias-state-error-primary)}
.sm-modal{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 22%,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px}.sm-dialog{background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;width:min(480px,100%);padding:24px;max-height:90vh;overflow:auto}.sm-dialog h2{font-size:19px;margin:0 0 12px}.sm-dialog p{font-size:13px;line-height:1.6;margin:10px 0 18px}.sm-dialog label{display:grid;gap:8px;font-size:13px;margin:18px 0}.sm-dialog select{width:100%;min-width:0}.sm-dialog-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:24px}.sm-dialog-summary{padding:10px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);overflow-wrap:anywhere;font-size:12px}
.sm-workspaces{padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);margin:0 0 18px}.sm-workspaces summary{cursor:pointer;font-weight:600;font-size:13px}.sm-workspaces summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}.sm-workspaces>p{margin:9px 0 12px}.sm-workspace-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:8px}.sm-workspace{display:flex;align-items:center;gap:9px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;min-width:0}.sm-workspace[data-hidden=true]{background:var(--dsw-alias-bg-layer-2)}.sm-workspace-text{flex:1;min-width:0}.sm-workspace-title{font-size:12px;font-weight:600;overflow-wrap:anywhere}.sm-workspace-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-secondary)}.sm-workspace button.sm-eye{display:flex;align-items:center;justify-content:center;gap:5px;flex:none;padding:5px 7px;font-size:11px;min-height:32px;color:var(--dsw-alias-brand-primary)}.sm-workspace[data-hidden=true] button.sm-eye{color:var(--dsw-alias-label-secondary)}.sm-include-hidden{display:flex;align-items:center;gap:7px;white-space:nowrap;font-size:12px;cursor:pointer}.sm-include-hidden input{accent-color:var(--dsw-alias-brand-primary);width:16px;height:16px;min-height:16px;margin:0}.sm-hidden-note{font-size:12px;color:var(--dsw-alias-label-secondary);margin-bottom:12px}
.sm-bulk{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:11px 13px;margin:0 0 12px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:9px}.sm-bulk label{display:flex;gap:7px;align-items:center;font-size:12px;cursor:pointer}.sm-bulk button{font-size:12px;min-height:30px}.sm-bulk-count{margin-left:auto;font-size:12px;color:var(--dsw-alias-label-secondary)}.sm-select{flex:none;margin-top:8px}.sm-select input,.sm-bulk input{accent-color:var(--dsw-alias-brand-primary);width:16px;height:16px;min-height:16px;margin:0;cursor:pointer}.sm-item[data-selected=true]{background:var(--dsw-alias-bg-layer-1)}.sm-dialog-list{padding:0;list-style:none;max-height:220px;overflow:auto;font-size:12px}.sm-dialog-list li{padding:7px 0;border-bottom:1px solid var(--dsw-alias-border-l1);overflow-wrap:anywhere}.sm-result-list{padding-left:18px;font-size:12px;max-height:240px;overflow:auto}
.sm{font-size:13px;padding:30px clamp(18px,4vw,48px)}.sm-wrap{max-width:1160px}.sm-head{padding-bottom:22px;margin-bottom:20px;border-bottom:1px solid var(--dsw-alias-border-l1)}.sm h1{font-size:26px;font-weight:650;letter-spacing:-.6px;margin-bottom:7px}.sm button,.sm input,.sm select,.sm-modal button,.sm-modal select{border-color:var(--dsw-alias-border-l1);transition:background .12s,border-color .12s}.sm button,.sm-modal button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:35px}.sm button svg,.sm-modal button svg{flex:none}.sm .sm-primary,.sm-modal .sm-primary{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1));border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,var(--dsw-alias-border-l1))}.sm-tabs{gap:5px;border:0;padding:4px;width:fit-content;border-radius:10px;background:var(--dsw-alias-bg-layer-1);margin:0 0 18px}.sm-tabs button{border:0;border-radius:7px;padding:6px 16px;min-height:32px}.sm-tabs button[aria-pressed=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);box-shadow:0 1px 3px color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}.sm-note{border-color:var(--dsw-alias-border-l1);border-radius:10px;padding:12px 15px;gap:10px;align-items:center}.sm-workspaces{border-radius:12px;padding:15px 18px;background:var(--dsw-alias-bg-layer-1)}.sm-workspaces summary{font-weight:600}.sm-workspace-grid{gap:9px}.sm-workspace{background:var(--dsw-alias-bg-base);border-radius:9px;padding:10px 12px}.sm-workspace[data-hidden=true]{background:transparent;border-style:dashed}.sm-workspace button.sm-eye{border:0;background:transparent;font-size:11px;min-height:30px;padding:5px 7px}.sm-workspace-path{margin-top:3px;opacity:.8}.sm-filters{gap:10px}.sm-filters input{border-radius:9px;background:var(--dsw-alias-bg-layer-1);padding:9px 12px}.sm-filters select{background:var(--dsw-alias-bg-layer-1);border-radius:9px}.sm-include-hidden{font-size:12px}.sm-bulk{border:0;border-radius:9px;padding:10px 12px;gap:8px}.sm-bulk button{border:0;background:transparent}.sm-bulk .sm-danger{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 6%,transparent)}.sm-list{border:0}.sm-item{padding:16px 14px;margin:5px 0;border:1px solid transparent;border-bottom-color:var(--dsw-alias-border-l1);border-radius:10px;gap:13px}.sm-item:hover{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l1)}.sm-item[data-selected=true]{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 35%,var(--dsw-alias-border-l1));background:color-mix(in srgb,var(--dsw-alias-brand-primary) 5%,var(--dsw-alias-bg-layer-1))}.sm-avatar{width:36px;height:36px;border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,var(--dsw-alias-bg-layer-1))}.sm-name{font-size:13px;font-weight:600}.sm-tag{border-radius:5px;padding:2px 7px}.sm-tag[data-running=true]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,var(--dsw-alias-bg-layer-1))}.sm-actions button{border-color:transparent;background:var(--dsw-alias-bg-layer-1);border-radius:7px}.sm-actions .sm-danger{background:transparent}.sm-meta{gap:8px}.sm-dialog{border-radius:16px;padding:26px}.sm-dialog-foot{padding-top:16px;border-top:1px solid var(--dsw-alias-border-l1)}
@media(max-width:680px){.sm{padding:18px 14px}.sm-select{margin-top:0}.sm-bulk-count{margin-left:0}.sm-avatar{display:none}.sm-item{flex-wrap:wrap;gap:10px;padding:14px 10px}.sm-info{min-width:100%}.sm-actions{justify-content:flex-start}.sm-head{margin-bottom:14px}.sm-filters select{max-width:100%;width:100%}.sm-footer{flex-wrap:wrap}.sm-note{flex-wrap:wrap}}
.sm{scrollbar-gutter:stable}.sm-head{margin-bottom:18px}.sm-head .sm-row button{display:inline-flex;align-items:center;gap:7px}.sm-note{margin:12px 0;padding:10px 12px}.sm-item{padding:14px 10px;border-radius:8px;transition:background .12s}.sm-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.sm-info>.sm-id{margin-top:5px;font-size:10px;color:var(--dsw-alias-label-tertiary)}.sm-path{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sm-actions{align-self:center}.sm-actions .sm-primary{font-weight:500}.sm-load-status{height:26px;display:flex;align-items:center;font-size:12px;color:var(--dsw-alias-label-secondary)}.sm-skeleton{min-height:320px}.sm-skeleton-row{height:80px;padding:18px 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}.sm-skeleton-row span{display:block;height:10px;width:52%;border-radius:5px;background:var(--dsw-alias-bg-layer-2)}.sm-skeleton-row span+span{width:76%;margin-top:12px;height:8px}.sm-list[aria-busy=true]{opacity:.7}.sm-footer{font-variant-numeric:tabular-nums}.sm-workspace-grid{max-height:280px;overflow:auto;scrollbar-gutter:stable}
@media(prefers-reduced-motion:reduce){.sm button,.sm input,.sm select,.sm-modal button,.sm-modal select,.sm-item{transition:none}}
`;
    function Icon({size=20,info=false}) {
      return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},info
        ? [h('circle',{key:'c',cx:12,cy:12,r:9}),h('path',{key:'p',d:'M12 11v6m0-10v.01'})]
        : [h('path',{key:'p',d:'M20 11V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h2v3l5-3h2M7 8h9M7 12h5m3 3h7m-3-3 3 3-3 3'})]);
    }
    function EyeIcon({hidden=false,size=17}) {
      return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},
        h('path',{d:hidden?'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.8 5.2A11 11 0 0 1 12 5c6 0 10 7 10 7a19 19 0 0 1-3.1 3.9M6.1 6.1A20 20 0 0 0 2 12s4 7 10 7a12 12 0 0 0 5-1.1':'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z'}),
        !hidden&&h('circle',{cx:12,cy:12,r:3}));
    }
    function SidebarIcon({name,size=16}) {
      const paths={
        trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
        folder:'M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
        folderAdd:'M3 7V5a1 1 0 0 1 1-1h5l2 3h8a2 2 0 0 1 2 2v3M3 7v11a2 2 0 0 0 2 2h7m5-5v6m-3-3h6',
        message:'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-6 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 5h8m-8 4h5',
        messageAdd:'M12 18h-1l-6 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5m-4 3v7m-3-3.5h6',
        search:'m16 16 4.5 4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
        chevron:'m9 5 7 7-7 7',
        expand:'M5 9V4h5m9 11v5h-5M9 5l-4 4m10 10 4-4',
        collapse:'M4 9h5V4m11 11h-5v5M5 5l4 4m10 10-4-4',
        settings:'M4 6h16M4 12h16M4 18h16M9 4v4m6 2v4m-7 2v4',
        back:'M19 12H5m5-5-5 5 5 5',
        refresh:'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 11-1l3 3M4 15l3 3a7 7 0 0 0 11-1',
        archive:'M4 8h16v12H4V8Zm-1-5h18v5H3V3Zm6 9h6',
        restore:'M4 9h16v11H4V9Zm8 6V3m-4 4 4-4 4 4',
        close:'m6 6 12 12M6 18 18 6',
      };
      return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.65,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[name]}));
    }
    return {
      inject:['slots','locale','layout','uiWorkspace','workspaces'],
      apply(ctx) {
        ctx.effect(()=>ctx.locale.register('session-manager','zh',zh));
        ctx.effect(()=>ctx.locale.register('session-manager','en',en));
        const t=ctx.locale.bind('session-manager');
        let visibilitySnapshot={ready:false,revision:-1,hiddenWorkspaceIds:[],error:false};
        const visibilityListeners=new Set();
        const visibility={getSnapshot:()=>visibilitySnapshot,subscribe:fn=>{visibilityListeners.add(fn);return()=>visibilityListeners.delete(fn);}};
        const publishVisibility=value=>{visibilitySnapshot=value;visibilityListeners.forEach(fn=>fn());};
        let reconnectVisibility;
        ctx.effect(()=>{
          let source;
          const disconnect=()=>{if(source){source.onmessage=null;source.onerror=null;source.close();}};
          const connect=()=>{
          disconnect();
          source=new EventSource(new URL('./session-manager/visibility',document.baseURI),{withCredentials:true});
          source.onmessage=event=>{
            try {
              const value=JSON.parse(event.data);
              if(!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.hiddenWorkspaceIds)||!value.hiddenWorkspaceIds.every(id=>typeof id==='string'))throw Error('Invalid workspace visibility snapshot');
              if(value.revision<visibilitySnapshot.revision||value.revision===visibilitySnapshot.revision&&visibilitySnapshot.ready&&!visibilitySnapshot.error)return;
              publishVisibility({...value,ready:true,error:false});
            }catch(error){console.error('Workspace visibility stream:',error);publishVisibility({...visibilitySnapshot,error:true});}
          };
          source.onerror=()=>publishVisibility({...visibilitySnapshot,error:true});
          };
          reconnectVisibility=connect;
          connect();
          return()=>{reconnectVisibility=undefined;disconnect();};
        });
        const journalKey='dsh-session-manager.pending.v1';
        let pending=null;
        try { const saved=JSON.parse(sessionStorage.getItem(journalKey)||'null'); if(saved&&typeof saved.requestId==='string'&&['create','move','delete','archive','restore','purge','setWorkspaceVisibility','batchDelete'].includes(saved.action))pending=saved; } catch {}
        const listeners=new Set();
        let revision=0;
        let inFlight=false;
        let completedRevision=0;
        const publish=()=>{revision++;listeners.forEach(fn=>fn());};
        const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
        const savePending=value=>{if(value)sessionStorage.setItem(journalKey,JSON.stringify(value));else sessionStorage.removeItem(journalKey);pending=value;publish();};
        async function api(request,signal) {
          const response=await fetch(new URL('./session-manager/api',document.baseURI),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal});
          if(!response.ok)throw Error(`HTTP ${response.status}`);
          return response.json();
        }
        const sidebarPreferenceKey='dsh-session-manager.sidebar.enabled.v1';
        let sidebarRequested=false,sidebarEnabled=false,sidebarError='';
        let sidebarRegistration;
        function sidebarRegistrationFailed(error) {
          sidebarEnabled=false;sidebarError=`${t('sidebarFailed')} ${error.message}`;
          console.error('session-manager sidebar registration:',error);publish();
        }
        function setSidebarEnabled(enabled,remember=true) {
          sidebarRequested=enabled;
          if(remember){
            sidebarError='';
            try{localStorage.setItem(sidebarPreferenceKey,String(enabled));}
            catch(error){sidebarError=`${t('sidebarPreferenceError')} ${error.message}`;}
          }
          if(!enabled){sidebarRegistration?.();sidebarRegistration=undefined;sidebarEnabled=false;publish();return;}
          if(sidebarRegistration&&sidebarEnabled){publish();return;}
          sidebarRegistration?.();sidebarRegistration=undefined;
          try {
            sidebarRegistration=ctx.slots.inject('sidebar.workspaces',()=>{
              try {
                // Static client modules must explicitly shadow native priority 0.
                const dispose=ctx.slots.register({name:'sidebar.workspaces',priority:-1},SidebarBrowser);
                sidebarEnabled=true;publish();
                return()=>{dispose();sidebarEnabled=false;publish();};
              }catch(error){sidebarRegistrationFailed(error);}
            });
          }catch(error){sidebarRegistrationFailed(error);}
        }
        async function runPending(request) {
          if(inFlight)return;
          inFlight=true;publish();
          try {
            const result=await api(request);
            if(!result.ok&&['WRITE_UNCERTAIN','PENDING','RECOVERY_REQUIRED'].includes(result.code))return result;
            if(pending?.requestId===request.requestId)savePending(null);
            completedRevision++;publish();
            const sessions=ctx.get('sessions');if(sessions?.refresh)void sessions.refresh().catch(()=>{});
            return result;
          } finally {inFlight=false;publish();}
        }
        const sidebarCss=`
.smx{height:100%;min-height:0;min-width:0;display:flex;flex-direction:column;gap:10px;padding:12px 10px 10px;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1.45}.smx *{box-sizing:border-box}.smx svg{display:block;flex:none}.smx button,.smx input{font:inherit;color:inherit}.smx button{display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;background:transparent;border:0;border-radius:7px;min-height:28px;padding:5px 7px;transition:background .12s,color .12s}.smx button:hover{background:var(--dsw-alias-interactive-bg-hover)}.smx button:disabled{opacity:.4;cursor:default}.smx button:focus-visible,.smx input:focus-visible,.smx summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.smx-head{display:flex;align-items:center;gap:6px;padding:0 2px}.smx-heading-icon{display:grid;place-items:center;color:var(--dsw-alias-brand-primary);width:28px;height:28px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}.smx-head strong{flex:1;min-width:0;font-size:12px;font-weight:650;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.smx-toolbar{display:flex;gap:1px;flex:none}.smx .smx-icon{width:26px;height:28px;min-height:28px;padding:5px;color:var(--dsw-alias-label-secondary);flex:none}.smx .smx-icon:hover{color:var(--dsw-alias-label-primary)}.smx-toolbar .smx-primary{color:var(--dsw-alias-brand-primary)}
.smx-search-wrap{display:flex;align-items:center;gap:7px;padding:0 9px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;color:var(--dsw-alias-label-secondary);transition:border-color .12s}.smx-search-wrap:focus-within{border-color:var(--dsw-alias-brand-primary)}.smx .smx-search{width:100%;min-width:0;height:32px;padding:6px 0;border:0;outline:none;background:transparent;font-size:11px;color:var(--dsw-alias-label-primary)}.smx-search::placeholder{color:var(--dsw-alias-label-secondary);opacity:.8}.smx-search::-webkit-search-cancel-button{display:none}.smx-search-wrap .smx-icon{width:20px;min-height:24px;height:24px;padding:2px}
.smx-scroll{overflow:auto;min-height:0;flex:1;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent;padding:1px 0 8px}.smx-group{margin-bottom:7px}.smx-group-head{display:flex;align-items:center;gap:1px;min-height:33px;border-radius:7px;transition:background .12s}.smx-group-head:hover,.smx-group-head:focus-within{background:var(--dsw-alias-interactive-bg-hover)}.smx .smx-group-toggle{justify-content:flex-start;min-width:0;flex:1;gap:6px;text-align:left;padding:6px 4px;font-weight:600}.smx-chevron{display:flex;flex:none;color:var(--dsw-alias-label-secondary);transition:transform .12s}.smx-chevron[data-expanded=true]{transform:rotate(90deg)}.smx-folder{color:var(--dsw-alias-brand-primary);opacity:.85}.smx-label{min-width:0;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.smx-count{font-size:10px;font-weight:500;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2)}.smx-group-actions{display:flex;flex:none;gap:1px;opacity:.55}.smx-group-head:hover .smx-group-actions,.smx-group-head:focus-within .smx-group-actions{opacity:1}
.smx-list{margin:2px 0 0 11px;padding:0 0 0 12px;border-left:1px solid var(--dsw-alias-border-l1);list-style:none}.smx-list li+li{margin-top:2px}.smx-session-row{display:flex;align-items:center;min-width:0}.smx-list .smx-session-row .smx-session{flex:1;min-width:0;width:auto}.smx .smx-row-action{flex:none;width:25px;padding:4px}.smx-toolbar button[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary)}.smx-list .smx-session{position:relative;justify-content:flex-start;width:100%;min-height:32px;gap:8px;text-align:left;padding:7px 8px;border-radius:7px;color:var(--dsw-alias-label-secondary);font-size:12px}.smx-session:hover{color:var(--dsw-alias-label-primary)}.smx-session[aria-current=page]{font-weight:550;color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,var(--dsw-alias-bg-layer-1));box-shadow:inset 2px 0 var(--dsw-alias-brand-primary)}.smx-session-icon{display:flex;flex:none;opacity:.65}.smx-session[aria-current=page] .smx-session-icon{color:var(--dsw-alias-brand-primary);opacity:1}.smx-session-status{display:inline-flex;align-items:center;gap:5px;flex:none;max-width:108px;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:16px}.smx-status-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.smx-state{display:block;flex:none;width:6px;height:6px;border-radius:50%;background:currentColor}.smx-session-status[data-state=running]{color:var(--dsw-alias-state-business-primary)}.smx-session-status[data-state=running] .smx-state{box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)}.smx-session-status[data-state=waiting]{color:var(--dsw-alias-state-warn-primary)}.smx-session-status[data-state=waiting] .smx-state{width:7px;height:7px;border-radius:2px;transform:rotate(45deg)}.smx-session-status[data-state=completed]{color:var(--dsw-alias-state-success-primary)}.smx-session-status[data-state=idle] .smx-state{background:transparent;box-shadow:inset 0 0 0 1px currentColor;opacity:.5}
.smx-note{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:0;padding:9px 10px;border-radius:7px;font-size:11px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;background:var(--dsw-alias-bg-layer-1)}.smx-group>.smx-note{margin:2px 8px 4px 26px;padding:7px 8px;background:transparent}.smx-note button{color:var(--dsw-alias-brand-primary);font-size:11px}.smx-alert{padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);overflow-wrap:anywhere;font-size:11px;line-height:1.6}.smx-alert[role=alert]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 40%,var(--dsw-alias-border-l1))}.smx-alert button{margin-top:5px;color:var(--dsw-alias-brand-primary)}
.smx-hidden{border-top:1px solid var(--dsw-alias-border-l1);padding:9px 4px 0}.smx-hidden summary{display:flex;align-items:center;gap:7px;cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:11px;list-style:none;padding:3px 0}.smx-hidden summary::-webkit-details-marker{display:none}.smx-hidden summary .smx-chevron{margin-left:auto}.smx-hidden[open] summary .smx-chevron{transform:rotate(90deg)}.smx-hidden-row{display:flex;align-items:center;gap:7px;padding:5px 2px;font-size:11px;color:var(--dsw-alias-label-secondary)}.smx-rail{align-items:center;padding:9px 0;gap:8px}.smx-rail .smx-icon{width:32px;height:32px}.smx-footer{border-top:1px solid var(--dsw-alias-border-l1);padding-top:8px}.smx .smx-manage{justify-content:flex-start;width:100%;padding:7px 9px;font-size:11px;color:var(--dsw-alias-label-secondary)}.smx-manage .smx-chevron{margin-left:auto}
.smx-progress{display:flex;flex:none;color:var(--dsw-alias-brand-primary);padding-left:4px}.smx-progress svg{animation:smx-spin 1s linear infinite}@keyframes smx-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.smx-progress svg{animation:none}}.smx-session-row[aria-busy=true]{background:var(--dsw-alias-interactive-bg-hover)}
.smx-scroll{scrollbar-gutter:stable;overscroll-behavior:contain}.smx-hidden{max-height:35%;overflow:auto;flex-shrink:0;scrollbar-width:thin}.smx-session-row{border-radius:7px}.smx-session-row:hover,.smx-session-row:focus-within{background:var(--dsw-alias-interactive-bg-hover)}.smx .smx-row-action{opacity:.55}.smx-session-row:hover .smx-row-action,.smx-session-row:focus-within .smx-row-action{opacity:1}.smx-segments{display:flex;gap:3px;padding:3px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1)}.smx-segments button{flex:1;min-width:0;font-size:11px;white-space:nowrap}.smx-segments button[aria-pressed=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);font-weight:600}
@media(prefers-reduced-motion:reduce){.smx button,.smx-chevron,.smx-search-wrap,.smx-group-head{transition:none}}
`;
        function SidebarBrowser({wide,expandSidebar,useSessions,useWorkspaces,useSessionStatus,usePanelInfo}) {
          React.useSyncExternalStore(ctx.locale.subscribe.bind(ctx.locale),ctx.locale.getSnapshot.bind(ctx.locale));
          React.useSyncExternalStore(subscribe,()=>revision);
          const state=React.useSyncExternalStore(visibility.subscribe,visibility.getSnapshot);
          const list=useSessions(value=>value),catalog=useWorkspaces(value=>value),statuses=useSessionStatus(value=>value);
          const panel=usePanelInfo(value=>value.activePanelId);
          const [query,setQuery]=React.useState(''),[collapsed,setCollapsed]=React.useState({}),[error,setError]=React.useState('');
          const [showArchived,setShowArchived]=React.useState(false),[dialog,setDialog]=React.useState(null),[preparing,setPreparing]=React.useState(null);
          const preparation=React.useRef(null);
          const [addingWorkspace,setAddingWorkspace]=React.useState(false),[workspaceNotice,setWorkspaceNotice]=React.useState(''),[createdSessionId,setCreatedSessionId]=React.useState('');
          const addWorkspaceFlight=React.useRef(false),alive=React.useRef(true);
          React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
          const latest=React.useRef();latest.current={catalog,state};
          const current=Object.values(list.byId).find(item=>(item.retainedBy.mainView??0)>0)?.id;
          const hidden=React.useMemo(()=>new Set(state.hiddenWorkspaceIds),[state.hiddenWorkspaceIds]);
          const needle=query.trim().toLocaleLowerCase();
          const titleOf=workspace=>workspace.title==='default-workspace'?t('defaultWorkspace'):(workspace.title||workspace.path);
          const orderedGroups=React.useMemo(()=>{
            const archived=new Set(catalog.archivedSessionIds),pinned=new Set(catalog.pinnedSessionIds);
            // Account for ALL workspaces before hiding any, so hidden sessions
            // can never leak into the synthetic ungrouped section.
            const accounted=new Set(catalog.items.flatMap(workspace=>workspace.sessionIds));
            const members=[...catalog.items.filter(workspace=>!hidden.has(workspace.workspaceId)).map(workspace=>({id:workspace.workspaceId,title:titleOf(workspace),path:workspace.path,ids:workspace.sessionIds})),{id:'',title:t('ungrouped'),path:'',ids:list.ids.filter(id=>!accounted.has(id))}];
            return members.map(group=>{
              const rows=group.ids.map(id=>list.byId[id]).filter(item=>item&&item.origin!=='subagent'&&(showArchived||!item.blank||item.id===current)&&archived.has(item.id)===showArchived);
              rows.sort((a,b)=>Number(b.id===current&&b.blank)-Number(a.id===current&&a.blank)||Number(pinned.has(b.id))-Number(pinned.has(a.id))||b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
              return {...group,rows};
            }).filter(group=>group.id||group.rows.length);
          },[catalog.items,catalog.archivedSessionIds,catalog.pinnedSessionIds,list.ids,list.byId,hidden,current,showArchived,ctx.locale.getLocale().active]);
          const groups=React.useMemo(()=>!needle?orderedGroups:orderedGroups.flatMap(group=>{
            if(`${group.title} ${group.path}`.toLocaleLowerCase().includes(needle))return [group];
            const rows=group.rows.filter(item=>`${item.title||''} ${item.id}`.toLocaleLowerCase().includes(needle));
            return rows.length?[{...group,rows}]:[];
          }),[orderedGroups,needle]);
          const hiddenWorkspaces=catalog.items.filter(workspace=>hidden.has(workspace.workspaceId));
          // Carrier reconnects retain their last complete snapshots. Keep them
          // visible, but never enable writes against a disconnected catalog.
          const ready=state.ready&&catalog.phase==='ready'&&list.phase==='ready';
          const connected=ready&&!state.error&&catalog.state==='idle';
          const locked=inFlight||!!pending||preparing||!connected;
          const manage=()=>ctx.layout.selectPanel('session-manager');
          async function addWorkspace() {
            if(addWorkspaceFlight.current||locked)return;
            addWorkspaceFlight.current=true;setAddingWorkspace(true);setError('');setWorkspaceNotice('');setCreatedSessionId('');
            try {
              const path=await ctx.uiWorkspace.pickDirectory();
              if(path===null||!alive.current)return;
              const workspace=await ctx.workspaces.create({path});
              if(!alive.current)return;
              setQuery('');setCollapsed(value=>({...value,[workspace.workspaceId]:false}));
              setWorkspaceNotice(t(latest.current.state.hiddenWorkspaceIds.includes(workspace.workspaceId)?'workspaceAlreadyHidden':'workspaceAdded'));
            }catch(reason){if(alive.current)setError(reason.message);}
            finally{addWorkspaceFlight.current=false;if(alive.current)setAddingWorkspace(false);}
          }
          async function submit(request) {
            setError('');
            let result;
            try {result=await runPending(request);}
            catch(reason){if(alive.current)setError(`${t('pending')} ${reason.message}`);return;}
            if(!alive.current||!result)return;
            if(!result.ok){setError([result.error||t('failed'),result.code==='CONFLICT'?t('refreshFirst'):''].filter(Boolean).join(' '));return;}
            if(request.action==='create'){
              setQuery('');setCollapsed(value=>({...value,[request.workspaceId]:false}));
              setCreatedSessionId(result.sessionId);setWorkspaceNotice(result.message||t('success'));
              try {ctx.uiWorkspace.openSession(result.sessionId);}catch(reason){setError(reason.message);}
            }
          }
          function createSession(workspaceId) {
            const live=latest.current;
            if(inFlight||pending||addWorkspaceFlight.current||!live.state.ready||live.state.error||live.catalog.state!=='idle'||live.state.hiddenWorkspaceIds.includes(workspaceId)||!live.catalog.items.some(item=>item.workspaceId===workspaceId))return;
            const request={action:'create',workspaceId,requestId:crypto.randomUUID()};
            try {savePending(request);}catch{setError(t('journalFailed'));return;}
            setCreatedSessionId('');setWorkspaceNotice('');
            void submit(request);
          }
          function changeVisibility(workspace,hide) {
            const live=latest.current;
            if(inFlight||pending||!live.state.ready||live.state.error||live.catalog.state!=='idle'||!live.catalog.items.some(item=>item.workspaceId===workspace.workspaceId))return;
            const request={action:'setWorkspaceVisibility',workspaceId:workspace.workspaceId,hidden:hide,expectedVisibilityRevision:live.state.revision,requestId:crypto.randomUUID()};
            try {savePending(request);}catch{setError(t('journalFailed'));return;}
            void submit(request);
          }
          async function prepareArchive(item,action=showArchived?'restore':'archive') {
            if(locked||addingWorkspace||preparation.current)return;
            preparation.current={id:item.id,action};
            setPreparing(preparation.current);setError('');
            try {
              const result=await api({action:'list',sessionId:item.id,archived:showArchived,limit:1});
              if(!alive.current)return;
              if(!result.ok)throw Error(result.error||t('failed'));
              const row=result.items.find(value=>value.sessionId===item.id);
              if(!row?.token||row.running)throw Error(t('unavailable'));
              if(action==='purge'&&!row.purgeRevision)throw Error(t('purgeUnavailable'));
              setDialog({action,item:row,requestId:crypto.randomUUID()});
            }catch(reason){if(alive.current)setError(reason.message);}
            finally{preparation.current=null;if(alive.current)setPreparing(null);}
          }
          function confirmArchive() {
            if(!dialog||locked)return;
            const request={action:dialog.action,sessionId:dialog.item.sessionId,expectedToken:dialog.item.token,...(dialog.action==='purge'?{expectedStorageRevision:dialog.item.purgeRevision}:{}),requestId:dialog.requestId};
            try{savePending(request);}catch{setError(t('journalFailed'));return;}
            setDialog(null);void submit(request);
          }
          function open(id) {
            if(!list.byId[id]||latest.current.catalog.archivedSessionIds.includes(id)){setError(t('archivedHint'));return;}
            try {ctx.uiWorkspace.openSession(id);setError('');}catch(reason){setError(reason.message);}
          }
          if(!wide)return h('section',{className:'smx smx-rail','aria-label':t('browser')},h('style',null,sidebarCss),h('button',{className:'smx-icon',title:t('browser'),'aria-label':t('browser'),onClick:expandSidebar},h(SidebarIcon,{name:'folder',size:19})),h('button',{className:'smx-icon',title:t('manage'),'aria-label':t('manage'),onClick:manage},h(SidebarIcon,{name:'settings',size:18})),h('button',{className:'smx-icon',title:t('addWorkspace'),'aria-label':t('addWorkspace'),disabled:addingWorkspace||locked,onClick:()=>{expandSidebar();void addWorkspace();}},h(SidebarIcon,{name:'folderAdd',size:19})));
          return h('section',{className:'smx','aria-label':t('browser'),'data-session-manager-sidebar':true},h('style',null,sidebarCss),
            h('header',{className:'smx-head'},h('span',{className:'smx-heading-icon'},h(SidebarIcon,{name:'folder',size:16})),h('strong',null,t('browser')),h('div',{className:'smx-toolbar'},h('button',{className:'smx-icon smx-primary',title:t('addWorkspace'),'aria-label':t('addWorkspace'),disabled:addingWorkspace||locked,onClick:()=>void addWorkspace()},h(SidebarIcon,{name:'folderAdd'})),h('button',{className:'smx-icon',title:t('expandAll'),'aria-label':t('expandAll'),onClick:()=>setCollapsed({})},h(SidebarIcon,{name:'expand',size:15})),h('button',{className:'smx-icon',title:t('collapseAll'),'aria-label':t('collapseAll'),onClick:()=>{setQuery('');setCollapsed(Object.fromEntries([...catalog.items.map(workspace=>[workspace.workspaceId,true]),['',true]]));}},h(SidebarIcon,{name:'collapse',size:15})))),
            h('div',{className:'smx-search-wrap'},h(SidebarIcon,{name:'search',size:14}),h('input',{className:'smx-search',type:'search',value:query,placeholder:t('browserSearch'),'aria-label':t('browserSearch'),title:t('sidebarScope'),maxLength:500,onChange:event=>setQuery(event.target.value)}),query&&h('button',{className:'smx-icon',title:t('clearSearch'),'aria-label':t('clearSearch'),onClick:()=>setQuery('')},h(SidebarIcon,{name:'close',size:13}))),
            h('div',{className:'smx-segments','aria-label':t('archivedSessions')},h('button',{'aria-pressed':!showArchived,onClick:()=>{setShowArchived(false);setQuery('');}},t('activeSessions')),h('button',{'aria-pressed':showArchived,onClick:()=>{setShowArchived(true);setQuery('');}},h(SidebarIcon,{name:'archive',size:14}),t('archivedSessions'))),
            ready&&!connected&&h('p',{className:'smx-note',role:'status'},t(state.error?'visibilityError':'listError'),state.error&&h('button',{className:'smx-icon',title:t('refresh'),'aria-label':t('refresh'),onClick:()=>reconnectVisibility?.()},h(SidebarIcon,{name:'refresh',size:14}))),
            addingWorkspace&&h('p',{className:'smx-note',role:'status'},t('addingWorkspace')),
            workspaceNotice&&h('div',{className:'smx-note',role:'status'},workspaceNotice,createdSessionId&&h('button',{onClick:()=>open(createdSessionId)},t('completedOpen'))),
            error&&h('div',{className:'smx-alert',role:'alert'},error),
            pending&&h('div',{className:'smx-alert',role:'status'},h('div',null,t('pendingHint')),h('button',{disabled:inFlight,onClick:()=>void submit(pending)},t(inFlight?'busy':'retryOriginal'))),
            h('div',{className:'smx-scroll'},!ready?h('p',{className:'smx-note',role:state.error||catalog.state==='error'?'alert':'status'},t(state.error?'visibilityError':catalog.state==='error'?'listError':!state.ready?'visibilityConnecting':'initialConnection'),state.error&&h('button',{className:'smx-icon',title:t('refresh'),'aria-label':t('refresh'),onClick:()=>reconnectVisibility?.()},h(SidebarIcon,{name:'refresh',size:14}))):groups.length?groups.map(group=>{
              const expanded=!!needle||!collapsed[group.id];
              return h('section',{className:'smx-group',key:group.id},h('div',{className:'smx-group-head'},h('button',{className:'smx-group-toggle','aria-expanded':expanded,title:group.path||group.title,onClick:()=>{if(needle)setQuery('');setCollapsed(value=>({...value,[group.id]:expanded}));}},h('span',{className:'smx-chevron','data-expanded':expanded},h(SidebarIcon,{name:'chevron',size:11})),h('span',{className:'smx-folder'},h(SidebarIcon,{name:'folder',size:15})),h('span',{className:'smx-label'},group.title),h('span',{className:'smx-count'},group.rows.length)),group.id&&h('div',{className:'smx-group-actions'},h('button',{className:'smx-icon',title:t('create')+' · '+group.title,'aria-label':t('create')+' · '+group.title,disabled:locked||addingWorkspace,onClick:()=>createSession(group.id)},h(SidebarIcon,{name:'messageAdd',size:15})),h('button',{className:'smx-icon',title:t('hideWorkspace')+' · '+group.title,'aria-label':t('hideWorkspace')+' · '+group.title,disabled:locked,onClick:()=>changeVisibility(catalog.items.find(item=>item.workspaceId===group.id),true)},h(EyeIcon,{size:14})))),
              expanded&&(group.rows.length?h('ul',{className:'smx-list'},group.rows.map(item=>{
                const status=statuses.get(item.id),running=status?.running??item.running;
                const interaction=status?.pendingInteraction?.kind;
                const waitingKey=interaction==='approval'?'statusApproval':interaction==='plan-review'?'statusPlanReview':interaction==='question'?'statusAnswer':null;
                const childCount=list.projectionsBySession[item.id]?.values.subagentCatalog?.reduce((count,child)=>count+((statuses.get(child.id)?.running??list.byId[child.id]?.running)===true?1:0),0)??0;
                const childLabel=childCount?t('statusSubagentsRunning',{n:childCount}):'';
                const label=item.blank?t('untitled'):(item.title||item.id);
                // Match native priority: interaction > live parent/child activity > unread completion > idle.
                const stateName=waitingKey?'waiting':running||childCount?'running':status?.completionUnread?'completed':'idle';
                const primaryLabel=waitingKey?t(waitingKey):running?t('running'):childCount?childLabel:t(status?.completionUnread?'completed':'idle');
                const stateLabel=[primaryLabel,childCount&&(waitingKey||running)?childLabel:''].filter(Boolean).join(' · ');
                const stateText=stateName==='completed'?t('statusDone'):primaryLabel;
                const rowBusy=preparing?.id===item.id||(inFlight&&pending?.sessionId===item.id);
                return h('li',{key:item.id,className:'smx-session-row','aria-busy':!!rowBusy},rowBusy&&h('span',{className:'smx-progress',role:'status',title:t(preparing?.id===item.id?'loading':'busy'),'aria-label':t(preparing?.id===item.id?'loading':'busy')},h(SidebarIcon,{name:'refresh',size:13})),h('button',{className:'smx-session','aria-current':panel===null&&item.id===current?'page':undefined,disabled:showArchived,title:`${label}\n${item.id}\n${stateLabel}`,onClick:()=>open(item.id)},h('span',{className:'smx-session-icon'},h(SidebarIcon,{name:showArchived?'archive':'message',size:14})),h('span',{className:'smx-label'},label),!showArchived&&!item.blank&&h('span',{className:'smx-session-status','data-state':stateName,role:'img','aria-label':stateLabel,title:stateLabel},h('span',{className:'smx-state','aria-hidden':true}),stateName!=='idle'&&h('span',{className:'smx-status-text','aria-hidden':true},stateText))),h('button',{className:'smx-icon smx-row-action',disabled:locked||running,title:t(showArchived?'restore':'archive')+' · '+label,'aria-label':t(showArchived?'restore':'archive')+' · '+label,onClick:()=>void prepareArchive(item)},h(SidebarIcon,{name:showArchived?'restore':'archive',size:14})),showArchived&&h('button',{className:'smx-icon smx-row-action',disabled:locked||running,title:t('purge')+' · '+label,'aria-label':t('purge')+' · '+label,onClick:()=>void prepareArchive(item,'purge')},h(SidebarIcon,{name:'trash',size:14})));
              })):h('p',{className:'smx-note'},t('noSessions'))));
            }):h('p',{className:'smx-note'},t(!needle&&hiddenWorkspaces.length===catalog.items.length&&hiddenWorkspaces.length?'noVisibleWorkspaces':'empty'))),
            hiddenWorkspaces.length>0&&h('details',{className:'smx-hidden',open:groups.length===0&&!needle?true:undefined},h('summary',null,h(EyeIcon,{hidden:true,size:14}),t('hiddenWorkspaces'),h('span',{className:'smx-count'},hiddenWorkspaces.length),h('span',{className:'smx-chevron'},h(SidebarIcon,{name:'chevron',size:11}))),hiddenWorkspaces.map(workspace=>h('div',{className:'smx-hidden-row',key:workspace.workspaceId},h(SidebarIcon,{name:'folder',size:14}),h('span',{className:'smx-label',title:workspace.path},titleOf(workspace)),h('button',{className:'smx-icon',disabled:locked,title:t('showWorkspace')+' · '+titleOf(workspace),'aria-label':t('showWorkspace')+' · '+titleOf(workspace),onClick:()=>changeVisibility(workspace,false)},h(EyeIcon,{size:14}))))),
            h('footer',{className:'smx-footer'},h('button',{className:'smx-manage',onClick:manage},h(SidebarIcon,{name:'settings',size:15}),t('manage'),h('span',{className:'smx-chevron'},h(SidebarIcon,{name:'chevron',size:12})))),
            dialog&&h(React.Fragment,null,h('style',null,css),h(Dialog,{model:dialog,workspaces:[],onCancel:()=>setDialog(null),onConfirm:confirmArchive,busy:inFlight||!!pending,confirmDisabled:locked})));
        }
        function Dialog({model,workspaces,onCancel,onConfirm,busy,confirmDisabled=false}) {
          const [target,setTarget]=React.useState(model.action==='create'?(workspaces.find(w=>w.id===model.workspaceId&&!w.hidden)?.id||workspaces.find(w=>!w.hidden)?.id||''):'');
          const ref=React.useRef(null);
          React.useEffect(()=>{
            const previous=document.activeElement; const root=ref.current;
            const first=root?.querySelector('select,button');first?.focus();
            return()=>{if(previous?.isConnected)previous.focus();};
          },[]);
          const needsTarget=['create','move'].includes(model.action);
          const choices=workspaces.filter(w=>!w.hidden&&(model.action!=='move'||w.id!==model.item?.workspaceId));
          const keydown=event=>{
            if(event.key==='Escape'&&!busy){event.preventDefault();onCancel();}
            if(event.key==='Tab'){
              const nodes=Array.from(ref.current?.querySelectorAll('button:not(:disabled),select:not(:disabled)')||[]);
              const first=nodes[0],last=nodes.at(-1);
              if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
              else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
            }
          };
          return h('div',{className:'sm-modal',onKeyDown:keydown},h('section',{ref,className:'sm-dialog',role:'dialog','aria-modal':true,'aria-labelledby':'sm-dialog-title'},
            h('h2',{id:'sm-dialog-title'},t(model.action==='create'?'create':model.action==='move'?'confirmMove':model.action==='purge'?'confirmPurge':model.action==='archive'?'confirmArchive':model.action==='delete'?'confirmDelete':model.action==='batchDelete'?'confirmBatchDelete':'confirmRestore')),
            model.item&&h('div',{className:'sm-dialog-summary'},h('strong',null,model.item.title||model.item.sessionId),h('div',{className:'sm-id'},model.item.sessionId)),
            h('p',{className:'sm-muted'},t(model.action==='create'?'createNote':model.action==='move'?'moveNote':model.action==='purge'?'purgeNote':model.action==='archive'?'archiveNote':model.action==='delete'?'deleteNote':model.action==='batchDelete'?'batchDeleteNote':'restoreNote')),
            model.action==='batchDelete'&&h('div',null,h('strong',null,t('selected'),' ',model.items.length),h('ul',{className:'sm-dialog-list'},model.items.map(item=>h('li',{key:item.sessionId},h('strong',null,item.title||item.sessionId),h('div',{className:'sm-id'},item.sessionId))))),
            needsTarget&&h('label',null,t(model.action==='move'?'target':'workspace'),h('select',{value:target,onChange:e=>setTarget(e.target.value),disabled:busy},h('option',{value:''},t('selectWorkspace')),choices.map(w=>h('option',{key:w.id,value:w.id},`${w.title} · ${w.path}`)))),
            needsTarget&&!choices.length&&h('p',null,t('noWorkspace')),
            h('div',{className:'sm-dialog-foot'},h('button',{onClick:onCancel,disabled:busy},t('cancel')),h('button',{className:['delete','batchDelete','purge'].includes(model.action)?'sm-danger':'sm-primary',disabled:busy||confirmDisabled||(needsTarget&&!choices.some(w=>w.id===target)),onClick:()=>{if(!needsTarget||choices.some(w=>w.id===target))onConfirm(target);}},t(busy?'busy':model.action==='create'?'create':model.action==='move'?'confirmMove':model.action==='purge'?'confirmPurge':model.action==='archive'?'confirmArchive':model.action==='delete'?'confirmDelete':model.action==='batchDelete'?'confirmBatchDelete':'confirmRestore')))));
        }
        function Page() {
          React.useSyncExternalStore(ctx.locale.subscribe.bind(ctx.locale),ctx.locale.getSnapshot.bind(ctx.locale));
          React.useSyncExternalStore(subscribe,()=>revision);
          const liveVisibility=React.useSyncExternalStore(visibility.subscribe,visibility.getSnapshot);
          const [data,setData]=React.useState({workspaces:[],items:[],total:0});
          const [visibilityExpanded,setVisibilityExpanded]=React.useState(false);
          const [loadedScope,setLoadedScope]=React.useState('');
          const [selected,setSelected]=React.useState({});
          const [query,setQuery]=React.useState(''),[filter,setFilter]=React.useState(''),[archived,setArchived]=React.useState(false),[includeHidden,setIncludeHidden]=React.useState(false),[offset,setOffset]=React.useState(0),[refresh,setRefresh]=React.useState(0);
          const [loading,setLoading]=React.useState(true),[readError,setReadError]=React.useState(''),[busy,setBusy]=React.useState(false),[notice,setNotice]=React.useState(null),[dialog,setDialog]=React.useState(null);
          const scope=JSON.stringify([query,filter,archived,includeHidden,offset,liveVisibility.revision]);
          const sameScope=loadedScope===scope;
          const alive=React.useRef(true);const serial=React.useRef(0);
          React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
          React.useEffect(()=>{
            const abort=new AbortController();const current=++serial.current;setLoading(true);setReadError('');setSelected({});
            const timer=setTimeout(()=>{api({action:'list',query,workspaceId:filter||undefined,archived,includeHidden,offset,limit:30},abort.signal).then(value=>{
              if(abort.signal.aborted||current!==serial.current)return;
              if(!value.ok)throw Error(value.error||t('failed'));
              setData(value);setLoadedScope(scope);setLoading(false);
            }).catch(error=>{if(!abort.signal.aborted&&current===serial.current){setReadError(error.message);setLoading(false);}});},query?220:0);
            return()=>{clearTimeout(timer);abort.abort();};
          },[query,filter,archived,includeHidden,offset,refresh,completedRevision,liveVisibility.revision]);
          const open=id=>ctx.uiWorkspace.openSession(id);
          async function execute(request) {
            if(inFlight)return;setBusy(true);
            try {
              const result=await runPending(request);
              if(!result.ok&&['WRITE_UNCERTAIN','PENDING','RECOVERY_REQUIRED'].includes(result.code)){
                if(alive.current)setNotice({error:true,text:result.error||t('pending')});return;
              }
              if(!alive.current)return;
              if(result.ok){
                if(request.action==='setWorkspaceVisibility')setOffset(0);
                setDialog(null);setSelected({});setNotice({text:result.message||t('success'),error:request.action==='batchDelete'&&result.failed>0,results:request.action==='batchDelete'?result.results:undefined,sessionId:['create','move','restore'].includes(request.action)?result.sessionId:undefined});
              }
              else {setDialog(null);setNotice({error:true,text:[result.error||t('failed'),result.code==='CONFLICT'?t('refreshFirst'):''].filter(Boolean).join(' ')});}
              // runPending publishes completedRevision once for every settled write.
            }catch(error){if(alive.current)setNotice({error:true,key:'pending',detail:error.message});}
            finally{if(alive.current)setBusy(false);}
          }
          function confirm(target) {
            if(inFlight||pending)return;
            const request={action:dialog.action,requestId:crypto.randomUUID()};
            if(dialog.item){request.sessionId=dialog.item.sessionId;request.expectedToken=dialog.item.token;}
            if(dialog.action==='purge')request.expectedStorageRevision=dialog.item.purgeRevision;
            if(dialog.action==='batchDelete')request.items=dialog.items.map(item=>({sessionId:item.sessionId,expectedToken:item.token}));
            if(target)request.workspaceId=target;
            try{savePending(request);}catch{setNotice({error:true,key:'journalFailed'});return;}
            setDialog(null);
            void execute(request);
          }
          function setVisibility(workspace) {
            if(inFlight||pending||loading||readError)return;
            if(!Number.isSafeInteger(data.visibilityRevision)){setNotice({error:true,key:'visibilityUnavailable'});return;}
            const request={action:'setWorkspaceVisibility',workspaceId:workspace.id,hidden:!workspace.hidden,expectedVisibilityRevision:data.visibilityRevision,requestId:crypto.randomUUID()};
            try{savePending(request);}catch{setNotice({error:true,key:'journalFailed'});return;}
            void execute(request);
          }
          const lock=busy||inFlight||!!pending||loading||!sameScope||!!readError;
          const workspaces=data.workspaces||[];
          const visibleWorkspaces=workspaces.filter(w=>!w.hidden);
          const browsableWorkspaces=includeHidden?workspaces:visibleWorkspaces;
          const hiddenCount=workspaces.length-visibleWorkspaces.length;
          React.useEffect(()=>{if(!includeHidden&&data.workspaces?.some(w=>w.id===filter&&w.hidden)){setFilter('');setOffset(0);}},[includeHidden,data.workspaces,filter]);
          const workspaceName=item=>workspaces.find(w=>w.id===item.workspaceId)?.title||t('ungrouped');
          const date=value=>{if(!Number.isFinite(value)||!Number.isFinite(new Date(value).getTime()))return '—';try{return new Date(value).toLocaleString(ctx.locale.getLocale().active,{dateStyle:'medium',timeStyle:'short'});}catch{return new Date(value).toLocaleString();}};
          const rows=data.items||[];
          const eligibleRows=rows.filter(item=>!item.archived&&!item.running&&item.token&&!item.readError);
          const selectedRows=eligibleRows.filter(item=>selected[item.sessionId]);
          const allPageSelected=eligibleRows.length>0&&selectedRows.length===eligibleRows.length;
          function choosePage(onlyEmpty=false) {
            if(lock)return;
            setSelected(Object.fromEntries(eligibleRows.filter(item=>!onlyEmpty||item.empty===true).map(item=>[item.sessionId,true])));
          }
          function openBatchDelete() {
            if(lock||!selectedRows.length)return;
            setDialog({action:'batchDelete',items:selectedRows.map(item=>({...item}))});
          }
          return h('div',{className:'sm'},h('style',null,css),h('div',{className:'sm-wrap'},
            h('header',{className:'sm-head'},h('div',null,h('h1',null,t('title')),h('p',{className:'sm-muted'},t('subtitle'))),h('div',{className:'sm-row'},h('button',{onClick:()=>ctx.layout.selectPanel('conversation')},h(SidebarIcon,{name:'back',size:15}),t('back')),h('button',{onClick:()=>setRefresh(x=>x+1),disabled:busy},h(SidebarIcon,{name:'refresh',size:15}),t('refresh')),h('button',{className:'sm-primary',disabled:lock||!visibleWorkspaces.length,onClick:()=>setDialog({action:'create',workspaceId:filter})},h(SidebarIcon,{name:'messageAdd',size:16}),t('create')))),
            h('div',{className:'sm-note'},h('label',{className:'sm-include-hidden'},h('input',{type:'checkbox',checked:sidebarRequested,onChange:event=>setSidebarEnabled(event.target.checked)}),t('sidebarToggle')),h('span',null,t('sidebarNote'))),
            sidebarError&&h('div',{className:'sm-alert','data-error':true,role:'alert'},sidebarError),
            h('details',{className:'sm-workspaces',open:visibilityExpanded,onToggle:event=>setVisibilityExpanded(event.currentTarget.open)},h('summary',null,t('workspaceVisibility'),' · ',visibleWorkspaces.length,' / ',workspaces.length),h('p',{className:'sm-muted'},t('visibilityHint')),h('div',{className:'sm-workspace-grid'},workspaces.map(w=>h('div',{key:w.id,className:'sm-workspace','data-hidden':!!w.hidden},h('div',{className:'sm-workspace-text'},h('div',{className:'sm-workspace-title'},w.title),h('div',{className:'sm-workspace-path',title:w.path},w.path)),h('button',{type:'button',className:'sm-eye',disabled:lock||!Number.isSafeInteger(data.visibilityRevision),title:t(w.hidden?'showWorkspace':'hideWorkspace')+' · '+w.title,'aria-label':t(w.hidden?'showWorkspace':'hideWorkspace')+' · '+w.title,'aria-pressed':!w.hidden,onClick:()=>setVisibility(w)},h(EyeIcon,{hidden:!!w.hidden}),h('span',null,t(w.hidden?'workspaceHidden':'workspaceVisible'))))))),
            h('div',{className:'sm-tabs'},[false,true].map(value=>h('button',{key:String(value),'aria-pressed':archived===value,onClick:()=>{setArchived(value);setOffset(0);}},t(value?'archivedSessions':'active')))),
            h('div',{className:'sm-filters'},h('input',{type:'search',value:query,placeholder:t('search'),'aria-label':t('search'),onChange:e=>{setQuery(e.target.value);setOffset(0);}}),h('select',{'aria-label':t('workspace'),value:filter,onChange:e=>{setFilter(e.target.value);setOffset(0);}},h('option',{value:''},t('allWorkspaces')),browsableWorkspaces.map(w=>h('option',{key:w.id,value:w.id},w.title+(w.hidden?' · '+t('workspaceHidden'):'')))),h('label',{className:'sm-include-hidden'},h('input',{type:'checkbox',checked:includeHidden,onChange:e=>{setIncludeHidden(e.target.checked);setOffset(0);}}),t('showHidden'),hiddenCount?' ('+hiddenCount+')':'')),
            notice&&h('div',{className:'sm-alert','data-error':!!notice.error,role:notice.error?'alert':'status'},h('div',null,notice.key?[t(notice.key),notice.detail].filter(Boolean).join(' '):notice.text),notice.results&&h('details',null,h('summary',null,t('batchResults')),h('ul',{className:'sm-result-list'},notice.results.map(result=>h('li',{key:result.sessionId},h('span',{className:'sm-id'},result.sessionId),' · ',t(result.ok?'batchSucceeded':'batchFailed'),result.error?' · '+result.error:'')))),h('div',{className:'sm-row',style:{marginTop:8}},notice.sessionId&&h('button',{onClick:()=>open(notice.sessionId)},t('completedOpen')),h('button',{onClick:()=>setNotice(null)},t('dismiss')))),
            pending&&h('div',{className:'sm-alert',role:'status'},h('div',null,t('pendingHint')),h('div',{className:'sm-id'},pending.requestId),h('button',{disabled:busy||inFlight,onClick:()=>void execute(pending)},t(busy||inFlight?'busy':'retryOriginal'))),
            h('div',{className:'sm-note'},h(Icon,{size:16,info:true}),h('span',null,t('safeNote'))),
            archived&&h('p',{className:'sm-muted'},t('archivedHint')),
            !archived&&h('div',{className:'sm-bulk'},h('label',null,h('input',{type:'checkbox',checked:allPageSelected,'aria-label':t('selectAllPage'),disabled:lock||!eligibleRows.length,onChange:e=>e.target.checked?choosePage(false):setSelected({})}),t('selectAllPage')),h('button',{disabled:lock||!eligibleRows.some(item=>item.empty===true),onClick:()=>choosePage(true)},t('selectEmptyPage')),h('button',{disabled:lock||!selectedRows.length,onClick:()=>setSelected({})},t('clearSelection')),h('span',{className:'sm-bulk-count'},t('selected'),' ',selectedRows.length),h('button',{className:'sm-danger',disabled:lock||!selectedRows.length,onClick:openBatchDelete},t('batchDelete'))),
            !archived&&h('p',{className:'sm-muted'},t('batchHint')),
            h('div',{className:'sm-load-status',role:'status','aria-live':'polite'},loading?t('loading'):'\u00a0'),
             readError?h('div',{className:'sm-alert','data-error':true,role:'alert'},h('p',null,readError),h('button',{onClick:()=>setRefresh(x=>x+1)},t('retry'))):!sameScope?h('div',{className:'sm-skeleton','aria-hidden':true},[0,1,2,3].map(key=>h('div',{key,className:'sm-skeleton-row'},h('span'),h('span')))):!rows.length?h('div',{className:'sm-empty'},h(Icon,{size:32}),h('h2',null,t('empty')),h('p',{className:'sm-muted'},t('emptyHint'))):h('div',{className:'sm-list','aria-busy':busy||loading},rows.map(item=>h('article',{className:'sm-item',key:item.sessionId,'data-selected':!!selected[item.sessionId]},
              !archived&&h('label',{className:'sm-select'},h('input',{type:'checkbox',checked:!!selected[item.sessionId],disabled:lock||item.archived||item.running||!item.token||!!item.readError,'aria-label':t('selectSession')+' · '+(item.title||item.sessionId)+' · '+item.sessionId,onChange:e=>{const checked=e.target.checked;setSelected(current=>{const next={...current};if(checked)next[item.sessionId]=true;else delete next[item.sessionId];return next;});}})),
              h('div',{className:'sm-avatar'},h(Icon,{size:19})),h('div',{className:'sm-info'},h('div',{className:'sm-name'},item.title||item.sessionId),h('div',{className:'sm-muted sm-path',title:[workspaceName(item),item.cwd].filter(Boolean).join(' · ')},workspaceName(item),item.cwd?' · '+item.cwd:''),h('div',{className:'sm-meta'},h('span',{className:'sm-tag','data-running':item.running},t(item.readError?'unreadable':item.archived?'deleted':item.running?'running':'idle')),item.empty===true&&h('span',{className:'sm-tag'},t('emptySession')),h('span',{className:'sm-muted'},t('updated')+' '+date(item.updatedAt))),h('div',{className:'sm-muted sm-id'},item.sessionId),item.readError&&h('p',{className:'sm-muted'},item.readError)),
              h('div',{className:'sm-actions'},!item.archived&&h('button',{onClick:()=>open(item.sessionId),disabled:busy||!!item.readError},t('open')),!item.archived&&h('button',{disabled:lock||item.running||!item.token||!visibleWorkspaces.some(w=>w.id!==item.workspaceId),title:item.running?t('unavailable'):t('move'),onClick:()=>setDialog({action:'move',item:{...item}})},t('move')),h('button',{className:item.archived?'sm-primary':'',disabled:lock||item.running||!item.token,title:item.running?t('unavailable'):undefined,onClick:()=>setDialog({action:item.archived?'restore':'archive',item:{...item}})},t(item.archived?'restore':'archive')),item.archived&&h('button',{className:'sm-danger',disabled:lock||item.running||!item.token||!item.purgeRevision,title:item.purgeRevision?t('purge'):t('purgeUnavailable'),onClick:()=>setDialog({action:'purge',item:{...item}})},t('purge')))))),
            h('footer',{className:'sm-footer'},h('span',{className:'sm-muted'},`${t('page')} ${rows.length} · ${t('total')} ${data.total||0}`),h('div',{className:'sm-row'},h('button',{disabled:loading||offset===0,onClick:()=>setOffset(x=>Math.max(0,x-30))},t('prev')),h('button',{disabled:loading||offset+30>=(data.total||0),onClick:()=>setOffset(x=>x+30)},t('next')))),
            dialog&&h(Dialog,{key:dialog.action+dialog.item?.sessionId,model:dialog,workspaces,onCancel:()=>setDialog(null),onConfirm:confirm,busy:busy||!!pending})
          ));
        }
        let restoreSidebar=false;
        try{restoreSidebar=localStorage.getItem(sidebarPreferenceKey)==='true';}
        catch(error){sidebarError=`${t('sidebarPreferenceError')} ${error.message}`;}
        if(restoreSidebar)setSidebarEnabled(true,false);
        ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'session-manager',order:16,label:()=>t('title')},Icon));
        ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'session-manager'},Page));
      },
    };
  },
});
