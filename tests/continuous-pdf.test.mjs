import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPageLayout,visiblePageNumbers,capturePageAnchor,restorePageAnchor,mountedPdfPages,pdfReadyMatches,groupPageMatches,isManualScrollKey,normalizedPdfMetric,measurePdfViewport} from '../src/continuous-pdf.mjs';
import {createScrollCoordinator} from '../src/view-state.mjs';

test('continuous pages have exact positions before any bitmap is drawn',()=>{
  const layout=buildPageLayout([{width:600,height:800},{width:800,height:600},{width:300,height:300}],616);
  assert.deepEqual(layout.pages.map(p=>[p.top,p.width,p.height,p.scale]),[[8,600,800,1],[820,600,450,.75],[1282,600,600,2]]);
  assert.equal(layout.totalHeight,1890);
  assert.deepEqual(visiblePageNumbers(layout,900,300,0),[2]);
});
test('far navigation forces only its pending target and manual cancellation releases it',()=>{
  const layout=buildPageLayout(Array.from({length:500},()=>({width:600,height:800})),616);
  const scroll=createScrollCoordinator(),epoch=scroll.beginLoad();
  scroll.reveal();
  let expected={source:{},layoutWidth:616,token:scroll.revision,page:499};
  assert.ok(mountedPdfPages(layout,0,700,expected.page).has(499));
  scroll.complete(epoch,expected.token,{scrollTop:100,scrollLeft:0});expected=null;
  assert.ok(!mountedPdfPages(layout,100,700,expected?.page).has(499));
  assert.equal(scroll.plan(epoch).kind,'none');
});
test('same-page and other-page late ready callbacks cannot complete a newer source or intent',()=>{
  const source={},expected={source,layoutWidth:616,token:8,page:99};
  assert.equal(pdfReadyMatches(expected,{...expected}),true);
  for(const actual of [{...expected,page:98},{...expected,source:{}},{...expected,token:7},{...expected,layoutWidth:500}])assert.equal(pdfReadyMatches(expected,actual),false);
  assert.equal(pdfReadyMatches(null,expected),false);
});
test('resize preserves the reading page and within-page ratio',()=>{
  const metrics=Array.from({length:100},(_,i)=>({width:500+i,height:700+i}));
  const old=buildPageLayout(metrics,1000),next=buildPageLayout(metrics,400),page=old.pages[73];
  const anchor=capturePageAnchor(old,page.top+page.height*.61);
  const top=restorePageAnchor(next,anchor);
  assert.equal(anchor.page,74);assert.ok(Math.abs((top-next.pages[73].top)/next.pages[73].height-.61)<1e-9);
});
test('all-page match groups preserve global and local indexes',()=>{
  const results=[{page:2,start:1,end:3},{page:2,start:9,end:11},{page:100,start:4,end:6}];
  const groups=groupPageMatches(results);
  assert.deepEqual(groups.get(2).globalIndexes,[0,1]);assert.deepEqual(groups.get(100).globalIndexes,[2]);
  assert.equal(groups.get(100).matches[0],results[2]);
});
test('hidden to visible transition retries work even at identical geometry without erasing offsets',()=>{
  const original={width:616,height:700,top:900,visible:true,measurementRevision:1};
  const hidden=measurePdfViewport(original,{width:0,height:0,top:0});
  assert.equal(hidden.visible,false);assert.equal(hidden.top,900);assert.equal(hidden.width,616);
  const repeated=measurePdfViewport(hidden,{width:0,height:0,top:0});assert.equal(repeated,hidden);
  const visible=measurePdfViewport(hidden,{width:616,height:700,top:900});
  assert.equal(visible.visible,true);assert.ok(visible.measurementRevision>original.measurementRevision);
  assert.equal(measurePdfViewport(visible,{width:616,height:700,top:900}),visible);
});
test('manual scroll keys exclude modified shortcuts and editable input navigation is filtered by UI scope',()=>{
  assert.equal(isManualScrollKey({key:'PageDown'}),true);
  assert.equal(isManualScrollKey({key:'Home',ctrlKey:true}),false);
  assert.equal(isManualScrollKey({key:'f'}),false);
  assert.throws(()=>normalizedPdfMetric({width:0,height:10}));
});
