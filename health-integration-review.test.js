import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createController, initialState, stateSchema } from './state.js';

const at=text=>Date.parse(text);
const policy={enabled:true,timeZone:'Asia/Shanghai',weekdays:[1,2,3,4,5],start:'09:00',end:'18:00',breakEnabled:true,breakStart:'12:00',breakEnd:'13:00'};
function fixture(time,seed=initialState()){
  let now=at(time),stored=structuredClone(seed);const schema=stateSchema(z);
  const make=()=>createController({load:()=>stored,save:async next=>{stored=schema.parse(next);},clock:()=>now});
  let controller=make();
  return {call:request=>controller.dispatch(request),get state(){return structuredClone(stored);},get now(){return now;},set now(value){now=value;},async restart(){await controller.close();controller=make();},close:()=>controller.close()};
}

test('review health: migrating old disabled rules preserves running deadlines and pending reminders',async()=>{
  const now=at('2026-10-26T08:30:00+08:00');
  const old={tasks:[],settings:{focusMinutes:25,eyeMinutes:20,bodyMinutes:60,breakMinutes:5},focus:{status:'idle',kind:'focus',endsAt:null,remainingMs:0},reminders:{eye:{running:true,nextAt:now+600000},body:{running:true,nextAt:now+900000}},alerts:[{id:'old-eye',kind:'eye',at:now-1000}],trash:[],snoozed:[],recovery:null};
  const f=fixture('2026-10-26T08:30:00+08:00',old);
  try{const result=await f.call({action:'read'});assert.equal(result.ok,true);assert.equal(result.state.healthPolicy.enabled,false);assert.deepEqual(result.state.reminders,old.reminders);assert.deepEqual(result.state.alerts,old.alerts);}finally{await f.close();}
});

test('review health: temporary quiet keeps switches, cancels health prompts and resumes a fresh cycle',async()=>{
  const f=fixture('2026-10-26T09:15:00+08:00');
  try{
    assert.equal((await f.call({action:'healthPolicy',policy})).ok,true);
    assert.equal((await f.call({action:'remindersStart',kind:'eye'})).ok,true);
    const start=f.now,quiet=await f.call({action:'quietStart',minutes:30});assert.equal(quiet.ok,true);
    assert.equal(quiet.state.healthStatus.allowed,false);assert.equal(quiet.state.healthStatus.reason,'quiet');
    assert.equal(quiet.state.reminders.eye.running,true);assert.equal(quiet.state.reminders.body.running,false);
    f.now=start+30*60000-1;assert.equal((await f.call({action:'read'})).state.healthStatus.allowed,false);
    f.now=start+30*60000;const resumed=await f.call({action:'read'});
    assert.equal(resumed.state.healthStatus.allowed,true);assert.equal(resumed.state.alerts.length,0);assert.equal(resumed.state.reminders.eye.nextAt,f.now+20*60000);assert.equal(resumed.state.reminders.body.running,false);
    f.now+=20*60000;const due=await f.call({action:'read'});assert.equal(due.state.alerts.filter(a=>a.kind==='eye').length,1);assert.equal(due.state.alerts.some(a=>a.kind==='body'),false);
  }finally{await f.close();}
});

test('review health: quiet does not hide focus or break completion and snoozed focus alerts',async()=>{
  const f=fixture('2026-10-26T09:15:00+08:00');
  try{
    await f.call({action:'settings',settings:{focusMinutes:1,breakMinutes:1}});
    await f.call({action:'focusStart'});f.now+=60000;const complete=await f.call({action:'read'});
    const focus=complete.state.alerts.find(a=>a.kind==='focus');assert.ok(focus);
    await f.call({action:'snooze',id:focus.id,minutes:5});await f.call({action:'quietStart',minutes:30});
    f.now+=5*60000;const redelivered=await f.call({action:'read'});assert.ok(redelivered.state.alerts.some(a=>a.kind==='focus'));assert.equal(redelivered.state.healthStatus.allowed,false);
    assert.equal((await f.call({action:'breakStart'})).ok,true);f.now+=60000;const rest=await f.call({action:'read'});assert.ok(rest.state.alerts.some(a=>a.kind==='break'));assert.equal(rest.state.focus.status,'idle');
  }finally{await f.close();}
});

test('review health: restart across a whole nonworking interval does not emit old health alerts',async()=>{
  const f=fixture('2026-10-23T17:45:00+08:00');
  try{
    await f.call({action:'healthPolicy',policy});await f.call({action:'remindersStart',kind:'eye'});
    f.now=at('2026-10-26T09:40:00+08:00');await f.restart();
    const resumed=await f.call({action:'read'});assert.equal(resumed.ok,true);assert.equal(resumed.state.healthStatus.allowed,true);
    assert.equal(resumed.state.alerts.some(a=>a.kind==='eye'||a.kind==='body'),false);assert.equal(resumed.state.reminders.eye.nextAt,f.now+20*60000);
  }finally{await f.close();}
});

test('review health: backup retains policy, excludes runtime quiet, and policy changes invalidate preview',async()=>{
  const f=fixture('2026-10-26T09:15:00+08:00');
  try{
    await f.call({action:'healthPolicy',policy});await f.call({action:'quietStart',minutes:60});
    const exported=await f.call({action:'export'});assert.equal(exported.ok,true);assert.deepEqual(exported.backup.healthPolicy,policy);assert.equal('quietUntil'in exported.backup,false);assert.equal('healthStatus'in exported.backup,false);
    const preview=await f.call({action:'importPreview',backup:exported.backup});assert.equal(preview.ok,true);
    await f.call({action:'healthPolicy',policy:{...policy,start:'08:00'}});const before=f.state;
    const stale=await f.call({action:'import',mode:'replace',backup:exported.backup,token:preview.preview.token});assert.equal(stale.ok,false);assert.deepEqual(f.state,before);
    const old={...exported.backup};delete old.healthPolicy;
    const p=await f.call({action:'importPreview',backup:old});const merged=await f.call({action:'import',mode:'merge',backup:old,token:p.preview.token});assert.equal(merged.ok,true);assert.equal(merged.state.healthPolicy.start,'08:00');
    const p2=await f.call({action:'importPreview',backup:old});const replaced=await f.call({action:'import',mode:'replace',backup:old,token:p2.preview.token});assert.equal(replaced.ok,true);assert.equal(replaced.state.healthPolicy.enabled,false);assert.equal(replaced.state.quietUntil,null);
  }finally{await f.close();}
});

test('review health: invalid rules and quiet durations cannot partially change state',async()=>{
  const f=fixture('2026-10-26T09:15:00+08:00');
  try{
    await f.call({action:'read'});const before=f.state;
    for(const request of [{action:'healthPolicy',policy:{...policy,weekdays:[]}},{action:'healthPolicy',policy:{...policy,start:'18:00',end:'09:00'}},{action:'healthPolicy',policy:{...policy,timeZone:'not/a-zone'}},{action:'quietStart',minutes:5}]){assert.equal((await f.call(request)).ok,false);assert.deepEqual(f.state,before);}
  }finally{await f.close();}
});
