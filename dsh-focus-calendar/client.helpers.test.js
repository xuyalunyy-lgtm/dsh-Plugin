import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise production pure helpers only. No React, DOM, browser storage or user data.
const source = await readFile(new URL('./client.js', import.meta.url), 'utf8');
const start = source.indexOf('// BEGIN PURE HELPERS');
const end = source.indexOf('// END PURE HELPERS', start);
assert.ok(start >= 0 && end > start, 'pure helper markers must exist');
const helpers = vm.runInNewContext(`${source.slice(start, end)}\n({dayKey,localDate,shiftDate,shiftMonth,selectTasks,dayStats,composingEnter,emptyDraft,sameDraft,createDraftStore})`, { Date });
const { dayKey, localDate, shiftDate, shiftMonth, selectTasks, dayStats, composingEnter, sameDraft, createDraftStore } = helpers;
const plain = value => JSON.parse(JSON.stringify(value));
const storageKey = 'dsh-focus-calendar.drafts.v1';
const today = '2026-10-23';
const draft = (title = 'Draft', date = today, time = '') => ({ title, date, time });
function memoryStorage() {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map };
}

test('localDate accepts real Gregorian dates including years 1–99 without a 1900 offset', () => {
  for (const key of ['0001-01-01', '0099-12-31', '0100-03-01', '2000-02-29', '2024-02-29', '2026-12-31', '9999-12-31']) {
    const date = localDate(key);
    assert.ok(date instanceof Date, key);
    assert.equal(dayKey(date), key);
    assert.equal(date.getHours(), 12);
  }
  for (const key of ['0000-01-01', '10000-01-01', '1900-02-29', '2100-02-29', '2023-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '2026-1-01', '2026-10-23T00:00:00Z', '', null, 20261023]) assert.equal(localDate(key), null, String(key));
});

test('shiftDate uses calendar arithmetic across month, year and leap-day boundaries and clamps the supported year range', () => {
  for (const [key, offset, expected] of [
    ['2026-01-31', 1, '2026-02-01'], ['2026-03-01', -1, '2026-02-28'],
    ['2026-12-31', 1, '2027-01-01'], ['2027-01-01', -1, '2026-12-31'],
    ['2024-02-28', 1, '2024-02-29'], ['2024-03-01', -1, '2024-02-29'],
    ['0099-12-31', 1, '0100-01-01'], ['0001-01-01', -1, '0001-01-01'],
    ['9999-12-31', 1, '9999-12-31'], ['invalid', 1, 'invalid'],
  ]) assert.equal(shiftDate(key, offset), expected);
});

test('shiftDate survives DST offset changes without skipping calendar days', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    assert.equal(shiftDate('2026-03-07', 1), '2026-03-08');
    assert.equal(shiftDate('2026-03-08', 1), '2026-03-09');
    assert.equal(shiftDate('2026-10-31', 1), '2026-11-01');
    assert.equal(shiftDate('2026-11-01', 1), '2026-11-02');
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});

test('shiftMonth clamps end-of-month dates and preserves valid early and late years', () => {
  for (const [key, offset, expected] of [
    ['2026-01-31', 1, '2026-02-28'], ['2024-01-31', 1, '2024-02-29'],
    ['2026-03-31', -1, '2026-02-28'], ['2024-02-29', 12, '2025-02-28'],
    ['2026-12-23', 1, '2027-01-23'], ['2027-01-23', -1, '2026-12-23'],
    ['0099-12-31', 1, '0100-01-31'], ['0001-01-01', -1, '0001-01-01'],
    ['9999-12-31', 1, '9999-12-31'], ['bad', 1, 'bad'],
  ]) assert.equal(shiftMonth(key, offset), expected);
});

test('task selection filters by day/status, sorts pending then time, and never mutates source order', () => {
  const tasks = [
    { id: 'done', date: today, done: true, time: '07:00' },
    { id: 'untimed', date: today, done: false, time: '' },
    { id: 'late', date: today, done: false, time: '18:00' },
    { id: 'early', date: today, done: false, time: '08:00' },
    { id: 'other', date: '2026-10-24', done: false, time: '06:00' },
  ];
  const before = structuredClone(tasks);
  assert.deepEqual(selectTasks(tasks, today).map(x => x.id), ['early', 'late', 'untimed', 'done']);
  assert.deepEqual(selectTasks(tasks, today, 'pending').map(x => x.id), ['early', 'late', 'untimed']);
  assert.deepEqual(selectTasks(tasks, today, 'done').map(x => x.id), ['done']);
  assert.deepEqual(selectTasks(tasks, '2026-10-25'), []);
  assert.deepEqual(tasks, before);
  assert.deepEqual(plain(dayStats(tasks)), { [today]: { total: 4, done: 1 }, '2026-10-24': { total: 1, done: 0 } });
  assert.deepEqual(plain(dayStats([])), {});
});

test('IME Enter is suppressed for composition flags, keyCode229 and the post-composition window only', () => {
  assert.equal(composingEnter({ key: 'Enter' }, true, -Infinity, 1000), true);
  for (const extra of [{ isComposing: true }, { nativeEvent: { isComposing: true } }, { keyCode: 229 }, { nativeEvent: { keyCode: 229 } }]) assert.equal(composingEnter({ key: 'Enter', ...extra }, false, -Infinity, 1000), true);
  assert.equal(composingEnter({ key: 'Enter' }, false, 1000, 1079), true);
  assert.equal(composingEnter({ key: 'Enter' }, false, 1000, 1080), false);
  assert.equal(composingEnter({ key: 'Enter' }, false, -Infinity, 1000), false);
  assert.equal(composingEnter({ key: 'Escape', isComposing: true }, true, 1000, 1010), false);
});

test('sameDraft compares content rather than object identity and rejects absent drafts', () => {
  const value = draft('Text', today, '09:30');
  assert.equal(sameDraft(value, { ...value }), true);
  for (const patch of [{ title: 'Other' }, { date: '2026-10-24' }, { time: '10:00' }]) assert.equal(sameDraft(value, { ...value, ...patch }), false);
  assert.equal(sameDraft(null, null), false);
  assert.equal(sameDraft(value, undefined), false);
});

test('draft store isolates new/edit/day keys, copies values, restores storage, and retains view fields', () => {
  const storage = memoryStorage(), store = createDraftStore(storage, today);
  const first = draft('New'), edit = draft('Editing', '2026-11-01', '13:00');
  store.set('new:' + today, first);
  store.set('new:2026-10-24', draft('Tomorrow', '2026-10-24'));
  store.set('edit:task-1', edit);
  first.title = 'Caller mutation';
  const read = store.get('edit:task-1'); read.title = 'Read mutation';
  assert.equal(store.get('new:' + today).title, 'New');
  assert.equal(store.get('edit:task-1').title, 'Editing');
  store.setView({ date: '2026-10-24' });
  store.setView({ editing: 'task-1' });
  store.setView({ filter: 'pending' });
  assert.deepEqual(plain(store.getView()), { date: '2026-10-24', editing: 'task-1', filter: 'pending' });
  const restored = createDraftStore(storage, '2026-12-01');
  assert.equal(restored.persistent, true);
  assert.deepEqual(plain(restored.getView()), plain(store.getView()));
  assert.deepEqual(plain(restored.get('edit:task-1')), edit);
  assert.equal(restored.get('new:' + today).title, 'New');
  assert.equal(restored.get('new:2026-10-24').title, 'Tomorrow');
  store.drop('edit:task-1');
  assert.equal(store.has('edit:task-1'), false);
  assert.equal(store.has('new:' + today), true);
});

test('clearIfUnchanged prevents a late save response from deleting a newer or different draft', () => {
  const store = createDraftStore(memoryStorage(), today), key = 'new:' + today;
  const sent = draft('Sent'); store.set(key, sent);
  store.set(key, draft('Typed after submit'));
  assert.equal(store.clearIfUnchanged(key, sent), false);
  assert.equal(store.get(key).title, 'Typed after submit');
  assert.equal(store.clearIfUnchanged('edit:other', sent), false);
  const current = store.get(key);
  assert.equal(store.clearIfUnchanged(key, { ...current }), true);
  assert.equal(store.has(key), false);
  assert.equal(store.clearIfUnchanged(key, current), false);
});

test('draft subscriptions expose a numeric increasing revision and unsubscribe cleanly', () => {
  const store = createDraftStore(memoryStorage(), today), seen = [];
  assert.equal(store.getSnapshot(), 0);
  const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot()));
  store.set('new:' + today, draft());
  store.setView({ filter: 'done' });
  const revision = store.getSnapshot();
  assert.equal(typeof revision, 'number');
  assert.deepEqual(seen, [1, 2]);
  assert.equal(store.set('new:' + today, draft('Invalid', '2026-02-30')), false);
  assert.equal(store.clearIfUnchanged('new:' + today, draft('Not matching')), false);
  assert.equal(store.getSnapshot(), revision);
  unsubscribe();store.drop('new:' + today);
  assert.equal(store.getSnapshot(), 3);
  assert.deepEqual(seen, [1, 2]);
});

