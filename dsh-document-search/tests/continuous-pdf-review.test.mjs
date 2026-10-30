import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPageLayout, visiblePageNumbers, mountedPdfPages, capturePageAnchor, restorePageAnchor, groupPageMatches, pdfReadyMatches, normalizedPdfMetric} from '../src/continuous-pdf.mjs';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);

test('review: mixed landscape/portrait PDF layout uses actual scaled heights with fixed gaps',()=>{
  const metrics=[{width:600,height:800},{width:800,height:600},{width:300,height:900}];
  const layout=buildPageLayout(metrics,616);
  close(layout.pages[0].height,800);
  close(layout.pages[1].height,450);
  close(layout.pages[2].height,1800);
  assert.equal(layout.pages[0].top,8);
  for(let i=1;i<layout.pages.length;i++)close(layout.pages[i].top-layout.pages[i-1].top-layout.pages[i-1].height,12);
  close(layout.totalHeight,8+800+12+450+12+1800+8);
  metrics.forEach((m,i)=>close(layout.pages[i].width/layout.pages[i].height,m.width/m.height));
});

test('review: far result target is forced only while pending, while ordinary canvases remain near viewport',()=>{
  const layout=buildPageLayout(Array.from({length:1000},()=>({width:600,height:800})),616);
  const near=visiblePageNumbers(layout,layout.pages[400].top,700);
  assert.ok(near.length<=5);
  assert.ok(near.includes(401));
  const forced=mountedPdfPages(layout,layout.pages[400].top,700,900);
  assert.equal(forced.size,near.length+1);
  assert.ok(forced.has(900));
  assert.ok(!mountedPdfPages(layout,layout.pages[400].top,700,null).has(900));
  assert.deepEqual([...mountedPdfPages(layout,0,700,1001)],visiblePageNumbers(layout,0,700));
});

test('review: width change preserves page and fractional position across mixed sizes',()=>{
  const metrics=Array.from({length:12},(_,i)=>({width:i%2?820:600,height:i%2?600:820}));
  const wide=buildPageLayout(metrics,816),narrow=buildPageLayout(metrics,416);
  for(let i=0;i<metrics.length;i++)for(const ratio of [0,.1,.5,.99]) {
    const offset=wide.pages[i].top+wide.pages[i].height*ratio;
    const anchor=capturePageAnchor(wide,offset);
    assert.equal(anchor.page,i+1);
    close(anchor.ratio,ratio);
    close(restorePageAnchor(narrow,anchor),narrow.pages[i].top+narrow.pages[i].height*ratio);
  }
});

test('review: global match ordinals stay associated with their original PDF page',()=>{
  const hits=[{page:1,start:0,end:2},{page:8,start:5,end:7},{page:8,start:12,end:14},{page:100,start:1,end:3}];
  const grouped=groupPageMatches(hits);
  assert.deepEqual(grouped.get(8).globalIndexes,[1,2]);
  assert.strictEqual(grouped.get(8).matches[1],hits[2]);
  assert.deepEqual(grouped.get(100).globalIndexes,[3]);
});

test('review: stale document, layout, navigation token or nearby-page readiness cannot finish target intent',()=>{
  const source={};
  const expected={source,layoutWidth:616,token:4,page:90};
  assert.equal(pdfReadyMatches(expected,{...expected}),true);
  for(const patch of [{source:{}},{layoutWidth:416},{token:3},{page:89}])assert.equal(pdfReadyMatches(expected,{...expected,...patch}),false);
  assert.equal(pdfReadyMatches(null,expected),false);
});

test('review: dimensions reject invalid PDF values and empty layouts have no visible pages',()=>{
  for(const bad of [{width:0,height:10},{width:10,height:-1},{width:NaN,height:2},{width:Infinity,height:2}])assert.throws(()=>normalizedPdfMetric(bad));
  const empty=buildPageLayout([],616);
  assert.equal(empty.totalHeight,0);
  assert.deepEqual(visiblePageNumbers(empty,0,700),[]);
  assert.equal(restorePageAnchor(empty,{page:4,ratio:.5}),0);
});
