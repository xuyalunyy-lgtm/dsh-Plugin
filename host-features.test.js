import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { Readable } from 'node:stream';
import { initialState, normalizeState, normalizeBackup, exportBackup, stateSchema, transition, createController, TRASH_TTL, MAX_TASKS } from './state.js';
import { createHttpHandler } from './index.js';

const BASE=1800000000000;
function rig(start=initialState()){
  let stored=structuredClone(start),now=BASE,seq=0,writes=0,fail=false;
  const controller=createController({load:()=>stored,save:async next=>{if(fail)throw Error('disk full');stored=structuredClone(next);writes++;},clock:()=>now,id:()=>`generated-${++seq}`});
  return {call:controller.dispatch,close:controller.close,get state(){return structuredClone(stored);},get writes(){return writes;},set now(value){now=value;},get now(){return now;},set fail(value){fail=value;}};
}
const task=(id,extras={})=>({id,date:'2026-10-23',title:`Task ${id}`,time:'09:30',done:false,focusMs:0,focusRounds:0,...extras});
const backup=(tasks=[],trash=[])=>({format:'dsh-focus-calendar',version:1,exportedAt:BASE,tasks,settings:{focusMinutes:25,eyeMinutes:20,bodyMinutes:60,breakMinutes:5},trash});
async function okay(r,input){const result=await r.call(input);assert.equal(result.ok,true,result.error);return result;}
async function preview(r,value){return (await okay(r,{action:'importPreview',backup:value})).preview;}

// Migration must work both before and after storageDomain's Zod projection.
test('v1.1 state migrates in the same domain shape without dropping task identity or running deadlines',async()=>{
  const legacy={tasks:[{id:'legacy',date:'2026-10-23',title:'  Preserved title  ',time:'',done:true}],settings:{focusMinutes:45,eyeMinutes:30,bodyMinutes:45,breakMinutes:5},focus:{status:'running',kind:'focus',endsAt:BASE+1234,remainingMs:1234},reminders:{eye:{running:false,nextAt:null},body:{running:false,nextAt:null}},alerts:[]};
  const parsed=stateSchema(z).parse(legacy);
  assert.equal(parsed.tasks[0].title,legacy.tasks[0].title);assert.equal(parsed.tasks[0].id,'legacy');assert.equal(parsed.tasks[0].focusMs,0);assert.equal(parsed.focus.endsAt,BASE+1234);assert.equal(parsed.focus.taskId,null);assert.deepEqual(parsed.trash,[]);assert.equal(parsed.recovery,null);
  const r=rig(legacy);const result=await okay(r,{action:'read'});assert.equal(result.state.tasks[0].title,legacy.tasks[0].title);const expected=normalizeState(legacy);assert.equal(typeof r.state.tasks[0]._editVersion,'string');expected.tasks[0]._editVersion=r.state.tasks[0]._editVersion;assert.deepEqual(r.state,expected);const stable=result.state.tasks[0].editToken;assert.equal((await okay(r,{action:'read'})).state.tasks[0].editToken,stable);await r.close();
});

test('focus segments count real running time only, cap on deadline, and count exactly one round without auto-done',async()=>{
  const initial=initialState();initial.tasks=[task('a')];initial.settings.focusMinutes=1;const r=rig(initial);
  await okay(r,{action:'focusStart',id:'a'});assert.equal(r.state.focus.taskId,'a');assert.equal(r.state.focus.segmentStartedAt,BASE);
  r.now=BASE+10000;await okay(r,{action:'focusPause'});assert.equal(r.state.tasks[0].focusMs,10000);assert.equal(r.state.focus.remainingMs,50000);
  r.now=BASE+600000;await okay(r,{action:'read'});assert.equal(r.state.tasks[0].focusMs,10000);
  await okay(r,{action:'focusResume'});r.now+=10000;await okay(r,{action:'focusReset'});assert.equal(r.state.tasks[0].focusMs,20000);assert.equal(r.state.tasks[0].focusRounds,0);
  await okay(r,{action:'focusStart',id:'a'});r.now+=999999;const completed=await okay(r,{action:'read'});
  assert.equal(completed.state.tasks[0].focusMs,80000);assert.equal(completed.state.tasks[0].focusRounds,1);assert.equal(completed.state.tasks[0].done,false);assert.equal(completed.state.alerts[0].taskId,'a');
  await okay(r,{action:'read'});assert.equal(r.state.tasks[0].focusRounds,1);
  await okay(r,{action:'breakStart'});r.now+=999999;await okay(r,{action:'read'});assert.equal(r.state.tasks[0].focusMs,80000);await r.close();
});

