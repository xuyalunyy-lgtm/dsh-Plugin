import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Config, apply } from '../lib/index.js';
import { CodexAdapter } from '../lib/adapter.js';
import { serializeRequest } from '../lib/serialize.js';

const request = { provider: 'codex', model: 'test-model', reasoningEffort: 'high', messages: [{ role: 'user', content: [{ type: 'text', text: 'offline fixture' }] }] };
const response = () => new Response('event: response.completed\ndata: {"type":"response.completed","response":{"output":[]}}\n\n', { headers: { 'content-type': 'text/event-stream' } });
const credentials = mode => ({ current: async () => ({ mode, baseURL: 'https://offline.invalid', accessToken: 'fixture', apiKey: 'fixture' }), refresh: async () => { throw new Error('unexpected credential refresh'); } });
async function consume(adapter) { for await (const chunk of adapter.stream(request)) { /* drain offline SSE */ } }

test('schema exposes volatile optional boolean with false default and rejects strings', () => {
  assert.equal(Config.dict.fastMode.meta.volatile, true);
  const parsed = Config['~standard'].validate({});
  assert.equal(parsed.value.fastMode.get(), false);
  assert.equal(Config['~standard'].validate({ fastMode: true }).value.fastMode.get(), true);
  assert.ok(Config['~standard'].validate({ fastMode: 'true' }).issues);
});
test('serializer emits only explicit priority; omitted/false keep the original body', () => {
  const original = serializeRequest(request);
  assert.equal(Object.hasOwn(original, 'service_tier'), false);
  for (const fastMode of [false, undefined, null, 'true', 1]) assert.deepEqual(serializeRequest(request, undefined, { fastMode }), original);
  assert.deepEqual(serializeRequest(request, undefined, { fastMode: true }), { ...original, service_tier: 'priority' });
  assert.equal(Object.hasOwn(serializeRequest({ ...request, fastMode: true }), 'service_tier'), false, 'only adapter configuration controls Fast');
});
for (const mode of ['chatgpt', 'apikey']) {
  test(`${mode} actual stream POST body tracks volatile true/false/true on one adapter`, async () => {
    let fastMode = true;
    let adapter;
    apply({ get: () => undefined, llm: { registerConfigurableProviders() {}, registerAdapter(_, value) { adapter = value; } } }, { fastMode: { get: () => fastMode }, writeBack: false });
    adapter.credentials = credentials(mode);
    const sent = [];
    adapter.transport = async () => ({ fetch: async (url, init) => { sent.push({ url, method: init.method, body: JSON.parse(init.body) }); return response(); } });
    for (const value of [true, false, true]) { fastMode = value; await consume(adapter); }
    assert.equal(sent.length, 3);
    assert.equal(sent[0].body.service_tier, 'priority');
    assert.equal(Object.hasOwn(sent[1].body, 'service_tier'), false);
    assert.equal(sent[2].body.service_tier, 'priority');
    for (const item of sent) {
      assert.equal(item.method, 'POST');
      assert.equal(item.url, mode === 'chatgpt' ? 'https://offline.invalid/codex/responses' : 'https://offline.invalid/responses');
      assert.equal(item.body.reasoning.effort, 'high');
    }
  });
}
test('unsupported priority 400 remains an error without silent fallback or retry', async () => {
  let calls = 0;
  const adapter = new CodexAdapter({ options: () => ({ fastMode: true }), credentials: credentials('chatgpt'), transport: async () => ({ fetch: async (_, init) => {
    calls++;
    assert.equal(JSON.parse(init.body).service_tier, 'priority');
    return new Response(JSON.stringify({ error: { message: 'priority unsupported for this model' } }), { status: 400 });
  } }) });
  await assert.rejects(() => consume(adapter), error => error.code === 'INVALID_REQUEST' && error.message.includes('priority unsupported'));
  assert.equal(calls, 1);
});
