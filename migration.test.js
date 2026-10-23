import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createController, stateSchema } from './state.js';

// Synthetic 1.1.0 data, not any user's actual planner.
function legacyState() {
  return {
    tasks: [
      { id: 'legacy-a', date: '2026-10-23', title: 'Keep this task', time: '', done: false },
      { id: 'legacy-b', date: '2026-10-24', title: 'Keep completed work', time: '10:30', done: true },
    ],
    settings: { focusMinutes: 45, eyeMinutes: 30, bodyMinutes: 45, breakMinutes: 5 },
    focus: { status: 'idle', kind: 'focus', endsAt: null, remainingMs: 0 },
    reminders: { eye: { running: false, nextAt: null }, body: { running: false, nextAt: null } },
    alerts: [],
  };
}
function fixture() {
  const schema = stateSchema(z);
  let stored = schema.parse(legacyState()), nextId = 0, now = Date.UTC(2026,9,23,4);
  const controller = createController({ load: () => stored, save: async next => { stored = schema.parse(next); }, clock: () => now, id: () => `migration-${++nextId}` });
  return { controller, getStored: () => structuredClone(stored), setNow: value => { now = value; } };
}
const originalFields = tasks => tasks.map(({ id, date, title, time, done }) => ({ id, date, title, time, done }));

test('old stored state survives export, merged import, replacement and recovery round-trip', async () => {
  const { controller } = fixture();
  try {
    const before = await controller.dispatch({ action: 'read' });
    assert.equal(before.ok, true);
    assert.deepEqual(originalFields(before.state.tasks), legacyState().tasks);
    assert.deepEqual(before.state.settings, legacyState().settings);
    assert.ok(before.state.tasks.every(t => t.focusMs === 0 && t.focusRounds === 0));
    const exported = await controller.dispatch({ action: 'export' });
    assert.equal(exported.ok, true);
    assert.equal(exported.backup.format, 'dsh-focus-calendar');
    assert.equal(exported.backup.version, 1);
    const preview = await controller.dispatch({ action: 'importPreview', backup: exported.backup });
    assert.equal(preview.ok, true);
    assert.equal(preview.preview.taskCount, 2);
    const merged = await controller.dispatch({ action: 'import', mode: 'merge', backup: exported.backup, token: preview.preview.token });
    assert.equal(merged.ok, true);
    assert.deepEqual(originalFields(merged.state.tasks), legacyState().tasks);

    const reduced = { ...exported.backup, tasks: [exported.backup.tasks[1]] };
    const replacePreview = await controller.dispatch({ action: 'importPreview', backup: reduced });
    assert.equal(replacePreview.ok, true);
    const replaced = await controller.dispatch({ action: 'import', mode: 'replace', backup: reduced, token: replacePreview.preview.token });
    assert.equal(replaced.ok, true);
    assert.equal(replaced.state.tasks.length, 1);
    assert.equal(replaced.state.recovery.taskCount, 2);
    assert.equal(replaced.state.focus.status, 'idle');
    assert.equal(replaced.state.reminders.eye.running, false);
    const recovery = await controller.dispatch({ action: 'recoveryExport' });
    assert.equal(recovery.ok, true);
    const recoveryPreview = await controller.dispatch({ action: 'importPreview', backup: recovery.backup });
    const restored = await controller.dispatch({ action: 'import', mode: 'replace', backup: recovery.backup, token: recoveryPreview.preview.token });
    assert.equal(restored.ok, true);
    assert.deepEqual(originalFields(restored.state.tasks), legacyState().tasks);
    assert.deepEqual(restored.state.settings, legacyState().settings);
  } finally { await controller.close(); }
});

test('stale import preview refuses to overwrite a newly added task', async () => {
  const { controller, getStored } = fixture();
  try {
    const { backup } = await controller.dispatch({ action: 'export' });
    const preview = await controller.dispatch({ action: 'importPreview', backup });
    const created = await controller.dispatch({ action: 'add', date: '2026-10-25', title: 'Added after preview' });
    assert.equal(created.ok, true);
    const before = getStored();
    const result = await controller.dispatch({ action: 'import', mode: 'replace', backup, token: preview.preview.token });
    assert.equal(result.ok, false);
    assert.deepEqual(getStored(), before);
  } finally { await controller.close(); }
});

test('legacy tasks can be trashed, restored, and purged without changing unrelated tasks', async () => {
  const { controller } = fixture();
  try {
    const deleted = await controller.dispatch({ action: 'delete', id: 'legacy-a' });
    assert.equal(deleted.ok, true);
    assert.equal(deleted.state.trash[0].task.id, 'legacy-a');
    assert.deepEqual(originalFields(deleted.state.tasks), [legacyState().tasks[1]]);
    const restored = await controller.dispatch({ action: 'restore', id: 'legacy-a' });
    assert.equal(restored.ok, true);
    assert.deepEqual(originalFields(restored.state.tasks).sort((a,b)=>a.id.localeCompare(b.id)), legacyState().tasks);
    await controller.dispatch({ action: 'delete', id: 'legacy-a' });
    const purged = await controller.dispatch({ action: 'trashPurge', id: 'legacy-a' });
    assert.equal(purged.ok, true);
    assert.equal(purged.state.trash.length, 0);
    assert.deepEqual(originalFields(purged.state.tasks), [legacyState().tasks[1]]);
  } finally { await controller.close(); }
});
