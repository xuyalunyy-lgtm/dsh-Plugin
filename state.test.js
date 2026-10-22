import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, transition, createController } from './state.js';

let seq = 0;
const id = () => `id-${++seq}`;
const step = (state, request, now = 1000) => transition(state, request, now, id);

test('defaults stopped and task CRUD validates calendar dates and times', () => {
  const original = initialState();
  assert.equal(original.focus.status, 'idle');
  assert.equal(original.reminders.eye.running, false);
  let state = step(original, { action: 'add', date: '2024-02-29', title: ' Test ' });
  assert.equal(original.tasks.length, 0);
  assert.equal(state.tasks[0].title, 'Test');
  assert.equal(state.tasks[0].time, '');
  const taskId = state.tasks[0].id;
  state = step(state, { action: 'update', id: taskId, time: '23:59', done: true });
  assert.equal(state.tasks[0].done, true);
  for (const date of ['2023-02-29', '2026-04-31', '2026-13-01', 'garbage']) assert.throws(() => step(state, { action: 'add', date, title: 'x' }));
  assert.throws(() => step(state, { action: 'update', id: taskId, time: '24:00' }));
  assert.throws(() => step(state, { action: 'update', id: 'missing', done: true }));
  state = step(state, { action: 'delete', id: taskId });
  assert.equal(state.tasks.length, 0);
});

test('focus pause/resume excludes paused wall time and expires exactly once', () => {
  let state = step(initialState(), { action: 'focusStart' }, 1000);
  assert.equal(state.focus.endsAt, 1501000);
  state = step(state, { action: 'focusPause' }, 61000);
  assert.equal(state.focus.remainingMs, 1440000);
  state = step(state, { action: 'read' }, 9999999);
  assert.equal(state.alerts.length, 0);
  state = step(state, { action: 'focusResume' }, 10000000);
  assert.equal(state.focus.endsAt, 11440000);
  state = step(state, { action: 'read' }, 11440000);
  assert.equal(state.focus.status, 'idle');
  assert.equal(state.alerts[0].kind, 'focus');
  state = step(state, { action: 'read' }, 99999999);
  assert.equal(state.alerts.length, 1);
  assert.throws(() => step(state, { action: 'focusResume' }));
});

test('independent reminders coalesce sleep catch-up and pending alerts', () => {
  let state = step(initialState(), { action: 'remindersStart', kind: 'eye' }, 0);
  assert.equal(state.reminders.body.running, false);
  state = step(state, { action: 'remindersStart', kind: 'eye' }, 60000);
  assert.equal(state.reminders.eye.nextAt, 1200000);
  state = step(state, { action: 'read' }, 86400000);
  assert.equal(state.alerts.length, 1);
  assert.equal(state.reminders.eye.nextAt, 87600000);
  state = step(state, { action: 'read' }, 172800000);
  assert.equal(state.alerts.length, 1);
  state = step(state, { action: 'ack', id: state.alerts[0].id }, 172800001);
  assert.equal(state.alerts.length, 0);
  state = step(state, { action: 'remindersStop', kind: 'eye' }, 172800002);
  state = step(state, { action: 'read' }, 999999999);
  assert.equal(state.alerts.length, 0);
});

test('break is explicit, settings affect next start, reset does not stop independent reminder', () => {
  let state = step(initialState(), { action: 'settings', settings: { breakMinutes: 1, eyeMinutes: 2 } }, 0);
  state = step(state, { action: 'remindersStart' }, 0);
  state = step(state, { action: 'breakStart' }, 0);
  state = step(state, { action: 'read' }, 60000);
  assert.equal(state.alerts[0].kind, 'break');
  state = step(state, { action: 'focusReset' }, 60000);
  assert.equal(state.reminders.eye.running, true);
  assert.equal(state.focus.kind, 'focus');
  assert.throws(() => step(state, { action: 'settings', settings: { focusMinutes: 0 } }));
  assert.throws(() => step(state, { action: 'settings', settings: { arbitrary: 20 } }));
  assert.throws(() => step(state, { action: 'delete', id: 'x', unexpected: 1 }));
});

test('serialized commits prevent lost updates and failed saves leave durable state intact', async () => {
  let stored = initialState(); let writes = 0; let fail = false;
  const controller = createController({ load: () => stored, save: async next => { await Promise.resolve(); if (fail) throw new Error('disk full'); stored = next; writes++; }, clock: () => 0, id });
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => controller.dispatch({ action: 'add', date: '2026-10-22', title: `Task ${i}` })));
  assert(results.every(result => result.ok));
  assert.equal(stored.tasks.length, 20);
  await controller.dispatch({ action: 'read' });
  assert.equal(writes, 20);
  fail = true;
  const result = await controller.dispatch({ action: 'delete', id: stored.tasks[0].id });
  assert.deepEqual(result, { ok: false, error: 'disk full' });
  assert.equal(stored.tasks.length, 20);
  results[0].state.tasks[0].title = 'external mutation';
  assert.equal(stored.tasks[0].title, 'Task 0');
  await controller.close();
  assert.equal((await controller.dispatch({ action: 'read' })).ok, false);
});

test('persisted running timers reconcile after Host restart without interval flood', async () => {
  let stored = step(initialState(), { action: 'remindersStart' }, 0);
  stored = step(stored, { action: 'focusStart' }, 0);
  const controller = createController({ load: () => stored, save: async next => { stored = next; }, clock: () => 86400000, id });
  const { state } = await controller.dispatch({ action: 'read' });
  assert.deepEqual(state.alerts.map(item => item.kind).sort(), ['body', 'eye', 'focus']);
  assert.equal(state.focus.status, 'idle');
  assert.equal((await controller.dispatch({ action: 'read' })).state.alerts.length, 3);
  await controller.close();
});
