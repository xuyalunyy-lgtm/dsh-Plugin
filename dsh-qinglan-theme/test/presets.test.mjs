import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DEFAULT_STATE, INITIAL_DOCUMENT, ThemeRepository, validDocument } from '../host-store.js';

const clone = value => structuredClone(value);
const image = 'data:image/png;base64,' + Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]).toString('base64');
function backing() { return { document: clone(INITIAL_DOCUMENT), images: new Map(), fail: '', events: [] }; }
function open(store = backing()) {
  let document = clone(store.document);
  const images = new Map([...store.images].map(([id, value]) => [id, clone(value)]));
  const table = {
    get: id => images.get(id), entries: () => images.entries(),
    async put(id, value) {
      if (store.fail === 'put') throw new Error('put failed');
      store.images.set(id, clone(value)); images.set(id, clone(value));
    },
    async delete(id) {
      assert.notEqual(store.document.current.imageId, id);
      assert.ok(!(store.document.presets || []).some(preset => preset.state.imageId === id));
      store.events.push(['delete', id]);
      if (store.fail === 'delete') throw new Error('delete failed');
      store.images.delete(id); return images.delete(id);
    },
  };
  const domain = {
    global: {
      get: () => document,
      async set(value) {
        store.events.push(['set', value.revision]);
        if (store.fail === 'set') throw new Error('set failed');
        store.document = clone(value); document = clone(value);
      },
    },
    table: () => table,
  };
  return { store, domain, repo: new ThemeRepository(domain) };
}
const read = repo => repo.execute({ action: 'read' });
const action = (repo, action, expectedRevision, rest = {}) => repo.execute({ action, expectedRevision, ...rest });
const update = (repo, expectedRevision, patch) => action(repo, 'update', expectedRevision, { patch });
const save = (repo, expectedRevision, name) => action(repo, 'savePreset', expectedRevision, { name });
const invalid = promise => assert.rejects(promise, { code: 'INVALID_INPUT' });

test('save/apply/rename/delete use stable UUIDs, revision CAS, and isolated states', async () => {
  const { repo } = open();
  const customized = await update(repo, 0, { palette: 'sky', blur: 5, name: 'sky.png' });
  const saved = await save(repo, 1, '  Morning  ');
  const preset = saved.presets[0];
  assert.match(preset.id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(preset.name, 'Morning');
  assert.deepEqual(preset.state, customized.state);
  assert.deepEqual(saved.state, customized.state);
  const changed = await update(repo, 2, { palette: 'coffee', blur: 0 });
  assert.equal(changed.presets[0].state.palette, 'sky');
  const renamed = await action(repo, 'renamePreset', 3, { id: preset.id, name: 'Evening' });
  assert.deepEqual(renamed.state, changed.state);
  assert.equal(renamed.presets[0].id, preset.id);
  assert.equal(renamed.presets[0].name, 'Evening');
  const applied = await action(repo, 'applyPreset', 4, { id: preset.id });
  assert.deepEqual(applied.state, customized.state);
  const deleted = await action(repo, 'deletePreset', 5, { id: preset.id });
  assert.deepEqual(deleted.state, applied.state);
  assert.deepEqual(deleted.presets, []);
  assert.equal(deleted.revision, 6);
});

test('reset preserves presets; saved images stay readable and reapply after restart', async () => {
  const { repo, store } = open();
  const current = await update(repo, 0, { palette: 'forest', image });
  const saved = await save(repo, 1, 'Forest');
  const reset = await action(repo, 'reset', 2);
  assert.deepEqual(reset.state, DEFAULT_STATE);
  assert.deepEqual(reset.presets, saved.presets);
  assert.equal(store.images.size, 1);
  assert.equal((await repo.readImage(current.state.imageId)).mime, 'image/png');
  const restarted = open(store).repo;
  assert.deepEqual(await read(restarted), reset);
  const applied = await action(restarted, 'applyPreset', 3, { id: saved.presets[0].id });
  assert.deepEqual(applied.state, current.state);
  assert.equal((await restarted.readImage(applied.state.imageId)).mime, 'image/png');
  assert.equal(Object.hasOwn(applied.presets[0].state, 'image'), false);
  assert.equal(JSON.stringify(applied).includes('base64'), false);
});

test('old version-1 documents validate and normalize without a write on read', async () => {
  const store = backing(); delete store.document.presets;
  assert.equal(validDocument(store.document), true);
  const { repo } = open(store);
  assert.deepEqual((await read(repo)).presets, []);
  assert.equal(store.events.length, 0);
  assert.equal(Object.hasOwn(store.document, 'presets'), false);
  await save(repo, 0, 'Default');
  assert.equal(store.document.presets.length, 1);
  assert.equal(validDocument(store.document), true);
  assert.deepEqual((await read(open(store).repo)).presets, store.document.presets);
});

test('save default initializes Host and legacy import cannot replace presets or appearance', async () => {
  const { repo } = open();
  const saved = await save(repo, 0, 'Default');
  assert.equal(saved.initialized, true);
  assert.deepEqual(await action(repo, 'importLegacy', 1, { patch: { palette: 'rose' } }), saved);
});

test('names trim and reject empty, long and case-insensitive duplicates', async () => {
  const { repo } = open();
  const saved = await save(repo, 0, '  Morning  ');
  for (const name of ['', '   ', '\n\t', 'a'.repeat(41), ' '.repeat(201), null, 7, {}, 'morning', 'MORNING']) {
    await invalid(save(repo, 1, name));
  }
  const second = await save(repo, 1, 'x'.repeat(40));
  await invalid(action(repo, 'renamePreset', 2, { id: second.presets[1].id, name: ' morning ' }));
  await invalid(action(repo, 'renamePreset', 2, { id: saved.presets[0].id, name: '  ' }));
  const renamed = await action(repo, 'renamePreset', 2, { id: saved.presets[0].id, name: ' MORNING ' });
  assert.equal(renamed.presets[0].name, 'MORNING');
});

test('maximum twenty presets; deleting releases capacity', async () => {
  const { repo } = open();
  let snapshot;
  for (let i = 0; i < 20; i++) snapshot = await save(repo, i, `Preset ${i}`);
  assert.equal(snapshot.presets.length, 20);
  await invalid(save(repo, 20, 'Twenty first'));
  await action(repo, 'deletePreset', 20, { id: snapshot.presets[0].id });
  assert.equal((await save(repo, 21, 'Replacement')).presets.length, 20);
});

test('every preset mutation checks exact revision and recovers after conflicts', async () => {
  const { repo } = open();
  const saved = await save(repo, 0, 'One');
  const id = saved.presets[0].id;
  for (const [name, rest] of [['savePreset', { name: 'Two' }], ['applyPreset', { id }], ['renamePreset', { id, name: 'Two' }], ['deletePreset', { id }]]) {
    await assert.rejects(action(repo, name, 0, rest), { code: 'CONFLICT' });
  }
  const results = await Promise.allSettled([save(repo, 1, 'Two'), save(repo, 1, 'Three')]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].reason.code, 'CONFLICT');
  assert.equal((await save(repo, 2, 'Three')).presets.length, 3);
});

