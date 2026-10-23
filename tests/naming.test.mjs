import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const text = name => readFile(new URL(name, root), 'utf8');

test('plugin naming, runtime IDs and lockfile metadata remain consistent', async () => {
  const manifest = JSON.parse(await text('package.json'));
  const lock = JSON.parse(await text('package-lock.json'));
  assert.equal(manifest.name, 'dsh-document-search');
  assert.equal(lock.name, manifest.name);
  assert.equal(lock.packages[''].name, manifest.name);
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[''].version, manifest.version);
  const client = await text('src/client.cjs');
  const patch = await text('cordis.patch.yml');
  const build = await text('build.mjs');
  assert.ok(client.includes("const ID = '" + manifest.name + "'"));
  assert.ok(build.includes("id:'" + manifest.name + "'"));
  assert.match(patch, /id: dsh-document-search\s+name: dsh-document-search/);
  for (const source of [client, patch, build]) assert.ok(!source.includes('@local/dsh-document-body-search'));
  assert.equal(JSON.parse(await text('locale/zh.json')).meta.title, '文档搜索');
  assert.equal(JSON.parse(await text('locale/en.json')).meta.title, 'Document Search');
});
