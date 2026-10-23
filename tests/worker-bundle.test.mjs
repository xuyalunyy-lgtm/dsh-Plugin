import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import vm from 'node:vm';

// Exercise the actual client import declaration and .mjs text-loader semantics.
// No fake browser, React, or DOM: validate the exact Blob payload as an ES module.
test('bundled worker produces JavaScript text, not an ES module namespace object', async () => {
  const client = await readFile(new URL('../src/client.cjs', import.meta.url), 'utf8');
  const declaration = client.match(/^const workerSource = .*;$/m)?.[0];
  assert.ok(declaration);
  const result = await build({
    stdin: { contents: declaration + '\nmodule.exports = workerSource;', resolveDir: process.cwd(), loader: 'js' },
    bundle: true, platform: 'browser', format: 'cjs', write: false,
    plugins: [{ name: 'local-worker-source', setup(b) {
      b.onLoad({ filter: /pdf\.worker\.mjs$/ }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
    } }],
  });
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(result.outputFiles[0].text, sandbox, { timeout: 5000 });
  assert.equal(typeof sandbox.module.exports, 'string');
  const payload = await new Blob([sandbox.module.exports], { type: 'text/javascript' }).text();
  assert.notEqual(payload, '[object Object]');
  const worker = await import('data:text/javascript;base64,' + Buffer.from(payload).toString('base64'));
  assert.equal(typeof worker.WorkerMessageHandler.setup, 'function');
});
