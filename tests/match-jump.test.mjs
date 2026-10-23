import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchJumpTarget, isComposingKey, nextMatchIndex, matchPosition} from '../src/match-navigation.mjs';

const results = [{page:1,start:0,end:3},{page:1,start:8,end:11},{page:4,start:2,end:5}];

test('1-based result numbers map to exact match indexes and PDF pages',()=>{
  assert.deepEqual(matchJumpTarget('1',results),{ok:true,ordinal:1,index:0,page:1});
  assert.deepEqual(matchJumpTarget('3',results),{ok:true,ordinal:3,index:2,page:4});
  assert.deepEqual(matchJumpTarget(' 002 ',results),{ok:true,ordinal:2,index:1,page:1});
  assert.equal(matchPosition('hit',results.length,matchJumpTarget('3',results).index).current,3);
});

test('blank input is rejected instead of coercing to result zero',()=>{
  for(const value of ['', ' ', '\t\r\n', '\u3000']) {
    assert.deepEqual(matchJumpTarget(value,results),{ok:false,error:'jumpRequired'});
  }
});

test('decimal, exponential, signed and non-digit input are rejected',()=>{
  for(const value of ['1.5','1.0','.5','1e0','1E2','+1','-1','0x1','1 2','NaN','Infinity','abc','１','一']) {
    assert.deepEqual(matchJumpTarget(value,results),{ok:false,error:'jumpInteger'},value);
  }
});

test('zero, out-of-range and unsafe integer destinations do not produce a target',()=>{
  for(const value of ['0','000','4','9007199254740993','9'.repeat(400)]) {
    assert.deepEqual(matchJumpTarget(value,results),{ok:false,error:'jumpRange'},value);
  }
  assert.deepEqual(matchJumpTarget('1',[]),{ok:false,error:'jumpUnavailable'});
});

test('jump follows the current result set and leaves result data unchanged',()=>{
  const frozen=Object.freeze(results.map(result=>Object.freeze({...result})));
  assert.equal(matchJumpTarget('3',frozen).page,4);
  assert.deepEqual(matchJumpTarget('3',frozen.slice(0,2)),{ok:false,error:'jumpRange'});
  // Existing Enter next/previous navigation still starts from the jumped match.
  const target=matchJumpTarget('3',frozen);
  assert.equal(nextMatchIndex(target.index,1,frozen.length),0);
  assert.equal(nextMatchIndex(target.index,-1,frozen.length),1);
  assert.equal(frozen[2].page,4);
});

test('IME lifecycle, React/native composing flags and legacy keyCode 229 suppress submission',()=>{
  assert.equal(isComposingKey({key:'Enter'},true),true);
  assert.equal(isComposingKey({key:'Enter',isComposing:true}),true);
  assert.equal(isComposingKey({key:'Enter',nativeEvent:{isComposing:true}}),true);
  assert.equal(isComposingKey({key:'Enter',keyCode:229}),true);
  assert.equal(isComposingKey({key:'Enter',nativeEvent:{keyCode:229}}),true);
  assert.equal(isComposingKey({key:'Enter',nativeEvent:{isComposing:false,keyCode:13}}),false);
});

test('both languages supply jump labels and accessible validation messages',async()=>{
  const dictionaries=await Promise.all(['zh','en'].map(async language=>JSON.parse(await readFile(new URL(`../locale/${language}.json`,import.meta.url),'utf8')).ui));
  for(const dictionary of dictionaries) {
    for(const key of ['jumpLabel','jumpPlaceholder','jumpButton','jumpRequired','jumpInteger','jumpRange','jumpUnavailable']) assert.ok(dictionary[key],key);
    assert.ok(dictionary.jumpRange.includes('{total}'));
    assert.ok(dictionary.jumpPlaceholder.includes('{total}'));
  }
});
