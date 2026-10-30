import test from 'node:test';
import assert from 'node:assert/strict';
import { createRestartController, finishRestartShutdown, restartCopy } from '../restart-controller.mjs';
import { patchMain, PATCH_MARKER } from '../main-patch.mjs';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const deferred=()=>{let resolve,reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject};};
function setup(states=[{activeTasks:false,scheduledTasks:false}],answers=[0]) {
  const calls=[], dialogs=[]; let permitted=true, quits=0, host={inspectQuit:async()=>{calls.push('inspect'); const s=states.length>1?states.shift():states[0]; if(s instanceof Error)throw s; return s;}};
  const controller=createRestartController({locale:()=>({id:'zh-CN'}),getHost:()=>host,canProceed:()=>permitted,
    show:async options=>{dialogs.push(options);return {response:answers.shift()??1};},requestQuit:()=>{quits++;},focus:()=>calls.push('focus'),timeoutMs:50});
  return {controller,calls,dialogs,get quits(){return quits;},set permitted(v){permitted=v;},set host(v){host=v;}};
}
test('always confirms idle restart with Cancel selected and escape cancellation',async()=>{
  const x=setup(); assert.equal(await x.controller.request(),true); assert.equal(x.quits,1);
  assert.equal(x.dialogs[0].defaultId,1);assert.equal(x.dialogs[0].cancelId,1);
  assert.match(x.dialogs[0].detail,/保存未提交/);assert.equal(x.calls.length,2);
});
test('cancel never requests quit or schedules relaunch',async()=>{
  const x=setup(undefined,[1]);assert.equal(await x.controller.request(),false);assert.equal(x.quits,0);assert.equal(x.calls.length,1);
});
test('active and scheduled work warnings are shown together',async()=>{
  const x=setup([{activeTasks:true,scheduledTasks:true}]);await x.controller.request();
  assert.match(x.dialogs[0].detail,/运行的任务/);assert.match(x.dialogs[0].detail,/定时任务/);assert.equal(x.dialogs[0].type,'warning');
});
test('new work requires reconfirmation after initial approval',async()=>{
  const x=setup([{activeTasks:false,scheduledTasks:false},{activeTasks:true,scheduledTasks:false},{activeTasks:true,scheduledTasks:false}],[0,1]);
  assert.equal(await x.controller.request(),false);assert.equal(x.dialogs.length,2);assert.equal(x.quits,0);assert.match(x.dialogs[1].detail,/状态发生变化/);
});
test('unknown, malformed or failed task inspection fails closed',async()=>{
  for(const state of [new Error('offline'),undefined,{activeTasks:'yes',scheduledTasks:false}]) {
    const x=setup([state]); assert.equal(await x.controller.request(),false);assert.equal(x.quits,0);assert.equal(x.dialogs[0].type,'error');
  }
});
test('repeated clicks share one pending decision',async()=>{
  const gate=deferred();const x=setup();x.host={inspectQuit:()=>gate.promise};
  const a=x.controller.request(),b=x.controller.request();assert.equal(a,b);gate.resolve({activeTasks:false,scheduledTasks:false});
  await a;assert.equal(x.quits,1);assert.equal(x.dialogs.length,1);
});
test('installation, shutdown or backend replacement during dialog prevents restart',async()=>{
  for(const mode of ['blocked','replaced','disposed']) {
    const gate=deferred();let allowed=true,host={inspectQuit:async()=>({activeTasks:false,scheduledTasks:false})},quits=0;
    const c=createRestartController({locale:()=>({id:'en'}),getHost:()=>host,canProceed:()=>allowed,show:()=>gate.promise,requestQuit:()=>quits++});
    const p=c.request();await new Promise(resolve=>setImmediate(resolve));
    if(mode==='blocked')allowed=false; else if(mode==='replaced')host={inspectQuit:host.inspectQuit};else c.dispose();
    gate.resolve({response:0});assert.equal(await p,false);assert.equal(quits,0);
  }
});
test('timeout and dialog failure cannot authorize restart',async()=>{
  let quits=0;const errors=[];const c=createRestartController({locale:()=>({id:'en'}),getHost:()=>host,canProceed:()=>true,
    show:async()=>{throw new Error('dialog fail');},requestQuit:()=>quits++,log:e=>errors.push(e),timeoutMs:5});
  const host={inspectQuit:()=>new Promise(()=>{})};assert.equal(await c.request(),false);assert.equal(quits,0);assert.ok(errors.length>=1);
});
test('relaunch waits for every cleanup, then ordinary quit',async()=>{
  const a=deferred(),b=deferred(),calls=[];
  const pending=finishRestartShutdown({cleanup:[()=>a.promise,()=>b.promise],shouldRelaunch:()=>true,relaunch:()=>calls.push('relaunch'),quit:()=>calls.push('quit')});
  a.resolve();await Promise.resolve();assert.deepEqual(calls,[]);b.resolve();await pending;assert.deepEqual(calls,['relaunch','quit']);
});
test('any cleanup failure suppresses relaunch but drains remaining cleanup',async()=>{
  const gate=deferred(),calls=[];
  const pending=finishRestartShutdown({cleanup:[()=>{throw Error('stop failed');},()=>gate.promise],shouldRelaunch:()=>true,relaunch:()=>calls.push('relaunch'),quit:()=>calls.push('quit'),log:()=>{}});
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,[]);gate.resolve();await pending;assert.deepEqual(calls,['quit']);
});
test('ordinary quit or cancelled restart never relaunches',async()=>{
  const calls=[];await finishRestartShutdown({cleanup:[],shouldRelaunch:()=>false,relaunch:()=>calls.push('relaunch'),quit:()=>calls.push('quit')});assert.deepEqual(calls,['quit']);
  assert.match(restartCopy({id:'en-US'}).menu,/Restart/);
});
test('patch removes unsafe dev restart, exposes formal entry and preserves other menus',()=>{
  const original=readFileSync(new URL('../baseline/main.js',import.meta.url),'utf8');const patched=patchMain(original);
  assert.ok(patched.includes(PATCH_MARKER));assert.equal((patched.match(/restartController\.request\(\)/g)||[]).length,1);
  assert.doesNotMatch(patched,/label: currentDesktopLocale\(\).messages.restartAppHostMenu,/);
  assert.match(patched,/label: restartCopy\(currentDesktopLocale\(\)\).menu/);
  assert.match(patched,/await dialog.showMessageBox\(parent, options\)/);
  assert.match(patched,/controller.signal.aborted \? \{ response: options.cancelId \?\? 1 \}/);
  assert.match(patched,/if \(restartRequested\) \{\n\t\t\trequireCleanStop = true;/);
  assert.match(patched,/await backend.close\(\); if \(restartRequested && updateStopFailure !== void 0\) throw updateStopFailure/);
  assert.match(patched,/role: "quit"/);assert.match(patched,/name !== "application" && name !== "edit"/);
  assert.throws(()=>patchMain(patched),/already applied/);assert.throws(()=>patchMain(original.replace('const applicationItems = () => [','const changedApplicationItems = () => [')),/context mismatch/);
  const dir=mkdtempSync(join(tmpdir(),'dsh-restart-syntax-'));try{const file=join(dir,'main.mjs');writeFileSync(file,patched);
    const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});assert.equal(result.status,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
