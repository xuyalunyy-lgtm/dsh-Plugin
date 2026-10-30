import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,nodes,ok,repos,overview,memoryStorage} from './helpers/client-harness.mjs';

test('late commit response cannot erase a newer draft after leaving and returning to a session',async()=>{
 let finish;const storage=memoryStorage();const transport=async(action,body)=>{
  if(action==='repositories')return ok(repos);
  if(action==='overview'){const value=overview(body.repository);value.snapshot.status=[{path:'file.txt',index:'M',worktree:' '}];return ok(value);}
  return new Promise(resolve=>{finish=()=>resolve(ok({message:'committed'}));});
 };
 const app=await harness(transport,{storage}),draft=tree=>nodes(tree).find(n=>n.props['aria-label']==='提交说明');
 app.render();await app.flush();draft(app.render()).props.onChange({target:{value:'original commit'}});
 app.button(app.render(),'提交已暂存').props.onClick();app.button(app.render(),'确认提交').props.onClick();
 app.render('session-other');await app.flush();app.render();await app.flush();draft(app.render()).props.onChange({target:{value:'new draft while old commit runs'}});
 finish();await app.flush();assert.equal(draft(app.render()).props.value,'new draft while old commit runs');app.dispose();
 const remount=await harness(transport,{storage});remount.render();await remount.flush();assert.equal(draft(remount.render()).props.value,'new draft while old commit runs');
});
