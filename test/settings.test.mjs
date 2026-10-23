import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// Pure logic tests only: no React/DOM emulation or artificial screenshot renderer.
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
function extract(name, scope = {}) {
  const match = source.match(new RegExp(`    function ${name}\\([^]*?\\n    \\}`));
  assert.ok(match, `missing helper ${name}`);
  return runInNewContext('(' + match[0] + ')', scope);
}
const createSaveQueue = extract('createSaveQueue');
function setup(commit) {
  let counter = 0;
  const tasks = new Map(), writes = [];
  const queue = createSaveQueue(commit || (v => { writes.push(v); return true; }),
    (fn, delay) => { assert.equal(delay, 250); const id = ++counter; tasks.set(id, fn); return id; },
    id => tasks.delete(id));
  return { queue, tasks, writes, tick() { for (const fn of [...tasks.values()]) fn(); } };
}
test('rapid slider input writes only the latest value after idle', () => {
  const x = setup();
  for (let i = 0; i < 100; i++) x.queue.enqueue({ opacity: i }, true);
  assert.equal(x.writes.length, 0);
  assert.equal(x.tasks.size, 1);
  x.tick();
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].opacity, 99);
  assert.equal(x.tasks.size, 0);
});
test('flush on release or page exit saves once and cancels timer', () => {
  const x = setup(); x.queue.enqueue({ blur: 8 }, true);
  assert.equal(x.queue.flush(), true);
  x.queue.flush(); x.tick();
  assert.equal(x.writes.length, 1);
  assert.equal(x.tasks.size, 0);
});
test('immediate upload/reset replaces a pending slider save', () => {
  const x = setup();
  x.queue.enqueue({ image: 'old', opacity: 9 }, true);
  x.queue.enqueue({ image: 'new', opacity: 9 });
  x.tick();
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].image, 'new');
});
test('discard prevents stale writes after an external storage update', () => {
  const x = setup(); x.queue.enqueue({ palette: 'old' }, true);
  x.queue.discard(); x.tick(); x.queue.flush();
  assert.equal(x.writes.length, 0);
  assert.equal(x.tasks.size, 0);
});
test('failed save returns failure without retry loop', () => {
  let calls = 0;
  const x = setup(() => { calls++; return false; });
  assert.equal(x.queue.enqueue({ opacity: 8 }), false);
  x.tick(); x.queue.flush();
  assert.equal(calls, 1);
});
test('failed deferred save does not leave timer or stale pending data', () => {
  let calls = 0;
  const x = setup(() => { calls++; return false; });
  x.queue.enqueue({ blur: 6 }, true); x.tick(); x.queue.flush();
  assert.equal(calls, 1); assert.equal(x.tasks.size, 0);
});
const defaults = runInNewContext('(' + source.match(/const defaults = (\{[^\n]+\});/)[1] + ')');
const backgroundReset = extract('backgroundReset', { defaults });
test('reset parameters preserves image, palette and enabled state', () => {
  const old = { image: 'data:image/png;base64,AAAA', name: 'keep.png', palette: 'rose', enabled: false, opacity: 24, blur: 15, fit: 'contain', pattern: false };
  const reset = { ...old, ...backgroundReset() };
  for (const key of ['image', 'name', 'palette', 'enabled']) assert.equal(reset[key], old[key]);
  for (const key of ['opacity', 'blur', 'fit', 'pattern']) assert.equal(reset[key], defaults[key]);
});
const layerPresentation = extract('layerPresentation');
test('preview and global layers use the same enable and opacity rules', () => {
  assert.equal(layerPresentation({ ...defaults, opacity: 9 }).opacity, .09);
  assert.equal(layerPresentation({ ...defaults, blur: 4 }).blur, 'blur(4px)');
  assert.equal(layerPresentation({ ...defaults, fit: 'contain', blur: 0 }).imageInset, 0);
  assert.equal(layerPresentation({ ...defaults, fit: 'contain', blur: 8 }).imageInset, 0);
  assert.equal(layerPresentation({ ...defaults, fit: 'cover' }).imageInset, -20);
  assert.match(source, /inset: presentation.imageInset, \.\.\.artwork\(s\)/);
  assert.equal(layerPresentation({ ...defaults, enabled: false, image: 'image' }).visible, false);
  assert.equal(layerPresentation({ ...defaults, image: '', pattern: false }).visible, false);
  assert.equal(layerPresentation({ ...defaults, image: 'image', pattern: false }).visible, true);
  assert.match(source, /h\(BackgroundLayers, \{ settings: s, fixed: true \}\)/);
  assert.match(source, /h\(BackgroundLayers, \{ settings: s \}\)/);
});
test('reset all is guarded by an explicit confirmation action', () => {
  assert.match(source, /button\('resetAll', \(\) => \{ saves.flush\(\); setConfirming\(true\); \}/);
  assert.match(source, /button\('confirmReset', \(\) => \{ generation.current\+\+; change\(defaults\)/);
  assert.match(source, /button\('cancel', closeConfirmation/);
});
test('external storage refresh reads current authority and invalidates image decoding', () => {
  assert.doesNotMatch(source, /JSON.parse\(event.newValue/);
  assert.match(source, /const next = sanitize\(JSON.parse\(localStorage.getItem\(KEY\)/);
  assert.match(source, /externalRevision\+\+/);
  assert.match(source, /sourceRevision !== externalRevision/);
});
test('page, visibility and component cleanup flush queued settings', () => {
  assert.match(source, /addEventListener\('pagehide', flush\)/);
  assert.match(source, /removeEventListener\('pagehide', flush\)/);
  assert.match(source, /generation.current\+\+; saves.flush\(\);/);
  assert.match(source, /state = savedState; saveStatus = 'failed'/);
});
