import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual production request queue without emulating React or a DOM.
const source = await readFile(new URL('./client.js', import.meta.url), 'utf8');
const start = source.indexOf('      function act(action,args={}) {');
const end = source.indexOf('      const useStore=', start);
assert.ok(start >= 0 && end > start, 'production action queue must be discoverable');
const actionSource = source.slice(start, end);
function harness(request) {
  const patches = [];
  const context = vm.createContext({ request, publish: patch => patches.push({ ...patch }) });
  const act = vm.runInContext(`let queue=Promise.resolve(); ${actionSource}; act`, context);
  return { act, patches };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const busyChanges = patches => patches.filter(p => 'busy' in p).map(p => p.busy);

const requestStart = source.indexOf('      async function request(input){');
assert.ok(requestStart >= 0 && requestStart < start);
const requestSource = source.slice(requestStart, start);
function requestHarness() {
  const patches=[];
  const state={tasks:[],alerts:[],now:Date.now()};
  const context=vm.createContext({
    fetch:async()=>({ok:true,json:async()=>({ok:true,state})}),
    abort:{signal:undefined},publish:patch=>patches.push({...patch}),dead:false,notify:()=>{},
  });
  return {request:vm.runInContext(`${requestSource}; request`,context),patches};
}

test('successful polling updates state without clearing a failed task operation', async () => {
  const {request,patches}=requestHarness();
  await request({action:'read'});
  assert.ok(patches[0].state);
  assert.equal(patches[0].syncError,'');
  assert.equal('error' in patches[0],false);
});

test('successful mutation clears its own error independently from sync status', async () => {
  const {request,patches}=requestHarness();
  await request({action:'add',date:'2026-10-23',title:'test'});
  assert.equal(patches[0].error,'');
  assert.equal('syncError' in patches[0],false);
});

test('background reads never disable form controls, including while awaiting the response', async () => {
  const response = deferred();
  const { act, patches } = harness(() => response.promise);
  const pending = act('read');
  await flush();
  assert.deepEqual(busyChanges(patches), []);
  response.resolve({ tasks: [] });
  await pending;
  assert.deepEqual(busyChanges(patches), []);
  await act('read');
  assert.deepEqual(busyChanges(patches), []);
});

test('failed reads report an error without toggling input availability', async () => {
  const { act, patches } = harness(async () => { throw new Error('offline'); });
  assert.equal(await act('read'), null);
  assert.deepEqual(busyChanges(patches), []);
  assert.equal(patches.at(-1).syncError, 'offline');
});

test('writes still disable duplicate submission and release controls after failure', async () => {
  const response = deferred();
  const { act, patches } = harness(() => response.promise);
  const pending = act('add', { date: '2026-10-23', title: 'test' });
  await flush();
  assert.deepEqual(busyChanges(patches), [true]);
  response.reject(new Error('save failed'));
  assert.equal(await pending, null);
  assert.deepEqual(busyChanges(patches), [true, false]);
  assert.ok(patches.some(p => p.error === 'save failed'));
});

test('polls and writes stay serialized; queued polling adds no busy transitions', async () => {
  const response = deferred(), calls = [];
  const { act, patches } = harness(async input => {
    calls.push(input.action);
    if (input.action === 'read' && calls.length === 1) await response.promise;
    return input.action;
  });
  const read = act('read'), write = act('update', { id: 'task', done: true }), nextRead = act('read');
  await flush();
  assert.deepEqual(calls, ['read']);
  assert.deepEqual(busyChanges(patches), []);
  response.resolve();
  assert.deepEqual(await Promise.all([read, write, nextRead]), ['read', 'update', 'read']);
  assert.deepEqual(calls, ['read', 'update', 'read']);
  assert.deepEqual(busyChanges(patches), [true, false]);
});
