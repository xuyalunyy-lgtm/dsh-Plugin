import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { createHealthWindowCache, validateHealthPolicy } from './health-policy.js';
import { createController, initialState, stateSchema, exportBackup, normalizeBackup } from './state.js';
import { parameters } from './index.js';
const ms = text => Date.parse(text);
const work = patch => validateHealthPolicy({ enabled:true, ...patch });
function rig(at='2026-10-23T11:50:00+08:00',initial=initialState()) {
  let state=structuredClone(initial), now=ms(at), writes=0, failed=false;
  const controller=createController({load:()=>state,save:value=>{if(failed)throw Error('disk failed');state=value;writes++;},clock:()=>now});
  return {call:controller.dispatch,close:controller.close,get state(){return state;},get writes(){return writes;},get now(){return now;},set now(value){now=typeof value==='string'?ms(value):value;},set fail(value){failed=value;}};
}
async function ok(r,request){const result=await r.call(request);assert.equal(result.ok,true,result.error);return result;}

test('health policy is a complete replacement; strict schema defaults old state without altering deadlines',()=>{
  const state=initialState();delete state.healthPolicy;delete state.quietUntil;delete state.healthRuntime;
  state.reminders.eye={running:true,nextAt:10000};state.alerts=[{id:'old',kind:'eye',at:1}];
  const parsed=stateSchema(z).parse(state);
  assert.equal(parsed.healthPolicy.enabled,false);assert.equal(parsed.quietUntil,null);
  assert.deepEqual(parsed.reminders,state.reminders);assert.deepEqual(parsed.alerts,state.alerts);
  assert.throws(()=>stateSchema(z).parse({...state,healthPolicy:{timeZone:'Not/AZone'}}));
});

test('quiet expiry during lunch and weekend computes the joint earliest allowed window',async()=>{
  const r=rig();await ok(r,{action:'healthPolicy',policy:work()});await ok(r,{action:'remindersStart'});
  let out=await ok(r,{action:'quietStart',minutes:30});
  const lunchEnd=ms('2026-10-23T13:00:00+08:00');
  assert.equal(out.state.healthStatus.reason,'quiet');assert.equal(out.state.healthStatus.resumeAt,lunchEnd);
  assert.equal(r.state.reminders.eye.nextAt,lunchEnd+20*60000);
  r.now='2026-10-23T12:20:00+08:00';out=await ok(r,{action:'read'});
  assert.equal(out.state.quietUntil,null);assert.equal(out.state.healthStatus.reason,'break');
  r.now='2026-10-23T13:00:00+08:00';out=await ok(r,{action:'read'});
  assert.equal(out.state.healthStatus.allowed,true);assert.equal(r.state.reminders.eye.nextAt,lunchEnd+20*60000);
  assert.equal(r.state.alerts.length,0);
  r.now='2026-10-23T17:50:00+08:00';out=await ok(r,{action:'quietStart',minutes:60});
  assert.equal(out.state.healthStatus.resumeAt,ms('2026-10-26T09:00:00+08:00'));
  await r.close();
});

test('quiet cancels only health pending/snoozed and cancelling resumes fresh or stays outside work',async()=>{
  const r=rig('2026-10-23T10:00:00+08:00');
  await ok(r,{action:'remindersStart',kind:'eye'});
  r.state.alerts=[{id:'eye',kind:'eye',at:r.now},{id:'focus',kind:'focus',at:r.now}];
  r.state.snoozed=[{id:'body',kind:'body',at:r.now,dueAt:r.now+5000},{id:'break',kind:'break',at:r.now,dueAt:r.now+5000}];
  await ok(r,{action:'quietStart',minutes:60});
  assert.deepEqual(r.state.alerts.map(a=>a.kind),['focus']);assert.deepEqual(r.state.snoozed.map(a=>a.kind),['break']);
  r.now+=60000;await ok(r,{action:'quietCancel'});
  assert.equal(r.state.reminders.eye.nextAt,r.now+20*60000);assert.equal(r.state.reminders.body.running,false);
  const saved=r.writes;await ok(r,{action:'quietCancel'});assert.equal(r.writes,saved);
  await ok(r,{action:'healthPolicy',policy:work()});r.now='2026-10-23T18:00:00+08:00';
  await ok(r,{action:'quietStart',minutes:30});const result=await ok(r,{action:'quietCancel'});
  assert.equal(result.state.healthStatus.reason,'outsideHours');assert.equal(result.state.healthStatus.resumeAt,ms('2026-10-26T09:00:00+08:00'));
  await r.close();
});

