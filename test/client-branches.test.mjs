import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,nodes,text,ok,repos,overview} from './helpers/client-harness.mjs';

async function setup({head='a'.repeat(40),failDelete=false}={}){
 const branches=['alpha','feature/done','feature/other'];
 const app=await harness(async(action,body)=>{
  if(action==='repositories')return ok(repos);
  if(action==='overview'){const value=overview('alpha');value.snapshot.branches=head?[...branches]:[];value.details.head=head;value.details.clean=true;return ok(value);}
  if(action==='action'){
   if(body.operation==='createBranch')branches.push(body.branch);
   if(body.operation==='deleteBranch'){
    if(failDelete)return {ok:false,status:400,json:async()=>({error:'Branch is not fully merged into the current HEAD'})};
    branches.splice(branches.indexOf(body.branch),1);
   }
   return ok({message:'done',output:''});
  }
  throw new Error('unexpected action '+action);
 });
 app.render();await app.flush();nodes(app.render()).find(n=>n.props.role==='tab'&&n.props.key==='branches').props.onClick();return app;
}
const input=(tree,label)=>nodes(tree).find(n=>n.type==='input'&&n.props['aria-label']===label);

test('branch creation has an explicit entry and confirmation, then refreshes without switching',async()=>{
 const app=await setup();let tree=app.render();assert.ok(text(tree).includes('新建本地分支'));assert.equal(app.button(tree,'创建分支').props.disabled,true);
 input(tree,'新分支名').props.onChange({target:{value:'  feature/new  '}});tree=app.render();app.button(tree,'创建分支').props.onClick();tree=app.render();
 assert.ok(text(nodes(tree).find(n=>n.props.role==='dialog')).includes('不自动切换'));assert.equal(app.calls.filter(c=>c.action==='action').length,0);
 app.button(tree,'确认创建分支').props.onClick();await app.flush();tree=app.render();
 const request=app.calls.find(c=>c.action==='action');assert.equal(request.operation,'createBranch');assert.equal(request.branch,'feature/new');assert.equal(request.confirm,true);assert.equal(request.expectedBranch,'alpha');assert.equal(request.repository,'alpha');
 assert.ok(app.button(tree,'删除分支 feature/new'));assert.equal(input(tree,'新分支名').props.value,'');assert.equal(app.calls.filter(c=>c.operation==='switchBranch').length,0);
});

test('branch deletion requires exact typed target and cancel never submits',async()=>{
 const app=await setup();let tree=app.render();assert.equal(app.button(tree,'删除分支 alpha').props.disabled,true);
 app.button(tree,'删除分支 feature/done').props.onClick();tree=app.render();const dialog=nodes(tree).find(n=>n.props.role==='dialog');assert.ok(text(dialog).includes('不删除远程分支'));assert.ok(text(dialog).includes('不执行强制删除'));assert.equal(app.button(tree,'确认删除本地分支').props.disabled,true);
 app.button(tree,'确认删除本地分支').props.onClick();await app.flush();assert.equal(app.calls.filter(c=>c.action==='action').length,0);
 input(tree,'输入要删除的分支名').props.onChange({target:{value:'feature/other'}});tree=app.render();assert.equal(app.button(tree,'确认删除本地分支').props.disabled,true);
 app.button(tree,'取消').props.onClick();tree=app.render();assert.equal(app.calls.filter(c=>c.action==='action').length,0);assert.ok(!nodes(tree).some(n=>n.props.role==='dialog'));
 app.button(tree,'删除分支 feature/done').props.onClick();tree=app.render();assert.equal(input(tree,'输入要删除的分支名').props.value,'');input(tree,'输入要删除的分支名').props.onChange({target:{value:'feature/done'}});tree=app.render();assert.equal(app.button(tree,'确认删除本地分支').props.disabled,false);
 const confirm=app.button(tree,'确认删除本地分支');confirm.props.onClick();confirm.props.onClick();await app.flush();tree=app.render();
 const actions=app.calls.filter(c=>c.action==='action');assert.equal(actions.length,1);assert.deepEqual(actions[0],{action:'action',sessionId:'session-test',repository:'alpha',operation:'deleteBranch',branch:'feature/done',expectedHead:'a'.repeat(40),expectedBranch:'alpha',confirm:true});
 assert.ok(!app.button(tree,'删除分支 feature/done'));assert.ok(text(tree).includes('删除本地分支完成'));assert.ok(app.button(tree,'删除分支 feature/other'));
});

test('unborn repositories disable create branch with a first-commit explanation',async()=>{
 const app=await setup({head:null});const tree=app.render();assert.ok(text(tree).includes('请先创建首次提交'));input(tree,'新分支名').props.onChange({target:{value:'feature/new'}});assert.equal(app.button(app.render(),'创建分支').props.disabled,true);
});

test('rejected deletion leaves branch visible and requires refresh before another write',async()=>{
 const app=await setup({failDelete:true});app.button(app.render(),'删除分支 feature/done').props.onClick();input(app.render(),'输入要删除的分支名').props.onChange({target:{value:'feature/done'}});app.button(app.render(),'确认删除本地分支').props.onClick();await app.flush();const tree=app.render();
 assert.ok(app.button(tree,'删除分支 feature/done'));assert.equal(app.button(tree,'删除分支 feature/done').props.disabled,true);assert.ok(text(tree).includes('尚未安全合并'));assert.ok(!text(tree).includes('删除本地分支完成'));
});
