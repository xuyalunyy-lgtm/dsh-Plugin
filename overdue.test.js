import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createController, initialState } from './state.js';

const source=await readFile(new URL('./client.js',import.meta.url),'utf8');
const start=source.indexOf('// BEGIN PURE HELPERS'),end=source.indexOf('// END PURE HELPERS');
const {selectOverdueTasks,overdueMoveRequest}=vm.runInNewContext(`${source.slice(start,end)};({selectOverdueTasks,overdueMoveRequest})`,{Date});
const plain=x=>JSON.parse(JSON.stringify(x));
const token='a'.repeat(64);
const task=(id,date,time='',done=false)=>({id,date,time,done,title:id,editToken:token,focusMs:120000,focusRounds:1});

test('history excludes today, future and completed tasks; oldest dates and scheduled times first',()=>{
  const values=[task('today','2026-10-26'),task('future','2026-10-27'),task('complete','2026-10-22','',true),task('untimed','2026-10-23'),task('morning','2026-10-23','09:00'),task('oldest','2025-12-31')];
  const before=structuredClone(values);
  assert.deepEqual(plain(selectOverdueTasks(values,'2026-10-26')).map(t=>t.id),['oldest','morning','untimed']);
  assert.deepEqual(values,before);
});

test('history handles leap days, year boundaries and invalid viewing dates without modifying dates',()=>{
  assert.deepEqual(plain(selectOverdueTasks([task('leap','2024-02-29'),task('march','2024-03-01')],'2024-03-01')).map(t=>t.id),['leap']);
  assert.equal(selectOverdueTasks([task('last','2025-12-31')],'2026-01-01').length,1);
  assert.equal(selectOverdueTasks([task('early','0001-01-01')],'0001-01-02').length,1);
  assert.equal(selectOverdueTasks([task('x','2026-10-23')],'2026-02-30').length,0);
});

test('move payload contains only ID, destination and captured token; ineligible tasks cannot move',()=>{
  const item=task('x','2026-10-23','14:30');
  assert.deepEqual(plain(overdueMoveRequest(item,'2026-10-26')),{id:'x',date:'2026-10-26',expectedToken:token});
  for(const value of [null,{...item,done:true},{...item,date:'2026-10-26'},{...item,date:'2026-10-27'},{...item,editToken:undefined}])assert.equal(overdueMoveRequest(value,'2026-10-26'),null);
});

test('move uses the existing guarded update, preserves task data and refuses a conflicting move',async()=>{
  let state=initialState();const controller=createController({load:()=>state,save:async value=>{state=value;}});
  try{
    const added=await controller.dispatch({action:'add',date:'2026-10-23',title:'History',time:'14:30'}),original=added.state.tasks[0];
    const payload=plain(overdueMoveRequest(original,'2026-10-26'));
    const moved=await controller.dispatch({action:'update',...payload,requestId:'history-move-request-0001'});
    assert.equal(moved.ok,true);assert.equal(moved.state.tasks[0].date,'2026-10-26');
    for(const field of ['id','title','time','done','focusMs','focusRounds'])assert.equal(moved.state.tasks[0][field],original[field]);
    assert.equal(selectOverdueTasks(moved.state.tasks,'2026-10-26').length,0);
    const retry=await controller.dispatch({action:'update',...payload,requestId:'history-move-request-0001'});assert.equal(retry.ok,true);assert.equal(retry.receipt.replayed,true);
    const stale=await controller.dispatch({action:'update',...payload,date:'2026-10-27',requestId:'history-move-request-0002'});assert.equal(stale.code,'CONFLICT');assert.equal(state.tasks[0].date,'2026-10-26');
  }finally{await controller.close();}
});

test('history UI uses explicit guarded actions and bounded rows rather than automatic migration',()=>{
  assert.match(source,/const result=await taskWrite\('update',request\)/);
  assert.match(source,/items\.slice\(0,limit\)/);
  assert.match(source,/h\(OverduePanel,\{onChooseDate:chooseDate\}\)/);
  assert.match(source,/journal\.get\('row:'\+item\.id\)/);
});
