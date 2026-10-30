import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RESULTS_PAGE_SIZE, resultPageWindow, listScrollForItem, buildLineStarts, lineNumberAt, matchContext, createResultPage} from '../src/result-list.mjs';
import {findMatches} from '../src/search.mjs';

test('list windows stay at 40 entries and preserve the full result total',()=>{
  assert.equal(RESULTS_PAGE_SIZE,40);
  assert.deepEqual(resultPageWindow(101,1),{page:1,pageCount:3,start:40,end:80,from:41,to:80,total:101});
  assert.deepEqual(resultPageWindow(101,99),{page:2,pageCount:3,start:80,end:101,from:81,to:101,total:101});
  assert.equal(resultPageWindow(80,2).page,1);
  assert.equal(resultPageWindow(80,-1).page,0);
  assert.equal(resultPageWindow(80,NaN).page,0);
  assert.deepEqual(resultPageWindow(0,1),{page:0,pageCount:0,start:0,end:0,from:0,to:0,total:0});
});

test('list visibility adjustment is local and preserves already-visible rows',()=>{
  assert.equal(listScrollForItem(100,200,120,40),100);
  assert.equal(listScrollForItem(100,200,60,40),60);
  assert.equal(listScrollForItem(100,200,280,50),130);
  assert.equal(listScrollForItem(100,200,240,400),240);
  assert.equal(listScrollForItem(100,0,240,40),100);
  assert.equal(listScrollForItem(0,200,0,40),0);
});

test('Markdown line numbers are 1-based and handle LF, CRLF and standalone CR',()=>{
  const starts=buildLineStarts('a\r\nb\rc\nd\n');
  assert.deepEqual(starts,[0,3,5,7,9]);
  assert.equal(lineNumberAt(starts,0),1);
  assert.equal(lineNumberAt(starts,2),1);
  assert.equal(lineNumberAt(starts,3),2);
  assert.equal(lineNumberAt(starts,5),3);
  assert.equal(lineNumberAt(starts,7),4);
  assert.equal(lineNumberAt(starts,9),5);
  assert.deepEqual(buildLineStarts(''),[0]);
});

test('context slices preserve UTF-16 surrogate pairs at both clipping boundaries',()=>{
  const text='x'.repeat(4)+'😀'+'y'.repeat(47)+'hit'+'z'.repeat(47)+'😀rest';
  const start=text.indexOf('hit');
  const context=matchContext(text,start,start+3);
  assert.equal(context.before,'😀'+'y'.repeat(47));
  assert.equal(context.match,'hit');
  assert.equal(context.after,'z'.repeat(47)+'😀');
  assert.equal(context.leadingEllipsis,true);
  assert.equal(context.trailingEllipsis,true);
  assert.equal(context.matchTruncated,false);
});

test('very long matching text is bounded only in the snippet, not the underlying result',()=>{
  const text='a'.repeat(119)+'😀'+'b'.repeat(200);
  const results=[{page:1,start:0,end:text.length}];
  const listing=createResultPage([{text}],results,0);
  assert.equal(listing.items[0].match,'a'.repeat(119)+'😀');
  assert.equal(listing.items[0].matchTruncated,true);
  assert.equal(results[0].end,text.length);
  assert.equal(listing.total,1);
});

test('PDF list entries preserve global indexes and page locations across batches',()=>{
  const pages=[{text:'needle '.repeat(48)},{text:'needle '.repeat(13)}];
  const results=pages.flatMap((p,index)=>findMatches(p.text,'needle').map(m=>({...m,page:index+1})));
  const listing=createResultPage(pages,results,1,{isPdf:true});
  assert.equal(listing.total,61);
  assert.equal(listing.items.length,21);
  assert.equal(listing.items[0].index,40);
  assert.equal(listing.items[0].ordinal,41);
  assert.equal(listing.items[7].page,1);
  assert.equal(listing.items[8].page,2);
  assert.equal(listing.items[20].ordinal,61);
  assert.equal(listing.items[0].line,undefined);
});

test('Markdown snippets retain literal markup and report the matching source line',()=>{
  const text='# Header\r\n<script>alert(1)</script>\nneedle <img src=x onerror=alert(2)>\rneedle';
  const results=findMatches(text,'needle').map(m=>({...m,page:1}));
  const listing=createResultPage([{text}],results,0,{lineStarts:buildLineStarts(text)});
  assert.deepEqual(listing.items.map(item=>item.line),[3,4]);
  assert.ok(listing.items[0].before.includes('<script>'));
  assert.ok(listing.items[0].after.includes('<img'));
  assert.equal(listing.items[0].match,'needle');
});

test('large result lists return only one bounded batch',()=>{
  const text='a '.repeat(10000);
  const results=findMatches(text,'a').map(m=>({...m,page:1}));
  const listing=createResultPage([{text}],results,123);
  assert.equal(listing.total,10000);
  assert.equal(listing.items.length,40);
  assert.equal(listing.items[0].ordinal,4921);
  assert.equal(listing.items[39].ordinal,4960);
  for(const item of listing.items) assert.ok(item.before.length+item.match.length+item.after.length<=219);
});

test('result list labels and ranges are available in both languages',async()=>{
  for(const language of ['zh','en']) {
    const {ui}=JSON.parse(await readFile(new URL(`../locale/${language}.json`,import.meta.url),'utf8'));
    for(const key of ['showResults','hideResults','resultsTitle','resultRange','previousResults','nextResults','resultOrdinal','resultPage','resultLine']) assert.ok(ui[key]);
    for(const parameter of ['{from}','{to}','{total}']) assert.ok(ui.resultRange.includes(parameter));
  }
});