test('sleep past quiet expiry resets now plus interval, not an overdue quiet deadline',async()=>{
  const r=rig('2026-10-23T10:00:00+08:00');await ok(r,{action:'remindersStart'});await ok(r,{action:'quietStart',minutes:30});
  const saved=structuredClone(r.state);await r.close();
  const restarted=rig('2026-10-23T15:00:00+08:00',saved);await ok(restarted,{action:'read'});
  assert.equal(restarted.state.alerts.length,0);assert.equal(restarted.state.reminders.eye.nextAt,restarted.now+20*60000);
  assert.equal(restarted.state.quietUntil,null);await restarted.close();
});

test('sleep across whole lunch resets both health cycles and removes stale pending alerts',async()=>{
  const r=rig();await ok(r,{action:'healthPolicy',policy:work()});await ok(r,{action:'remindersStart'});
  r.state.alerts=[{id:'old-eye',kind:'eye',at:r.now}];
  r.now='2026-10-23T14:00:00+08:00';await ok(r,{action:'read'});
  assert.equal(r.state.alerts.length,0);assert.equal(r.state.reminders.eye.nextAt,r.now+20*60000);
  assert.equal(r.state.reminders.body.nextAt,r.now+60*60000);
  await r.close();
});

test('policy changes keep off switches, start during block uses resume plus interval, intervals update while blocked',async()=>{
  const r=rig('2026-10-24T10:00:00+08:00');await ok(r,{action:'healthPolicy',policy:work()});
  await ok(r,{action:'remindersStart',kind:'eye'});const resume=ms('2026-10-26T09:00:00+08:00');
  assert.equal(r.state.reminders.eye.nextAt,resume+20*60000);assert.equal(r.state.reminders.body.nextAt,null);
  await ok(r,{action:'settings',settings:{eyeMinutes:15}});assert.equal(r.state.reminders.eye.nextAt,resume+15*60000);
  await ok(r,{action:'healthPolicy',policy:work({enabled:false})});
  assert.equal(r.state.reminders.eye.nextAt,r.now+15*60000);assert.equal(r.state.reminders.body.running,false);
  await r.close();
});

test('unchanged blocked/allowed reads do not rewrite storage; future scans are cached',async t=>{
  const r=rig('2026-10-24T10:00:00+08:00');await ok(r,{action:'healthPolicy',policy:work()});await ok(r,{action:'remindersStart'});
  const writes=r.writes,original=Intl.DateTimeFormat.prototype.formatToParts;let probes=0;
  Intl.DateTimeFormat.prototype.formatToParts=function(...args){probes++;return original.apply(this,args);};
  const start=performance.now();
  try{for(let i=0;i<100;i++){r.now+=1000;await ok(r,{action:'read'});}}
  finally{Intl.DateTimeFormat.prototype.formatToParts=original;}
  assert.equal(r.writes,writes);assert.ok(probes<=210,`unexpected repeated future scan: ${probes}`);
  t.diagnostic(`100 cached blocked Host reads: ${(performance.now()-start).toFixed(2)} ms, ${probes} Intl probes, 0 writes`);
  r.now='2026-10-26T09:00:00+08:00';await ok(r,{action:'read'});const allowedWrites=r.writes;
  r.now+=1000;await ok(r,{action:'read'});assert.equal(r.writes,allowedWrites);
  await r.close();
});

test('clock rollback invalidates cached future windows and resets only active health cycles',async()=>{
  const r=rig('2026-10-23T13:10:00+08:00');await ok(r,{action:'healthPolicy',policy:work()});await ok(r,{action:'remindersStart'});
  r.now='2026-10-23T11:00:00+08:00';await ok(r,{action:'read'});
  assert.equal(r.state.reminders.eye.nextAt,r.now+20*60000);assert.equal(r.state.healthRuntime.boundaryAt,ms('2026-10-23T12:00:00+08:00'));
  await r.close();
  const old=rig('2026-10-23T13:10:00+08:00');await ok(old,{action:'remindersStart'});const next=old.state.reminders.eye.nextAt;
  old.now='2026-10-23T11:00:00+08:00';await ok(old,{action:'read'});assert.equal(old.state.reminders.eye.nextAt,next);await old.close();
});

