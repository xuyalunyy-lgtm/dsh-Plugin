import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,nodes,text,ok,repos,overview,memoryStorage} from './helpers/client-harness.mjs';

const draft=tree=>nodes(tree).find(n=>n.type==='textarea'&&n.props['aria-label']==='提交说明');
async function choose(app,repo){let tree=app.render();nodes(tree).find(n=>n.type==='button'&&n.props.className==='repo-button').props.onClick();tree=app.render();nodes(tree).find(n=>n.type==='button'&&n.props.key===repo).props.onClick();await app.flush();}
const defaultTransport=async(action,body)=>action==='repositories'?ok(repos):ok(overview(body.repository));

test('commit drafts survive repository switch, rescan and remount and stay session/root scoped',async()=>{
 const storage=memoryStorage(),app=await harness(defaultTransport,{storage});app.render();await app.flush();
 draft(app.render()).props.onChange({target:{value:'alpha 草稿'}});await choose(app,'group/beta');assert.equal(draft(app.render()).props.value,'');
 draft(app.render()).props.onChange({target:{value:'beta 草稿'}});await choose(app,'alpha');assert.equal(draft(app.render()).props.value,'alpha 草稿');
 app.button(app.render(),'重新检索').props.onClick();await app.flush();assert.equal(draft(app.render()).props.value,'alpha 草稿');app.dispose();
 const remount=await harness(defaultTransport,{storage});remount.render();await remount.flush();assert.equal(draft(remount.render()).props.value,'alpha 草稿');
 remount.render('session-another');await remount.flush();assert.equal(draft(remount.render('session-another')).props.value,'');
 const otherRoot=await harness(async(action,body)=>action==='repositories'?ok({...repos,workspaceRoot:'D:/other'}):ok(overview(body.repository)),{storage});otherRoot.render();await otherRoot.flush();assert.equal(draft(otherRoot.render()).props.value,'');
});

test('draft memory fallback handles unavailable browser storage',async()=>{
 const storage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');},removeItem(){throw new Error('blocked');}};
 const app=await harness(defaultTransport,{storage});app.render();await app.flush();draft(app.render()).props.onChange({target:{value:'temporary'}});await choose(app,'group/beta');await choose(app,'alpha');assert.equal(draft(app.render()).props.value,'temporary');
});

test('failed commit preserves draft, successful commit removes only this repository draft',async()=>{
 let fail=true;const storage=memoryStorage();const app=await harness(async(action,body)=>{
  if(action==='repositories')return ok(repos);
  if(action==='overview'){const value=overview(body.repository);value.snapshot.status=[{path:'file.txt',index:'M',worktree:' '}];return ok(value);}
  return fail?{ok:false,status:400,json:async()=>({error:'commit rejected'})}:ok({message:'ok'});
 },{storage});
 app.render();await app.flush();draft(app.render()).props.onChange({target:{value:'commit alpha'}});await choose(app,'group/beta');draft(app.render()).props.onChange({target:{value:'keep beta'}});await choose(app,'alpha');
 app.button(app.render(),'提交已暂存').props.onClick();app.button(app.render(),'确认提交').props.onClick();await app.flush();assert.equal(draft(app.render()).props.value,'commit alpha');
 fail=false;app.button(app.render(),'刷新仓库').props.onClick();await app.flush();app.button(app.render(),'提交已暂存').props.onClick();app.button(app.render(),'确认提交').props.onClick();await app.flush();assert.equal(draft(app.render()).props.value,'');
 await choose(app,'group/beta');assert.equal(draft(app.render()).props.value,'keep beta');
});

test('filtered group staging never includes hidden files',async()=>{
 const app=await harness(async(action,body)=>{if(action==='repositories')return ok(repos);if(action==='action')return ok({});const value=overview(body.repository);value.snapshot.status.push({path:'hidden.txt',index:' ',worktree:'M'});return ok(value);});
 app.render();await app.flush();let tree=app.render();nodes(tree).find(n=>n.props['aria-label']==='筛选').props.onChange({target:{value:'file.txt'}});tree=app.render();app.button(tree,'暂存筛选结果').props.onClick();tree=app.render();assert.ok(!text(nodes(tree).find(n=>n.props.role==='dialog')).includes('hidden.txt'));app.button(tree,'确认暂存').props.onClick();await app.flush();assert.deepEqual(app.calls.find(c=>c.action==='action').paths,['file.txt']);
});

