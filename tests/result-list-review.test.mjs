import test from 'node:test';
import assert from 'node:assert/strict';
import {findMatches} from '../src/search.mjs';
import {buildLineStarts, lineNumberAt, matchContext, createResultPage, RESULTS_PAGE_SIZE} from '../src/result-list.mjs';

test('review: deterministic Unicode contexts never cut valid surrogate pairs',()=>{
  let seed=12345;
  const alphabet=['中文','😀','𠮷','a','\r\n','\n','\r',' '];
  let text='';
  for(let i=0;i<1500;i++) { seed=(Math.imul(seed,1664525)+1013904223)>>>0; text+=alphabet[seed%alphabet.length]; }
  const starts=buildLineStarts(text);
  for(const hit of findMatches(text,'😀')) {
    const context=matchContext(text,hit.start,hit.end);
    assert.equal(context.match,'😀');
    for(const part of [context.before,context.match,context.after]) assert.doesNotMatch(part,/[\uD800-\uDFFF]/u);
    assert.ok(context.before.length<=49);
    assert.ok(context.after.length<=49);
    assert.equal(lineNumberAt(starts,hit.start),text.slice(0,hit.start).split(/\r\n|\r|\n/).length);
  }
});

test('review: result batches visit every global ordinal once without losing totals',()=>{
  const pages=[{text:'命中 '.repeat(83)},{text:'命中 '.repeat(48)}];
  const results=pages.flatMap((page,index)=>findMatches(page.text,'命中').map(hit=>({...hit,page:index+1})));
  const ordinals=[];
  for(let index=0;index<Math.ceil(results.length/RESULTS_PAGE_SIZE);index++) {
    const batch=createResultPage(pages,results,index,{isPdf:true});
    assert.equal(batch.total,131);
    assert.ok(batch.items.length<=40);
    for(const item of batch.items) {
      ordinals.push(item.ordinal);
      assert.equal(item.page,results[item.index].page);
      assert.equal(item.match,'命中');
    }
  }
  assert.deepEqual(ordinals,Array.from({length:131},(_,index)=>index+1));
});
