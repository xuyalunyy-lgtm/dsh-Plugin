import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {apply} from '../index.js';

test('host registers only authenticated connection routes and rejects invalid input',async()=>{
 const routes=[];
 apply({connection:{fetch:{register:r=>routes.push(r)}},sessions:{get:()=>undefined},get:()=>undefined,sandboxPolicy:{workspaceRoot:process.cwd()}});
 assert.deepEqual(routes.map(route=>route.path),['repositories','snapshot','diff','details','action','overview','preview','summary','branchMetadata','activity'].map(name=>'/api/git-visualizer/'+name));
 assert.equal(routes.length,10);
 for(const r of routes){
  assert.deepEqual(r.methods,['POST']);
  assert.ok(r.path.startsWith('/api/git-visualizer/'));
  const req=body=>new Request('http://localhost'+r.path,{method:'POST',body});
  assert.equal((await r.fetch(req('{'))).status,400);
  for(const body of ['{}','null','[]','"text"','1']) assert.equal((await r.fetch(req(body))).status,400);
  assert.equal((await r.fetch(req(JSON.stringify({sessionId:'../../other'})))).status,400);
  assert.equal((await r.fetch(req(JSON.stringify({sessionId:'session-missing'})))).status,404);
  assert.equal((await r.fetch(req('x'.repeat(16385)))).status,413);
 }
});

test('client bundle registers Git tab and body with the module loader',async()=>{
 let plugin,definition;const slots=[];
 const React={createElement:()=>null};
 vm.runInNewContext(await readFile(new URL('../client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:entry=>{assert.equal(entry.id,'dsh-git-visualizer');plugin=entry.factory(name=>{assert.equal(name,'react');return React;});}}}});
 const ctx={effect:fn=>fn(),sidebarRightTabs:{register:d=>{definition=d;}},slots:{inject:(_name,fn)=>fn(),register:(d,component)=>{slots.push({d,component});}}};
 plugin.apply(ctx);
 assert.equal(definition.kind,'git-visualizer');assert.equal(definition.priority,'extension');
 assert.equal(slots.length,2);assert.equal(typeof slots[0].component,'function');
});
