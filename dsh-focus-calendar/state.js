import { randomUUID, createHash } from 'node:crypto';
import { validateHealthPolicy, createHealthWindowCache } from './health-policy.js';

export const ACTIONS = ['read','add','update','delete','restore','trashPurge','settings','focusStart','focusPause','focusResume','focusReset','remindersStart','remindersStop','ack','snooze','breakStart','export','importPreview','import','recoveryExport','healthPolicy','quietStart','quietCancel'];
export const DEFAULT_SETTINGS = { focusMinutes:25, eyeMinutes:20, bodyMinutes:60, breakMinutes:5 };
export const TRASH_TTL = 30*24*60*60*1000;
export const MAX_TASKS = 2000;
export const RECEIPT_TTL = 7*24*60*60*1000;
export const MAX_RECEIPTS = 4096;
const TASK_WRITES = new Set(['add','update','delete','restore','trashPurge']);
const fail = (code,message,conflict) => { const error=new Error(message);error.code=code;if(conflict)error.conflict=conflict;throw error; };
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const assert = (condition,message) => {if(!condition)throw new Error(message);};
const own = (obj,key) => Object.prototype.hasOwnProperty.call(obj,key);
const object = value => value && typeof value==='object' && !Array.isArray(value);
const safeNumber = value => Number.isSafeInteger(value) && value>=0;
const validId = value => typeof value==='string' && value.length>0 && value.length<=128 && value.trim()===value && !/[\u0000-\u001f]/.test(value);
function fields(value,allowed,required,label){
  assert(object(value),`${label}须为对象`);
  assert(Object.keys(value).every(key=>allowed.includes(key)),`${label}包含未知字段`);
  assert(required.every(key=>own(value,key)),`${label}缺少必填字段`);
}
export function initialState(){
  return {tasks:[],settings:{...DEFAULT_SETTINGS},healthPolicy:validateHealthPolicy(),quietUntil:null,healthRuntime:null,focus:{status:'idle',kind:'focus',endsAt:null,remainingMs:0,taskId:null,segmentStartedAt:null},reminders:{eye:{running:false,nextAt:null},body:{running:false,nextAt:null}},alerts:[],trash:[],snoozed:[],recovery:null,receipts:[]};
}
export function validDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function validTime(value){return typeof value==='string'&&(value===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(value));}
function normalizeTask(task){return {...task,focusMs:task.focusMs??0,focusRounds:task.focusRounds??0,_editVersion:task._editVersion??randomUUID()};}
function publicTask(task){const {_editVersion,...copy}=task;return copy;}
/** Compatibility normalization adds fields without changing IDs, titles, or prior timestamps. */
export function normalizeState(current){
  const state=structuredClone(current);
  state.tasks=state.tasks.map(normalizeTask);
  state.trash=(state.trash??[]).map(entry=>({...entry,task:normalizeTask(entry.task)}));
  state.snoozed??=[];state.recovery??=null;state.receipts??=[];
  state.healthPolicy=validateHealthPolicy(state.healthPolicy);
  state.quietUntil??=null;state.healthRuntime??=null;
  state.focus.taskId??=null;
  state.focus.segmentStartedAt??=null;
  return state;
}
function settleFocus(state,now,completed=false){
  const f=state.focus;
  const task=f.taskId?state.tasks.find(item=>item.id===f.taskId):undefined;
  if(f.kind==='focus'&&f.status==='running'&&f.segmentStartedAt!==null&&task){
    const end=Math.min(now,f.endsAt);
    task.focusMs=Math.min(MAX_SAFE,task.focusMs+Math.max(0,end-f.segmentStartedAt));
    if(completed)task.focusRounds=Math.min(MAX_SAFE,task.focusRounds+1);
  }
  f.segmentStartedAt=null;
}
function pushAlert(state,kind,now,id,taskId){
  if(state.alerts.some(item=>item.kind===kind)||state.snoozed.some(item=>item.kind===kind))return;
  state.alerts.push({id:id(),kind,at:now,...(taskId?{taskId}:{})});
}
const healthKind = kind => kind==='eye'||kind==='body';
export function healthStatus(state,now,evaluate=createHealthWindowCache()){
  const quietUntil=state.quietUntil??null,quiet=quietUntil!==null&&quietUntil>now;
  const window=evaluate(state.healthPolicy,quiet?quietUntil:now);
  return {allowed:!quiet&&window.allowed,reason:quiet?'quiet':window.reason,
    resumeAt:quiet?(window.allowed?quietUntil:window.nextAllowedAt):window.allowed?null:window.nextAllowedAt,quietUntil};
}
function clearHealthAlerts(state){
  state.alerts=state.alerts.filter(item=>!healthKind(item.kind));
  state.snoozed=state.snoozed.filter(item=>!healthKind(item.kind));
}
/** Keep user running switches. Persist the end of the current eligible window
 * so sleep/restart across an entirely missed lunch/weekend cannot catch up.
 * The runtime marker changes at boundaries, not on every one-second read.
 */
