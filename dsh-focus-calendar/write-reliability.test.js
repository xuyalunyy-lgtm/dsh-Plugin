import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { initialState, createController, stateSchema, RECEIPT_TTL, MAX_RECEIPTS } from './state.js';

function hostFixture(){
  let state=initialState(),now=Date.now(),sequence=0,fail=false;
  const schema=stateSchema(z);
  const make=()=>createController({load:()=>state,save:async next=>{if(fail)throw Error('disk failure');state=schema.parse(next);},clock:()=>now,id:()=>`guard-task-${++sequence}`});
  let controller=make();
  return {call:request=>controller.dispatch(request),get state(){return structuredClone(state);},seed:value=>{state=schema.parse(value);},get now(){return now;},set now(value){now=value;},set fail(value){fail=value;},async restart(){await controller.close();controller=make();},close:()=>controller.close()};
}
const payload={action:'add',date:'2026-10-23',title:'Original',time:'',requestId:'stable-request-0001'};

test('receipt replay wins before stale edit checks and cannot undo newer modifications',async()=>{
  const f=hostFixture();try{
    const a=await f.call(payload),task=a.state.tasks[0];
    const update={action:'update',id:task.id,title:'First edit',expectedToken:task.editToken,requestId:'stable-update-0001'};
    const first=await f.call(update);assert.equal(first.ok,true);
    await f.call({action:'update',id:task.id,title:'Other window',expectedToken:first.state.tasks[0].editToken});
    await f.restart();const replay=await f.call(update);
    assert.equal(replay.ok,true);assert.equal(replay.receipt.replayed,true);assert.equal(replay.state.tasks[0].title,'Other window');
    const reused=await f.call({...update,title:'Different intent'});
    assert.equal(reused.code,'REQUEST_ID_REUSED');assert.equal(f.state.tasks[0].title,'Other window');
  }finally{await f.close();}
});

test('unexpired receipt capacity rejects new guarded writes without evicting receipts',async()=>{
  const f=hostFixture();try{
    const seed=initialState();seed.receipts=Array.from({length:MAX_RECEIPTS},(_,i)=>({requestId:`receipt-capacity-${String(i).padStart(4,'0')}`,payloadHash:'a'.repeat(64),action:'add',taskId:`old-${i}`,taskToken:null,createdAt:f.now}));f.seed(seed);
    const before=f.state;const denied=await f.call(payload);assert.equal(denied.code,'RECEIPT_CAPACITY');assert.deepEqual(f.state,before);
    f.now+=RECEIPT_TTL;const accepted=await f.call(payload);assert.equal(accepted.ok,true);assert.equal(f.state.receipts.length,1);
  }finally{await f.close();}
});

test('receipt guarantee is bounded to seven days, preserves only compact hashes and is excluded from backups',async()=>{
  const f=hostFixture();try{
    const result=await f.call(payload);assert.equal(result.receipt.expiresAt,f.now+RECEIPT_TTL);
    assert.deepEqual(Object.keys(f.state.receipts[0]).sort(),['action','createdAt','payloadHash','requestId','taskId','taskToken'].sort());
    assert.ok(!JSON.stringify(f.state.receipts).includes('Original'));
    const exported=await f.call({action:'export'});assert.equal('receipts'in exported.backup,false);assert.equal('_editVersion'in exported.backup.tasks[0],false);assert.equal('editToken'in exported.backup.tasks[0],false);
    assert.equal('receipts'in result.state,false);assert.equal('_editVersion'in result.state.tasks[0],false);
    f.now+=RECEIPT_TTL;const outside=await f.call(payload);assert.equal(outside.receipt.replayed,false);assert.equal(outside.state.tasks.length,2,'outside retention is not an exactly-once promise');
  }finally{await f.close();}
});

test('task payload is frozen before queueing and receipt + mutation commit together on storage retry',async()=>{
  const f=hostFixture();try{
    const request={...payload};f.fail=true;const pending=f.call(request);request.title='Mutated by caller';
    const failed=await pending;assert.equal(failed.code,'WRITE_UNCERTAIN');assert.equal(f.state.tasks.length,0);assert.equal(f.state.receipts.length,0);
    f.fail=false;const success=await f.call(payload);assert.equal(success.state.tasks[0].title,'Original');assert.equal(f.state.receipts.length,1);
    await f.restart();assert.equal((await f.call(payload)).receipt.replayed,true);
  }finally{await f.close();}
});