test('untracked files use preview endpoint with paging, binary and truncation notices',async()=>{
 let binary=false;const app=await harness(async(action,body)=>{
  if(action==='repositories')return ok(repos);if(action==='preview')return ok({text:binary?'二进制文件':Array.from({length:401},(_,i)=>`line ${i+1}`).join('\n'),binary,truncated:!binary,bytes:900000,lines:binary?0:401});
  const value=overview(body.repository);value.snapshot.status=[{path:'new.txt',index:'?',worktree:'?'}];return ok(value);
 });
 app.render();await app.flush();let tree=app.render();nodes(tree).find(n=>n.props.title==='查看 new.txt 的差异').props.onClick();await app.flush();tree=app.render();
 assert.equal(app.calls.at(-1).action,'preview');assert.deepEqual(Object.keys(app.calls.at(-1)).sort(),['action','sessionId','repository','path'].sort());
 assert.equal(nodes(tree).filter(n=>n.props.className?.startsWith('diff-line ')).length,200);assert.ok(text(tree).includes('预览已截断'));assert.ok(text(tree).includes('1 / 3'));app.button(tree,'下一页').props.onClick();tree=app.render();assert.ok(text(tree).includes('line 201'));assert.ok(!text(tree).includes('line 1line'));
 app.button(tree,'下一页').props.onClick();tree=app.render();assert.equal(nodes(tree).filter(n=>n.props.className?.startsWith('diff-line ')).length,1);assert.equal(app.button(tree,'下一页').props.disabled,true);
 binary=true;nodes(tree).find(n=>n.props.title==='查看 new.txt 的差异').props.onClick();await app.flush();tree=app.render();assert.ok(text(tree).includes('二进制文件'));assert.equal(nodes(tree).filter(n=>n.props.className?.startsWith('diff-line ')).length,0);
});

test('diff parser distinguishes headers, hunk content resembling headers and line numbers',async()=>{
 const app=await harness(defaultTransport),parsed=app.parsePatch('diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -3,3 +7,3 @@\n context\n--- deleted text\n+++ added text\n same\n\\ No newline at end of file\n');
 assert.equal(parsed.added,1);assert.equal(parsed.removed,1);assert.equal(parsed.rows[1].kind,'meta');assert.equal(parsed.rows[2].kind,'meta');
 assert.deepEqual(JSON.parse(JSON.stringify(parsed.rows[4])),{text:' context',kind:'',old:3,next:7});assert.equal(parsed.rows[5].old,4);assert.equal(parsed.rows[6].next,8);assert.equal(parsed.rows[7].old,5);assert.equal(parsed.rows[7].next,9);
 assert.equal(app.parsePatch('').rows.length,0);assert.equal(app.parsePatch('\n',true).rows.length,1);assert.equal(app.parsePatch('first\rsecond\r',true).rows.length,2);assert.equal(app.parsePatch('first\rsecond\r',true).rows[1].next,2);
 const multiple=app.parsePatch('@@ -0,0 +1 @@\n+new\ndiff --git a/y b/y\n--- a/y\n+++ b/y\n@@ -1 +1 @@\n-old\n+next\n');assert.equal(multiple.added,2);assert.equal(multiple.removed,1);
 const huge=app.parsePatch('@@ -0,0 +1,30000 @@\n'+'+row\n'.repeat(30000));assert.equal(huge.rows.length,20000);assert.equal(huge.truncated,true);
});

test('ordinary large diffs render at most one page and preserve line numbering',async()=>{
 const patch='@@ -0,0 +1,500 @@\n'+Array.from({length:500},(_,i)=>`+added ${i}`).join('\n');
 const app=await harness(async(action,body)=>action==='repositories'?ok(repos):action==='diff'?ok({text:patch}):ok(overview(body.repository)));
 app.render();await app.flush();nodes(app.render()).find(n=>n.props.title==='查看 file.txt 的差异').props.onClick();await app.flush();let tree=app.render();assert.ok(text(tree).includes('+500 / −0'));assert.equal(nodes(tree).filter(n=>n.props.className?.startsWith('diff-line ')).length,200);
 app.button(tree,'下一页').props.onClick();tree=app.render();assert.equal(nodes(tree).find(n=>n.props['aria-label']==='新行号').children[0],200);app.button(tree,'自动换行').props.onClick();tree=app.render();assert.ok(nodes(tree).some(n=>n.type==='pre'&&n.props.className==='wrap'));
});
