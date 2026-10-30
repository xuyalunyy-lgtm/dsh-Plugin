import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATE, INITIAL_DOCUMENT, validDocument, validImageRecord, ThemeRepository } from '../host-store.js';

const clone = value => structuredClone(value);
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
const jpeg = Buffer.from([255, 216, 255, 224, 0]);
const webp = Buffer.from('RIFFxxxxWEBPpayload');
const dataURL = (bytes = png, mime = 'image/png') => `data:${mime};base64,${bytes.toString('base64')}`;
function backing() { return { document: clone(INITIAL_DOCUMENT), images: new Map(), events: [], fail: null, gate: null }; }
// Models durable-before-memory semantics and gives each restart its own in-memory handles.
function domain(store = backing()) {
  let document = clone(store.document);
  const images = new Map([...store.images].map(([k, v]) => [k, clone(v)]));
  const table = {
    get: id => images.get(id),
    entries: () => images.entries(),
    async put(id, value) {
      store.events.push(['put', id]);
      if (store.fail === 'put') throw new Error('put failure');
      store.images.set(id, clone(value)); images.set(id, clone(value));
    },
    async delete(id) {
      store.events.push(['delete', id]);
      assert.notEqual(store.document.current.imageId, id, 'never delete durably referenced image');
      if (store.fail === 'delete') throw new Error('delete failure');
      store.images.delete(id); return images.delete(id);
    },
  };
  return {
    store,
    global: {
      get: () => document,
      async set(value) {
        store.events.push(['set', value.current.imageId]);
        if (store.gate) await store.gate;
        if (store.fail === 'set') throw new Error('set failure');
        store.document = clone(value); document = clone(value);
      },
    },
    table(name) { assert.equal(name, 'images'); return table; },
  };
}
const update = (repo, patch, expectedRevision = 0) => repo.execute({ action: 'update', patch, expectedRevision });
const read = repo => repo.execute({ action: 'read' });
const invalid = operation => assert.rejects(operation, { code: 'INVALID_INPUT' });

test('defaults and exported predicates are strict and frozen', () => {
  assert.equal(validDocument(INITIAL_DOCUMENT), true);
  assert.equal(Object.isFrozen(DEFAULT_STATE), true);
  assert.equal(Object.isFrozen(INITIAL_DOCUMENT), true);
  assert.equal(validDocument({ ...INITIAL_DOCUMENT, extra: 1 }), false);
  assert.equal(validDocument({ ...INITIAL_DOCUMENT, current: { ...DEFAULT_STATE, image: '' } }), false);
  assert.equal(validDocument({ ...INITIAL_DOCUMENT, revision: -1 }), false);
  assert.equal(validDocument({ ...INITIAL_DOCUMENT, initialized: 'yes' }), false);
  assert.equal(validDocument({ ...INITIAL_DOCUMENT, current: { ...DEFAULT_STATE, imageId: '../file' } }), false);
  assert.equal(validDocument(Object.create(INITIAL_DOCUMENT)), false);
  assert.equal(validImageRecord({ mime: 'image/png', data: png.toString('base64') }), true);
  assert.equal(validImageRecord({ mime: 'image/png', data: png.toString('base64'), extra: 1 }), false);
});

test('restart preserves document and separate image; snapshots contain no bytes', async () => {
  const store = backing();
  let repo = new ThemeRepository(domain(store));
  assert.deepEqual(await read(repo), { revision: 0, initialized: false, state: DEFAULT_STATE, presets: [] });
  const saved = await update(repo, { palette: 'forest', image: dataURL(), name: 'forest.png' });
  assert.equal(saved.revision, 1);
  assert.equal(saved.initialized, true);
  assert.match(saved.state.imageId, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(saved).includes('base64'), false);
  assert.equal(Object.hasOwn(saved.state, 'image'), false);
  await repo.drain();
  repo = new ThemeRepository(domain(store));
  assert.deepEqual(await read(repo), saved);
  assert.deepEqual(await repo.readImage(saved.state.imageId), { mime: 'image/png', data: png.toString('base64') });
});

