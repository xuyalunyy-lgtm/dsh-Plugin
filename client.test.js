import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual production queue/transport without emulating React or a DOM.
const source=await readFile(new URL('./client.js',import.meta.url),'utf8');
const start=source.indexOf('      function actFull(action,args={}) {');
const end=source.indexOf('      const useStore=',start);
assert.ok(start>=0&&end>start,'production action queue must be discoverable');
const actionSource=source.slice(start,end);
function harness(requestFull){
  const patches=[];
  const context=vm.createContext({requestFull,publish:patch=>patches.push({...patch})});
  const api=vm.runInContext(`let queue=Promise.resolve(); ${actionSource}; ({act,actFull})`,context);
  return {...api,patches};
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const busyChanges=patches=>patches.filter(p=>'busy'in p).map(p=>p.busy);
const requestStart=source.indexOf('      async function requestFull(input){');
assert.ok(requestStart>=0&&requestStart<start);
const requestSource=source.slice(requestStart,start);
function requestHarness(extra={}){
  const patches=[],state={tasks:[],alerts:[],now:Date.now()};
  const context=vm.createContext({fetch:async()=>({ok:true,json:async()=>({ok:true,state,...extra})}),abort:{signal:undefined},publish:patch=>patches.push({...patch}),dead:false,notify:()=>{}});
  return {requestFull:vm.runInContext(`${requestSource}; requestFull`,context),patches,state};
}

test('successful polling updates state without clearing a failed task operation',async()=>{
  const {requestFull,patches}=requestHarness();await requestFull({action:'read'});
  assert.ok(patches[0].state);assert.equal(patches[0].syncError,'');assert.equal('error'in patches[0],false);
});
test('successful mutation clears its own error independently from sync status',async()=>{
  const {requestFull,patches}=requestHarness();await requestFull({action:'add',date:'2026-10-23',title:'test'});
  assert.equal(patches[0].error,'');assert.equal('syncError'in patches[0],false);
});
test('transport preserves extended backup and preview payloads alongside state',async()=>{
  const backup={format:'dsh-focus-calendar',version:1},preview={token:'test-token'};
  const {requestFull,state}=requestHarness({backup,preview});
  const result=await requestFull({action:'export'});
  assert.equal(result.state,state);assert.equal(result.backup,backup);assert.equal(result.preview,preview);
});
test('background reads never disable controls while awaiting a response',async()=>{
  const response=deferred(),{act,patches}=harness(()=>response.promise);
  const pending=act('read');await flush();assert.deepEqual(busyChanges(patches),[]);
  response.resolve({ok:true,state:{tasks:[]}});await pending;await act('read');assert.deepEqual(busyChanges(patches),[]);
});
test('failed reads report sync error; state-only callers keep null failure semantics',async()=>{
  const {act,actFull,patches}=harness(async()=>{throw Error('offline');});
  assert.equal(await act('read'),null);const full=await actFull('read');assert.equal(full.ok,false);assert.equal(full.error,'offline');
  assert.deepEqual(busyChanges(patches),[]);assert.equal(patches.at(-1).syncError,'offline');
});
test('writes still disable duplicate submission and release controls after failure',async()=>{
  const response=deferred(),{act,patches}=harness(()=>response.promise);
  const pending=act('add',{date:'2026-10-23',title:'test'});await flush();assert.deepEqual(busyChanges(patches),[true]);
  response.reject(Error('save failed'));assert.equal(await pending,null);assert.deepEqual(busyChanges(patches),[true,false]);assert.ok(patches.some(p=>p.error==='save failed'));
});
test('state-only and full-response actions share one serialized queue',async()=>{
  const response=deferred(),calls=[];
  const {act,actFull,patches}=harness(async input=>{calls.push(input.action);if(calls.length===1)await response.promise;return {ok:true,state:input.action,preview:{token:'next'}};});
  const read=act('read'),preview=actFull('importPreview',{backup:{}}),nextRead=act('read');
  await flush();assert.deepEqual(calls,['read']);assert.deepEqual(busyChanges(patches),[]);response.resolve();
  const results=await Promise.all([read,preview,nextRead]);assert.equal(results[0],'read');assert.equal(results[1].preview.token,'next');assert.equal(results[2],'read');
  assert.deepEqual(calls,['read','importPreview','read']);assert.deepEqual(busyChanges(patches),[true,false]);
});
