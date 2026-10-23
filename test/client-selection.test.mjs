import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,nodes,ok,repos,overview} from './helpers/client-harness.mjs';
const checkbox=(tree,label)=>nodes(tree).find(n=>n.type==='input'&&n.props['aria-label']===label);
async function setup(entries){const app=await harness(async(action,body)=>{if(action==='repositories')return ok(repos);if(action==='action')return ok({});const v=overview(body.repository);v.snapshot.status=entries;return ok(v);});app.render();await app.flush();return app;}
test('checkbox batches use exact files and rename pairs and keep staged side independent',async()=>{
 const app=await setup([{path:'both.txt',index:'M',worktree:'M'},{path:'renamed.txt',oldPath:'old.txt',index:'R',worktree:' '},{path:'hidden.txt',index:' ',worktree:'M'}]);
 checkbox(app.render(),'选择 worktree both.txt').props.onChange({target:{checked:true}});assert.equal(checkbox(app.render(),'选择 staged both.txt').props.checked,false);
 app.button(app.render(),'暂存所选 (1)').props.onClick();app.button(app.render(),'确认暂存').props.onClick();await app.flush();assert.deepEqual(app.calls.find(c=>c.action==='action').paths,['both.txt']);
 checkbox(app.render(),'选择 staged renamed.txt').props.onChange({target:{checked:true}});app.button(app.render(),'取消暂存所选 (1)').props.onClick();app.button(app.render(),'确认取消暂存').props.onClick();await app.flush();assert.deepEqual(app.calls.filter(c=>c.action==='action').at(-1).paths,['renamed.txt','old.txt']);
});
test('select-all respects filter and selection clears on filter, refresh, repository and session change',async()=>{
 const app=await setup([{path:'one.txt',index:' ',worktree:'M'},{path:'two.txt',index:' ',worktree:'M'}]);
 checkbox(app.render(),'全选 worktree').props.onChange({target:{checked:true}});assert.equal(checkbox(app.render(),'选择 worktree two.txt').props.checked,true);
 nodes(app.render()).find(n=>n.props['aria-label']==='筛选').props.onChange({target:{value:'one'}});assert.equal(checkbox(app.render(),'选择 worktree one.txt').props.checked,false);checkbox(app.render(),'全选 worktree').props.onChange({target:{checked:true}});
 app.button(app.render(),'暂存所选 (1)').props.onClick();app.button(app.render(),'取消').props.onClick();assert.equal(app.calls.filter(c=>c.action==='action').length,0);
 app.button(app.render(),'刷新仓库').props.onClick();await app.flush();assert.equal(checkbox(app.render(),'选择 worktree one.txt').props.checked,false);
 checkbox(app.render(),'全选 worktree').props.onChange({target:{checked:true}});nodes(app.render()).find(n=>n.props.className==='repo-button').props.onClick();nodes(app.render()).find(n=>n.props.key==='group/beta'&&n.type==='button').props.onClick();await app.flush();assert.equal(checkbox(app.render(),'选择 worktree one.txt').props.checked,false);
 checkbox(app.render(),'全选 worktree').props.onChange({target:{checked:true}});app.render('session-other');await app.flush();assert.equal(checkbox(app.render('session-other'),'选择 worktree one.txt').props.checked,false);
});
test('selected batch limit prevents >200 paths and conflicts remain individually resolved',async()=>{
 const entries=Array.from({length:201},(_,i)=>({path:`${i}.txt`,index:' ',worktree:'M'}));entries.push({path:'conflict',index:'U',worktree:'U'});const app=await setup(entries);
 checkbox(app.render(),'全选 worktree').props.onChange({target:{checked:true}});assert.equal(app.button(app.render(),'暂存所选 (201)').props.disabled,true);assert.ok(!checkbox(app.render(),'选择 conflict conflict'));app.button(app.render(),'清除本组选择').props.onClick();assert.equal(app.button(app.render(),'暂存所选 (0)').props.disabled,true);
});
