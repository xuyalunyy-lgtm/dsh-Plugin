import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,nodes,text,ok,repos,overview} from './helpers/client-harness.mjs';
const open=app=>nodes(app.render()).find(n=>n.props.role==='tab'&&n.props.key==='branches').props.onClick();
const names=['alpha','done','not-merged','occupied'];
const meta=head=>({head,checkedAt:'2026-10-23T01:00:00Z',branches:names.map(name=>({name,merged:name!=='not-merged',worktrees:name==='occupied'?['D:/other tree']:[],deleteBlockedReason:name==='alpha'?'current':name==='not-merged'?'unmerged':name==='occupied'?'worktree':null,updatedAt:'2026-10-22T01:00:00Z'}))});
test('branch markers show merged state and worktree occupancy and protect deletion until fresh',async()=>{
 let finish;const app=await harness(async(action,body)=>{if(action==='repositories')return ok(repos);if(action==='overview'){const v=overview(body.repository);v.snapshot.branches=names;return ok(v);}return new Promise(resolve=>{finish=()=>resolve(ok(meta('a'.repeat(40))));});});
 app.render();await app.flush();open(app);assert.equal(app.button(app.render(),'删除分支 done').props.disabled,true);finish();await app.flush();let tree=app.render();assert.equal(app.button(tree,'删除分支 done').props.disabled,false);assert.equal(app.button(tree,'删除分支 occupied').props.disabled,true);assert.equal(app.button(tree,'删除分支 not-merged').props.disabled,true);assert.ok(text(tree).includes('D:/other tree'));assert.ok(text(tree).includes('未合并到 HEAD'));
 app.button(tree,'刷新仓库').props.onClick();await app.flush();tree=app.render();assert.equal(app.button(tree,'删除分支 done').props.disabled,true);
});
test('metadata with a different HEAD or late session response cannot enable delete',async()=>{
 const app=await harness(async(action,body)=>{if(action==='repositories')return ok(repos);if(action==='overview'){const v=overview(body.repository);v.snapshot.branches=names;return ok(v);}return ok(meta('b'.repeat(40)));});
 app.render();await app.flush();open(app);await app.flush();assert.equal(app.button(app.render(),'删除分支 done').props.disabled,true);assert.ok(text(app.render()).includes('分支标记待刷新'));
});