test('strict preset requests reject IDs, extra fields, accessors and prototype attacks', async () => {
  const { repo } = open();
  const saved = await save(repo, 0, 'One');
  const id = saved.presets[0].id;
  for (const badId of ['', '../x', 'constructor', id.toUpperCase(), '0'.repeat(64), null, 1, randomUUID()]) {
    for (const name of ['applyPreset', 'renamePreset', 'deletePreset']) {
      await invalid(action(repo, name, 1, { id: badId, ...(name === 'renamePreset' ? { name: 'New' } : {}) }));
    }
  }
  const requests = [
    { action: 'savePreset', expectedRevision: 1, name: 'Two', id },
    { action: 'savePreset', expectedRevision: 1, name: 'Two', patch: {} },
    { action: 'applyPreset', expectedRevision: 1, id, name: 'Two' },
    { action: 'renamePreset', expectedRevision: 1, id },
    { action: 'deletePreset', expectedRevision: 1, id, patch: {} },
    { action: 'savePreset', name: 'Two' },
    { action: 'savePreset', expectedRevision: '1', name: 'Two' },
    JSON.parse('{"action":"savePreset","expectedRevision":1,"name":"Two","__proto__":{}}'),
    Object.assign(Object.create({ name: 'Two' }), { action: 'savePreset', expectedRevision: 1 }),
    { action: 'savePreset', expectedRevision: 1, name: 'Two', [Symbol('extra')]: true },
    { action: 'update', expectedRevision: 1, patch: {}, name: 'Two' },
    { action: 'reset', expectedRevision: 1, id },
  ];
  requests.push(Object.defineProperty({ action: 'savePreset', expectedRevision: 1 }, 'name', { enumerable: true, get() { throw new Error('must not run'); } }));
  for (const request of requests) await invalid(repo.execute(request));
  assert.deepEqual(await read(repo), saved);
});

test('failed preset deletion preserves durable document and every image reference', async () => {
  const { repo, store } = open();
  const current = await update(repo, 0, { image });
  const saved = await save(repo, 1, 'Image');
  const reset = await action(repo, 'reset', 2);
  store.fail = 'set';
  await assert.rejects(action(repo, 'deletePreset', 3, { id: saved.presets[0].id }), /set failed/);
  assert.deepEqual(await read(repo), reset);
  assert.deepEqual(await read(open(store).repo), reset);
  assert.ok(await repo.readImage(current.state.imageId));
  assert.equal(store.images.size, 1);
  assert.equal(store.events.some(([op]) => op === 'delete'), false);
  store.fail = '';
  await action(repo, 'deletePreset', 3, { id: saved.presets[0].id });
  assert.equal(store.images.size, 0);
  assert.equal(await repo.readImage(current.state.imageId), undefined);
  assert.equal(store.events.at(-1)[0], 'delete');
  assert.deepEqual(store.events.at(-2), ['set', 4]);
});

