window.__ModuleLoader__.load({
  id: 'dsh-session-manager',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const zh = {
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
      browser:'工作区浏览器', browserSearch:'筛选工作区、会话标题或 ID', manage:'打开会话管理', collapseAll:'全部折叠', expandAll:'全部展开', hiddenWorkspaces:'已隐藏的工作区', sidebarToggle:'使用独立侧栏浏览器', sidebarNote:'记住此客户端的选择，刷新或重启后自动恢复；取消勾选会恢复原生列表。', sidebarFailed:'独立侧栏注册失败，已保留原生列表：', sidebarPreferenceError:'无法保存侧栏偏好，本次选择可能无法跨重启保留：', untitled:'新会话', defaultWorkspace:'默认工作区', noSessions:'暂无会话', visibilityConnecting:'正在连接工作区显示设置…', visibilityError:'显示设置连接中断，正在重连；为避免显示已隐藏内容，列表暂不可用。', listError:'工作区列表连接异常，请重新连接 DSH。', statusWaiting:'等待交互', sidebarScope:'按标题和 ID 筛选当前会话目录，不搜索消息正文。',
      workspaceVisibility:'工作区可见性', visibilityHint:'点击眼睛隐藏/显示本页及独立侧栏中的工作区和会话；隐藏项保留恢复入口。不改变原生侧栏数据，不会归档、删除或停止任务。', hideWorkspace:'隐藏工作区', showWorkspace:'显示工作区', workspaceVisible:'已显示', workspaceHidden:'已隐藏', showHidden:'显示已隐藏的会话', visibilityUnavailable:'请刷新后重试可见性设置', visibleCount:'显示中',
    };
    const en = {
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
      browser:'Workspace Explorer', browserSearch:'Filter workspaces, session titles or IDs', manage:'Open Session Manager', collapseAll:'Collapse all', expandAll:'Expand all', hiddenWorkspaces:'Hidden workspaces', sidebarToggle:'Use independent sidebar browser', sidebarNote:'Remembers this client’s choice across reloads and restarts. Uncheck to restore the native list.', sidebarFailed:'Independent sidebar registration failed; the native list is retained:', sidebarPreferenceError:'Could not save the sidebar preference; this choice may not survive a restart:', untitled:'New session', defaultWorkspace:'Default workspace', noSessions:'No sessions', visibilityConnecting:'Connecting workspace visibility…', visibilityError:'Visibility disconnected; reconnecting. The list is paused to avoid revealing hidden entries.', listError:'Workspace connection failed. Reconnect to DSH.', statusWaiting:'Waiting for interaction', sidebarScope:'Filters the current session catalog by title and ID, not message content.',
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
@media(max-width:680px){.sm{padding:18px 14px}.sm-select{margin-top:0}.sm-bulk-count{margin-left:0}.sm-avatar{display:none}.sm-item{flex-wrap:wrap;gap:10px}.sm-info{min-width:100%}.sm-actions{justify-content:flex-start}.sm-head{margin-bottom:14px}.sm-filters select{max-width:100%;width:100%}.sm-footer{flex-wrap:wrap}}
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
    return {
      inject:['slots','locale','layout','uiWorkspace'],
      apply(ctx) {
        ctx.effect(()=>ctx.locale.register('session-manager','zh',zh));
        ctx.effect(()=>ctx.locale.register('session-manager','en',en));
        const t=ctx.locale.bind('session-manager');
        let visibilitySnapshot={ready:false,revision:-1,hiddenWorkspaceIds:[],error:false};
        const visibilityListeners=new Set();
        const visibility={getSnapshot:()=>visibilitySnapshot,subscribe:fn=>{visibilityListeners.add(fn);return()=>visibilityListeners.delete(fn);}};
        const publishVisibility=value=>{visibilitySnapshot=value;visibilityListeners.forEach(fn=>fn());};
        ctx.effect(()=>{
          const source=new EventSource(new URL('./session-manager/visibility',document.baseURI),{withCredentials:true});
          source.onmessage=event=>{
            try {
              const value=JSON.parse(event.data);
              if(!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.hiddenWorkspaceIds)||!value.hiddenWorkspaceIds.every(id=>typeof id==='string'))throw Error('Invalid workspace visibility snapshot');
              if(value.revision<visibilitySnapshot.revision)return;
              publishVisibility({...value,ready:true,error:false});
            }catch(error){console.error('Workspace visibility stream:',error);publishVisibility({...visibilitySnapshot,error:true});}
          };
          source.onerror=()=>publishVisibility({...visibilitySnapshot,error:true});
          return()=>{source.onmessage=null;source.onerror=null;source.close();};
        });
        const journalKey='dsh-session-manager.pending.v1';
        let pending=null;
        try { const saved=JSON.parse(sessionStorage.getItem(journalKey)||'null'); if(saved&&typeof saved.requestId==='string'&&['create','move','delete','restore','setWorkspaceVisibility','batchDelete'].includes(saved.action))pending=saved; } catch {}
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
.smx{height:100%;min-height:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1.5;padding:8px;gap:8px}.smx *{box-sizing:border-box}.smx button,.smx input{font:inherit;color:inherit}.smx button{cursor:pointer;background:transparent;border:0;border-radius:5px;min-height:28px;padding:4px 6px}.smx button:hover{background:var(--dsw-alias-interactive-bg-hover)}.smx button:disabled{opacity:.45;cursor:default}.smx button:focus-visible,.smx input:focus-visible,.smx summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.smx-head{display:flex;align-items:center;gap:4px}.smx-head strong{flex:1;font-weight:600;letter-spacing:.3px}.smx-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px}.smx-search{width:100%;min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);padding:6px 8px}.smx-scroll{overflow:auto;min-height:0;flex:1}.smx-group{margin-bottom:4px}.smx-group-head{display:flex;align-items:center;gap:2px;border-radius:5px}.smx-group-toggle{min-width:0;flex:1;display:flex;align-items:center;gap:5px;text-align:left}.smx-label{min-width:0;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.smx-count{font-size:10px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}.smx-list{margin:0 0 0 9px;padding:0 0 0 9px;border-left:1px solid var(--dsw-alias-border-l1);list-style:none}.smx-list .smx-session{display:flex;align-items:center;gap:6px;width:100%;text-align:left;padding:5px 6px}.smx-session[aria-current=page]{color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}.smx-state{flex:none;color:var(--dsw-alias-label-secondary)}.smx-state[data-busy=true]{color:var(--dsw-alias-brand-primary)}.smx-note{margin:4px 0;padding:6px;font-size:11px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.smx-alert{padding:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;overflow-wrap:anywhere;font-size:11px}.smx-alert[role=alert]{border-color:var(--dsw-alias-state-error-primary)}.smx-hidden{border-top:1px solid var(--dsw-alias-border-l1);padding-top:7px}.smx-hidden summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:11px}.smx-hidden-row{display:flex;align-items:center;gap:4px;padding:3px 0}.smx-rail{align-items:center;padding:8px 0}.smx-footer{border-top:1px solid var(--dsw-alias-border-l1);padding-top:6px}.smx .smx-manage{width:100%;text-align:left;color:var(--dsw-alias-label-secondary)}
`;
        function SidebarBrowser({wide,expandSidebar,useSessions,useWorkspaces,useSessionStatus,usePanelInfo}) {
          React.useSyncExternalStore(ctx.locale.subscribe.bind(ctx.locale),ctx.locale.getSnapshot.bind(ctx.locale));
          React.useSyncExternalStore(subscribe,()=>revision);
          const state=React.useSyncExternalStore(visibility.subscribe,visibility.getSnapshot);
          const list=useSessions(value=>value),catalog=useWorkspaces(value=>value),statuses=useSessionStatus(value=>value);
          const panel=usePanelInfo(value=>value.activePanelId);
          const [query,setQuery]=React.useState(''),[collapsed,setCollapsed]=React.useState({}),[error,setError]=React.useState('');
          const latest=React.useRef();latest.current={catalog,state};
          const current=Object.values(list.byId).find(item=>(item.retainedBy.mainView??0)>0)?.id;
          const hidden=React.useMemo(()=>new Set(state.hiddenWorkspaceIds),[state.hiddenWorkspaceIds]);
          const needle=query.trim().toLocaleLowerCase();
          const titleOf=workspace=>workspace.title==='default-workspace'?t('defaultWorkspace'):(workspace.title||workspace.path);
          const groups=React.useMemo(()=>{
            const archived=new Set(catalog.archivedSessionIds),pinned=new Set(catalog.pinnedSessionIds);
            // Account for ALL workspaces before hiding any, so hidden sessions
            // can never leak into the synthetic ungrouped section.
            const accounted=new Set(catalog.items.flatMap(workspace=>workspace.sessionIds));
            const members=[...catalog.items.filter(workspace=>!hidden.has(workspace.workspaceId)).map(workspace=>({id:workspace.workspaceId,title:titleOf(workspace),path:workspace.path,ids:workspace.sessionIds})),{id:'',title:t('ungrouped'),path:'',ids:list.ids.filter(id=>!accounted.has(id))}];
            return members.map(group=>{
              const groupMatches=!!needle&&`${group.title} ${group.path}`.toLocaleLowerCase().includes(needle);
              const rows=group.ids.map(id=>list.byId[id]).filter(item=>item&&item.origin!=='subagent'&&(!item.blank||item.id===current)&&!archived.has(item.id)).filter(item=>!needle||groupMatches||`${item.title||''} ${item.id}`.toLocaleLowerCase().includes(needle));
              rows.sort((a,b)=>Number(b.id===current&&b.blank)-Number(a.id===current&&a.blank)||Number(pinned.has(b.id))-Number(pinned.has(a.id))||b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
              return {...group,rows};
            }).filter(group=>(group.id||group.rows.length)&&(!needle||group.rows.length||`${group.title} ${group.path}`.toLocaleLowerCase().includes(needle)));
          },[catalog,list,hidden,needle,current,ctx.locale.getLocale().active]);
          const hiddenWorkspaces=catalog.items.filter(workspace=>hidden.has(workspace.workspaceId));
          const ready=state.ready&&!state.error&&catalog.phase==='ready'&&catalog.state!=='loading'&&catalog.state!=='error'&&list.phase==='ready';
          const locked=inFlight||!!pending||!ready;
          const manage=()=>ctx.layout.selectPanel('session-manager');
          async function submit(request) {
            setError('');
            try {const result=await runPending(request);if(result&&!result.ok)setError([result.error||t('failed'),result.code==='CONFLICT'?t('refreshFirst'):''].filter(Boolean).join(' '));}
            catch(reason){setError(`${t('pending')} ${reason.message}`);}
          }
          function changeVisibility(workspace,hide) {
            const live=latest.current;
            if(inFlight||pending||!live.state.ready||live.state.error||!live.catalog.items.some(item=>item.workspaceId===workspace.workspaceId))return;
            const request={action:'setWorkspaceVisibility',workspaceId:workspace.workspaceId,hidden:hide,expectedVisibilityRevision:live.state.revision,requestId:crypto.randomUUID()};
            try {savePending(request);}catch{setError(t('journalFailed'));return;}
            void submit(request);
          }
          function open(id) {
            if(!list.byId[id]||latest.current.catalog.archivedSessionIds.includes(id)){setError(t('archivedHint'));return;}
            try {ctx.uiWorkspace.openSession(id);setError('');}catch(reason){setError(reason.message);}
          }
          if(!wide)return h('section',{className:'smx smx-rail','aria-label':t('browser')},h('style',null,sidebarCss),h('button',{className:'smx-icon',title:t('browser'),'aria-label':t('browser'),onClick:expandSidebar},h(Icon,{size:18})),h('button',{className:'smx-icon',title:t('manage'),'aria-label':t('manage'),onClick:manage},h(EyeIcon,{size:17})));
          return h('section',{className:'smx','aria-label':t('browser'),'data-session-manager-sidebar':true},h('style',null,sidebarCss),
            h('header',{className:'smx-head'},h('strong',null,t('browser')),h('button',{className:'smx-icon',title:t('expandAll'),'aria-label':t('expandAll'),onClick:()=>setCollapsed({})},'⊞'),h('button',{className:'smx-icon',title:t('collapseAll'),'aria-label':t('collapseAll'),onClick:()=>{setQuery('');setCollapsed(Object.fromEntries([...catalog.items.map(workspace=>[workspace.workspaceId,true]),['',true]]));}},'⊟')),
            h('input',{className:'smx-search',type:'search',value:query,placeholder:t('browserSearch'),'aria-label':t('browserSearch'),title:t('sidebarScope'),maxLength:500,onChange:event=>setQuery(event.target.value)}),
            error&&h('div',{className:'smx-alert',role:'alert'},error),
            pending&&h('div',{className:'smx-alert',role:'status'},h('div',null,t('pendingHint')),h('button',{disabled:inFlight,onClick:()=>void submit(pending)},t(inFlight?'busy':'retryOriginal'))),
            h('div',{className:'smx-scroll'},!ready?h('p',{className:'smx-note',role:state.error||catalog.state==='error'?'alert':'status'},t(state.error?'visibilityError':catalog.state==='error'?'listError':!state.ready?'visibilityConnecting':'loading')):groups.length?groups.map(group=>{
              const expanded=!!needle||!collapsed[group.id];
              return h('section',{className:'smx-group',key:group.id},h('div',{className:'smx-group-head'},h('button',{className:'smx-group-toggle','aria-expanded':expanded,title:group.path||group.title,onClick:()=>{if(needle)setQuery('');setCollapsed(value=>({...value,[group.id]:expanded}));}},h('span',{'aria-hidden':true},expanded?'⌄':'›'),h('span',{className:'smx-label'},group.title),h('span',{className:'smx-count'},group.rows.length)),group.id&&h('button',{className:'smx-icon',title:t('hideWorkspace')+' · '+group.title,'aria-label':t('hideWorkspace')+' · '+group.title,disabled:locked,onClick:()=>changeVisibility(catalog.items.find(item=>item.workspaceId===group.id),true)},h(EyeIcon,{size:15}))),
              expanded&&(group.rows.length?h('ul',{className:'smx-list'},group.rows.map(item=>{
                const status=statuses.get(item.id),running=status?.running??item.running,waiting=['approval','plan-review','question'].includes(status?.pendingInteraction?.kind);
                const label=item.blank?t('untitled'):(item.title||item.id);
                return h('li',{key:item.id},h('button',{className:'smx-session','aria-current':panel===null&&item.id===current?'page':undefined,title:`${label}\n${item.id}`,onClick:()=>open(item.id)},h('span',{className:'smx-state','data-busy':running||waiting,'aria-label':t(waiting?'statusWaiting':running?'running':'idle')},waiting?'!':running?'●':status?.completionUnread?'◆':'○'),h('span',{className:'smx-label'},label)));
              })):h('p',{className:'smx-note'},t('noSessions'))));
            }):h('p',{className:'smx-note'},t('empty'))),
            hiddenWorkspaces.length>0&&h('details',{className:'smx-hidden'},h('summary',null,t('hiddenWorkspaces'),' · ',hiddenWorkspaces.length),hiddenWorkspaces.map(workspace=>h('div',{className:'smx-hidden-row',key:workspace.workspaceId},h('span',{className:'smx-label',title:workspace.path},titleOf(workspace)),h('button',{className:'smx-icon',disabled:locked,title:t('showWorkspace')+' · '+titleOf(workspace),'aria-label':t('showWorkspace')+' · '+titleOf(workspace),onClick:()=>changeVisibility(workspace,false)},h(EyeIcon,{hidden:true,size:15}))))),
            h('footer',{className:'smx-footer'},h('button',{className:'smx-manage',onClick:manage},t('manage'))));
        }
        function Dialog({model,workspaces,onCancel,onConfirm,busy}) {
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
            h('h2',{id:'sm-dialog-title'},t(model.action==='create'?'create':model.action==='move'?'confirmMove':model.action==='delete'?'confirmDelete':model.action==='batchDelete'?'confirmBatchDelete':'confirmRestore')),
            model.item&&h('div',{className:'sm-dialog-summary'},h('strong',null,model.item.title||model.item.sessionId),h('div',{className:'sm-id'},model.item.sessionId)),
            h('p',{className:'sm-muted'},t(model.action==='create'?'createNote':model.action==='move'?'moveNote':model.action==='delete'?'deleteNote':model.action==='batchDelete'?'batchDeleteNote':'restoreNote')),
            model.action==='batchDelete'&&h('div',null,h('strong',null,t('selected'),' ',model.items.length),h('ul',{className:'sm-dialog-list'},model.items.map(item=>h('li',{key:item.sessionId},h('strong',null,item.title||item.sessionId),h('div',{className:'sm-id'},item.sessionId))))),
            needsTarget&&h('label',null,t(model.action==='move'?'target':'workspace'),h('select',{value:target,onChange:e=>setTarget(e.target.value),disabled:busy},h('option',{value:''},t('selectWorkspace')),choices.map(w=>h('option',{key:w.id,value:w.id},`${w.title} · ${w.path}`)))),
            needsTarget&&!choices.length&&h('p',null,t('noWorkspace')),
            h('div',{className:'sm-dialog-foot'},h('button',{onClick:onCancel,disabled:busy},t('cancel')),h('button',{className:['delete','batchDelete'].includes(model.action)?'sm-danger':'sm-primary',disabled:busy||(needsTarget&&!choices.some(w=>w.id===target)),onClick:()=>{if(!needsTarget||choices.some(w=>w.id===target))onConfirm(target);}},t(busy?'busy':model.action==='create'?'create':model.action==='move'?'confirmMove':model.action==='delete'?'confirmDelete':model.action==='batchDelete'?'confirmBatchDelete':'confirmRestore')))));
        }
        function Page() {
          React.useSyncExternalStore(ctx.locale.subscribe.bind(ctx.locale),ctx.locale.getSnapshot.bind(ctx.locale));
          React.useSyncExternalStore(subscribe,()=>revision);
          const liveVisibility=React.useSyncExternalStore(visibility.subscribe,visibility.getSnapshot);
          const [data,setData]=React.useState({workspaces:[],items:[],total:0});
          const [visibilityExpanded,setVisibilityExpanded]=React.useState(true);
          const [selected,setSelected]=React.useState({});
          const [query,setQuery]=React.useState(''),[filter,setFilter]=React.useState(''),[archived,setArchived]=React.useState(false),[includeHidden,setIncludeHidden]=React.useState(false),[offset,setOffset]=React.useState(0),[refresh,setRefresh]=React.useState(0);
          const [loading,setLoading]=React.useState(true),[readError,setReadError]=React.useState(''),[busy,setBusy]=React.useState(false),[notice,setNotice]=React.useState(null),[dialog,setDialog]=React.useState(null);
          const alive=React.useRef(true);const serial=React.useRef(0);
          React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
          React.useEffect(()=>{
            const abort=new AbortController();const current=++serial.current;setLoading(true);setReadError('');setSelected({});
            const timer=setTimeout(()=>{api({action:'list',query,workspaceId:filter||undefined,archived,includeHidden,offset,limit:30},abort.signal).then(value=>{
              if(abort.signal.aborted||current!==serial.current)return;
              if(!value.ok)throw Error(value.error||t('failed'));
              setData(value);setLoading(false);
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
              setRefresh(x=>x+1);
            }catch(error){if(alive.current)setNotice({error:true,key:'pending',detail:error.message});}
            finally{if(alive.current)setBusy(false);}
          }
          function confirm(target) {
            if(inFlight||pending)return;
            const request={action:dialog.action,requestId:crypto.randomUUID()};
            if(dialog.item){request.sessionId=dialog.item.sessionId;request.expectedToken=dialog.item.token;}
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
          const lock=busy||inFlight||!!pending||loading||!!readError;
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
            h('header',{className:'sm-head'},h('div',null,h('h1',null,t('title')),h('p',{className:'sm-muted'},t('subtitle'))),h('div',{className:'sm-row'},h('button',{onClick:()=>ctx.layout.selectPanel('conversation')},t('back')),h('button',{onClick:()=>setRefresh(x=>x+1),disabled:busy},t('refresh')),h('button',{className:'sm-primary',disabled:lock||!visibleWorkspaces.length,onClick:()=>setDialog({action:'create',workspaceId:filter})},'+ '+t('create')))),
            h('div',{className:'sm-note'},h('label',{className:'sm-include-hidden'},h('input',{type:'checkbox',checked:sidebarRequested,onChange:event=>setSidebarEnabled(event.target.checked)}),t('sidebarToggle')),h('span',null,t('sidebarNote'))),
            sidebarError&&h('div',{className:'sm-alert','data-error':true,role:'alert'},sidebarError),
            h('details',{className:'sm-workspaces',open:visibilityExpanded,onToggle:event=>setVisibilityExpanded(event.currentTarget.open)},h('summary',null,t('workspaceVisibility'),' · ',visibleWorkspaces.length,' / ',workspaces.length),h('p',{className:'sm-muted'},t('visibilityHint')),h('div',{className:'sm-workspace-grid'},workspaces.map(w=>h('div',{key:w.id,className:'sm-workspace','data-hidden':!!w.hidden},h('div',{className:'sm-workspace-text'},h('div',{className:'sm-workspace-title'},w.title),h('div',{className:'sm-workspace-path',title:w.path},w.path)),h('button',{type:'button',className:'sm-eye',disabled:lock||!Number.isSafeInteger(data.visibilityRevision),title:t(w.hidden?'showWorkspace':'hideWorkspace')+' · '+w.title,'aria-label':t(w.hidden?'showWorkspace':'hideWorkspace')+' · '+w.title,'aria-pressed':!w.hidden,onClick:()=>setVisibility(w)},h(EyeIcon,{hidden:!!w.hidden}),h('span',null,t(w.hidden?'workspaceHidden':'workspaceVisible'))))))),
            h('div',{className:'sm-tabs'},[false,true].map(value=>h('button',{key:String(value),'aria-pressed':archived===value,onClick:()=>{setArchived(value);setOffset(0);}},t(value?'archived':'active')))),
            h('div',{className:'sm-filters'},h('input',{type:'search',value:query,placeholder:t('search'),'aria-label':t('search'),onChange:e=>{setQuery(e.target.value);setOffset(0);}}),h('select',{'aria-label':t('workspace'),value:filter,onChange:e=>{setFilter(e.target.value);setOffset(0);}},h('option',{value:''},t('allWorkspaces')),browsableWorkspaces.map(w=>h('option',{key:w.id,value:w.id},w.title+(w.hidden?' · '+t('workspaceHidden'):'')))),h('label',{className:'sm-include-hidden'},h('input',{type:'checkbox',checked:includeHidden,onChange:e=>{setIncludeHidden(e.target.checked);setOffset(0);}}),t('showHidden'),hiddenCount?' ('+hiddenCount+')':'')),
            notice&&h('div',{className:'sm-alert','data-error':!!notice.error,role:notice.error?'alert':'status'},h('div',null,notice.key?[t(notice.key),notice.detail].filter(Boolean).join(' '):notice.text),notice.results&&h('details',null,h('summary',null,t('batchResults')),h('ul',{className:'sm-result-list'},notice.results.map(result=>h('li',{key:result.sessionId},h('span',{className:'sm-id'},result.sessionId),' · ',t(result.ok?'batchSucceeded':'batchFailed'),result.error?' · '+result.error:'')))),h('div',{className:'sm-row',style:{marginTop:8}},notice.sessionId&&h('button',{onClick:()=>open(notice.sessionId)},t('completedOpen')),h('button',{onClick:()=>setNotice(null)},t('dismiss')))),
            pending&&h('div',{className:'sm-alert',role:'status'},h('div',null,t('pendingHint')),h('div',{className:'sm-id'},pending.requestId),h('button',{disabled:busy||inFlight,onClick:()=>void execute(pending)},t(busy||inFlight?'busy':'retryOriginal'))),
            h('div',{className:'sm-note'},h(Icon,{size:16,info:true}),h('span',null,t('safeNote'))),
            archived&&h('p',{className:'sm-muted'},t('archivedHint')),
            !archived&&h('div',{className:'sm-bulk'},h('label',null,h('input',{type:'checkbox',checked:allPageSelected,'aria-label':t('selectAllPage'),disabled:lock||!eligibleRows.length,onChange:e=>e.target.checked?choosePage(false):setSelected({})}),t('selectAllPage')),h('button',{disabled:lock||!eligibleRows.some(item=>item.empty===true),onClick:()=>choosePage(true)},t('selectEmptyPage')),h('button',{disabled:lock||!selectedRows.length,onClick:()=>setSelected({})},t('clearSelection')),h('span',{className:'sm-bulk-count'},t('selected'),' ',selectedRows.length),h('button',{className:'sm-danger',disabled:lock||!selectedRows.length,onClick:openBatchDelete},t('batchDelete'))),
            !archived&&h('p',{className:'sm-muted'},t('batchHint')),
            loading?h('div',{className:'sm-empty',role:'status'},t('loading')):readError?h('div',{className:'sm-alert','data-error':true,role:'alert'},h('p',null,readError),h('button',{onClick:()=>setRefresh(x=>x+1)},t('retry'))):!rows.length?h('div',{className:'sm-empty'},h(Icon,{size:32}),h('h2',null,t('empty')),h('p',{className:'sm-muted'},t('emptyHint'))):h('div',{className:'sm-list','aria-busy':busy},rows.map(item=>h('article',{className:'sm-item',key:item.sessionId,'data-selected':!!selected[item.sessionId]},
              !archived&&h('label',{className:'sm-select'},h('input',{type:'checkbox',checked:!!selected[item.sessionId],disabled:lock||item.archived||item.running||!item.token||!!item.readError,'aria-label':t('selectSession')+' · '+(item.title||item.sessionId)+' · '+item.sessionId,onChange:e=>{const checked=e.target.checked;setSelected(current=>{const next={...current};if(checked)next[item.sessionId]=true;else delete next[item.sessionId];return next;});}})),
              h('div',{className:'sm-avatar'},h(Icon,{size:19})),h('div',{className:'sm-info'},h('div',{className:'sm-name'},item.title||item.sessionId),h('div',{className:'sm-muted sm-path'},workspaceName(item),item.cwd?' · '+item.cwd:''),h('div',{className:'sm-meta'},h('span',{className:'sm-tag','data-running':item.running},t(item.readError?'unreadable':item.archived?'deleted':item.running?'running':'idle')),item.empty===true&&h('span',{className:'sm-tag'},t('emptySession')),h('span',{className:'sm-muted'},t('updated')+' '+date(item.updatedAt))),h('div',{className:'sm-muted sm-id'},item.sessionId),item.readError&&h('p',{className:'sm-muted'},item.readError)),
              h('div',{className:'sm-actions'},!item.archived&&h('button',{onClick:()=>open(item.sessionId),disabled:busy||!!item.readError},t('open')),!item.archived&&h('button',{disabled:lock||item.running||!item.token||!visibleWorkspaces.some(w=>w.id!==item.workspaceId),title:item.running?t('unavailable'):t('move'),onClick:()=>setDialog({action:'move',item:{...item}})},t('move')),h('button',{className:item.archived?'':'sm-danger',disabled:lock||item.running||!item.token,title:item.running?t('unavailable'):undefined,onClick:()=>setDialog({action:item.archived?'restore':'delete',item:{...item}})},t(item.archived?'restore':'remove')))))),
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