const source=await readFile(new URL('./client.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('// BEGIN PURE HELPERS'),source.indexOf('// END PURE HELPERS'));
const writes=source.slice(source.indexOf('      async function retryWrite(record){'),source.indexOf('      const useStore='));
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),values};}
function browserFixture(store,host,{dropFirst=false}={}){
  const patches=[],calls=[];
  const context=vm.createContext({Date,crypto:{randomUUID},t:key=>key,publish:patch=>patches.push({...patch}),storage:store,
    act:async()=>({}),actFull:async(action,args)=>{calls.push({action,...args});const result=await host.call({action,...args});if(dropFirst&&result.ok){dropFirst=false;return {ok:false,code:'NETWORK_UNCERTAIN',error:'Connection lost after commit'};}return result;}});
  const api=vm.runInContext(`${helpers}\nconst drafts=createDraftStore(storage,'2026-10-23');const journal=createWriteJournal(storage),writeLocks=new Set();${writes}\n({drafts,journal,retryWrite,taskWrite,settleEditorReceipt,createWriteJournal})`,context);
  return {...api,calls,patches};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('Client unknown add result survives tab reload and Host restart, and retries original ID/payload exactly once',async()=>{
  const host=hostFixture(),store=storage(),key='new:2026-10-23',draft={title:'Original',date:'2026-10-23',time:''};
  try{
    let browser=browserFixture(store,host,{dropFirst:true});browser.drafts.set(key,draft);
    const first=await browser.taskWrite('add',{date:draft.date,title:draft.title,time:''},'editor:'+key,draft);
    assert.equal(first.code,'NETWORK_UNCERTAIN');assert.equal(host.state.tasks.length,1);
    const original=browser.journal.get('editor:'+key);
    const different=await browser.taskWrite('add',{date:draft.date,title:'Changed intent',time:''},'editor:'+key,draft);
    assert.equal(different.ok,false);assert.equal(browser.calls.length,1);assert.deepEqual(plain(browser.journal.get('editor:'+key)),plain(original));
    await host.restart();browser=browserFixture(store,host);const restored=browser.journal.get('editor:'+key);
    assert.deepEqual(plain(restored),plain(original));const replay=await browser.retryWrite(restored);
    assert.equal(replay.ok,true);assert.equal(replay.receipt.replayed,true);assert.equal(host.state.tasks.length,1);
    assert.deepEqual(plain(browser.calls[0]),plain(original.payload));assert.equal(browser.journal.get('editor:'+key),null);assert.equal(browser.drafts.has(key),false);
  }finally{await host.close();}
});

test('Client preserves newer draft text after confirming an old unknown add instead of claiming it was saved',async()=>{
  const host=hostFixture(),store=storage(),key='new:2026-10-23',draft={title:'Original',date:'2026-10-23',time:''};
  try{
    const browser=browserFixture(store,host,{dropFirst:true});browser.drafts.set(key,draft);
    await browser.taskWrite('add',{date:draft.date,title:draft.title,time:''},'editor:'+key,draft);
    browser.drafts.set(key,{...draft,title:'New unsaved text'});
    const result=await browser.retryWrite(browser.journal.get('editor:'+key));
    assert.equal(result.draftResult.newer,true);assert.equal(host.state.tasks[0].title,'Original');
    assert.equal(browser.drafts.get('edit:'+result.receipt.taskId).title,'New unsaved text');
    assert.equal(browser.drafts.get('edit:'+result.receipt.taskId).expectedToken,result.receipt.taskToken);
  }finally{await host.close();}
});

test('Client refuses network writes before journaling succeeds and blocks expired automatic retry',async()=>{
  const host=hostFixture();try{
    const broken={getItem:()=>null,setItem:()=>{throw Error('quota');}},browser=browserFixture(broken,host);
    const blocked=await browser.taskWrite('add',{date:'2026-10-23',title:'Never sent'},'editor:new:2026-10-23');
    assert.equal(blocked.ok,false);assert.equal(browser.calls.length,0);assert.equal(host.state.tasks.length,0);
    const healthy=browserFixture(storage(),host),old=healthy.journal.begin('row:old',{action:'delete',id:'missing',expectedToken:'b'.repeat(64)},Date.now()-RECEIPT_TTL-1,'expired-request-0001');
    const expired=await healthy.retryWrite(old);assert.equal(expired.code,'REQUEST_EXPIRED');assert.equal(healthy.calls.length,0);assert.ok(healthy.journal.get('row:old'));
  }finally{await host.close();}
});

test('successful Host write plus failed draft settlement retains the original request across reload',async()=>{
  const host=hostFixture(),store=storage(),key='new:2026-10-23',draft={title:'Original',date:'2026-10-23',time:''};
  const set=store.setItem;let failDraft=false;
  store.setItem=(k,v)=>{if(failDraft&&k==='dsh-focus-calendar.drafts.v1')throw Error('quota');set(k,v);};
  try{
    let browser=browserFixture(store,host);browser.drafts.set(key,draft);browser.drafts.setView({filter:'done'});failDraft=true;
    const result=await browser.taskWrite('add',{date:draft.date,title:draft.title,time:''},'editor:'+key,draft);
    assert.equal(result.ok,false);assert.equal(host.state.tasks.length,1);
    assert.equal(browser.drafts.has(key),true);assert.equal(browser.drafts.getView().filter,'done');
    const original=browser.journal.get('editor:'+key);assert.ok(original);
    failDraft=false;browser=browserFixture(store,host);
    assert.deepEqual(plain(browser.journal.get('editor:'+key)),plain(original));
    assert.equal((await browser.taskWrite('add',{date:draft.date,title:draft.title,time:''},'editor:'+key,draft)).ok,false);
    const retried=await browser.retryWrite(original);assert.equal(retried.ok,true);assert.equal(retried.receipt.replayed,true);
    assert.equal(host.state.tasks.length,1);assert.equal(browser.drafts.has(key),false);assert.equal(browser.drafts.getView().filter,'all');
    assert.equal(browser.journal.get('editor:'+key),null);
  }finally{await host.close();}
});

test('failed journal deletion after durable draft settlement remains recoverable',async()=>{
  const host=hostFixture(),store=storage(),key='new:2026-10-23',draft={title:'Original',date:'2026-10-23',time:''};
  const set=store.setItem;let failRemove=true;
  store.setItem=(k,v)=>{if(failRemove&&k==='dsh-focus-calendar.writes.v1'&&JSON.parse(v).entries.length===0)throw Error('journal failure');set(k,v);};
  try{
    let browser=browserFixture(store,host);browser.drafts.set(key,draft);
    assert.equal((await browser.taskWrite('add',{date:draft.date,title:draft.title,time:''},'editor:'+key,draft)).ok,false);
    assert.equal(browser.drafts.has(key),false);assert.ok(browser.journal.get('editor:'+key));
    failRemove=false;browser=browserFixture(store,host);
    assert.equal((await browser.retryWrite(browser.journal.get('editor:'+key))).ok,true);
    assert.equal(host.state.tasks.length,1);assert.equal(browser.drafts.has(key),false);assert.equal(browser.journal.list().length,0);
  }finally{await host.close();}
});

test('newer draft conversion and edit view update are one durable local settlement',async()=>{
  const host=hostFixture(),store=storage(),key='new:2026-10-23',draft={title:'Original',date:'2026-10-23',time:''};
  const set=store.setItem;let failDraft=false;
  store.setItem=(k,v)=>{if(failDraft&&k==='dsh-focus-calendar.drafts.v1')throw Error('quota');set(k,v);};
  try{
    let browser=browserFixture(store,host,{dropFirst:true});browser.drafts.set(key,draft);
    await browser.taskWrite('add',{date:draft.date,title:draft.title,time:''},'editor:'+key,draft);
    browser.drafts.set(key,{...draft,title:'New unsaved text'});const record=browser.journal.get('editor:'+key),id=host.state.tasks[0].id;
    failDraft=true;assert.equal((await browser.retryWrite(record)).ok,false);
    assert.equal(browser.drafts.get(key).title,'New unsaved text');assert.equal(browser.drafts.has('edit:'+id),false);assert.equal(browser.drafts.getView().editing,null);
    failDraft=false;browser=browserFixture(store,host);assert.equal((await browser.retryWrite(browser.journal.get('editor:'+key))).ok,true);
    assert.equal(browser.drafts.has(key),false);assert.equal(browser.drafts.get('edit:'+id).title,'New unsaved text');assert.equal(browser.drafts.getView().editing,id);
    assert.equal(host.state.tasks.length,1);assert.equal(host.state.tasks[0].title,'Original');
  }finally{await host.close();}
});

test('crash between durable draft settlement and journal deletion does not duplicate an add',async()=>{
  const host=hostFixture(),store=storage(),key='new:2026-10-23',draft={title:'Original',date:'2026-10-23',time:''};
  try{
    let browser=browserFixture(store,host);browser.drafts.set(key,draft);
    const record=browser.journal.begin('editor:'+key,{action:'add',date:draft.date,title:draft.title,time:''},Date.now(),'crash-window-request-0001',draft);
    const result=await host.call(record.payload);browser.settleEditorReceipt(browser.drafts,record,result.receipt);
    browser=browserFixture(store,host);assert.equal(browser.drafts.has(key),false);
    const retried=await browser.retryWrite(browser.journal.get('editor:'+key));assert.equal(retried.ok,true);assert.equal(retried.receipt.replayed,true);assert.equal(host.state.tasks.length,1);
  }finally{await host.close();}
});

test('Client never rebases old drafts silently and protected UI entrypoints freeze their baselines',()=>{
  assert.match(source,/expectedToken:sent\.expectedToken/);assert.match(source,/expectedToken:item\.editToken/);
  assert.match(source,/expectedToken:deleting\.token/);assert.match(source,/expectedToken:notice\.undoToken/);
  assert.match(source,/undoToken:result\.receipt\.taskToken/);assert.match(source,/expectedToken:task\?\.editToken/);
  assert.match(source,/!hasEditToken\(value\.expectedToken\)/);assert.match(source,/reloadConfirm/);
  assert.match(source,/expectedToken:action==='trashPurge'\?confirm\?\.token:item\.task\.editToken/);
});
