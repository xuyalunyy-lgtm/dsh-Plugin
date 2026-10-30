import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const extract = (name, scope = {}) => runInNewContext('(' + source.match(new RegExp(`    function ${name}\\([^]*?\\n    \\}`))[0] + ')', scope);
const createSaveQueue = extract('createSaveQueue');
const createRemotePreferences = extract('createRemotePreferences', { createSaveQueue });
const initial = { palette: 'green', image: '', opacity: 12 };
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
function harness() {
  let server = { revision: 0, initialized: false, state: { ...initial } };
  const calls = [], events = [], timers = new Map(); let id = 0, hook;
  const request = async input => {
    calls.push(JSON.parse(JSON.stringify(input)));
    if (hook) return hook(input);
    if (input.action === 'read') return structuredClone(server);
    if (input.expectedRevision !== server.revision) throw Object.assign(new Error('conflict'), { code:'CONFLICT' });
    server = { revision: server.revision + 1, initialized:true, state: input.action === 'reset' ? {...initial} : {...server.state,...input.patch} };
    return structuredClone(server);
  };
  const store = createRemotePreferences({ request, initial, materialize: r => r.state,
    changed: x => events.push(x), schedule: (fn) => { timers.set(++id,fn); return id; }, cancel: n => timers.delete(n) });
  return { store, calls, events, timers, tick() { for (const fn of [...timers.values()]) fn(); return store.idle(); },
    get server(){return server;}, set server(v){server=v;}, set hook(v){hook=v;}, get request(){return request;} };
}
test('does not mutate before Host baseline is loaded', async () => {
  const x=harness(); assert.equal(x.store.update(initial),false); await x.store.load();
  assert.equal(x.store.snapshot().ready,true); assert.equal(x.calls.length,1);
});
test('many slider previews are coalesced to one Host write', async () => {
  const x=harness(); await x.store.load();
  for(let i=0;i<20;i++) x.store.update({...initial,opacity:i},true);
  assert.equal(x.calls.length,1); assert.equal(x.store.snapshot().value.opacity,19);
  await x.tick(); assert.equal(x.calls.length,2); assert.equal(x.server.state.opacity,19);
});
test('unchanged Host image is not uploaded when changing a slider', async () => {
  const x=harness(); x.server={revision:1,initialized:true,state:{...initial,image:'https://host/image?id=x'}};
  await x.store.load(); await x.store.update({...x.store.snapshot().value,opacity:8});
  assert.equal(Object.hasOwn(x.calls[1].patch,'image'),false);
});
test('new image data and explicit removal are sent', async () => {
  const x=harness(); await x.store.load();
  await x.store.update({...initial,image:'data:image/png;base64,AAAA'});
  assert.equal(x.calls[1].patch.image,'data:image/png;base64,AAAA');
  await x.store.update({...initial,image:''}); assert.equal(x.calls[2].patch.image,'');
});
test('a slow earlier reply does not overwrite a newer preview; writes use latest revision', async () => {
  const x=harness(); await x.store.load(); const gate=deferred();
  x.hook=async input => {
    if (input.patch.opacity===3) return gate.promise;
    assert.equal(input.expectedRevision,1);
    return {revision:2,initialized:true,state:{...initial,opacity:9}};
  };
  const first=x.store.update({...initial,opacity:3}); await Promise.resolve();
  const second=x.store.update({...initial,opacity:9},true);
  gate.resolve({revision:1,initialized:true,state:{...initial,opacity:3}}); await first;
  assert.equal(x.store.snapshot().value.opacity,9);
  await x.tick(); assert.equal(x.store.snapshot().revision,2); assert.equal(x.store.snapshot().status,'saved');
});
test('conflict loads authority, cancels old drafts and advances upload invalidation epoch', async () => {
  const x=harness(); await x.store.load();
  x.server={revision:4,initialized:true,state:{...initial,palette:'rose'}};
  await x.store.update({...initial,palette:'sky'});
  assert.equal(x.store.snapshot().value.palette,'rose'); assert.equal(x.store.snapshot().status,'conflict');
  assert.equal(x.store.snapshot().epoch,1); assert.equal(x.store.snapshot().ready,true);
});
test('failed write plus failed recovery blocks edits until successful reload', async () => {
  const x=harness(); await x.store.load(); x.hook=async()=>{throw new Error('offline');};
  await x.store.update({...initial,opacity:4}); assert.equal(x.store.snapshot().ready,false);
  assert.equal(x.store.update(initial),false); x.hook=null; await x.store.load();
  assert.equal(x.store.snapshot().ready,true);
});
test('refresh does not discard an unsaved slider preview', async () => {
  const x=harness(); await x.store.load(); x.store.update({...initial,opacity:8},true);
  await x.store.load(); assert.equal(x.calls.length,1); assert.equal(x.store.snapshot().value.opacity,8);
  await x.tick();
});
test('reset is ordered after queued save and restores server authority', async () => {
  const x=harness(); await x.store.load(); x.store.update({...initial,opacity:5},true);
  await x.store.action('reset'); assert.equal(x.calls[1].action,'update'); assert.equal(x.calls[2].expectedRevision,1);
  assert.equal(x.store.snapshot().value.opacity,12);
});
test('concurrent focus and visibility loads share one request and cannot erase subsequent edits', async () => {
  const x=harness(); await x.store.load(); const gate=deferred();
  x.hook=async input=>input.action==='read' ? gate.promise : {revision:2,initialized:true,state:{...initial,...input.patch}};
  const a=x.store.load(), b=x.store.load(); assert.equal(a,b);
  await Promise.resolve(); assert.equal(x.store.snapshot().ready,false);
  assert.equal(x.store.update({...initial,palette:'rose'}),false);
  gate.resolve({revision:1,initialized:true,state:{...initial,palette:'sky'}}); await a; await b;
  await x.store.update({...x.store.snapshot().value,palette:'rose'});
  assert.equal(x.store.snapshot().value.palette,'rose');
  assert.equal(x.calls.filter(c=>c.action==='read').length,2);
});
test('dispose flushes pending work once but never notifies disposed UI', async () => {
  const x=harness(); await x.store.load(); x.store.update({...initial,opacity:7},true);
  x.store.dispose(); const count=x.events.length; await x.store.idle();
  assert.equal(x.events.length,count); assert.equal(x.server.state.opacity,7); assert.equal(x.timers.size,0);
});