test('failed save, rename and apply cannot leak in-memory mutations', async () => {
  const { repo, store } = open();
  const saved = await save(repo, 0, 'Default');
  const prior = await update(repo, 1, { palette: 'coffee' });
  const id = saved.presets[0].id;
  store.fail = 'set';
  for (const [name, rest] of [['savePreset', { name: 'Other' }], ['renamePreset', { id, name: 'Renamed' }], ['applyPreset', { id }]]) {
    await assert.rejects(action(repo, name, 2, rest), /set failed/);
    assert.deepEqual(await read(repo), prior);
    assert.deepEqual(await read(open(store).repo), prior);
  }
  store.fail = '';
  assert.equal((await action(repo, 'renamePreset', 2, { id, name: 'Recovered' })).presets[0].name, 'Recovered');
});

test('shared preset and current references retain images until last reference disappears', async () => {
  const { repo, store } = open();
  const current = await update(repo, 0, { image });
  await save(repo, 1, 'One');
  const saved = await save(repo, 2, 'Two');
  await action(repo, 'reset', 3);
  await action(repo, 'deletePreset', 4, { id: saved.presets[0].id });
  assert.equal(store.images.size, 1);
  assert.ok(await repo.readImage(current.state.imageId));
  await action(repo, 'applyPreset', 5, { id: saved.presets[1].id });
  await action(repo, 'deletePreset', 6, { id: saved.presets[1].id });
  assert.equal(store.images.size, 1, 'current reference still owns image');
  await update(repo, 7, { image: '' });
  assert.equal(store.images.size, 0);
});

test('cleanup failure after preset delete is best-effort and orphan cannot be read', async () => {
  const { repo, store } = open();
  const current = await update(repo, 0, { image });
  const saved = await save(repo, 1, 'Image');
  await action(repo, 'reset', 2);
  store.fail = 'delete';
  const deleted = await action(repo, 'deletePreset', 3, { id: saved.presets[0].id });
  assert.equal(deleted.presets.length, 0);
  assert.equal(store.images.size, 1);
  assert.equal(await repo.readImage(current.state.imageId), undefined);
  store.fail = '';
  await update(repo, 4, {});
  assert.equal(store.images.size, 0);
});

test('snapshot presets, nested states and queued inputs are isolated clones', async () => {
  const { repo } = open();
  const request = { action: 'savePreset', expectedRevision: 0, name: 'One' };
  const pending = repo.execute(request); request.name = 'Changed';
  const saved = await pending;
  const id = saved.presets[0].id;
  saved.presets[0].name = 'Oops'; saved.presets[0].state.palette = 'rose';
  saved.presets.push({ id: randomUUID(), name: 'Injected', state: {} });
  saved.state.palette = 'coffee';
  const again = await read(repo);
  assert.equal(again.presets.length, 1);
  assert.equal(again.presets[0].name, 'One');
  assert.deepEqual(again.presets[0].state, DEFAULT_STATE);
  assert.deepEqual(again.state, DEFAULT_STATE);
  again.presets.length = 0;
  const applied = await action(repo, 'applyPreset', 1, { id });
  applied.state.palette = 'midnight';
  assert.deepEqual((await read(repo)).presets[0].state, DEFAULT_STATE);
});

test('document validator strictly checks preset arrays, names, IDs and nested state', () => {
  const preset = { id: randomUUID(), name: 'One', state: { ...DEFAULT_STATE } };
  const doc = presets => ({ ...INITIAL_DOCUMENT, presets });
  assert.equal(validDocument(doc([preset])), true);
  const getterArray = [];
  Object.defineProperty(getterArray, '0', { enumerable: true, get() { throw new Error('must not run'); } });
  const extraArray = [preset]; extraArray.extra = true;
  const inheritedArray = [preset]; Object.setPrototypeOf(inheritedArray, {});
  for (const presets of [undefined, null, {}, new Array(1), getterArray, extraArray, inheritedArray,
    [preset, preset], [preset, { ...preset, id: randomUUID(), name: 'ONE' }],
    [{ ...preset, id: '../path' }], [{ ...preset, name: ' One ' }], [{ ...preset, name: '' }],
    [{ ...preset, extra: true }], [{ ...preset, state: { ...DEFAULT_STATE, image: '' } }],
    [Object.create(preset)], Array.from({ length: 21 }, (_, i) => ({ ...preset, id: randomUUID(), name: `Name ${i}` })),
  ]) assert.equal(validDocument(doc(presets)), false);
});
