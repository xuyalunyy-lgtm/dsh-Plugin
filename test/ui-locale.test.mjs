import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
// Read only inert localization dictionaries. No React or DOM execution.
const begin = source.indexOf('    const dictionaries = ');
const end = source.indexOf('    const css =', begin);
assert.ok(begin >= 0 && end > begin);
const dictionaries = runInNewContext(source.slice(begin, end) + '\ndictionaries');
test('Chinese and English management labels have matching keys', () => {
  assert.deepEqual(Object.keys(dictionaries.zh).sort(), Object.keys(dictionaries.en).sort());
});
test('all literal UI translations resolve in both locales', () => {
  for (const match of source.matchAll(/\bt\('([^']+)'\)/g)) {
    for (const locale of ['zh', 'en']) assert.equal(typeof dictionaries[locale][match[1]], 'string', `${locale}:${match[1]}`);
  }
});
