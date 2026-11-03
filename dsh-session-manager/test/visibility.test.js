import test from 'node:test';
import assert from 'node:assert/strict';
import { createController, visibilitySchema } from '../controller.js';
import { normalizeToolRequest } from '../index.js';
import { z } from 'zod';

function fixture() {
  let data = { revision: 0, hiddenWorkspaceIds: [], receipts: [] };
  const faults = {}, sessionReceipts = new Map(), calls = [];
  const workspaces = ['one','two'].map((id,index) => ({ id, title:id, path:`D:\\${id}`, sessionIds:index ? ['other'] : ['source'] }));
  const visibility = { get: () => structuredClone(data), async set(next) { if(faults.before)throw Error('before'); visibilitySchema(z).parse(next); data=structuredClone(next);if(faults.after)throw Error('after'); } };
  const receipts = { get:id=>sessionReceipts.get(id), get size(){return sessionReceipts.size;},async put(id,value){sessionReceipts.set(id,structuredClone(value));} };
  const ctx = {
    workspaceRegistry: {list:()=>workspaces,get:id=>workspaces.find(w=>w.id===id)},
    workspaceController: {async *follow(){yield {type:'baseline',value:{archivedSessionIds:[],pinnedSessionIds:[]}};}},
    sessionController: {
      async list(){return {items:['source','other'].map((sessionId,index)=>({sessionId,cwd:workspaces[index].path,updatedAt:index+1}))};},
      async inspect(id){calls.push(id);return {meta:{id,version:4,isSeeded:false,cwd:id==='source'?'D:\\one':'D:\\two'},inheritedEventCount:0,events:[]};},
    },
    sessionPersistence:{async stat(){return {revision:'1'};}},sessions:{get(){}},agents:{get(){}},
  };
  const controller=createController(ctx,receipts,{visibility});
  const action=(workspaceId,hidden,expectedVisibilityRevision,requestId='visibility-req-0001')=>({action:'setWorkspaceVisibility',workspaceId,hidden,expectedVisibilityRevision,requestId});
  return {ctx,controller,receipts,visibility,faults,action,calls,sessionReceipts};
}

