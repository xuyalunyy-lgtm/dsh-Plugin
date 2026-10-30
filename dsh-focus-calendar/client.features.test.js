import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Only execute production pure functions; do not emulate React, DOM or browser UI.
const source=await readFile(new URL('./client.js',import.meta.url),'utf8');
const from=source.indexOf('// BEGIN PURE HELPERS'),to=source.indexOf('// END PURE HELPERS',from);
assert.ok(from>=0&&to>from);
const {BACKUP_MAX_BYTES,backupShape,parseBackup,focusStats,retentionDays,alertOccurrence,canImport,actionThenAck}=vm.runInNewContext(`${source.slice(from,to)}; ({BACKUP_MAX_BYTES,backupShape,parseBackup,focusStats,retentionDays,alertOccurrence,canImport,actionThenAck})`,{Date});
const plain=value=>JSON.parse(JSON.stringify(value));
const backup=()=>({format:'dsh-focus-calendar',version:1,exportedAt:1000,tasks:[],settings:{focusMinutes:25,eyeMinutes:20,bodyMinutes:60,breakMinutes:5},trash:[]});

test('backup file selection validates version, basic shape, JSON and 4MiB bound',()=>{
  assert.equal(BACKUP_MAX_BYTES,4*1024*1024);
  const value=backup();assert.equal(backupShape(value),true);
  assert.deepEqual(plain(parseBackup('\uFEFF'+JSON.stringify(value),200)),value);
  assert.deepEqual(plain(parseBackup(JSON.stringify(value),BACKUP_MAX_BYTES)),value);
  assert.throws(()=>parseBackup(JSON.stringify(value),BACKUP_MAX_BYTES+1),/backupTooLarge/);
  assert.throws(()=>parseBackup('{bad',10),/backupReadFailed/);
  for(const invalid of [null,[],{...value,format:'other'},{...value,version:2},{...value,tasks:{}},{...value,trash:null},{...value,settings:[]},{...value,exportedAt:'date'}]){
    assert.equal(backupShape(invalid),false);assert.throws(()=>parseBackup(JSON.stringify(invalid),100),/invalidBackup/);
  }
});

test('replacement requires a valid preview token and explicit confirmation',()=>{
  const value=backup(),preview={token:'preview-bound-to-backup'};
  assert.equal(canImport(value,preview,'merge',false),true);
  assert.equal(canImport(value,preview,'replace',false),false);
  assert.equal(canImport(value,preview,'replace',true),true);
  for(const p of [null,{}, {token:''},{token:123}])assert.equal(canImport(value,p,'replace',true),false);
  assert.equal(canImport(value,preview,'other',true),false);
  assert.equal(canImport(null,preview,'merge',true),false);
});

test('task focus stats preserve legacy zero defaults and count only active segment once',()=>{
  const task={id:'task',focusMs:90000,focusRounds:2};
  const focus={kind:'focus',status:'running',taskId:'task',segmentStartedAt:1000,endsAt:121000};
  assert.deepEqual(plain(focusStats({id:'legacy'},{status:'idle'},100)),{minutes:0,rounds:0,segment:0});
  assert.deepEqual(plain(focusStats(task,focus,61000)),{minutes:2,rounds:2,segment:60000});
  assert.deepEqual(plain(focusStats(task,focus,9999999)),{minutes:3,rounds:2,segment:120000});
  assert.equal(focusStats(task,focus,0).segment,0);
  for(const patch of [{status:'paused'},{status:'idle'},{kind:'break'},{taskId:'other'},{segmentStartedAt:null}])assert.equal(focusStats(task,{...focus,...patch},61000).segment,0);
});

test('trash retention is 30 days, rounds upward and never displays negative days',()=>{
  const deletedAt=1000000,day=86400000;
  assert.equal(retentionDays(deletedAt,deletedAt),30);
  assert.equal(retentionDays(deletedAt,deletedAt+day),29);
  assert.equal(retentionDays(deletedAt,deletedAt+30*day-1),1);
  assert.equal(retentionDays(deletedAt,deletedAt+30*day),0);
  assert.equal(retentionDays(deletedAt,deletedAt+60*day),0);
});

test('snoozed alert occurrences deduplicate the same delivery but allow a later delivery',()=>{
  const first={id:'alert',at:1000};
  assert.equal(alertOccurrence(first),alertOccurrence({...first}));
  assert.notEqual(alertOccurrence(first),alertOccurrence({...first,at:301000}));
  assert.notEqual(alertOccurrence(first),alertOccurrence({...first,id:'new-alert'}));
});

test('focus alert does not acknowledge after a failed task/timer action',async()=>{
  for(const action of ['focusStart','breakStart','update']){
    const calls=[];
    const result=await actionThenAck(async(name,args)=>{calls.push({name,args});return {ok:false,error:'rejected'};},action,{id:'task'},'alert');
    assert.equal(result.ok,false);assert.equal(result.error,'rejected');assert.equal(calls.length,1);assert.equal(calls[0].name,action);
  }
});

test('focus alert acknowledges only after the explicit action succeeds and returns ack failure',async()=>{
  const calls=[];
  const result=await actionThenAck(async(name,args)=>{calls.push({name,args});return name==='ack'?{ok:false,error:'ack failed'}:{ok:true,state:{}};},'update',{id:'task',done:true},'alert');
  assert.deepEqual(calls.map(x=>x.name),['update','ack']);assert.deepEqual(plain(calls[0].args),{id:'task',done:true});assert.deepEqual(plain(calls[1].args),{id:'alert'});
  assert.equal(result.ok,false);assert.equal(result.error,'ack failed');
});

test('new feature copy is bilingual and download stays inside the component',()=>{
  const a=source.indexOf('    const zh = {'),b=source.indexOf('    const css = `',a);
  const {zh,en}=vm.runInNewContext(`${source.slice(a,b)}; ({zh,en})`);
  assert.deepEqual(Object.keys(zh).sort(),Object.keys(en).sort());
  for(const key of ['backupTitle','replaceConfirm','importStop','undoDelete','purgeWarning','focusTask','continueFocus','snooze5','snooze10']){
    assert.ok(zh[key]);assert.ok(en[key]);
  }
  assert.doesNotMatch(source,/document\.body/);
  assert.match(source,/URL\.revokeObjectURL/);
  assert.match(source,/h\('a',\{ref:download,hidden:true/);
});