test('storage read/write failures degrade to usable in-memory drafts and notify subscribers', () => {
  const broken = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } };
  const store = createDraftStore(broken, today);
  assert.equal(store.persistent, false);
  let notifications = 0; store.subscribe(() => notifications++);
  assert.equal(store.set('new:' + today, draft('Not lost')), true);
  store.setView({ filter: 'pending' });
  assert.equal(store.get('new:' + today).title, 'Not lost');
  assert.equal(store.persistent, false);
  assert.equal(notifications, 2);
  const absent = createDraftStore(undefined, today);
  assert.equal(absent.set('new:' + today, draft('Memory')), true);
  assert.equal(absent.persistent, false);
  assert.equal(absent.get('new:' + today).title, 'Memory');
});

test('corrupt JSON and invalid schema use safe defaults; invalid stored drafts and view values are ignored', () => {
  for (const raw of ['{not JSON', 'null', '{"version":2,"drafts":{}}']) {
    const storage = memoryStorage();storage.setItem(storageKey, raw);
    const store = createDraftStore(storage, today);
    assert.deepEqual(plain(store.getView()), { date: today, editing: null, filter: 'all' });
    assert.equal(store.has('new:' + today), false);
    assert.equal(store.persistent, false);
  }
  const storage = memoryStorage();
  storage.setItem(storageKey, JSON.stringify({ version: 1, view: { date: '2026-02-30', filter: 'bad', editing: 'missing' }, drafts: {
    ['new:' + today]: draft('Valid'), 'new:2026-02-30': draft('Invalid key'),
    'edit:bad-date': draft('Invalid date', '2026-02-30'), 'edit:bad-time': draft('Invalid time', today, '24:00'),
    'edit:long': draft('x'.repeat(201)), 'other:task': draft('Invalid prefix'),
  } }));
  const store = createDraftStore(storage, today);
  assert.deepEqual(plain(store.getView()), { date: today, editing: null, filter: 'all' });
  assert.equal(store.get('new:' + today).title, 'Valid');
  for (const key of ['new:2026-02-30', 'edit:bad-date', 'edit:bad-time', 'edit:long', 'other:task']) assert.equal(store.has(key), false, key);
});

test('draft writes reject invalid dates, times and titles without replacing existing draft', () => {
  const store = createDraftStore(memoryStorage(), today), key = 'new:' + today, original = draft('Keep');
  store.set(key, original);
  for (const invalid of [draft('x', '1900-02-29'), draft('x', '0000-01-01'), draft('x', today, '24:00'), draft('x'.repeat(201)), { ...original, title: null }, { ...original, time: 12 }]) {
    assert.equal(store.set(key, invalid), false);
    assert.deepEqual(plain(store.get(key)), original);
  }
});
