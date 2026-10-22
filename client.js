window.__ModuleLoader__.load({
  id: '@local/dsh-focus-calendar',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const zh = {
      title:'专注日历', subtitle:'把工作安排好，也给眼睛和身体留一点时间。', back:'返回聊天', today:'今天', prev:'上个月', next:'下个月',
      tasks:'每日安排', empty:'这一天还没有安排。添加一件最重要的事吧。', taskTitle:'要做的事情', time:'时间（可选）', add:'添加待办', save:'保存', cancel:'取消', edit:'编辑', remove:'删除', confirmDelete:'确认删除', complete:'标记完成', undo:'标记未完成',
      focus:'专注计时', focusHint:'一次只做一件事。完成后，给自己一个短休息。', start:'开始专注', pause:'暂停', resume:'继续', reset:'重置', rest:'开始休息', idle:'准备开始', running:'专注中', paused:'已暂停', breaking:'休息中',
      reminders:'健康休息提醒', eye:'休息眼睛', body:'活动身体', enable:'开启', disable:'关闭', off:'未开启', minutes:'分钟', interval:'每隔',
      settings:'时间设置', focusMinutes:'每次专注', eyeMinutes:'护眼间隔', bodyMinutes:'活动间隔', breakMinutes:'短休息', settingsHint:'设置范围 1–240 分钟；保存后在下次启动或下一周期生效。',
      notify:'允许系统通知', granted:'系统通知已允许', denied:'系统通知未获允许，请在浏览器权限中设置；页面内仍会提醒。', unsupported:'此环境不支持系统通知，页面内提醒仍可用。',
      eyeAlert:'让眼睛休息一下：看看远处约 20 秒，放松视线。', bodyAlert:'起身走动一下，轻轻活动肩颈和身体。', focusAlert:'本次专注完成！可以休息一下了。', breakAlert:'休息结束，准备好后再开始下一次专注。', ack:'知道了', open:'打开日历',
      note:'数据保存在本机，跨会话共享。关闭此面板不会停止计时；系统通知需要保持 DSH 和此页面运行，电脑休眠时无法准时弹出，恢复后会补充页面提醒。待办时间仅用于安排，不单独触发通知。',
      loading:'正在读取日历…', error:'操作失败', retry:'重试', saved:'已保存', completed:'已完成', remaining:'剩余', shortcut:'快捷键 Alt + Shift + F', weekdays:'一 二 三 四 五 六 日', timezone:'日期按本机时区显示', stopFirst:'重新开始将替换当前计时',
    };
    const en = {
      title:'Focus Calendar',subtitle:'Make room for meaningful work, rested eyes, and movement.',back:'Back to chat',today:'Today',prev:'Previous month',next:'Next month',tasks:'Daily plan',empty:'Nothing planned yet. Add one important task.',taskTitle:'What needs doing?',time:'Time (optional)',add:'Add task',save:'Save',cancel:'Cancel',edit:'Edit',remove:'Delete',confirmDelete:'Confirm delete',complete:'Mark complete',undo:'Mark incomplete',focus:'Focus timer',focusHint:'One thing at a time. Take a short break when you finish.',start:'Start focus',pause:'Pause',resume:'Resume',reset:'Reset',rest:'Take a break',idle:'Ready',running:'Focusing',paused:'Paused',breaking:'On a break',reminders:'Healthy break reminders',eye:'Rest your eyes',body:'Move your body',enable:'Enable',disable:'Disable',off:'Off',minutes:'min',interval:'Every',settings:'Timer settings',focusMinutes:'Focus duration',eyeMinutes:'Eye-rest interval',bodyMinutes:'Movement interval',breakMinutes:'Short break',settingsHint:'1–240 minutes. Changes apply on the next start or cycle.',notify:'Allow system notifications',granted:'System notifications allowed',denied:'Notifications are not allowed. Check browser permissions; in-page reminders still work.',unsupported:'System notifications are unavailable. In-page reminders still work.',eyeAlert:'Rest your eyes: look into the distance for about 20 seconds.',bodyAlert:'Stand up, walk around, and gently move your shoulders and body.',focusAlert:'Focus session complete! Time for a break.',breakAlert:'Break complete. Start another focus session when ready.',ack:'Got it',open:'Open calendar',note:'Data is saved locally and shared across sessions. Closing this panel does not stop timers. System notifications require DSH and this page to remain running; sleeping computers cannot notify on time. Missed reminders appear on return. Task times organize the plan but do not trigger notifications.',loading:'Loading calendar…',error:'Operation failed',retry:'Retry',saved:'Saved',completed:'completed',remaining:'Remaining',shortcut:'Shortcut: Alt + Shift + F',weekdays:'Mo Tu We Th Fr Sa Su',timezone:'Dates use the local time zone',stopFirst:'Starting again replaces the current timer',
    };
    const css = `
.fc{height:100%;overflow:auto;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-family:inherit;font-size:14px;line-height:1.5;padding:28px clamp(16px,3vw,44px)}
.fc *,.fc-toast *{box-sizing:border-box}.fc-wrap{max-width:1100px;margin:auto}.fc-head,.fc-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.fc-head{justify-content:space-between;margin-bottom:24px}.fc h1{font-size:25px;font-weight:650;margin:0 0 4px}.fc h2{font-size:16px;font-weight:600;margin:0 0 14px}.fc p{margin:6px 0 14px}.fc-muted{color:var(--dsw-alias-label-secondary);font-size:12px}.fc-grid{display:grid;grid-template-columns:minmax(280px,1.2fr) minmax(260px,1fr);gap:20px;align-items:start}.fc-stack{display:grid;gap:18px}.fc-card{padding:20px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1)}
.fc button,.fc input,.fc-toast button{font:inherit;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);padding:7px 11px;min-height:34px}.fc button,.fc-toast button{cursor:pointer}.fc button:hover,.fc-toast button:hover{background:var(--dsw-alias-interactive-bg-hover)}.fc button:disabled,.fc input:disabled,.fc-toast button:disabled{opacity:.5;cursor:default}.fc button:focus-visible,.fc input:focus-visible,.fc-toast button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.fc .fc-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);font-weight:600}.fc-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;margin-top:14px}.fc-week{text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px;padding:4px}.fc .fc-day{min-height:48px;padding:5px 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-color:transparent}.fc .fc-day[data-selected=true]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}.fc .fc-day[data-today=true]{font-weight:750;text-decoration:underline;text-underline-offset:3px}.fc-day small{font-size:10px;line-height:12px;color:var(--dsw-alias-label-secondary)}.fc-timer{font-size:52px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:2px;margin:12px 0}.fc-status{font-size:12px;color:var(--dsw-alias-brand-primary)}.fc-task{padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:9px;align-items:flex-start}.fc-task input[type=checkbox]{min-height:18px;margin-top:4px;accent-color:var(--dsw-alias-brand-primary)}.fc-task-text{flex:1;min-width:0;overflow-wrap:anywhere}.fc-task-text[data-done=true]{text-decoration:line-through;color:var(--dsw-alias-label-secondary)}.fc .fc-small{font-size:12px;padding:4px 7px;min-height:28px}.fc-form{display:grid;gap:10px;margin-top:16px}.fc-form input{min-width:0;width:100%}.fc-form label{display:grid;gap:5px;font-size:12px}.fc-settings{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fc-health{padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;justify-content:space-between;align-items:center;gap:12px}.fc-error{color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}.fc-toast{position:fixed;right:20px;top:70px;width:min(360px,calc(100vw - 40px));max-height:70vh;overflow:auto;pointer-events:auto;color:var(--dsw-alias-label-primary);font-size:14px}.fc-toast article{border:1px solid var(--dsw-alias-brand-primary);border-radius:12px;background:var(--dsw-alias-bg-overlay);padding:16px;margin-bottom:10px}.fc-toast p{margin:8px 0 14px}.fc-toast .fc-row{display:flex;gap:8px;flex-wrap:wrap}@media(max-width:760px){.fc-grid{grid-template-columns:1fr}.fc{padding:16px}.fc-card{padding:16px}}
`;
    const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const fmt = ms => { const s=Math.max(0,Math.ceil(ms/1000)); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
    function Icon({size=22}) { return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true},h('rect',{x:3,y:5,width:18,height:17,rx:4}),h('path',{d:'M7 2v6M17 2v6M3 11h18M12 14v3l2 1'})); }
    return { inject:['slots','locale','layout'], apply(ctx) {
      ctx.effect(()=>ctx.locale.register('focus-calendar','zh',zh));
      ctx.effect(()=>ctx.locale.register('focus-calendar','en',en));
      const t=ctx.locale.bind('focus-calendar');
      let snapshot={state:null,error:'',busy:false,clock:Date.now(),serverOffset:0,revision:0};
      const listeners=new Set(), abort=new AbortController();
      let dead=false, queue=Promise.resolve(), pollTimer;
      const publish=patch=>{if(dead)return; snapshot={...snapshot,...patch,revision:snapshot.revision+1};listeners.forEach(f=>f());};
      const subscribe=f=>{listeners.add(f);return()=>listeners.delete(f);};
      const notifySeen=new Set(), notifications=new Set(), notificationTimers=new Set();
      const notify=state=>{
        for(const a of state.alerts){
          if(notifySeen.has(a.id))continue; notifySeen.add(a.id);
          try {
            if(localStorage.getItem('focus-calendar.notifications')!=='yes'||!('Notification' in window)||Notification.permission!=='granted')continue;
            const key='focus-calendar.notice.'+a.kind;
            if(localStorage.getItem(key)===a.id)continue;
            localStorage.setItem(key,a.id);
            const n=new Notification(t('title'),{body:t(a.kind+'Alert'),tag:'focus-calendar-'+a.kind});
            n.onclick=()=>{window.focus();ctx.layout.selectPanel('focus-calendar');n.close();};
            notifications.add(n);
            const timer=setTimeout(()=>{n.close();notifications.delete(n);notificationTimers.delete(timer);},15000);notificationTimers.add(timer);
          }catch{ /* OS notification failures must not hide in-page reminders. */ }
        }
      };
      async function request(input){
        const response=await fetch('/focus-calendar/api',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:abort.signal});
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        const result=await response.json(); if(!result.ok)throw Error(result.error||t('error'));
        publish({state:result.state,error:'',clock:Date.now(),serverOffset:result.state.now-Date.now()});if(!dead)notify(result.state);return result.state;
      }
      function act(action,args={}) {
        const run=queue.then(async()=>{publish({busy:true});try{return await request({action,...args});}catch(e){publish({error:e.message});return null;}finally{publish({busy:false});}});
        queue=run.catch(()=>{}); return run;
      }
      const useStore=()=>{React.useSyncExternalStore(f=>ctx.locale.subscribe(f),()=>ctx.locale.getSnapshot());return React.useSyncExternalStore(subscribe,()=>snapshot);};
      const button=(key,fn,props={})=>h('button',{type:'button',onClick:fn,...props},t(key));
      function Panel(){
        const {state:s,error,busy,clock}=useStore();
        const [date,setDate]=React.useState(()=>dayKey(new Date()));
        const [month,setMonth]=React.useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
        const [title,setTitle]=React.useState(''),[time,setTime]=React.useState(''),[editing,setEditing]=React.useState(null),[deleting,setDeleting]=React.useState(null);
        const [draft,setDraft]=React.useState(null),[message,setMessage]=React.useState('');
        const formDate=React.useRef(date);
        React.useEffect(()=>{formDate.current=date;setEditing(null);setTitle('');setTime('');setDeleting(null);},[date]);
        const openToday=()=>{const d=new Date();setDate(dayKey(d));setMonth(new Date(d.getFullYear(),d.getMonth(),1));};
        const shift=n=>setMonth(new Date(month.getFullYear(),month.getMonth()+n,1));
        const submit=async e=>{e.preventDefault();const submittedDate=date;const result=await act(editing?'update':'add',{...(editing?{id:editing}:{}),date,title:title.trim(),time});if(result&&formDate.current===submittedDate){setTitle('');setTime('');setEditing(null);}};
        const permission=async()=>{try{if(!('Notification'in window)){setMessage(t('unsupported'));return;}const p=await Notification.requestPermission();if(p==='granted'){localStorage.setItem('focus-calendar.notifications','yes');setMessage(t('granted'));}else setMessage(t('denied'));}catch(e){setMessage(t('unsupported'));}};
        const now=clock+snapshot.serverOffset;
        // Server deadlines are absolute epoch timestamps; browser display is refreshed each second.
        const remaining=s?(s.focus.status==='running'?s.focus.endsAt-now:s.focus.status==='paused'?s.focus.remainingMs:s.settings.focusMinutes*60000):0;
        const tasks=s?s.tasks.filter(x=>x.date===date).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')):[];
        const counts={};if(s)for(const task of s.tasks)counts[task.date]=(counts[task.date]||0)+1;
        const cells=Array.from({length:(month.getDay()+6)%7},(_,i)=>h('span',{key:'blank'+i}));
        for(let d=1;d<=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();d++){
          const key=dayKey(new Date(month.getFullYear(),month.getMonth(),d));
          cells.push(h('button',{key,type:'button',className:'fc-day','data-selected':key===date,'data-today':key===dayKey(new Date()),'aria-pressed':key===date,'aria-label':key+(counts[key]?` (${counts[key]})`:''),onClick:()=>setDate(key)},String(d),h('small',null,counts[key]?`${counts[key]} ·`:'\u00a0')));
        }
        return h('section',{className:'fc','aria-label':t('title')},h('style',null,css),h('div',{className:'fc-wrap'},
          h('header',{className:'fc-head'},h('div',null,h('h1',null,t('title')),h('div',{className:'fc-muted'},t('subtitle'))),button('back',()=>ctx.layout.selectPanel(null))),
          error&&h('p',{role:'alert',className:'fc-error'},t('error'),': ',error,' ',button('retry',()=>act('read'),{disabled:busy})),
          !s?h('p',{role:'status'},t('loading')):h('div',{className:'fc-grid'},
            h('div',{className:'fc-stack'},
              h('section',{className:'fc-card'},h('div',{className:'fc-head',style:{marginBottom:0}},h('strong',null,month.toLocaleDateString(ctx.locale.getLocale().active,{year:'numeric',month:'long'})),h('div',{className:'fc-row'},h('button',{type:'button','aria-label':t('prev'),onClick:()=>shift(-1)},'‹'),button('today',openToday),h('button',{type:'button','aria-label':t('next'),onClick:()=>shift(1)},'›'))),h('div',{className:'fc-calendar'},...t('weekdays').split(' ').map(w=>h('span',{className:'fc-week',key:w},w)),...cells)),
              h('section',{className:'fc-card'},h('div',{className:'fc-head',style:{marginBottom:8}},h('h2',null,t('tasks')),h('input',{type:'date','aria-label':t('tasks'),value:date,onChange:e=>{if(e.target.value){setDate(e.target.value);const [y,m]=e.target.value.split('-').map(Number);setMonth(new Date(y,m-1,1));}}})),h('p',{className:'fc-muted'},tasks.filter(x=>x.done).length,' / ',tasks.length,' ',t('completed')),
                tasks.length?tasks.map(task=>h('div',{className:'fc-task',key:task.id},h('input',{type:'checkbox',checked:task.done,disabled:busy,'aria-label':t(task.done?'undo':'complete')+': '+task.title,onChange:e=>act('update',{id:task.id,done:e.target.checked})}),h('div',{className:'fc-task-text','data-done':task.done},task.time&&h('span',{className:'fc-muted'},task.time+'  '),task.title),button('edit',()=>{setEditing(task.id);setTitle(task.title);setTime(task.time);},{className:'fc-small',disabled:busy}),deleting===task.id?h('div',null,button('confirmDelete',async()=>{if(await act('delete',{id:task.id})){setDeleting(null);if(editing===task.id){setEditing(null);setTitle('');setTime('');}}},{className:'fc-small',disabled:busy}),button('cancel',()=>setDeleting(null),{className:'fc-small'})):button('remove',()=>setDeleting(task.id),{className:'fc-small',disabled:busy}))):h('p',{className:'fc-muted'},t('empty')),
                h('form',{className:'fc-form',onSubmit:submit},h('label',null,t('taskTitle'),h('input',{value:title,onChange:e=>setTitle(e.target.value),required:true,maxLength:200,placeholder:t('taskTitle'),disabled:busy})),h('div',{className:'fc-row'},h('label',null,t('time'),h('input',{type:'time',value:time,onChange:e=>setTime(e.target.value),disabled:busy})),h('button',{type:'submit',className:'fc-primary',disabled:busy||!title.trim()},t(editing?'save':'add')),editing&&button('cancel',()=>{setEditing(null);setTitle('');setTime('');}))))),
            h('div',{className:'fc-stack'},
              h('section',{className:'fc-card'},h('h2',null,t('focus')),h('p',{className:'fc-muted'},t('focusHint')),h('div',{className:'fc-status'},t(s.focus.status==='idle'?'idle':s.focus.status==='paused'?'paused':s.focus.kind==='break'?'breaking':'running')),h('div',{className:'fc-timer','aria-label':t('remaining')},fmt(remaining)),h('div',{className:'fc-row'},s.focus.status==='running'?button('pause',()=>act('focusPause'),{disabled:busy}):s.focus.status==='paused'?button('resume',()=>act('focusResume'),{disabled:busy,className:'fc-primary'}):button('start',()=>act('focusStart'),{disabled:busy,className:'fc-primary'}),button('reset',()=>act('focusReset'),{disabled:busy||s.focus.status==='idle'}),button('rest',()=>act('breakStart'),{disabled:busy||s.focus.status!=='idle',title:t('stopFirst')}))),
              h('section',{className:'fc-card'},h('h2',null,t('reminders')),...['eye','body'].map(kind=>h('div',{className:'fc-health',key:kind},h('div',null,h('strong',null,t(kind)),h('div',{className:'fc-muted'},t('interval'),' ',s.settings[kind+'Minutes'],' ',t('minutes'),' · ',s.reminders[kind].running?fmt(s.reminders[kind].nextAt-now):t('off'))),h('button',{type:'button',role:'switch','aria-checked':s.reminders[kind].running,'aria-label':t(kind),disabled:busy,onClick:()=>act(s.reminders[kind].running?'remindersStop':'remindersStart',{kind})},t(s.reminders[kind].running?'disable':'enable')))),h('p',null,button('notify',permission,{className:'fc-small'})),message&&h('p',{className:'fc-muted',role:'status'},message)),
              h('details',{className:'fc-card'},h('summary',null,t('settings')),h('form',{className:'fc-form',onSubmit:async e=>{e.preventDefault();if(await act('settings',{settings:draft||s.settings})){setDraft(null);setMessage(t('saved'));}}},h('div',{className:'fc-settings'},...['focusMinutes','eyeMinutes','bodyMinutes','breakMinutes'].map(key=>h('label',{key},t(key)+' ('+t('minutes')+')',h('input',{type:'number',min:1,max:240,step:1,required:true,value:(draft||s.settings)[key],disabled:busy,onChange:e=>setDraft({...s.settings,...draft,[key]:e.target.value===''?'':Number(e.target.value)})})))),h('p',{className:'fc-muted'},t('settingsHint')),h('button',{type:'submit',disabled:busy},t('save')))))
          ),h('p',{className:'fc-muted',style:{marginTop:22}},t('note')),h('p',{className:'fc-muted'},t('shortcut'),' · ',t('timezone'))));
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
