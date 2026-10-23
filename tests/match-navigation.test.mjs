import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchPosition, nextMatchIndex} from '../src/match-navigation.mjs';
import {findMatches} from '../src/search.mjs';

test('counter distinguishes idle, empty, loading and failed states',()=>{
  assert.deepEqual(matchPosition('',18,9),{status:'idle',current:0,total:0});
  assert.deepEqual(matchPosition('word',0,9),{status:'empty',current:0,total:0});
  assert.equal(matchPosition('word',18,9,{loading:true}).status,'loading');
  assert.equal(matchPosition('word',18,9,{error:'read failed'}).status,'error');
});
test('current result is one-based while total covers all matches',()=>{
  const total=['匹配 匹配','匹配'].flatMap(text=>findMatches(text,'匹配')).length;
  assert.deepEqual(matchPosition('匹配',total,0),{status:'matched',current:1,total:3});
  assert.deepEqual(matchPosition('匹配',total,2),{status:'matched',current:3,total:3});
});
test('next and previous wrap without changing total',()=>{
  assert.equal(nextMatchIndex(2,1,3),0);
  assert.equal(nextMatchIndex(0,-1,3),2);
  assert.equal(nextMatchIndex(1,1,3),2);
  assert.equal(nextMatchIndex(0,1,1),0);
  assert.equal(nextMatchIndex(0,-1,0),0);
});
test('a reduced result set never shows an out-of-range current ordinal',()=>{
  assert.deepEqual(matchPosition('new',2,17),{status:'matched',current:1,total:2});
  assert.equal(matchPosition('new',2,-1).current,1);
  assert.equal(matchPosition('new',2,NaN).current,1);
  assert.equal(nextMatchIndex(17,1,2),1);
});
test('bilingual counter text names both current item and total',async()=>{
  const zh=JSON.parse(await readFile(new URL('../locale/zh.json',import.meta.url),'utf8')).ui;
  const en=JSON.parse(await readFile(new URL('../locale/en.json',import.meta.url),'utf8')).ui;
  const format=s=>s.replace('{current}','3').replace('{total}','18');
  assert.equal(format(zh.matchCount),'当前第 3 项 · 共 18 项');
  assert.equal(format(en.matchCount),'Match 3 of 18');
  for(const key of ['noMatches','indexing','searchUnavailable','matchPage']) {
    assert.ok(zh[key]); assert.ok(en[key]);
  }
});
