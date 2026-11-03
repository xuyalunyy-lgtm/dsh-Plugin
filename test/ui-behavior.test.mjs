import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Presentation-only release guard: hash the unchanged operation blocks, not a mock DOM.
// Intentional future behavior changes should update these alongside behavioral tests.
const source = (await readFile(new URL('../client.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
for (const [name, start, end, expected] of [
  ['requests, mount cleanup and frozen-revision saves', '          async function run(action, extra) {', '          const button =', 'e4cb52013752c13b975dc409db28c12b801691549e73e6dbf82503edc01ce823'],
  ['quota freshness and single-open refresh rules', '    function integerPreference', '    return {\n      inject:', '99cdd53aaab25b3ef270f6fec86f93c09d521c94a23a30085914a942a8896e55'],
  ['clipboard permissions and cleanup', '          async function copyReport() {', '          const quotaWindows', '00dcd6991bdd44f254d43aa1495c8276e8381418e8d47bc5e0bdc161a6715b3e'],
]) {
  test(`UI redesign preserves ${name}`, () => {
    const a = source.indexOf(start), b = source.indexOf(end, a);
    assert.ok(a >= 0 && b > a);
    assert.equal(createHash('sha256').update(source.slice(a, b)).digest('hex'), expected);
  });
}