test('visibility defaults, absolute hide and includeHidden filter before pagination',async()=>{
  const f=fixture();const before=await f.controller.dispatch({action:'list'});
  assert.equal(before.visibilityRevision,0);assert.equal(before.total,2);assert(before.workspaces.every(w=>w.hidden===false));
  const result=await f.controller.dispatch(f.action('one',true,0));assert.equal(result.ok,true);assert.equal(result.visibilityRevision,1);assert.match(result.message,/不影响原生侧栏/);
  const hidden=await f.controller.dispatch({action:'list',offset:0,limit:1});assert.equal(hidden.total,1);assert.equal(hidden.items[0].sessionId,'other');assert.equal(hidden.workspaces.length,2);assert.equal(hidden.workspaces[0].hidden,true);
  assert.equal((await f.controller.dispatch({action:'list',workspaceId:'one'})).total,0);
  assert.equal((await f.controller.dispatch({action:'list',workspaceId:'one',includeHidden:true})).total,1);
  assert.equal((await f.controller.dispatch({action:'list',includeHidden:true,offset:1,limit:1})).items[0].sessionId,'source');
  assert.equal(Object.hasOwn(result,'workspaces'),false);
  assert.equal((await f.controller.dispatch(f.action('one',true,1,'visibility-no-toggle'))).visibilityRevision,2);
  assert.equal((await f.controller.dispatch({action:'list'})).workspaces[0].hidden,true);
  assert.equal((await f.controller.dispatch(f.action('one',false,2,'visibility-show-0001'))).visibilityRevision,3);
  assert.equal((await f.controller.dispatch({action:'list'})).workspaces[0].hidden,false);
  // This operation is plugin-owned state only: no archive, Agent, directory or
  // persistence business mutation APIs even exist on this test Context.
});
test('CAS allows one concurrent writer; old successful exact replay never overwrites newer state',async()=>{
  const f=fixture();const first=f.action('one',true,0);
  const [a,b]=await Promise.all([f.controller.dispatch(first),f.controller.dispatch(f.action('two',true,0,'visibility-second01'))]);
  assert.equal(a.ok,true);assert.equal(b.code,'CONFLICT');
  const second=await f.controller.dispatch(f.action('one',false,1,'visibility-second02'));assert.equal(second.visibilityRevision,2);
  const restarted=createController(f.ctx,f.receipts,{visibility:f.visibility});
  const replay=await restarted.dispatch({requestId:first.requestId,hidden:true,workspaceId:'one',expectedVisibilityRevision:0,action:'setWorkspaceVisibility'});
  assert.deepEqual(replay,a);assert.equal(f.visibility.get().revision,2);assert.deepEqual(f.visibility.get().hiddenWorkspaceIds,[]);
  assert.equal((await restarted.dispatch({...first,hidden:false})).code,'REQUEST_ID_REUSED');
});
test('atomic visibility write failure before commit blocks new writes until exact retry',async()=>{
  const f=fixture();const request=f.action('one',true,0);f.faults.before=true;
  assert.equal((await f.controller.dispatch(request)).code,'WRITE_UNCERTAIN');assert.equal(f.visibility.get().revision,0);
  assert.equal((await f.controller.dispatch(f.action('two',true,0,'visibility-blocked01'))).code,'PENDING');
  assert.equal((await f.controller.dispatch({action:'create',workspaceId:'two',requestId:request.requestId})).code,'REQUEST_ID_REUSED');
  f.faults.before=false;assert.equal((await f.controller.dispatch(request)).visibilityRevision,1);
  assert.equal((await f.controller.dispatch(f.action('two',true,1,'visibility-blocked01'))).visibilityRevision,2);
});
test('atomic visibility commit followed by response failure recovers receipt across restart',async()=>{
  const f=fixture();const request=f.action('one',true,0);f.faults.after=true;
  assert.equal((await f.controller.dispatch(request)).code,'WRITE_UNCERTAIN');assert.equal(f.visibility.get().revision,1);
  f.faults.after=false;const restarted=createController(f.ctx,f.receipts,{visibility:f.visibility});
  assert.equal((await restarted.dispatch(request)).visibilityRevision,1);assert.equal(f.visibility.get().receipts.length,1);
  assert.equal((await restarted.dispatch(f.action('one',false,1,'visibility-after-001'))).visibilityRevision,2);
  assert.equal((await restarted.dispatch(request)).visibilityRevision,1);assert.deepEqual(f.visibility.get().hiddenWorkspaceIds,[]);
});
test('visibility validates bool/revision, checks registry not directory and fences cross-action request IDs',async()=>{
  const f=fixture();const request=f.action('one',true,0);
  for(const patch of [{hidden:'true'},{expectedVisibilityRevision:-1},{expectedVisibilityRevision:0.1},{sessionId:'x'}]) assert.equal((await f.controller.dispatch({...request,...patch})).code,'INVALID_REQUEST');
  assert.equal((await f.controller.dispatch(f.action('missing',true,0))).code,'WORKSPACE_NOT_FOUND');
  f.sessionReceipts.set(request.requestId,{stage:'done'});assert.equal((await f.controller.dispatch(request)).code,'REQUEST_ID_REUSED');f.sessionReceipts.clear();
  assert.equal((await f.controller.dispatch(request)).ok,true);
  assert.equal((await f.controller.dispatch({action:'create',workspaceId:'two',requestId:request.requestId})).code,'REQUEST_ID_REUSED');
  assert.equal((await f.controller.dispatch({action:'list',includeHidden:'yes'})).code,'INVALID_REQUEST');
});
test('visibility journal bounds and schema reject duplicate receipt IDs',async()=>{
  const f=fixture(),valid=f.action('one',true,0);const result=await f.controller.dispatch(valid);const state=f.visibility.get();
  assert.throws(()=>visibilitySchema(z).parse({...state,receipts:[state.receipts[0],state.receipts[0]]}));
  const full={...state,receipts:Array.from({length:4096},(_,i)=>({...state.receipts[0],requestId:`filled-request-${String(i).padStart(5,'0')}`}))};await f.visibility.set(full);
  assert.equal((await f.controller.dispatch(f.action('two',true,1,'visibility-overflow1'))).code,'JOURNAL_FULL');assert.equal(f.visibility.get().revision,1);
  assert.equal(result.ok,true);
});
test('strict adapter normalization removes neutral unused visibility fields but preserves meaningful values',()=>{
  assert.deepEqual(normalizeToolRequest({action:'list',hidden:false,expectedVisibilityRevision:0,includeHidden:true}),{action:'list',includeHidden:true});
  const request={action:'setWorkspaceVisibility',workspaceId:'one',hidden:false,expectedVisibilityRevision:0,requestId:'visibility-normal01',sessionId:'',expectedToken:'',query:'',archived:false,includeHidden:false,offset:0,limit:50};
  assert.deepEqual(normalizeToolRequest(request),{action:'setWorkspaceVisibility',workspaceId:'one',hidden:false,expectedVisibilityRevision:0,requestId:'visibility-normal01'});
  for(const action of ['create','move','delete','restore']) {
    const normalized=normalizeToolRequest({action,hidden:false,expectedVisibilityRevision:0,includeHidden:false});assert.equal(Object.hasOwn(normalized,'hidden'),false);assert.equal(Object.hasOwn(normalized,'includeHidden'),false);
    assert.equal(normalizeToolRequest({action,hidden:true}).hidden,true);assert.equal(normalizeToolRequest({action,expectedVisibilityRevision:7}).expectedVisibilityRevision,7);assert.equal(normalizeToolRequest({action,includeHidden:true}).includeHidden,true);
  }
});
