import test from 'node:test';
import assert from 'node:assert/strict';
import {documentViewKey,normalizeViewState,createViewStateCache,createScrollCoordinator} from '../src/view-state.mjs';

const savedView={query:'初始化',sensitive:true,current:47,page:8,listExpanded:true,listPage:1,scrollTop:940,scrollLeft:24};

test('view snapshots retain only primitive reading fields and sanitize invalid inputs',()=>{
  const state=normalizeViewState({...savedView,data:new Uint8Array(100),doc:{},element:{},matches:[1],error:'failed',jumpValue:'3'});
  assert.deepEqual(state,savedView);
  assert.deepEqual(normalizeViewState({query:9,current:-3,page:NaN,listPage:Infinity,scrollTop:-1,scrollLeft:Infinity}),{
    query:'',sensitive:false,current:0,page:1,listExpanded:false,listPage:0,scrollTop:0,scrollLeft:0,
  });
});

test('restored result, PDF page and list batch are safe before the first ready render',()=>{
  assert.deepEqual(normalizeViewState(savedView,{totalMatches:2,totalPages:2}),{...savedView,current:1,page:2,listPage:0});
  assert.deepEqual(normalizeViewState(savedView,{totalMatches:0,totalPages:0}),{...savedView,current:0,page:1,listPage:0});
  assert.equal(normalizeViewState(savedView).page,8,'loading with unknown bounds must not erase a saved page');
});

test('component release preserves state until its tab closes and remount reads a copy',()=>{
  const cache=createViewStateCache(),abort=new AbortController(),key=documentViewKey('s','tab','file');
  assert.equal(cache.read(key),undefined);
  assert.equal(cache.size,0,'read is side-effect free');
  const first=cache.retain(key,abort.signal);
  assert.equal(first.save(savedView),true); first.release();
  assert.equal(first.save({query:'late'}),false);
  const snapshot=cache.read(key); snapshot.query='mutated copy';
  assert.equal(cache.read(key).query,'初始化');
  const next=cache.retain(key,abort.signal);
  assert.equal(next.save({...savedView,current:2}),true);
  abort.abort();
  assert.equal(cache.size,0);
  assert.equal(next.save(savedView),false);
  assert.equal(cache.read(key),undefined);
});

test('already-closed tabs and disposed plugins cannot allocate or resurrect records',()=>{
  const cache=createViewStateCache(),closed=new AbortController(),open=new AbortController();
  closed.abort();
  assert.equal(cache.retain('closed',closed.signal).save(savedView),false);
  const lease=cache.retain('open',open.signal); lease.save(savedView);
  cache.dispose();
  assert.equal(cache.size,0);
  assert.equal(lease.save(savedView),false);
  assert.equal(cache.retain('new',new AbortController().signal).save(savedView),false);
  assert.equal(cache.size,0);
});

test('session, tab and complete resource address are separate identities',()=>{
  const keys=[documentViewKey('s1','tab','a/README.md'),documentViewKey('s2','tab','a/README.md'),documentViewKey('s1','other','a/README.md'),documentViewKey('s1','tab','b/README.md')];
  assert.equal(new Set(keys).size,4);
  const cache=createViewStateCache(),signals=keys.map(()=>new AbortController());
  keys.forEach((key,index)=>cache.retain(key,signals[index].signal).save({...savedView,query:String(index)}));
  keys.forEach((key,index)=>assert.equal(cache.read(key).query,String(index)));
  signals[1].abort();assert.equal(cache.size,3);
  assert.equal(cache.read(keys[0]).query,'0');cache.dispose();
});

test('scroll captures are rejected until the actual content is ready and restoration is applied',()=>{
  const scroll=createScrollCoordinator(savedView),epoch=scroll.beginLoad();
  assert.equal(scroll.capture(epoch,{scrollTop:0,scrollLeft:0}),false);
  assert.deepEqual(scroll.snapshot(),{scrollTop:940,scrollLeft:24,pendingReveal:false});
  scroll.renderStarted(epoch);
  const plan=scroll.plan(epoch,scroll.revision);
  assert.equal(plan.kind,'restore');
  assert.equal(scroll.complete(epoch,plan.token,{scrollTop:900,scrollLeft:24}),true);
  assert.equal(scroll.plan(epoch).kind,'none','a completed restore is not applied repeatedly');
  assert.equal(scroll.capture(epoch,{scrollTop:980,scrollLeft:12}),true);
  assert.deepEqual(scroll.snapshot(),{scrollTop:980,scrollLeft:12,pendingReveal:false});
});

test('reloading retains accepted scroll instead of layout-shrink zero and rejects old readiness',()=>{
  const scroll=createScrollCoordinator(savedView),oldEpoch=scroll.beginLoad();
  scroll.complete(oldEpoch,scroll.revision,{scrollTop:940,scrollLeft:24});
  const epoch=scroll.beginLoad(),plan=scroll.plan(epoch);
  assert.equal(plan.scrollTop,940);
  assert.equal(scroll.capture(epoch,{scrollTop:0,scrollLeft:0}),false);
  assert.equal(scroll.plan(oldEpoch),null);
  assert.equal(scroll.complete(oldEpoch,plan.token,{scrollTop:0,scrollLeft:0}),false);
  assert.equal(scroll.complete(epoch,plan.token,{scrollTop:940,scrollLeft:24}),true);
});

test('explicit match navigation cancels restore and a same-page stale callback cannot consume the new intent',()=>{
  const scroll=createScrollCoordinator(savedView),epoch=scroll.beginLoad();
  const oldRevision=scroll.revision,restore=scroll.plan(epoch,oldRevision);
  const newRevision=scroll.reveal();
  assert.equal(scroll.plan(epoch,oldRevision),null,'old onReady must not acquire the latest reveal token');
  assert.equal(scroll.complete(epoch,restore.token,{scrollTop:940,scrollLeft:24}),false);
  const reveal=scroll.plan(epoch,newRevision);assert.equal(reveal.kind,'reveal');
  assert.equal(scroll.complete(epoch,reveal.token,{scrollTop:120,scrollLeft:0}),true);
  assert.deepEqual(scroll.snapshot(),{scrollTop:120,scrollLeft:0,pendingReveal:false});
  const again=scroll.reveal();assert.notEqual(again,newRevision,'same match can request another reveal');
});

test('manual PDF page selection replaces pending restoration with the new page top',()=>{
  const scroll=createScrollCoordinator(savedView),epoch=scroll.beginLoad();
  const old=scroll.revision,newRevision=scroll.restore({scrollTop:0,scrollLeft:0});
  assert.equal(scroll.plan(epoch,old),null);
  assert.deepEqual(scroll.plan(epoch,newRevision),{kind:'restore',token:newRevision,scrollTop:0,scrollLeft:0});
  assert.equal(scroll.capture(epoch,{scrollTop:20,scrollLeft:0}),false);
  scroll.complete(epoch,newRevision,{scrollTop:0,scrollLeft:0});
  assert.equal(scroll.capture(epoch,{scrollTop:20,scrollLeft:0}),true);
});
