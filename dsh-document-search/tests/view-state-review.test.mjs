import test from 'node:test';
import assert from 'node:assert/strict';
import {documentViewKey, createViewStateCache, createScrollCoordinator, normalizeViewState} from '../src/view-state.mjs';

test('review: tab unmount/remount preserves a cloned small view, not large runtime objects',()=>{
  const cache=createViewStateCache(), tab=new AbortController();
  const key=documentViewKey('session-a','tab-a','file-a');
  const first=cache.retain(key,tab.signal);
  assert.equal(first.save({query:'初始化',current:17,page:9,scrollTop:777,sensitive:true,listExpanded:true,bytes:new Uint8Array(1024),doc:{secret:true}}),true);
  first.release();
  assert.equal(first.save({query:'late'}),false);
  const snapshot=cache.read(key);
  assert.equal(snapshot.query,'初始化');
  assert.equal(snapshot.scrollTop,777);
  assert.ok(!('bytes' in snapshot)); assert.ok(!('doc' in snapshot));
  snapshot.query='external mutation';
  assert.equal(cache.read(key).query,'初始化');
  const second=cache.retain(key,tab.signal);
  assert.equal(second.save({...cache.read(key),current:18}),true);
  assert.equal(cache.read(key).current,18);
  cache.dispose();
});

test('review: close/replacement/disposal reject stale leases and do not resurrect snapshots',()=>{
  const cache=createViewStateCache(), oldTab=new AbortController(), newTab=new AbortController();
  const oldLease=cache.retain('same-key',oldTab.signal);
  oldLease.save({query:'old'});
  const replacement=cache.retain('same-key',newTab.signal);
  replacement.save({query:'new'});
  oldTab.abort();
  assert.equal(cache.read('same-key').query,'new');
  assert.equal(oldLease.save({query:'late old'}),false);
  newTab.abort();
  assert.equal(cache.size,0);
  assert.equal(replacement.save({query:'late close'}),false);
  const active=cache.retain('other',new AbortController().signal);
  active.save({query:'active'});
  cache.dispose();
  assert.equal(active.save({query:'late dispose'}),false);
  assert.equal(cache.retain('reopen',new AbortController().signal).save({}),false);
  assert.equal(cache.size,0);
});

test('review: identity cannot collide across session, tab or address delimiters',()=>{
  const keys=[documentViewKey('a','b','c'),documentViewKey('a','b:c',''),documentViewKey('a:b','c',''),documentViewKey('other','b','c'),documentViewKey('a','other','c')];
  assert.equal(new Set(keys).size,keys.length);
});

test('review: delayed old loads and old restore tokens cannot overwrite a newer explicit reveal',()=>{
  const scroll=createScrollCoordinator({scrollTop:900,scrollLeft:5});
  const oldEpoch=scroll.beginLoad(), oldPlan=scroll.plan(oldEpoch);
  assert.equal(scroll.capture(oldEpoch,{scrollTop:0}),false);
  const epoch=scroll.beginLoad();
  assert.equal(scroll.complete(oldEpoch,oldPlan.token,{scrollTop:0}),false);
  const restore=scroll.plan(epoch);
  const reveal=scroll.reveal();
  assert.equal(scroll.complete(epoch,restore.token,{scrollTop:900}),false);
  assert.equal(scroll.plan(epoch).kind,'reveal');
  assert.equal(scroll.complete(epoch,reveal,{scrollTop:222,scrollLeft:0}),true);
  assert.equal(scroll.plan(epoch).kind,'none');
  assert.equal(scroll.capture(epoch,{scrollTop:333,scrollLeft:2}),true);
  assert.deepEqual(scroll.snapshot(),{scrollTop:333,scrollLeft:2,pendingReveal:false});
  scroll.renderStarted(epoch);
  assert.equal(scroll.capture(epoch,{scrollTop:0}),false);
  assert.deepEqual(scroll.snapshot(),{scrollTop:333,scrollLeft:2,pendingReveal:false});
});

test('review: PDF redraw restores accepted offsets instead of committing layout-clamped zero',()=>{
  const scroll=createScrollCoordinator({scrollTop:940,scrollLeft:24});
  const epoch=scroll.beginLoad(), revision=scroll.revision;
  scroll.complete(epoch,revision,{scrollTop:940,scrollLeft:24});
  scroll.renderStarted(epoch);
  assert.equal(scroll.capture(epoch,{scrollTop:0,scrollLeft:0}),false);
  assert.deepEqual(scroll.plan(epoch,revision),{kind:'restore',token:revision,scrollTop:940,scrollLeft:24});
  const reveal=scroll.reveal();
  scroll.renderStarted(epoch);
  assert.equal(scroll.plan(epoch,reveal).kind,'reveal','redraw must not override explicit navigation');
});

test('review: shorter documents clamp view selection before any page record is accessed',()=>{
  const saved={query:'q',current:100,page:99,listPage:20,scrollTop:400};
  const next=normalizeViewState(saved,{totalMatches:2,totalPages:2});
  assert.equal(next.current,1); assert.equal(next.page,2); assert.equal(next.listPage,0);
  const empty=normalizeViewState(saved,{totalMatches:0,totalPages:0});
  assert.equal(empty.current,0); assert.equal(empty.page,1); assert.equal(empty.listPage,0);
  assert.equal(saved.page,99);
});

test('review: switching away before drawing preserves the new navigation intent, not stale offsets',()=>{
  const cache=createViewStateCache(),tab=new AbortController();
  const lease=cache.retain('pdf-tab',tab.signal);
  const first=createScrollCoordinator({scrollTop:900,scrollLeft:5});
  first.beginLoad();
  first.restore({scrollTop:0,scrollLeft:0});
  lease.save({query:'hit',page:3,current:0,...first.snapshot()});
  const returned=createScrollCoordinator(cache.read('pdf-tab'));
  let epoch=returned.beginLoad();
  assert.equal(returned.plan(epoch).kind,'restore');
  assert.equal(returned.plan(epoch).scrollTop,0);
  returned.reveal();
  lease.save({query:'new hit',page:8,current:17,...returned.snapshot()});
  const remounted=createScrollCoordinator(cache.read('pdf-tab'));
  epoch=remounted.beginLoad();
  assert.equal(remounted.plan(epoch).kind,'reveal');
  const intent=remounted.plan(epoch);
  remounted.complete(epoch,intent.token,{scrollTop:250,scrollLeft:0});
  lease.save({...cache.read('pdf-tab'),...remounted.snapshot()});
  assert.notEqual(cache.read('pdf-tab').pendingReveal,true,'normalization omits a cleared pending flag');
  const reopened=createScrollCoordinator(cache.read('pdf-tab'));
  assert.equal(reopened.plan(reopened.beginLoad()).kind,'restore','completed navigation must not repeat on the next mount');
  cache.dispose();
});
