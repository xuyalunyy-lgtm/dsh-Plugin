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
    const css = `
.fc{height:100%;overflow:auto;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-family:inherit;font-size:14px;line-height:1.5;padding:20px clamp(12px,2.5vw,32px)}
.fc *,.fc-toast *{box-sizing:border-box}.fc-wrap{max-width:1120px;margin:auto}.fc-head,.fc-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.fc-head{justify-content:space-between;margin-bottom:16px}.fc h1{font-size:24px;font-weight:650;margin:0 0 3px}.fc h2{font-size:16px;font-weight:600;margin:0}.fc p{margin:7px 0 12px}.fc-muted{color:var(--dsw-alias-label-secondary);font-size:12px}.fc-grid{display:grid;grid-template-columns:minmax(300px,1.45fr) minmax(240px,1fr);gap:16px;align-items:start}.fc-stack{display:grid;gap:16px;min-width:0}.fc-card{padding:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);min-width:0}
.fc button,.fc input,.fc-toast button{font:inherit;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);padding:6px 10px;min-height:34px;max-width:100%}.fc button,.fc-toast button{cursor:pointer}.fc button:hover,.fc-toast button:hover{background:var(--dsw-alias-interactive-bg-hover)}.fc button:disabled,.fc input:disabled,.fc button[aria-disabled=true],.fc-toast button:disabled{opacity:.5;cursor:default}.fc button:focus-visible,.fc input:focus-visible,.fc summary:focus-visible,.fc-toast button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.fc .fc-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);font-weight:600}.fc-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin-top:10px}.fc-week{text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px;padding:2px}.fc .fc-day{min-height:56px;padding:4px 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;border-color:transparent}.fc .fc-day[data-selected=true]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}.fc .fc-day[data-today=true]{font-weight:750}.fc-day small{font-size:10px;line-height:12px;color:var(--dsw-alias-label-secondary)}.fc .fc-day[data-complete=true] small{color:var(--dsw-alias-state-success-primary)}.fc-day em{font-size:9px;line-height:11px;font-style:normal;color:var(--dsw-alias-brand-primary)}
.fc-datebar{margin-top:12px}.fc-datebar input{flex:1;min-width:130px}.fc-timer{font-size:46px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:2px;margin:10px 0}.fc-status{font-size:12px;color:var(--dsw-alias-brand-primary)}.fc-task{padding:11px 0;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:9px;align-items:flex-start;flex-wrap:wrap}.fc-task[data-editing=true]{border-left:3px solid var(--dsw-alias-brand-primary);padding-left:8px}.fc-task input[type=checkbox]{min-height:18px;width:18px;height:18px;margin-top:3px;accent-color:var(--dsw-alias-brand-primary)}.fc-task-text{flex:1;min-width:100px;overflow-wrap:anywhere}.fc-task-text[data-done=true]{text-decoration:line-through;color:var(--dsw-alias-label-secondary)}.fc-task-actions{display:flex;gap:5px;flex-wrap:wrap}.fc .fc-small{font-size:12px;padding:4px 7px;min-height:30px}.fc-form{display:grid;gap:9px;margin:12px 0 16px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}.fc-form[data-editing=true]{border-color:var(--dsw-alias-brand-primary)}.fc-form input{min-width:0;width:100%}.fc-form label,.fc-settings label{display:grid;gap:4px;font-size:12px}.fc-form-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fc-form .fc-hint{margin:0}.fc-form-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.fc-settings{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fc-health{padding:10px 0;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;justify-content:space-between;align-items:center;gap:10px}.fc-filter{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.fc-filter button[aria-pressed=true]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}.fc-progress{height:5px;width:100%;display:block;accent-color:var(--dsw-alias-state-success-primary);margin:8px 0 12px}.fc-notice{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 10px;margin-bottom:12px;overflow-wrap:anywhere}.fc-notice-text{flex:1;min-width:0}.fc-error{color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}.fc-badge{font-size:11px;color:var(--dsw-alias-brand-primary)}.fc-footer{margin-top:18px}.fc-footer summary,.fc-card summary{cursor:pointer}.fc-toast{position:fixed;right:20px;top:70px;width:min(360px,calc(100vw - 40px));max-height:70vh;overflow:auto;pointer-events:auto;color:var(--dsw-alias-label-primary);font-size:14px}.fc-toast article{border:1px solid var(--dsw-alias-brand-primary);border-radius:12px;background:var(--dsw-alias-bg-overlay);padding:16px;margin-bottom:10px}.fc-toast p{margin:8px 0 14px}.fc-toast .fc-row{display:flex;gap:8px;flex-wrap:wrap}@media(max-width:760px){.fc-grid{grid-template-columns:1fr}.fc{padding:12px}.fc-card{padding:12px}.fc-task-actions{margin-left:auto}}@media(max-width:380px){.fc-form-fields,.fc-settings{grid-template-columns:1fr}}
`;

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
      };
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
      const pendingDrafts=new Set();
      let snapshot={state:null,error:'',syncError:'',busy:false,clock:Date.now(),serverOffset:0,revision:0};
      const listeners=new Set(),abort=new AbortController();
      let dead=false,queue=Promise.resolve(),pollTimer;
      const publish=patch=>{if(dead)return;snapshot={...snapshot,...patch,revision:snapshot.revision+1};listeners.forEach(f=>f());};
      const subscribe=f=>{listeners.add(f);return()=>listeners.delete(f);};
      const notifySeen=new Set(),notifications=new Set(),notificationTimers=new Set();
      const notify=state=>{
        for(const a of state.alerts){
          if(notifySeen.has(a.id))continue;notifySeen.add(a.id);
          try {
            if(localStorage.getItem('focus-calendar.notifications')!=='yes'||!('Notification'in window)||Notification.permission!=='granted')continue;
            const key='focus-calendar.notice.'+a.kind;if(localStorage.getItem(key)===a.id)continue;localStorage.setItem(key,a.id);
            const n=new Notification(t('title'),{body:t(a.kind+'Alert'),tag:'focus-calendar-'+a.kind});
            n.onclick=()=>{window.focus();ctx.layout.selectPanel('focus-calendar');n.close();};notifications.add(n);
            const timer=setTimeout(()=>{n.close();notifications.delete(n);notificationTimers.delete(timer);},15000);notificationTimers.add(timer);
          } catch { /* Notification failures must not hide in-page reminders. */ }
        }
      };
      async function request(input){
        const response=await fetch('/focus-calendar/api',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:abort.signal});
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        const result=await response.json();if(!result.ok)throw Error(result.error||t('error'));
        publish({state:result.state,...(input.action==='read'?{syncError:''}:{error:''}),clock:Date.now(),serverOffset:result.state.now-Date.now()});
        if(!dead)notify(result.state);return result.state;
      }
      function act(action,args={}) {
        // Background reads never disable a focused input; only mutations set busy.
        const mutating=action!=='read';
        const run=queue.then(async()=>{
          if(mutating)publish({busy:true,error:''});
          try{return await request({action,...args});}
          catch(e){publish(mutating?{error:e.message}:{syncError:e.message});return null;}
          finally{if(mutating)publish({busy:false});}
        });
        queue=run.catch(()=>{});return run;
      }
      const useStore=()=>{React.useSyncExternalStore(f=>ctx.locale.subscribe(f),()=>ctx.locale.getSnapshot());return React.useSyncExternalStore(subscribe,()=>snapshot);};
      const button=(key,fn,props={})=>h('button',{type:'button',onClick:fn,...props},t(key));

      // A stable component identity and draft key prevent polling from remounting inputs.
      function TaskEditor({date,taskId,task,focusToken,onExit,onSaved}) {
        const {busy}=useStore();
        const key=taskId?'edit:'+taskId:'new:'+date;
        React.useSyncExternalStore(drafts.subscribe,drafts.getSnapshot);
        const getValue=()=>drafts.get(key,task?{title:task.title,time:task.time,date:task.date}:emptyDraft(date));
        const value=getValue();
        const [saving,setSaving]=React.useState(false);
        const input=React.useRef(null),form=React.useRef(null),mounted=React.useRef(false);
        const composing=React.useRef(false),compositionEndedAt=React.useRef(-Infinity);
        const locked=saving||pendingDrafts.has(key);
        const missing=!!taskId&&!task;
        React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
        React.useEffect(()=>{if(focusToken.key===key)input.current?.focus();},[focusToken,key]);
        const change=patch=>{
          if(pendingDrafts.has(key))return;
          drafts.set(key,{...getValue(),...patch});
        };
        const submit=async(event,asNew=false)=>{
          event.preventDefault();
          const sent=getValue();
          if(composing.current||Date.now()-compositionEndedAt.current<80||pendingDrafts.has(key)||busy||!sent.title.trim()||!localDate(sent.date)||(missing&&!asNew))return;
          drafts.set(key,sent);pendingDrafts.add(key);setSaving(true);
          try {
            const result=await act(taskId&&!asNew?'update':'add',{...(taskId&&!asNew?{id:taskId}:{}),title:sent.title.trim(),time:sent.time,date:sent.date});
            if(!result)return;
            const keepFocus=mounted.current&&!!form.current?.contains(document.activeElement);
            const cleared=drafts.clearIfUnchanged(key,sent);
            if(cleared){
              // Update the shared draft/view store even if this editor was closed mid-request.
              const currentView=drafts.getView();
              if(taskId&&currentView.editing===taskId)drafts.setView({editing:null,filter:'all'});
              else if(!taskId&&currentView.date===date&&!currentView.editing)drafts.setView({filter:'all'});
              if(mounted.current){
                onSaved({key:taskId&&!asNew?(task&&task.date!==sent.date?'moved':'updated'):'added',date:sent.date},!!taskId,keepFocus);
                if(!taskId&&keepFocus)input.current?.focus();
              }
            }
          } finally {pendingDrafts.delete(key);publish({});if(mounted.current)setSaving(false);}
        };
        const keyboard=event=>{
          if(composingEnter(event,composing.current,compositionEndedAt.current,Date.now())){event.preventDefault();return;}
          if(event.key==='Escape'&&taskId&&!composing.current&&!event.nativeEvent?.isComposing&&!locked){event.preventDefault();onExit();}
        };
        return h('form',{ref:form,className:'fc-form','data-editing':!!taskId,'aria-busy':locked,onSubmit:submit,onKeyDown:keyboard},
          h('div',{className:'fc-form-head'},h('strong',null,t(taskId?'editing':'newTask')),h('span',{className:'fc-badge'},locked?t('saving'):drafts.has(key)?t('draftBadge'):'')),
          h('label',null,t('taskTitle'),h('input',{ref:input,value:value.title,readOnly:locked,required:true,maxLength:200,placeholder:t('taskTitle'),onChange:e=>change({title:e.target.value}),onCompositionStart:()=>{composing.current=true;},onCompositionEnd:()=>{composing.current=false;compositionEndedAt.current=Date.now();}})),
          h('div',{className:'fc-form-fields'},
            taskId&&h('label',null,t('targetDate'),h('input',{type:'date',value:value.date,min:'0001-01-01',max:'9999-12-31',readOnly:locked,required:true,onChange:e=>{if(localDate(e.target.value))change({date:e.target.value});}})),
            h('label',null,t('time'),h('input',{type:'time',value:value.time,readOnly:locked,onChange:e=>change({time:e.target.value})}))),
          missing&&h('p',{role:'alert',className:'fc-error fc-hint'},t('missingTask')),
          h('div',{className:'fc-row'},h('button',{type:'submit',className:'fc-primary','aria-disabled':locked||busy||!value.title.trim()||missing},t(locked?'saving':taskId?'save':'add')),
            missing&&button('saveAsNew',e=>{if(form.current?.reportValidity())submit(e,true);},{disabled:locked||busy||!value.title.trim()}),
            taskId&&button('exitEdit',onExit,{disabled:locked})),
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
          if(!drafts.has('edit:'+task.id))drafts.set('edit:'+task.id,{title:task.title,time:task.time,date:task.date});
          setCurrent({editing:task.id});setDeleting(null);setFocusToken(current=>({key:'edit:'+task.id,nonce:current.nonce+1}));
        };
        const exitEdit=(focus=true)=>{setCurrent({editing:null});setFocusToken(current=>({key:focus?'new:'+drafts.getView().date:null,nonce:current.nonce+1}));};
        const runTask=async(action,args,success)=>{
          if(opLock.current||busy)return;opLock.current=true;
          try{const result=await act(action,args);if(result){success?.();return true;}return false;}finally{opLock.current=false;}
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
        return h('section',{className:'fc','aria-label':t('title')},h('style',null,css),h('div',{className:'fc-wrap'},
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
                notice&&h('div',{className:'fc-notice',role:'status'},h('span',{className:'fc-notice-text'},t(notice.key),' ',notice.date||''),notice.date&&notice.date!==date&&button('showDate',()=>chooseDate(notice.date),{className:'fc-small'}),button('dismiss',()=>setNotice(null),{className:'fc-small'})),
                h(TaskEditor,{key:editing?'edit:'+editing:'new:'+date,date,taskId:editing,task,focusToken,onExit:()=>exitEdit(),onSaved:(next,wasEditing,keepFocus)=>{setNotice(next);if(wasEditing)setFocusToken(current=>({key:keepFocus?'new:'+drafts.getView().date:null,nonce:current.nonce+1}));}}),
                h('div',{className:'fc-filter',role:'group','aria-label':t('filter')},...['all','pending','done'].map(value=>h('button',{type:'button',key:value,className:'fc-small','aria-pressed':filter===value,onClick:()=>setCurrent({filter:value})},t(value==='done'?'completed':value),' ',value==='all'?day.total:value==='done'?day.done:day.total-day.done))),
                tasks.length?tasks.map(item=>h('div',{className:'fc-task',key:item.id,'data-editing':editing===item.id},
                  h('input',{type:'checkbox',checked:item.done,disabled:busy,'aria-label':t(item.done?'undo':'complete')+': '+item.title,onChange:e=>runTask('update',{id:item.id,done:e.target.checked})}),
                  h('div',{className:'fc-task-text','data-done':item.done},h('div',null,item.title),h('div',{className:'fc-muted'},item.time||t('allDay'))),
                  h('div',{className:'fc-task-actions'},button('edit',()=>beginEdit(item),{className:'fc-small',disabled:busy,'aria-label':t('edit')+': '+item.title}),
                    deleting===item.id?h(React.Fragment,null,button('confirmDelete',()=>runTask('delete',{id:item.id},()=>{drafts.drop('edit:'+item.id);setDeleting(null);if(drafts.getView().editing===item.id)exitEdit(false);setNotice({key:'deleted'});}),{className:'fc-small',disabled:busy}),button('cancel',()=>setDeleting(null),{className:'fc-small'})):button('remove',()=>setDeleting(item.id),{className:'fc-small',disabled:busy,'aria-label':t('remove')+': '+item.title}))
                )):h('p',{className:'fc-muted'},t(day.total===0?'empty':filter==='pending'?'noPending':'noCompleted')))),
            h('div',{className:'fc-stack'},
              h('section',{className:'fc-card'},h('h2',null,t('focus')),h('p',{className:'fc-muted'},t('focusHint')),h('div',{className:'fc-status'},t(s.focus.status==='idle'?'idle':s.focus.status==='paused'?'paused':s.focus.kind==='break'?'breaking':'running')),h('div',{className:'fc-timer','aria-label':t('remaining')},fmt(remaining)),
                h('div',{className:'fc-row'},s.focus.status==='running'?button('pause',()=>act('focusPause'),{disabled:busy}):s.focus.status==='paused'?button('resume',()=>act('focusResume'),{disabled:busy,className:'fc-primary'}):button('start',()=>act('focusStart'),{disabled:busy,className:'fc-primary'}),button('reset',()=>act('focusReset'),{disabled:busy||s.focus.status==='idle'}),button('rest',()=>act('breakStart'),{disabled:busy||s.focus.status!=='idle',title:t('stopFirst')}))),
              h('section',{className:'fc-card'},h('h2',null,t('reminders')),...['eye','body'].map(kind=>h('div',{className:'fc-health',key:kind},h('div',null,h('strong',null,t(kind)),h('div',{className:'fc-muted'},t('interval'),' ',s.settings[kind+'Minutes'],' ',t('minutes'),' · ',s.reminders[kind].running?fmt(s.reminders[kind].nextAt-now):t('off'))),h('button',{type:'button',role:'switch','aria-checked':s.reminders[kind].running,'aria-label':t(kind),disabled:busy,onClick:()=>act(s.reminders[kind].running?'remindersStop':'remindersStart',{kind})},t(s.reminders[kind].running?'disable':'enable')))),h('p',null,button('notify',permission,{className:'fc-small'})),message&&h('p',{className:'fc-muted',role:'status'},message)),
              h('details',{className:'fc-card'},h('summary',null,t('settings')),h('form',{className:'fc-form',onSubmit:async e=>{e.preventDefault();if(await act('settings',{settings:settings||s.settings})){setSettings(null);setMessage(t('saved'));}}},h('div',{className:'fc-settings'},...['focusMinutes','eyeMinutes','bodyMinutes','breakMinutes'].map(key=>h('label',{key},t(key)+' ('+t('minutes')+')',h('input',{type:'number',min:1,max:240,step:1,required:true,value:(settings||s.settings)[key],readOnly:busy,onChange:e=>setSettings({...s.settings,...settings,[key]:e.target.value===''?'':Number(e.target.value)})})))),h('p',{className:'fc-muted'},t('settingsHint')),h('button',{type:'submit',disabled:busy},t('save')))))
          ),
          h('details',{className:'fc-footer fc-muted'},h('summary',null,t('noteTitle')),h('p',null,t('note')),h('p',null,t('draftHint'))),h('p',{className:'fc-muted'},t('shortcut'),' · ',t('timezone'))));
      }
      function Alerts(){const {state:s,busy,error}=useStore();if(!s?.alerts.length)return null;return h('aside',{className:'fc-toast','aria-label':t('reminders')},h('style',null,css),...s.alerts.map(a=>h('article',{key:a.id,role:'status'},h('strong',null,t('title')),h('p',null,t(a.kind+'Alert')),h('div',{className:'fc-row'},button('ack',()=>act('ack',{id:a.id}),{disabled:busy}),button('open',()=>ctx.layout.selectPanel('focus-calendar'))))),error&&h('p',{className:'fc-error',role:'alert'},error));}
      ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'focus-calendar',order:15,label:()=>t('title')},Icon));
      ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'focus-calendar'},Panel));
      ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'focus-calendar-alerts',order:30},Alerts));
      ctx.effect(()=>{
        let active=true;
        async function poll(){if(!active)return;await act('read');if(active)pollTimer=setTimeout(poll,snapshot.state&&(snapshot.state.focus.status==='running'||snapshot.state.reminders.eye.running||snapshot.state.reminders.body.running)?2000:10000);}
        poll();const tick=setInterval(()=>publish({clock:Date.now()}),1000);
        const key=e=>{if(e.altKey&&e.shiftKey&&e.code==='KeyF'&&!e.repeat){e.preventDefault();ctx.layout.selectPanel('focus-calendar');}};
        window.addEventListener('keydown',key);
        return()=>{active=false;dead=true;abort.abort();clearTimeout(pollTimer);clearInterval(tick);for(const timer of notificationTimers)clearTimeout(timer);for(const n of notifications)n.close();window.removeEventListener('keydown',key);listeners.clear();};
      });
    }};
  },
});
