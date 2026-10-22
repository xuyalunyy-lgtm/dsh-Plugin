import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,nodes,text,ok,repos,overview} from './helpers/client-harness.mjs';

test('client prevents double submission and locks stale write state until refresh',async()=>{
 let finish;const app=await harness(async(action)=>{
  if(action==='repositories')return ok(repos);if(action==='overview')return ok(overview('alpha'));
  return new Promise(resolve=>{finish=()=>resolve({ok:false,status:409,json:async()=>({error:'Repository state changed'})});});
 });
 app.render();await app.flush();let tree=app.render();app.button(tree,'暂存 file.txt').props.onClick();tree=app.render();
 const confirm=app.button(tree,'确认暂存');confirm.props.onClick();confirm.props.onClick();await app.flush();assert.equal(app.calls.filter(r=>r.action==='action').length,1);
 finish();await app.flush();tree=app.render();assert.ok(text(tree).includes('Repository state changed'));assert.ok(text(tree).includes('仓库正忙或状态已改变'));assert.ok(!nodes(tree).some(n=>n.props.className==='notice success'));assert.equal(app.button(tree,'暂存 file.txt').props.disabled,true);
 app.button(tree,'刷新仓库').props.onClick();await app.flush();tree=app.render();assert.equal(app.button(tree,'暂存 file.txt').props.disabled,false);
});

test('refresh keeps previous content visible but disables stale mutations on failure',async()=>{
 let count=0,finish;const app=await harness(async(action)=>{
  if(action==='repositories')return ok(repos);
  if(++count===1)return ok(overview('alpha'));
  return new Promise(resolve=>{finish=()=>resolve({ok:false,status:429,json:async()=>({error:'too many requests'})});});
 });
 app.render();await app.flush();let tree=app.render();app.button(tree,'刷新仓库').props.onClick();tree=app.render();
 assert.ok(text(tree).includes('file.txt'));assert.ok(text(tree).includes('正在刷新'));assert.equal(app.button(tree,'暂存 file.txt').props.disabled,true);
 finish();await app.flush();tree=app.render();assert.ok(text(tree).includes('file.txt'));assert.ok(text(tree).includes('请求过多'));assert.equal(app.button(tree,'暂存 file.txt').props.disabled,true);
});