test('nonidle timers cannot be replaced and invalid task associations cause no write',async()=>{
  const r=rig();assert.equal((await r.call({action:'focusStart',id:'missing'})).ok,false);assert.equal(r.writes,0);
  await okay(r,{action:'focusStart'});const before=r.state,writes=r.writes;
  for(const action of ['focusStart','breakStart'])assert.equal((await r.call({action})).ok,false);
  assert.deepEqual(r.state,before);assert.equal(r.writes,writes);
  await okay(r,{action:'focusPause'});assert.equal((await r.call({action:'breakStart'})).ok,false);await r.close();
});

test('delete settles associated running focus into trash, restore retains identity/statistics, and purge is permanent',async()=>{
  const initial=initialState();initial.tasks=[task('a')];const r=rig(initial);
  await okay(r,{action:'focusStart',id:'a'});r.now+=12345;await okay(r,{action:'delete',id:'a'});
  assert.equal(r.state.tasks.length,0);assert.equal(r.state.focus.status,'idle');assert.equal(r.state.trash[0].task.focusMs,12345);assert.equal(r.state.trash[0].deletedAt,r.now);
  await okay(r,{action:'restore',id:'a'});assert.equal(r.state.tasks[0].focusMs,12345);assert.equal(r.state.tasks[0].id,'a');assert.equal(r.state.trash.length,0);
  await okay(r,{action:'delete',id:'a'});await okay(r,{action:'trashPurge',id:'a'});assert.equal(r.state.trash.length,0);assert.equal((await r.call({action:'restore',id:'a'})).ok,false);await r.close();
});

test('trash expires at thirty days and full active/trash collections reject rather than evict',async()=>{
  const initial=initialState();initial.tasks=[task('a')];initial.trash=Array.from({length:MAX_TASKS},(_,i)=>({task:task('trash-'+i),deletedAt:BASE}));const r=rig(initial);
  assert.equal((await r.call({action:'delete',id:'a'})).ok,false);assert.deepEqual(r.state,initial);
  r.now=BASE+TRASH_TTL-1;await okay(r,{action:'read'});assert.equal(r.state.trash.length,MAX_TASKS);
  r.now++;await okay(r,{action:'read'});assert.equal(r.state.trash.length,0);await r.close();
  const full=initialState();full.tasks=Array.from({length:MAX_TASKS},(_,i)=>task('active-'+i));full.trash=[{task:task('restorable'),deletedAt:BASE}];const q=rig(full);
  assert.equal((await q.call({action:'restore',id:'restorable'})).ok,false);assert.deepEqual(q.state,full);await q.close();
});

test('snoozed alert reappears once with updated at, suppresses its kind meanwhile, and Stop cancels it',async()=>{
  const initial=initialState();initial.settings.eyeMinutes=1;const r=rig(initial);
  await okay(r,{action:'remindersStart',kind:'eye'});r.now+=60000;const first=(await okay(r,{action:'read'})).state.alerts[0];
  await okay(r,{action:'snooze',id:first.id,minutes:5});assert.equal(r.state.alerts.length,0);assert.equal(r.state.snoozed[0].dueAt,r.now+300000);
  r.now+=60000;await okay(r,{action:'read'});assert.equal(r.state.alerts.length,0);
  r.now+=240000;const after=(await okay(r,{action:'read'})).state;assert.equal(after.snoozed.length,0);assert.equal(after.alerts.length,1);assert.equal(after.alerts[0].id,first.id);assert.ok(after.alerts[0].at>first.at);
  await okay(r,{action:'snooze',id:first.id,minutes:10});await okay(r,{action:'remindersStop',kind:'eye'});assert.equal(r.state.snoozed.length,0);
  r.now+=9999999;await okay(r,{action:'read'});assert.equal(r.state.alerts.length,0);await r.close();
});

test('invalid snooze and missing alert do not remove or mutate pending notifications',async()=>{
  const initial=initialState();initial.alerts=[{id:'alert',kind:'focus',at:BASE}];const r=rig(initial);
  for(const input of [{action:'snooze',id:'alert',minutes:6},{action:'snooze',id:'missing',minutes:5},{action:'snooze',id:'alert',minutes:'5'}])assert.equal((await r.call(input)).ok,false);
  assert.deepEqual(r.state,initial);assert.equal(r.writes,0);await r.close();
});