test('all twelve palettes and boundary values are accepted', async () => {
  const repo = new ThemeRepository(domain());
  let revision = 0;
  for (const palette of ['green', 'apricot', 'forest', 'sky', 'lavender', 'rose', 'mint', 'silver', 'midnight', 'plum', 'coffee', 'graphite']) {
    await update(repo, { palette, opacity: 25, blur: 16, name: 'x'.repeat(200), enabled: false, pattern: false, fit: 'repeat' }, revision++);
  }
  await update(repo, { opacity: 0, blur: 0, fit: 'contain' }, revision);
});

test('exact revisions required and stale reset/import/update conflict', async () => {
  const repo = new ThemeRepository(domain());
  await update(repo, { palette: 'rose' });
  for (const action of ['update', 'importLegacy', 'reset']) {
    const request = { action, expectedRevision: 0, ...(action === 'reset' ? {} : { patch: {} }) };
    await assert.rejects(repo.execute(request), { code: 'CONFLICT' });
  }
  assert.equal((await read(repo)).state.palette, 'rose');
});

test('legacy initializes once; initialized Host is never overwritten', async () => {
  const store = backing();
  const repo = new ThemeRepository(domain(store));
  const first = await repo.execute({ action: 'importLegacy', expectedRevision: 0, patch: { palette: 'sky', image: dataURL() } });
  const eventCount = store.events.length;
  assert.deepEqual(await repo.execute({ action: 'importLegacy', expectedRevision: 1, patch: { palette: 'coffee', image: '' } }), first);
  assert.equal(store.events.length, eventCount);
  const restarted = new ThemeRepository(domain(store));
  assert.deepEqual(await restarted.execute({ action: 'importLegacy', expectedRevision: 1, patch: { palette: 'green' } }), first);
  await restarted.execute({ action: 'reset', expectedRevision: 1 });
  assert.deepEqual((await restarted.execute({ action: 'importLegacy', expectedRevision: 2, patch: { palette: 'rose' } })).state, DEFAULT_STATE);
});

test('image omission retains, empty removes, reset restores defaults', async () => {
  const d = domain(); const repo = new ThemeRepository(d);
  const first = await update(repo, { image: dataURL(), opacity: 23 });
  const second = await update(repo, { blur: 4 }, 1);
  assert.equal(second.state.imageId, first.state.imageId);
  const third = await update(repo, { image: '' }, 2);
  assert.equal(third.state.imageId, null);
  assert.equal(await repo.readImage(first.state.imageId), undefined);
  assert.equal(d.store.images.size, 0);
  const reset = await repo.execute({ action: 'reset', expectedRevision: 3 });
  assert.deepEqual(reset, { revision: 4, initialized: true, state: DEFAULT_STATE, presets: [] });
});

test('content-addressed rows are reused, not rewritten, and only current image is accessible', async () => {
  const d = domain(); const repo = new ThemeRepository(d);
  const first = await update(repo, { image: dataURL() });
  await update(repo, { image: dataURL() }, 1);
  assert.equal(d.store.events.filter(([op]) => op === 'put').length, 1);
  d.store.fail = 'delete';
  const next = await update(repo, { image: dataURL(jpeg, 'image/jpeg') }, 2);
  assert.equal(d.store.images.size, 2);
  assert.equal(await repo.readImage(first.state.imageId), undefined);
  assert.equal((await repo.readImage(next.state.imageId)).mime, 'image/jpeg');
  assert.equal(await repo.readImage('0'.repeat(64)), undefined);
  await invalid(repo.readImage('../../secret'));
});

test('failed image put leaves old document and old image intact; queue recovers', async () => {
  const d = domain(); const repo = new ThemeRepository(d);
  const first = await update(repo, { image: dataURL(), palette: 'mint' });
  d.store.fail = 'put';
  await assert.rejects(update(repo, { image: dataURL(jpeg, 'image/jpeg'), palette: 'coffee' }, 1), /put failure/);
  assert.deepEqual(await read(repo), first);
  assert.equal(d.store.images.size, 1);
  assert.ok(await repo.readImage(first.state.imageId));
  d.store.fail = null;
  assert.equal((await update(repo, { palette: 'sky' }, 1)).revision, 2);
});