test('no-window bounded result never triggers null deadline and is periodically reconsidered',async()=>{
  const r=rig('2024-03-09T05:00:00Z');await ok(r,{action:'healthPolicy',policy:work({timeZone:'America/New_York',weekdays:[7],start:'02:30',end:'02:31',breakEnabled:false})});
  await ok(r,{action:'remindersStart'});let out=await ok(r,{action:'read'});
  assert.equal(out.state.healthStatus.resumeAt,null);assert.equal(r.state.reminders.eye.nextAt,null);assert.equal(r.state.alerts.length,0);
  r.now='2024-03-09T07:00:00Z';out=await ok(r,{action:'read'});
  assert.equal(out.state.healthStatus.resumeAt,ms('2024-03-17T06:30:00Z'));assert.ok(r.state.reminders.eye.nextAt>r.now);await r.close();
});

test('failed health writes publish neither policy nor runtime; bad duration and incomplete policy are atomic',async()=>{
  const r=rig();const before=structuredClone(r.state);
  for(const input of [{action:'healthPolicy',policy:{enabled:true}},{action:'quietStart',minutes:5},{action:'quietStart',minutes:60,extra:true}]){
    assert.equal((await r.call(input)).ok,false);assert.deepEqual(r.state,before);
  }
  r.fail=true;assert.equal((await r.call({action:'healthPolicy',policy:work()})).code,'WRITE_UNCERTAIN');assert.deepEqual(r.state,before);
  r.fail=false;await ok(r,{action:'healthPolicy',policy:work()});assert.equal(r.state.healthPolicy.enabled,true);await r.close();
});

test('backup policy is normalized; runtime remains private; both imports stop quiet and all timers',async()=>{
  const r=rig();await ok(r,{action:'healthPolicy',policy:work()});await ok(r,{action:'remindersStart'});await ok(r,{action:'quietStart',minutes:30});
  const out=await ok(r,{action:'export'});assert.equal(out.backup.healthPolicy.enabled,true);
  assert.ok(!('quietUntil' in out.backup));assert.ok(!('healthRuntime' in out.backup));assert.ok(!('healthRuntime' in out.state));
  const old=exportBackup(initialState(),r.now);delete old.healthPolicy;assert.equal(normalizeBackup(old).healthPolicy.enabled,false);
  for(const mode of ['merge','replace']){
    await ok(r,{action:'quietStart',minutes:30});const preview=await ok(r,{action:'importPreview',backup:old});
    await ok(r,{action:'import',mode,backup:old,token:preview.preview.token});
    assert.equal(r.state.quietUntil,null);assert.equal(r.state.reminders.eye.running,false);
    assert.equal(r.state.focus.status,'idle');assert.equal(r.state.healthPolicy.enabled,mode==='merge');
  }await r.close();
});

test('cache preserves DST folds, updates denial reasons, and evicts on changed policy',()=>{
  const cache=createHealthWindowCache(),p=work({timeZone:'America/New_York',weekdays:[7],start:'01:30',end:'01:45',breakEnabled:false});
  assert.equal(cache(p,ms('2024-11-03T05:30:00Z')).boundaryAt,ms('2024-11-03T05:45:00Z'));
  assert.equal(cache(p,ms('2024-11-03T05:45:00Z')).nextAllowedAt,ms('2024-11-03T06:30:00Z'));
  assert.equal(cache(p,ms('2024-11-03T06:30:00Z')).boundaryAt,ms('2024-11-03T06:45:00Z'));
  const friday=cache(work(),ms('2026-10-23T19:00:00+08:00'));assert.equal(friday.reason,'outsideHours');
  assert.equal(cache(work(),ms('2026-10-24T10:00:00+08:00')).reason,'dayOff');
  assert.equal(cache(work({enabled:false}),ms('2026-10-24T10:00:00+08:00')).allowed,true);
});

test('tool schema and bilingual Client route health actions through the shared Host',()=>{
  for(const action of ['healthPolicy','quietStart','quietCancel'])assert.ok(parameters.properties.action.enum.includes(action));
  assert.deepEqual(parameters.properties.minutes.enum,[5,10,30,60]);
  assert.equal(parameters.properties.policy.additionalProperties,false);assert.equal(parameters.properties.policy.required.length,8);
  const source=readFileSync(new URL('./client.js',import.meta.url),'utf8');
  for(const action of ["run('healthPolicy'","run('quietStart'","run('quietCancel'"])assert.ok(source.includes(action));
  assert.ok(source.includes('function HealthPolicyPanel()'));assert.ok(source.includes('h(HealthPolicyPanel)'));
  assert.ok(source.includes('不影响专注/休息倒计时及完成提示'));assert.ok(source.includes('not focus/break countdowns or completion alerts'));
  assert.ok(source.includes("s.healthStatus?.allowed===false"));
});
