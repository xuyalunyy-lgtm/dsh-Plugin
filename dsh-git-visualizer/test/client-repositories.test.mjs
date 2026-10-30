import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,nodes,text,ok,repos,overview} from './helpers/client-harness.mjs';

test('client uses one overview request, scopes diffs and rejects stale snapshots',async()=>{
 let resolveSlow;const app=await harness(async(action,body)=>{
  if(action==='repositories')return ok(repos);
  if(action==='diff')return ok({text:'+ scoped change'});
  assert.equal(action,'overview');
  if(body.repository==='alpha')return new Promise(resolve=>{resolveSlow=()=>resolve(ok(overview('alpha')));});
  return ok(overview('group/beta'));
 });
 app.render();await app.flush();assert.equal(app.calls[0].action,'repositories');assert.equal(app.calls[1].action,'overview');assert.equal(app.calls.length,2);
 let tree=app.render();app.button(tree,'alpha2 个仓库▾').props.onClick();tree=app.render();const beta=nodes(tree).find(n=>n.type==='button'&&n.props.key==='group/beta');assert.ok(beta);beta.props.onClick();await app.flush();
 tree=app.render();assert.ok(text(tree).includes('⑂ group/beta'));assert.ok(text(tree).includes('D:/workspace'));
 resolveSlow();await app.flush();tree=app.render();assert.ok(text(tree).includes('⑂ group/beta'));assert.ok(!text(tree).includes('⑂ alpha'));
 app.button(tree,'刷新仓库').props.onClick();await app.flush();assert.equal(app.calls.at(-1).repository,'group/beta');
 tree=app.render();nodes(tree).find(n=>n.type==='button'&&n.props.title==='查看 file.txt 的差异').props.onClick();await app.flush();assert.equal(app.calls.at(-1).action,'diff');assert.equal(app.calls.at(-1).repository,'group/beta');
});

test('write actions require confirmation, preserve scope and refresh after success',async()=>{
 const app=await harness(async(action)=>action==='repositories'?ok(repos):action==='overview'?ok(overview('alpha')):ok({message:'暂存完成',output:'ok'}));
 app.render();await app.flush();let tree=app.render();app.button(tree,'暂存 file.txt').props.onClick();tree=app.render();
 assert.ok(nodes(tree).some(n=>n.props.role==='dialog'));assert.equal(app.calls.filter(c=>c.action==='action').length,0);
 app.button(tree,'取消').props.onClick();tree=app.render();assert.ok(!nodes(tree).some(n=>n.props.role==='dialog'));
 app.button(tree,'暂存 file.txt').props.onClick();tree=app.render();app.button(tree,'确认暂存').props.onClick();await app.flush();
 const action=app.calls.find(c=>c.action==='action');assert.equal(action.repository,'alpha');assert.equal(action.confirm,true);assert.equal(action.operation,'stage');assert.deepEqual(action.paths,['file.txt']);assert.equal(action.expectedHead,'a'.repeat(40));assert.equal(action.expectedBranch,'alpha');
 assert.equal(app.calls.filter(c=>c.action==='overview').length,2);tree=app.render();assert.ok(text(tree).includes('暂存完成'));
});

test('switching sessions ignores stale operation results',async()=>{
 let finish;const app=await harness(async(action,body)=>{
  if(action==='repositories')return ok(repos);if(action==='overview')return ok(overview(body.sessionId));
  return new Promise(resolve=>{finish=()=>resolve(ok({message:'OLD SESSION RESULT',output:'OLD SESSION OUTPUT'}));});
 });
 app.render();await app.flush();let tree=app.render();app.button(tree,'暂存 file.txt').props.onClick();tree=app.render();app.button(tree,'确认暂存').props.onClick();
 app.render('session-other');await app.flush();finish();await app.flush();tree=app.render('session-other');assert.ok(!text(tree).includes('OLD SESSION OUTPUT'));
});