test('failed global durability preserves prior preferences across restart; orphan cleaned later', async () => {
  const d = domain(); const repo = new ThemeRepository(d);
  const first = await update(repo, { image: dataURL(), palette: 'mint' });
  d.store.fail = 'set';
  await assert.rejects(update(repo, { image: dataURL(jpeg, 'image/jpeg'), palette: 'coffee' }, 1), /set failure/);
  assert.deepEqual(await read(repo), first);
  assert.equal(d.store.images.size, 2);
  assert.ok(await repo.readImage(first.state.imageId));
  const restarted = new ThemeRepository(domain(d.store));
  assert.deepEqual(await read(restarted), first);
  d.store.fail = null;
  await update(restarted, { blur: 3 }, 1);
  assert.equal(d.store.images.size, 1);
  const events = d.store.events;
  assert.ok(events.findIndex(([op]) => op === 'delete') > events.findLastIndex(([op]) => op === 'set'));
});

test('failed reset and image removal do not delete referenced image', async () => {
  for (const action of ['reset', 'update']) {
    const d = domain(); const repo = new ThemeRepository(d);
    const first = await update(repo, { image: dataURL() });
    d.store.fail = 'set';
    await assert.rejects(repo.execute({ action, expectedRevision: 1, ...(action === 'update' ? { patch: { image: '' } } : {}) }), /set failure/);
    assert.deepEqual(await read(repo), first);
    assert.equal(d.store.images.size, 1);
    assert.equal(d.store.events.some(([op]) => op === 'delete'), false);
  }
});

test('PNG/JPEG/WebP accepted; wrong magic, noncanonical base64 and URLs rejected', async () => {
  const repo = new ThemeRepository(domain());
  let revision = 0;
  for (const [bytes, mime] of [[png, 'image/png'], [jpeg, 'image/jpeg'], [webp, 'image/webp']]) {
    await update(repo, { image: dataURL(bytes, mime) }, revision++);
  }
  for (const image of [dataURL(png, 'image/jpeg'), 'https://example.com/a.png', 'file:///tmp/a.png', 'C:\\a.png',
    'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,AAAA', 'data:image/png;base64,',
    dataURL().replace(/.$/, ' '), dataURL(jpeg, 'image/jpeg').replace(/=$/, ''), dataURL().replace('base64,', 'base64,\n'),
    'data:image/jpeg;base64,/9j/4AB=', 'data:image/jpeg;base64,/9j/4A===']) {
    await invalid(update(repo, { image }, revision));
  }
  assert.equal((await read(repo)).revision, revision);
});

test('3 MiB exact limit accepted; oversized bytes, strings and names rejected', async () => {
  const repo = new ThemeRepository(domain());
  const max = Buffer.alloc(3 * 1024 * 1024); png.copy(max);
  await update(repo, { image: dataURL(max) });
  const oversized = Buffer.alloc(max.length + 1); png.copy(oversized);
  await invalid(update(repo, { image: dataURL(oversized) }, 1));
  await invalid(update(repo, { image: 'x'.repeat(4 * 1024 * 1024 + 100) }, 1));
  await invalid(update(repo, { name: 'n'.repeat(201) }, 1));
  assert.equal((await read(repo)).revision, 1);
});