function coordinateHealth(state,now,evaluate,force=false){
  const status=healthStatus(state,now,evaluate),runtime=state.healthRuntime;
  const expiredQuiet=state.quietUntil!==null&&state.quietUntil<=now;
  if(expiredQuiet)state.quietUntil=null;
  const active=state.healthPolicy.enabled||state.quietUntil!==null;
  if(!active&&!runtime&&!force&&!expiredQuiet)return status;
  const reset=force||expiredQuiet||runtime?.blocked||
    (runtime?.boundaryAt!==null&&runtime?.boundaryAt!==undefined&&now>=runtime.boundaryAt)||
    (runtime&&now<runtime.checkedAt)||(!runtime&&active);
  if(!status.allowed||reset){
    clearHealthAlerts(state);
    const base=status.allowed?now:status.resumeAt;
    for(const kind of ['eye','body']){
      const reminder=state.reminders[kind];
      if(reminder.running)reminder.nextAt=base===null?null:base+state.settings[kind+'Minutes']*60000;
    }
  }
  if(!active){state.healthRuntime=null;return {...status,quietUntil:null};}
  if(!status.allowed){
    // Preserve checkedAt between reads: no needless persisted writes.
    if(!runtime||!runtime.blocked||force||now<runtime.checkedAt)
      state.healthRuntime={blocked:true,boundaryAt:null,checkedAt:now};
  }else if(reset||!runtime){
    state.healthRuntime={blocked:false,boundaryAt:evaluate(state.healthPolicy,now).boundaryAt,checkedAt:now};
  }
  return {...status,quietUntil:state.quietUntil};
}
export function reconcile(state,now,id=randomUUID,evaluate=createHealthWindowCache(),forceHealth=false){
  state.trash=state.trash.filter(item=>now-item.deletedAt<TRASH_TTL);
  if(state.focus.status==='running'&&state.focus.endsAt<=now){
    settleFocus(state,now,true);
    pushAlert(state,state.focus.kind,now,id,state.focus.taskId);
    state.focus={...state.focus,status:'idle',endsAt:null,remainingMs:0,segmentStartedAt:null};
  }
  const health=coordinateHealth(state,now,evaluate,forceHealth);
  // Reuse the original alert ID so postponed reminders remain identifiable.
  const waiting=[];
  for(const item of state.snoozed){
    if(item.dueAt>now){waiting.push(item);continue;}
    if(!state.alerts.some(alert=>alert.kind===item.kind)){
      const {dueAt,...alert}=item;state.alerts.push({...alert,at:now});
    }
  }
  state.snoozed=waiting;
  for(const kind of ['eye','body']){
    const reminder=state.reminders[kind];
    if(health.allowed&&reminder.running&&reminder.nextAt!==null&&reminder.nextAt<=now){
      pushAlert(state,kind,now,id);
      reminder.nextAt=now+state.settings[kind+'Minutes']*60000;
    }
  }
  return state;
}
function validateTask(value){
  fields(value,['id','date','title','time','done','focusMs','focusRounds'],['id','date','title','time','done'],'备份任务');
  assert(validId(value.id),'备份任务ID无效（1至128字符）');
  assert(validDate(value.date),'备份任务日期无效');
  assert(typeof value.title==='string'&&value.title.trim().length>0&&value.title.length<=200,'备份任务标题无效');
  assert(validTime(value.time),'备份任务时间无效');assert(typeof value.done==='boolean','备份任务done无效');
  const task=normalizeTask(value);assert(safeNumber(task.focusMs)&&safeNumber(task.focusRounds),'备份专注统计无效');
  return {id:task.id,date:task.date,title:task.title,time:task.time,done:task.done,focusMs:task.focusMs,focusRounds:task.focusRounds};
}
export function normalizeBackup(value){
  assert(Buffer.byteLength(JSON.stringify(value)??'')<=4*1024*1024,'备份不能超过4MiB');
  fields(value,['format','version','exportedAt','tasks','settings','trash','healthPolicy'],['format','version','exportedAt','tasks','settings','trash'],'备份');
  assert(value.format==='dsh-focus-calendar','不是专注日历备份');assert(value.version===1,'不支持的备份版本');
  assert(safeNumber(value.exportedAt),'备份时间无效');
  assert(Array.isArray(value.tasks)&&value.tasks.length<=MAX_TASKS,'备份任务须为数组，最多2000项');
  assert(Array.isArray(value.trash)&&value.trash.length<=MAX_TASKS,'备份回收站须为数组，最多2000项');
  fields(value.settings,Object.keys(DEFAULT_SETTINGS),Object.keys(DEFAULT_SETTINGS),'备份设置');
  const settings={};for(const key of Object.keys(DEFAULT_SETTINGS)){const number=value.settings[key];assert(Number.isInteger(number)&&number>=1&&number<=240,'备份间隔须为1至240整数分钟');settings[key]=number;}
  const tasks=value.tasks.map(validateTask);
  const trash=value.trash.map(entry=>{fields(entry,['task','deletedAt'],['task','deletedAt'],'回收站项');assert(safeNumber(entry.deletedAt),'删除时间无效');return {task:validateTask(entry.task),deletedAt:entry.deletedAt};});
  const ids=new Set();for(const task of [...tasks,...trash.map(item=>item.task)]){assert(!ids.has(task.id),'备份包含重复任务ID（包括回收站）');ids.add(task.id);}
  return {format:'dsh-focus-calendar',version:1,exportedAt:value.exportedAt,tasks,settings,trash,healthPolicy:validateHealthPolicy(value.healthPolicy)};
}
export function exportBackup(state,now){return {format:'dsh-focus-calendar',version:1,exportedAt:now,healthPolicy:validateHealthPolicy(state.healthPolicy),tasks:state.tasks.map(task=>structuredClone(publicTask(task))),settings:{...state.settings},trash:state.trash.map(entry=>({task:structuredClone(publicTask(entry.task)),deletedAt:entry.deletedAt}))};}
function canonical(value){return Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;}
const fingerprint = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function taskEditToken(task,location='active',deletedAt=null){
  return fingerprint({location,deletedAt,version:task._editVersion??null,id:task.id,date:task.date,title:task.title,time:task.time,done:task.done});
}
function locatedToken(state,id){
  const active=state.tasks.find(task=>task.id===id);
  if(active)return taskEditToken(active);
  const trash=state.trash.find(entry=>entry.task.id===id);
  return trash?taskEditToken(trash.task,'trash',trash.deletedAt):null;
}
function receiptResult(receipt,replayed){return {requestId:receipt.requestId,taskId:receipt.taskId,taskToken:receipt.taskToken,replayed,expiresAt:receipt.createdAt+RECEIPT_TTL};}
function previewToken(state,backup,tokenSalt){return fingerprint({tokenSalt,backup,current:{tasks:state.tasks,settings:state.settings,trash:state.trash,healthPolicy:state.healthPolicy}});}
function previewOf(state,backup,tokenSalt){
  const existing=new Map([...state.tasks.map(task=>[task.id,{type:'active',task:publicTask(task)}]),...state.trash.map(entry=>[entry.task.id,{type:'trash',task:publicTask(entry.task),deletedAt:entry.deletedAt}])]);
  let added=0,conflicts=0,duplicates=0;
  for(const entry of [...backup.tasks.map(task=>({type:'active',task})),...backup.trash.map(item=>({type:'trash',...item}))]){
    const current=existing.get(entry.task.id);
    if(!current)added++;else if(fingerprint(current)===fingerprint(entry))duplicates++;else conflicts++;
  }
  const dates=[...backup.tasks,...backup.trash.map(item=>item.task)].map(task=>task.date).sort();
  return {token:previewToken(state,backup,tokenSalt),taskCount:backup.tasks.length,trashCount:backup.trash.length,from:dates[0]??null,to:dates.at(-1)??null,added,conflicts,duplicates,settings:{...backup.settings},healthPolicy:structuredClone(backup.healthPolicy)};
}
function stopAll(state,now){
  settleFocus(state,now);
  state.focus=initialState().focus;state.reminders=initialState().reminders;state.alerts=[];state.snoozed=[];state.quietUntil=null;state.healthRuntime=null;
}
function operation(current,request,now,id,tokenSalt='',evaluate=createHealthWindowCache(),rewound=false){
  assert(object(request),'操作必须是对象');assert(ACTIONS.includes(request.action),'未知操作');
  const allowed={read:[],add:['date','title','time'],update:['id','date','title','time','done'],delete:['id'],restore:['id'],trashPurge:['id'],settings:['settings'],focusStart:['id'],focusPause:[],focusResume:[],focusReset:[],remindersStart:['kind'],remindersStop:['kind'],ack:['id'],snooze:['id','minutes'],breakStart:[],export:[],importPreview:['backup'],import:['backup','mode','token'],recoveryExport:[],healthPolicy:['policy'],quietStart:['minutes'],quietCancel:[]};
  if(TASK_WRITES.has(request.action))allowed[request.action].push('requestId');
  if(TASK_WRITES.has(request.action)&&request.action!=='add')allowed[request.action].push('expectedToken');
  assert(Object.keys(request).every(key=>key==='action'||allowed[request.action].includes(key)),'操作包含不支持的参数');
  assert(safeNumber(now),'时钟时间无效');
  const state=normalizeState(current),extras={};
  state.receipts=state.receipts.filter(receipt=>now-receipt.createdAt<RECEIPT_TTL);
  let payloadHash;
  if(own(request,'requestId')){
    assert(validId(request.requestId)&&request.requestId.length>=16,'requestId须为16至128字符');
    const {requestId,...payload}=request;payloadHash=fingerprint(payload);
    const receipt=state.receipts.find(item=>item.requestId===requestId);
    if(receipt){
      if(receipt.payloadHash!==payloadHash)fail('REQUEST_ID_REUSED','请求ID已用于不同内容；请勿修改原请求后重试');
      reconcile(state,now,id,evaluate,rewound&&(state.healthPolicy.enabled||state.quietUntil!==null));extras.receipt=receiptResult(receipt,true);return {state,extras};
    }
    if(state.receipts.length>=MAX_RECEIPTS)fail('RECEIPT_CAPACITY','防重复回执已达4096条上限，请等待回执过期；未执行此次操作');
  }
  reconcile(state,now,id,evaluate,rewound&&(state.healthPolicy.enabled||state.quietUntil!==null));
  if(own(request,'expectedToken')){
    assert(typeof request.expectedToken==='string'&&/^[a-f0-9]{64}$/.test(request.expectedToken),'expectedToken须为read返回的editToken');
    const currentToken=locatedToken(state,request.id);
    if(currentToken!==request.expectedToken)fail('CONFLICT','任务已在另一处修改、移动或删除；本次操作未执行，请核对最新任务',{id:request.id??'',currentToken});
  }
  const taskFields=(input,add)=>{
    const patch={};
    if(add||own(input,'date')){assert(validDate(input.date),'日期须为有效 YYYY-MM-DD');patch.date=input.date;}
    if(add||own(input,'title')){assert(typeof input.title==='string'&&input.title.trim().length>0&&input.title.trim().length<=200,'标题须为1至200字符');patch.title=input.title.trim();}
    if(add||own(input,'time')){const time=add&&input.time===undefined?'':input.time;assert(validTime(time),'时间须为 HH:mm 或空字符串');patch.time=time;}
    if(own(input,'done')){assert(typeof input.done==='boolean','done须为布尔值');patch.done=input.done;}
    return patch;
  };
  switch(request.action){
    case 'read':break;
    case 'healthPolicy':{
      const keys=Object.keys(validateHealthPolicy());
      fields(request.policy,keys,keys,'健康工作规则');
      const policy=validateHealthPolicy(request.policy);
      if(JSON.stringify(policy)!==JSON.stringify(state.healthPolicy)){
        state.healthPolicy=policy;evaluate.clear();coordinateHealth(state,now,evaluate,true);
      }break;
    }
    case 'quietStart':{
      assert([30,60].includes(request.minutes),'临时健康勿扰仅支持30或60分钟');
      state.quietUntil=now+request.minutes*60000;
      coordinateHealth(state,now,evaluate,true);break;
    }
    case 'quietCancel':{
      if(state.quietUntil!==null){state.quietUntil=null;coordinateHealth(state,now,evaluate,true);}break;
    }
    case 'add':{
      assert(state.tasks.length<MAX_TASKS,'最多保存2000项任务');
      const taskId=id();assert(validId(taskId)&&!state.tasks.some(task=>task.id===taskId)&&!state.trash.some(item=>item.task.id===taskId),'任务ID冲突');
      state.tasks.push(normalizeTask({id:taskId,...taskFields(request,true),done:false,focusMs:0,focusRounds:0}));break;
    }
    case 'update':{const task=state.tasks.find(item=>item.id===request.id);assert(task,'任务不存在');const before=taskEditToken(task);Object.assign(task,taskFields(request,false));if(taskEditToken(task)!==before)task._editVersion=randomUUID();break;}
    case 'delete':{
      const index=state.tasks.findIndex(item=>item.id===request.id);assert(index>=0,'任务不存在');assert(state.trash.length<MAX_TASKS,'回收站已满，请先恢复或明确永久删除项目');
      if(state.focus.taskId===request.id&&state.focus.status!=='idle'){settleFocus(state,now);state.focus=initialState().focus;}
      const removed=state.tasks.splice(index,1)[0];removed._editVersion=randomUUID();state.trash.push({task:removed,deletedAt:now});break;
    }
    case 'restore':{
      const index=state.trash.findIndex(item=>item.task.id===request.id);assert(index>=0,'回收站任务不存在或已过期');assert(state.tasks.length<MAX_TASKS,'任务已达2000项上限');assert(!state.tasks.some(task=>task.id===request.id),'本机已有相同ID任务');const restored=state.trash.splice(index,1)[0].task;restored._editVersion=randomUUID();state.tasks.push(restored);break;
    }
    case 'trashPurge':{const index=state.trash.findIndex(item=>item.task.id===request.id);assert(index>=0,'回收站任务不存在');state.trash.splice(index,1);break;}
    case 'settings':{
      const values=request.settings;assert(object(values)&&Object.keys(values).length>0,'settings须为非空对象');
      for(const [key,value] of Object.entries(values)){assert(own(DEFAULT_SETTINGS,key),'未知设置项');assert(Number.isInteger(value)&&value>=1&&value<=240,'间隔须为1至240整数分钟');state.settings[key]=value;}coordinateHealth(state,now,evaluate);break;
    }
    case 'focusStart':case 'breakStart':{
      assert(state.focus.status==='idle','请先暂停后重置或完成当前计时，不能替换进行中的计时');
      const kind=request.action==='breakStart'?'break':'focus';
      if(own(request,'id'))assert(validId(request.id)&&state.tasks.some(task=>task.id===request.id),'关联任务不存在');
      const duration=state.settings[kind+'Minutes']*60000;
      state.focus={status:'running',kind,endsAt:now+duration,remainingMs:duration,taskId:kind==='focus'?(request.id??null):null,segmentStartedAt:kind==='focus'?now:null};break;
    }
    case 'focusPause':assert(state.focus.status==='running','没有运行中的计时');settleFocus(state,now);state.focus.remainingMs=Math.max(0,state.focus.endsAt-now);state.focus.endsAt=null;state.focus.status='paused';break;
    case 'focusResume':assert(state.focus.status==='paused','没有暂停的计时');state.focus.endsAt=now+state.focus.remainingMs;state.focus.status='running';state.focus.segmentStartedAt=state.focus.kind==='focus'?now:null;break;
    case 'focusReset':settleFocus(state,now);state.focus=initialState().focus;break;
    case 'remindersStart':case 'remindersStop':{
      const kind=request.kind??'all';assert(['eye','body','all'].includes(kind),'kind须为eye、body或all');
      for(const key of kind==='all'?['eye','body']:[kind]){
        const running=request.action==='remindersStart';if(running&&state.reminders[key].running)continue;
        state.reminders[key]={running,nextAt:running?now+state.settings[key+'Minutes']*60000:null};
        if(!running){state.snoozed=state.snoozed.filter(item=>item.kind!==key);state.alerts=state.alerts.filter(item=>item.kind!==key);}
      }coordinateHealth(state,now,evaluate);break;
    }
    case 'ack':assert(validId(request.id),'需要提醒id');state.alerts=state.alerts.filter(item=>item.id!==request.id);break;
    case 'snooze':{
      assert([5,10].includes(request.minutes),'稍后提醒仅支持5或10分钟');const index=state.alerts.findIndex(item=>item.id===request.id);assert(index>=0,'提醒不存在');const alert=state.alerts.splice(index,1)[0];
      assert(!state.snoozed.some(item=>item.kind===alert.kind),'同类型已有稍后提醒');state.snoozed.push({...alert,dueAt:now+request.minutes*60000});break;
    }
    case 'export':{const copy=structuredClone(state);settleFocus(copy,now);extras.backup=exportBackup(copy,now);break;}
    case 'recoveryExport':assert(state.recovery?.backup,'没有可恢复的替换前备份');extras.backup=structuredClone(state.recovery.backup);break;
    case 'importPreview':extras.preview=previewOf(state,normalizeBackup(request.backup),tokenSalt);break;
    case 'import':{
      const backup=normalizeBackup(request.backup);assert(['merge','replace'].includes(request.mode),'导入模式须为merge或replace');
      assert(typeof request.token==='string'&&request.token===previewToken(state,backup,tokenSalt),'预览已过期或备份已更改，请重新预览');
      stopAll(state,now);
      if(request.mode==='replace'){
        state.recovery={createdAt:now,backup:exportBackup(state,now)};
        state.healthPolicy=backup.healthPolicy;state.tasks=backup.tasks.map(normalizeTask);state.settings=backup.settings;state.trash=backup.trash.map(entry=>({...entry,task:normalizeTask(entry.task)}));
      }else{
        const existing=new Set([...state.tasks.map(task=>task.id),...state.trash.map(item=>item.task.id)]);
        const newTasks=backup.tasks.filter(task=>!existing.has(task.id)),newTrash=backup.trash.filter(item=>!existing.has(item.task.id));
        assert(state.tasks.length+newTasks.length<=MAX_TASKS&&state.trash.length+newTrash.length<=MAX_TASKS,'合并将超过任务或回收站2000项上限');state.tasks.push(...newTasks.map(normalizeTask));state.trash.push(...newTrash.map(entry=>({...entry,task:normalizeTask(entry.task)})));
      }
      state.trash=state.trash.filter(item=>now-item.deletedAt<TRASH_TTL);break;
    }
  }
  if(payloadHash){
    const taskId=request.action==='add'?state.tasks.at(-1).id:request.id;
    const receipt={requestId:request.requestId,payloadHash,action:request.action,taskId,taskToken:locatedToken(state,taskId),createdAt:now};
    state.receipts.push(receipt);extras.receipt=receiptResult(receipt,false);
  }
  return {state,extras};
}
export function transition(current,request,now=Date.now(),id=randomUUID){return operation(current,request,now,id).state;}
function clientState(state,now,evaluate){
  const copy=structuredClone(state);delete copy.receipts;delete copy.healthRuntime;
  copy.healthStatus=healthStatus(state,now,evaluate);
  copy.tasks=state.tasks.map(task=>({...publicTask(task),editToken:taskEditToken(task)}));
  copy.trash=state.trash.map(entry=>({deletedAt:entry.deletedAt,task:{...publicTask(entry.task),editToken:taskEditToken(entry.task,'trash',entry.deletedAt)}}));
  copy.recovery=state.recovery?{createdAt:state.recovery.createdAt,taskCount:state.recovery.backup.tasks.length}:null;return {...copy,now};
}
/** Serialize copy-on-write commits: a failed write publishes neither state nor successful extras. */
export function createController({load,save,clock=Date.now,id=randomUUID}){
  let queue=Promise.resolve(),closed=false,lastNow=null;
  const evaluate=createHealthWindowCache();
  // Opaque process-scoped tokens cannot be fabricated from an unpreviewed payload.
  const tokenSalt=randomUUID();
  const dispatch=request=>{
    if(closed)return Promise.resolve({ok:false,error:'插件已停止'});
    // Snapshot the caller's payload before queueing; later object mutation cannot change intent.
    let input;try{input=structuredClone(request);}catch{return Promise.resolve({ok:false,code:'INVALID_REQUEST',error:'请求必须是可序列化数据'});}
    const run=queue.then(async()=>{
      let saving=false;
      try{
        const now=clock(),current=load(),rewound=lastNow!==null&&now<lastNow;
        if(rewound)evaluate.clear();
        const {state,extras}=operation(current,input,now,id,tokenSalt,evaluate,rewound);
        if(JSON.stringify(state)!==JSON.stringify(current)){saving=true;await save(state);saving=false;}
        lastNow=now;
        return {ok:true,state:clientState(state,now,evaluate),...extras};
      }catch(error){return {ok:false,error:error instanceof Error?error.message:'操作失败',code:saving?'WRITE_UNCERTAIN':error.code??'INVALID_REQUEST',...(error.conflict?{conflict:error.conflict}:{})};}
    });
    queue=run.then(()=>{});return run;
  };
  return {dispatch,async close(){closed=true;await queue;}};
}
/** Persisted v1 schema adds defaults for the 1.1 shape; backups have a separate strict validator. */
export function stateSchema(z){
  const timestamp=z.number().int().nonnegative().nullable();
  const task=z.object({id:z.string().min(1),date:z.string().refine(validDate),title:z.string().min(1).max(200),time:z.string().refine(validTime),done:z.boolean(),focusMs:z.number().int().nonnegative().default(0),focusRounds:z.number().int().nonnegative().default(0),_editVersion:z.string().min(1).optional()});
  const reminder=z.object({running:z.boolean(),nextAt:timestamp});
  const alert=z.object({id:z.string().min(1),kind:z.enum(['focus','eye','body','break']),at:z.number().int().nonnegative(),taskId:z.string().min(1).optional()});
  const backup=z.unknown().transform((value,ctx)=>{try{return normalizeBackup(value);}catch(error){ctx.addIssue({code:'custom',message:error.message});return z.NEVER;}});
  return z.object({
    tasks:z.array(task).max(MAX_TASKS),settings:z.object(Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(key=>[key,z.number().int().min(1).max(240)]))),
    focus:z.object({status:z.enum(['idle','running','paused']),kind:z.enum(['focus','break']),endsAt:timestamp,remainingMs:z.number().int().nonnegative(),taskId:z.string().min(1).nullable().default(null),segmentStartedAt:timestamp.default(null)}),
    healthPolicy:z.unknown().transform((value,ctx)=>{try{return validateHealthPolicy(value);}catch(error){ctx.addIssue({code:'custom',message:error.message});return z.NEVER;}}).default(()=>validateHealthPolicy()),
    quietUntil:timestamp.default(null),
    healthRuntime:z.object({blocked:z.boolean(),boundaryAt:timestamp,checkedAt:z.number().int().nonnegative()}).nullable().default(null),
    reminders:z.object({eye:reminder,body:reminder}),alerts:z.array(alert).max(4),
    trash:z.array(z.object({task,deletedAt:z.number().int().nonnegative()})).max(MAX_TASKS).default([]),
    snoozed:z.array(alert.extend({dueAt:z.number().int().nonnegative()})).max(4).default([]),
    recovery:z.object({createdAt:z.number().int().nonnegative(),backup}).nullable().default(null),
    receipts:z.array(z.object({requestId:z.string().min(16).max(128),payloadHash:z.string().regex(/^[a-f0-9]{64}$/),action:z.enum(['add','update','delete','restore','trashPurge']),taskId:z.string().min(1).max(128),taskToken:z.string().nullable(),createdAt:z.number().int().nonnegative()})).max(MAX_RECEIPTS).default([]),
  });
}
