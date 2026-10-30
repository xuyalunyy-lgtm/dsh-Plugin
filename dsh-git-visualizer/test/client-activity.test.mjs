import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,nodes,text,ok,repos,overview} from './helpers/client-harness.mjs';
const open=app=>nodes(app.render()).find(n=>n.props.role==='tab'&&n.props.key==='activity').props.onClick();
const record=(id,status,repository='alpha')=>({id,sessionId:'session-test',workspaceRoot:'D:/workspace',repository,operation:'stage',status,startedAt:1700000000000,...(status!=='running'?{finishedAt:1700000001000,durationMs:1000}:{}),fileCount:1});
test('activity survives remount through host query, filters repositories and never retries unknown operations',async()=>{
 const records=[record('1','running'),record('2','success','group/beta'),{...record('3','unknown'),errorCode:'OUTCOME_UNKNOWN'}];
 const transport=async(action,body)=>action==='repositories'?ok(repos):action==='overview'?ok(overview(body.repository)):ok({records,persistent:false});
 const app=await harness(transport);app.render();await app.flush();open(app);await app.flush();let tree=app.render();assert.ok(text(tree).includes('执行中'));assert.ok(text(tree).includes('结果待核实'));assert.ok(text(tree).includes('重启 DSH 会清空'));
 nodes(tree).find(n=>n.props['aria-label']==='只看当前仓库记录').props.onChange({target:{checked:true}});tree=app.render();assert.ok(!text(tree).includes('仓库：group/beta'));assert.equal(app.calls.filter(c=>c.action==='action').length,0);
 app.dispose();const remount=await harness(transport);remount.render();await remount.flush();open(remount);await remount.flush();assert.ok(text(remount.render()).includes('结果待核实'));
});
test('operation completion refreshes history and records remain available without an existing repository',async()=>{
 let done=false;const app=await harness(async(action,body)=>{if(action==='repositories')return ok(repos);if(action==='overview')return ok(overview(body.repository));if(action==='action'){done=true;return ok({});}assert.equal(action,'activity');return ok({records:done?[record('done','success')]:[],persistent:false});});
 app.render();await app.flush();app.button(app.render(),'暂存 file.txt').props.onClick();app.button(app.render(),'确认暂存').props.onClick();await app.flush();assert.ok(app.calls.some(c=>c.action==='activity'));open(app);await app.flush();assert.ok(text(app.render()).includes('成功'));
 const empty=await harness(async action=>action==='repositories'?ok({...repos,repositories:[]}):ok({records:[record('old','success')],persistent:false}));empty.render();await empty.flush();open(empty);await empty.flush();assert.ok(text(empty.render()).includes('成功'));
});
test('a scan resolving a new root releases stale activity loading state',async()=>{
 let finishScan,finishHistory;const app=await harness(async(action,body)=>{if(action==='repositories')return new Promise(resolve=>{finishScan=()=>resolve(ok(repos));});if(action==='overview')return ok(overview(body.repository));return new Promise(resolve=>{finishHistory=()=>resolve(ok({records:[record('stale','success','STALE-ROOT')],persistent:false}));});});
 app.render();open(app);await app.flush();assert.equal(app.button(app.render(),'读取中…').props.disabled,true);finishScan();await app.flush();assert.equal(app.button(app.render(),'刷新记录').props.disabled,false);finishHistory();await app.flush();assert.equal(app.button(app.render(),'刷新记录').props.disabled,false);assert.ok(!text(app.render()).includes('STALE-ROOT'));
});
test('late activity responses cannot replace another session history',async()=>{
 let finish;const app=await harness(async(action,body)=>{if(action==='repositories')return ok(repos);if(action==='overview')return ok(overview(body.repository));return new Promise(resolve=>{finish=()=>resolve(ok({records:[record('old','success','OLD-REPO')],persistent:false}));});});
 app.render();await app.flush();open(app);app.render('session-other');await app.flush();finish();await app.flush();assert.ok(!text(app.render('session-other')).includes('OLD-REPO'));
});
