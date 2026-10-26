import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeCallId, serializeMessages } from '../lib/serialize.js';

function pairedCallIds(id) {
  const messages = [
    {
      role: 'assistant',
      content: [{ type: 'tool-call', id, name: 'run_code', arguments: '{}' }],
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool-result',
          toolCallId: id,
          content: [{ type: 'text', text: 'ok' }],
        },
      ],
    },
  ];
  return serializeMessages(messages, [])
    .filter((item) => Object.hasOwn(item, 'call_id'))
    .map((item) => item.call_id);
}

test('normalizes foreign history call IDs for Responses API replay', () => {
  const longId =
    'call_ff5c0df8e42749068c868bd1|fc_02178672417344200000000000000000000ffffac174e11519098';
  const neighborId =
    'call_ff5c0df8e42749068c868bd1|fc_12178672417344200000000000000000000ffffac174e11519098';

  const [callId, resultCallId] = pairedCallIds(longId);
  assert.equal(callId, resultCallId);
  assert.equal(callId.length, 64);
  assert.match(callId, /^[a-zA-Z0-9_-]+$/);
  assert.notEqual(callId, normalizeCallId(neighborId));
});

test('preserves already valid Responses API call IDs', () => {
  const id = 'call_abc-123_XYZ';
  assert.deepEqual(pairedCallIds(id), [id, id]);
});

test('normalizes forbidden call ID characters deterministically', () => {
  const id = 'provider/call+id=with|punctuation';
  const normalized = normalizeCallId(id);
  assert.equal(normalized, normalizeCallId(id));
  assert.equal(normalized.length, 64);
  assert.match(normalized, /^[a-zA-Z0-9_-]+$/);
});

test('maps harness tool messages to function_call_output', () => {
  const messages = [
    { role: 'assistant', content: [{ type: 'tool-call', id: 'call_1', name: 'pwsh', arguments: '{}' }] },
    { role: 'tool', toolCallId: 'call_1', content: [{ type: 'text', text: 'hi' }] },
  ];
  const input = serializeMessages(messages, []);
  assert.deepEqual(input[0], { type: 'function_call', call_id: 'call_1', name: 'pwsh', arguments: '{}' });
  assert.deepEqual(input[1], { type: 'function_call_output', call_id: 'call_1', output: 'hi' });
});

test('keeps an empty tool output representable', () => {
  const input = serializeMessages([{ role: 'tool', toolCallId: 'call_2', content: [] }], []);
  assert.equal(input[0].output, '(no output)');
});

test('serializes image blocks with resolved data URLs', () => {
  const images = new Map([['att_1', 'data:image/png;base64,AAAA']]);
  const input = serializeMessages(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'look' },
          { type: 'image', attachment: { attachmentId: 'att_1', mediaType: 'image/png' } },
        ],
      },
    ],
    [],
    images,
  );
  assert.deepEqual(input[0].content, [
    { type: 'input_text', text: 'look' },
    { type: 'input_image', image_url: 'data:image/png;base64,AAAA' },
  ]);
});

test('refuses to drop an unresolved image silently', () => {
  const messages = [
    { role: 'user', content: [{ type: 'image', attachment: { attachmentId: 'att_x', mediaType: 'image/png' } }] },
  ];
  assert.throws(() => serializeMessages(messages, []), /图片附件缺少请求字节/);
});

test('collects system messages into instructions instead of input', () => {
  const systemParts = [];
  const input = serializeMessages(
    [
      { role: 'system', content: [{ type: 'text', text: 'be brief' }] },
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
    ],
    systemParts,
  );
  assert.equal(input.length, 1);
  assert.deepEqual(systemParts, ['be brief']);
});