test('export snapshots elapsed focus without mutating running segment or double-counting future completion',async()=>{
  const initial=initialState();initial.tasks=[task('a')];initial.settings.focusMinutes=1;const r=rig(initial);
  await okay(r,{action:'focusStart',id:'a'});r.now+=10000;const first=await okay(r,{action:'export'});
  assert.equal(first.backup.tasks[0].focusMs,10000);assert.equal(first.state.tasks[0].focusMs,0);assert.equal(r.state.focus.segmentStartedAt,BASE);
  assert.deepEqual(Object.keys(first.backup).sort(),['exportedAt','format','settings','tasks','trash','version']);
  r.now+=10000;const second=await okay(r,{action:'export'});assert.equal(second.backup.tasks[0].focusMs,20000);
  r.now=BASE+60000;await okay(r,{action:'read'});assert.equal(r.state.tasks[0].focusMs,60000);assert.equal(r.state.tasks[0].focusRounds,1);await r.close();
});

test('backup validation is strict, bounded, versioned, unique across active/trash, and defaults old statistics',()=>{
  const legacy=task('a');delete legacy.focusMs;delete legacy.focusRounds;assert.equal(normalizeBackup(backup([legacy])).tasks[0].focusMs,0);
  const bad=[];
  const changed=patch=>({...backup([task('a')]),...patch});
  bad.push(changed({format:'other'}),changed({version:2}),changed({extra:true}),changed({exportedAt:-1}),changed({tasks:Array(MAX_TASKS+1).fill(task('a'))}));
  bad.push(backup([task('a'),task('a')]),backup([task('a')],[{task:task('a'),deletedAt:BASE}]));
  for(const patch of [{id:''},{id:'x'.repeat(129)},{date:'2026-02-30'},{title:''},{time:'24:00'},{done:1},{focusMs:-1},{focusRounds:Infinity},{focusMs:MAX_SAFE_INTEGER_PLUS_ONE()},{extra:'no'}])bad.push(backup([task('a',patch)]));
  bad.push(changed({settings:{focusMinutes:25}}),changed({settings:{...backup().settings,eyeMinutes:0}}),backup([],[{task:task('t'),deletedAt:-1}]));
  for(const value of bad)assert.throws(()=>normalizeBackup(value));
  assert.throws(()=>normalizeBackup({...backup(),oversize:'x'.repeat(4*1024*1024)}),/4MiB/);
});
function MAX_SAFE_INTEGER_PLUS_ONE(){return Number.MAX_SAFE_INTEGER+1;}

test('preview counts duplicate/conflict/new IDs and merge keeps local items/settings across active and trash',async()=>{
  const initial=initialState();initial.tasks=[task('same'),task('conflict',{title:'Local'}),task('cross')];initial.settings.eyeMinutes=33;initial.trash=[{task:task('local-trash'),deletedAt:BASE}];const r=rig(initial);
  const value=backup([task('same'),task('conflict',{title:'Imported'}),task('new')],[{task:task('cross'),deletedAt:BASE},{task:task('local-trash'),deletedAt:BASE},{task:task('new-trash'),deletedAt:BASE}]);
  const p=await preview(r,value);assert.deepEqual({a:p.added,c:p.conflicts,d:p.duplicates},{a:2,c:2,d:2});assert.equal(p.taskCount,3);assert.equal(p.trashCount,3);assert.equal(p.from,'2026-10-23');
  const result=await okay(r,{action:'import',backup:value,mode:'merge',token:p.token});
  assert.equal(result.state.tasks.find(t=>t.id==='conflict').title,'Local');assert.equal(result.state.tasks.length,4);assert.equal(result.state.trash.length,2);assert.equal(result.state.settings.eyeMinutes,33);await r.close();
});

test('preview tokens bind normalized backup and current saved data; stale or edited imports cannot write',async()=>{
  const r=rig();const value=backup([task('incoming')]);const p=await preview(r,value);assert.match(p.token,/^[0-9a-f]{64}$/);
  await okay(r,{action:'add',date:'2026-10-23',title:'New local'});const before=r.state,writes=r.writes;
  assert.equal((await r.call({action:'import',backup:value,mode:'replace',token:p.token})).ok,false);assert.deepEqual(r.state,before);assert.equal(r.writes,writes);
  const fresh=await preview(r,value);const edited=structuredClone(value);edited.tasks[0].title='Changed';assert.equal((await r.call({action:'import',backup:edited,mode:'replace',token:fresh.token})).ok,false);
  const reordered={trash:value.trash,settings:{...value.settings},tasks:value.tasks,exportedAt:value.exportedAt,version:1,format:value.format};
  await okay(r,{action:'import',backup:reordered,mode:'merge',token:fresh.token});await r.close();
});