test('strict request shape and patch fields reject unknown keys, prototypes and accessors', async () => {
  const repo = new ThemeRepository(domain());
  const requests = [null, [], {}, { action: 'presets' }, { action: 'read', patch: {} }, { action: 'read', expectedRevision: 0 },
    { action: 'read', unknown: 1 }, { action: 'reset', expectedRevision: 0, patch: {} }, { action: 'update', patch: {} },
    { action: 'update', expectedRevision: 0 }, { action: 'update', expectedRevision: 0, patch: [] },
    Object.assign(Object.create({ inherited: true }), { action: 'read' }),
    JSON.parse('{"action":"read","__proto__":{}}'),
    { action: 'read', [Symbol('hidden')]: true },
    Object.defineProperty({}, 'action', { get() { throw new Error('must not call'); }, enumerable: true }),
  ];
  for (const request of requests) await invalid(repo.execute(request));
  const patches = [{ extra: 1 }, { imageId: null }, { opacity: 1.2 }, { opacity: NaN }, { opacity: Infinity },
    { opacity: -1 }, { opacity: 26 }, { blur: 17 }, { blur: -1 }, { blur: 0.5 }, { enabled: 1 }, { pattern: 'true' },
    { palette: 'toString' }, { fit: 'stretch' }, { name: null }, { image: null }, { image: undefined },
    JSON.parse('{"__proto__":{}}'), { constructor: {} }, Object.create({ palette: 'sky' }),
    Object.defineProperty({}, 'name', { value: 'hidden', enumerable: false }),
    Object.defineProperty({}, 'name', { get() { throw new Error('must not call'); }, enumerable: true }),
  ];
  for (const patch of patches) await invalid(update(repo, patch));
  for (const rev of [undefined, null, '0', -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) await invalid(repo.execute({ action: 'update', patch: {}, expectedRevision: rev }));
  assert.equal((await read(repo)).revision, 0);
});

test('returned objects and caller inputs cannot mutate repository state', async () => {
  const d = domain(); const repo = new ThemeRepository(d);
  const request = { action: 'update', expectedRevision: 0, patch: { palette: 'sky', image: dataURL() } };
  const pending = repo.execute(request);
  request.patch.palette = 'rose'; request.expectedRevision = 100;
  const result = await pending;
  const imageId = result.state.imageId;
  result.state.palette = 'coffee'; result.revision = 900;
  const image = await repo.readImage(imageId); image.data = 'bad'; image.mime = 'x';
  const actual = await read(repo);
  assert.equal(actual.state.palette, 'sky'); assert.equal(actual.revision, 1);
  assert.equal((await repo.readImage(imageId)).mime, 'image/png');
  actual.state.name = 'changed';
  assert.equal((await read(repo)).state.name, '');
});

test('concurrent writes and reads serialize, stale write fails, drain waits and queue recovers', async () => {
  const d = domain(); const repo = new ThemeRepository(d);
  let release;
  d.store.gate = new Promise(resolve => { release = resolve; });
  const first = update(repo, { palette: 'sky' });
  const stale = assert.rejects(update(repo, { palette: 'coffee' }), { code: 'CONFLICT' });
  const second = update(repo, { blur: 2 }, 1);
  const reading = read(repo);
  let drained = false;
  const draining = repo.drain().then(() => { drained = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(drained, false);
  assert.equal(d.store.document.revision, 0);
  assert.equal(d.store.events.filter(([op]) => op === 'set').length, 1);
  release();
  await first; await stale;
  const saved = await second;
  assert.deepEqual(await reading, saved);
  await draining; assert.equal(drained, true);
  assert.equal((await update(repo, { name: 'recovered' }, 2)).revision, 3);
});

test('cleanup enumeration failure cannot fail a durable commit', async () => {
  const d = domain(); const repo = new ThemeRepository(d);
  d.table('images').entries = () => { throw new Error('enumeration failure'); };
  const saved = await update(repo, { palette: 'lavender' });
  assert.equal(saved.revision, 1);
  assert.deepEqual(await read(new ThemeRepository(domain(d.store))), saved);
});

test('migration cannot overwrite ordinary Host updates and revision overflow is rejected', async () => {
  const d = domain(); const repo = new ThemeRepository(d);
  const saved = await update(repo, { palette: 'midnight' });
  assert.deepEqual(await repo.execute({ action: 'importLegacy', expectedRevision: 1, patch: { palette: 'green' } }), saved);
  const store = backing(); store.document.revision = Number.MAX_SAFE_INTEGER;
  await invalid(update(new ThemeRepository(domain(store)), {}, Number.MAX_SAFE_INTEGER));
  assert.equal(store.events.length, 0);
});

test('WebP magic is byte-exact and invalid validator objects do not invoke getters', () => {
  const wrong = Buffer.from(webp); wrong[0] |= 128;
  assert.equal(validImageRecord({ mime: 'image/webp', data: wrong.toString('base64') }), false);
  const record = { data: png.toString('base64') };
  Object.defineProperty(record, 'mime', { enumerable: true, get() { throw new Error('getter invoked'); } });
  assert.equal(validImageRecord(record), false);
  assert.equal(validImageRecord(Object.create({ mime: 'image/png', data: png.toString('base64') })), false);
});

test('corrupt stored document or content-addressed row is rejected rather than overwritten', async () => {
  const store = backing(); store.document.current.opacity = 100;
  await invalid(read(new ThemeRepository(domain(store))));
  const d = domain(); const repo = new ThemeRepository(d);
  const saved = await update(repo, { image: dataURL() });
  d.table('images').get(saved.state.imageId).data = jpeg.toString('base64');
  await invalid(repo.readImage(saved.state.imageId));
  await invalid(update(repo, { image: dataURL() }, 1));
  assert.equal((await read(repo)).revision, 1);
});
