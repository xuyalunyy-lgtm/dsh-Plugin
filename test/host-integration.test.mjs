import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../index.js';
import { DEFAULT_STATE } from '../host-store.js';

async function harness() {
  const routes = new Map(), tools = new Map(), effects = [];
  let stored, closed = false, spec;
  const images = new Map();
  const ctx = {
    storageDomain: { async open(s) { spec = s; stored = structuredClone(s.global.initial); s.global.schema.parse(stored);
      return { global: { get:()=>stored, set:async v=>{ s.global.schema.parse(v); stored=structuredClone(v); } },
        table:()=>({get:k=>images.get(k),entries:()=>images.entries(),put:async(k,v)=>{s.tables.images.valueSchema.parse(v);images.set(k,structuredClone(v));},delete:async k=>images.delete(k)}),
        close:async()=>{closed=true;} };
    } },
    connection: { fetch: { register(route) { routes.set(route.path,route); return async()=>routes.delete(route.path); } } },
    tools: { register(tool) { tools.set(tool.name,tool); return ()=>tools.delete(tool.name); } },
    effect(fn) { const cleanup=fn(); effects.push(cleanup); },
  };
  await apply(ctx);
  const post = async input => {
    const response = await routes.get('/api/qinglan-theme').fetch(new Request('http://localhost/api/qinglan-theme', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}));
    return { status:response.status, body:await response.json() };
  };
  return { routes,tools,effects,post,get closed(){return closed;},get spec(){return spec;} };
}
test('registers authenticated Connection routes, real Zod schemas and shared tool', async()=>{
  const x=await harness();
  assert.equal(x.spec.layout,'per-record'); assert.equal(x.spec.name,'local-qinglan-theme');
  assert.equal(x.routes.get('/api/qinglan-theme').requestBody,'streaming');
  const reply=await x.post({action:'read'});
  assert.equal(reply.status,200); assert.equal(reply.body.value.revision,0);
  assert.deepEqual(reply.body.value,await x.tools.get('qinglan_theme').execute({action:'read'}));
});
test('tool and UI use identical committed state and conflicts return 409',async()=>{
  const x=await harness();
  await x.tools.get('qinglan_theme').execute({action:'update',expectedRevision:0,patch:{palette:'rose'}});
  const stale=await x.post({action:'update',expectedRevision:0,patch:{palette:'sky'}});
  assert.equal(stale.status,409); assert.equal(stale.body.code,'CONFLICT');
  const current=await x.post({action:'read'}); assert.equal(current.body.value.state.palette,'rose');
});
test('image endpoint awaits repository and returns exact MIME and bytes',async()=>{
  const x=await harness(); const bytes=Buffer.from([137,80,78,71,13,10,26,10,0,1,2,3]);
  const update=await x.post({action:'update',expectedRevision:0,patch:{image:'data:image/png;base64,'+bytes.toString('base64')}});
  const id=update.body.value.state.imageId;
  const response=await x.routes.get('/api/qinglan-theme/image').fetch(new Request('http://localhost/api/qinglan-theme/image?id='+id));
  assert.equal(response.status,200); assert.equal(response.headers.get('Content-Type'),'image/png');
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  await x.post({action:'reset',expectedRevision:1});
  const gone=await x.routes.get('/api/qinglan-theme/image').fetch(new Request('http://localhost/api/qinglan-theme/image?id='+id));
  assert.equal(gone.status,404);
});
test('rejects incorrect media type, malformed JSON and oversized body',async()=>{
  const x=await harness(), route=x.routes.get('/api/qinglan-theme');
  assert.equal((await route.fetch(new Request('http://localhost/api/qinglan-theme',{method:'POST',body:'text'}))).status,415);
  assert.equal((await route.fetch(new Request('http://localhost/api/qinglan-theme',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'}))).status,400);
  assert.equal((await route.fetch(new Request('http://localhost/api/qinglan-theme',{method:'POST',headers:{'Content-Type':'application/json'},body:' '.repeat(4300001)}))).status,413);
  assert.equal((await x.post({action:'read'})).body.value.revision,0);
});
test('stopping rejects retained route and tool closures before closing domain',async()=>{
  const x=await harness(); await x.effects[0](); assert.equal(x.closed,true);
  await assert.rejects(x.tools.get('qinglan_theme').execute({action:'read'}),{code:'UNAVAILABLE'});
  assert.equal((await x.post({action:'read'})).body.code,'UNAVAILABLE');
});
test('migration preserves original Host preferences',async()=>{
  const x=await harness();
  const migrated=await x.post({action:'importLegacy',expectedRevision:0,patch:{palette:'sky',image:''}});
  assert.equal(migrated.body.value.initialized,true);
  const second=await x.post({action:'importLegacy',expectedRevision:1,patch:{palette:'rose'}});
  assert.equal(second.body.value.state.palette,'sky'); assert.equal(second.body.value.revision,1);
  assert.deepEqual((await x.post({action:'reset',expectedRevision:1})).body.value.state,DEFAULT_STATE);
});