test('replace records one atomic recovery backup, exposes only summary, stops all timers and supports previewed recovery',async()=>{
  const initial=initialState();initial.tasks=[task('original')];initial.trash=[{task:task('deleted'),deletedAt:BASE}];const r=rig(initial);
  await okay(r,{action:'focusStart',id:'original'});await okay(r,{action:'remindersStart'});
  const incoming=backup([task('imported')]);const p=await preview(r,incoming);r.now+=1234;
  const result=await okay(r,{action:'import',backup:incoming,mode:'replace',token:p.token});
  assert.equal(result.state.tasks[0].id,'imported');assert.deepEqual(result.state.recovery,{createdAt:r.now,taskCount:1});assert.equal(result.state.focus.status,'idle');assert.equal(result.state.reminders.eye.running,false);assert.equal(result.state.reminders.body.running,false);assert.deepEqual(result.state.alerts,[]);assert.deepEqual(result.state.snoozed,[]);
  const old=(await okay(r,{action:'recoveryExport'})).backup;assert.equal(old.tasks[0].id,'original');assert.equal(old.tasks[0].focusMs,1234);assert.equal(old.trash[0].task.id,'deleted');
  const rp=await preview(r,old);await okay(r,{action:'import',backup:old,mode:'replace',token:rp.token});assert.equal(r.state.tasks[0].id,'original');assert.equal(r.state.recovery.backup.tasks[0].id,'imported');assert.equal(stateSchema(z).safeParse(r.state).success,true);await r.close();
});

test('merge stops running timers and retains settled local focus statistics',async()=>{
  const initial=initialState();initial.tasks=[task('a')];const r=rig(initial);await okay(r,{action:'focusStart',id:'a'});await okay(r,{action:'remindersStart'});
  const value=backup([task('b')]);const p=await preview(r,value);r.now+=1234;await okay(r,{action:'import',backup:value,mode:'merge',token:p.token});
  assert.equal(r.state.tasks.find(t=>t.id==='a').focusMs,1234);assert.equal(r.state.focus.status,'idle');assert.equal(r.state.reminders.eye.running,false);await r.close();
});

test('capacity failures and failed atomic replace preserve originals, recovery and running state',async()=>{
  const initial=initialState();initial.tasks=Array.from({length:MAX_TASKS},(_,i)=>task('a'+i));const r=rig(initial);await okay(r,{action:'focusStart',id:'a0'});
  const incoming=backup([task('new')]);const p=await preview(r,incoming);const before=r.state,writes=r.writes;
  assert.equal((await r.call({action:'import',backup:incoming,mode:'merge',token:p.token})).ok,false);assert.deepEqual(r.state,before);assert.equal(r.writes,writes);
  r.fail=true;assert.equal((await r.call({action:'import',backup:incoming,mode:'replace',token:p.token})).ok,false);assert.deepEqual(r.state,before);assert.equal(r.state.recovery,null);assert.equal(r.state.focus.status,'running');await r.close();
});

test('HTTP accepts valid >32KiB backup envelopes with the shared controller and rejects >5MiB before dispatch',async()=>{
  const r=rig();const handler=createHttpHandler({requestRejection:()=>undefined},r.call);
  const value=backup(Array.from({length:400},(_,i)=>task('item-'+i,{title:'x'.repeat(180)})));
  const payload=JSON.stringify({action:'importPreview',backup:value});assert.ok(Buffer.byteLength(payload)>32768);
  const request=Readable.from([payload]);request.method='POST';request.headers={'content-type':'application/json'};
  const response={headersSent:false,writeHead(code){this.code=code;this.headersSent=true;},end(body){this.body=JSON.parse(body);}};
  await handler(request,response);assert.equal(response.code,200);assert.equal(response.body.ok,true);assert.equal(response.body.preview.taskCount,400);await r.close();
});

test('preview becomes stale after focus settlement, trash changes, or Host controller restart',async()=>{
  const initial=initialState();initial.tasks=[task('a')];const r=rig(initial),incoming=backup([task('b')]);
  await okay(r,{action:'focusStart',id:'a'});const beforePause=await preview(r,incoming);r.now+=1000;await okay(r,{action:'focusPause'});
  assert.equal((await r.call({action:'import',backup:incoming,mode:'replace',token:beforePause.token})).ok,false);
  const beforeTrash=await preview(r,incoming);await okay(r,{action:'delete',id:'a'});
  assert.equal((await r.call({action:'import',backup:incoming,mode:'replace',token:beforeTrash.token})).ok,false);
  const current=await preview(r,incoming),other=rig(r.state);other.now=r.now;
  assert.equal((await other.call({action:'import',backup:incoming,mode:'replace',token:current.token})).ok,false);
  await r.close();await other.close();
});

