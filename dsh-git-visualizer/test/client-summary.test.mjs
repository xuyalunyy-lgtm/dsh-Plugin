import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,nodes,text,ok,repos,overview} from './helpers/client-harness.mjs';
const open=app=>nodes(app.render()).find(n=>n.props.key==='repos'&&n.props.role==='tab').props.onClick();
const summary=(id,changes=0)=>({branch:id,head:'a'.repeat(40),changes,staged:0,untracked:changes,conflicts:0,upstream:null,ahead:null,behind:null,checkedAt:'2026-10-23T01:00:00Z'});
test('repository dashboard reads with two workers, isolates errors, and filters states',async()=>{
 let active=0,max=0;const pending=[];const list={...repos,repositories:[...repos.repositories,{id:'third',name:'third'}]};
 const app=await harness(async(action,body)=>{if(action==='repositories')return ok(list);if(action==='overview')return ok(overview(body.repository));assert.equal(action,'summary');active++;max=Math.max(max,active);return new Promise(resolve=>pending.push(()=>{active--;resolve(body.repository==='third'?{ok:false,status:400,json:async()=>({error:'cannot read third'})}:ok(summary(body.repository,body.repository==='alpha'?2:0)));}));});
 app.render();await app.flush();assert.equal(app.calls.filter(c=>c.action==='summary').length,0);open(app);await app.flush();assert.equal(active,2);open(app);await app.flush();assert.equal(active,2);
 pending.shift()();await app.flush();assert.equal(active,2);pending.shift()();pending.shift()();await app.flush();assert.equal(max,2);
 let tree=app.render();assert.ok(text(tree).includes('2 个改动'));assert.ok(text(tree).includes('cannot read third'));assert.ok(text(tree).includes('未配置 upstream'));
 nodes(tree).find(n=>n.props['aria-label']==='仓库状态筛选').props.onChange({target:{value:'dirty'}});tree=app.render();assert.ok(app.button(tree,'打开仓库 alpha'));assert.ok(!app.button(tree,'打开仓库 group/beta'));
 app.button(tree,'打开仓库 alpha').props.onClick();await app.flush();assert.ok(text(app.render()).includes('创建提交'));
});
test('late summary batches cannot leak between sessions or continue queue after navigation',async()=>{
 const pending=[];const list={...repos,repositories:[...repos.repositories,{id:'third',name:'third'}]};
 const app=await harness(async(action,body)=>{if(action==='repositories')return ok(list);if(action==='overview')return ok(overview(body.repository));return new Promise(resolve=>pending.push(()=>resolve(ok(summary('OLD-SESSION')))));});
 app.render();await app.flush();open(app);await app.flush();app.render('session-other');await app.flush();pending.splice(0).forEach(fn=>fn());await app.flush();assert.equal(app.calls.filter(c=>c.action==='summary').length,2);assert.ok(!text(app.render('session-other')).includes('OLD-SESSION'));
});
