import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

// Exercise only the pure display rules, never emulate React, a DOM or a preview.
// Normalize only the in-memory inspection text; Windows checkouts may use CRLF.
const source = (await readFile(new URL('../client.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const begin = source.indexOf('    // Pure quota display rules (no I/O).');
const end = source.indexOf('    return {\n      inject:', begin);
assert.ok(begin >= 0 && end > begin, 'pure display rule section must exist');
const { quotaSnapshotState, quotaWindowState } = runInNewContext(source.slice(begin, end) + '\n({ quotaSnapshotState, quotaWindowState })');
const now = Date.parse('2026-10-26T06:00:00.000Z');
const fresh = () => quotaSnapshotState({ checkedAt: new Date(now - 60000).toISOString() }, now, '10');
const window = remainingPercent => ({ remainingPercent, resetAt: new Date(now + 60000).toISOString() });
test('fresh quota warns only for valid percentages at configured threshold', () => {
  assert.equal(quotaWindowState(window(20), fresh(), now, '20').low, true);
  assert.equal(quotaWindowState(window(21), fresh(), now, '20').low, false);
  assert.equal(quotaWindowState(window(0), fresh(), now, '20').low, true);
  for (const value of [null, undefined, NaN, -1, 101, '10']) assert.equal(quotaWindowState(window(value), fresh(), now, '20').low, false);
});
test('zero, blank or invalid preference cannot produce a low-quota warning', () => {
  for (const threshold of ['0', '', 'bad', '-1', '101']) assert.equal(quotaWindowState(window(0), fresh(), now, threshold).low, false);
});
test('missing, future, old timestamps and invalid expiry mean stale data', () => {
  for (const checkedAt of [undefined, 'bad', new Date(now + 1000).toISOString(), new Date(now - 600000).toISOString()]) {
    const snapshot = quotaSnapshotState({ checkedAt }, now, '10');
    assert.equal(snapshot.stale, true); assert.equal(quotaWindowState(window(1), snapshot, now, '20').low, false);
  }
  assert.equal(quotaSnapshotState({ checkedAt: new Date(now).toISOString() }, now, '0').stale, true);
});
test('reset time reached marks history without rewriting quota as full', () => {
  const result = quotaWindowState({ remainingPercent: 12, resetAt: new Date(now).toISOString() }, fresh(), now, '20');
  assert.equal(result.resetDue, true); assert.equal(result.historical, true); assert.equal(result.low, false); assert.equal(result.remaining, 12);
});
test('unknown reset time never implies quota was restored or triggers threshold alert', () => {
  const result = quotaWindowState({ remainingPercent: 10, resetAt: null }, fresh(), now, '20');
  assert.equal(result.resetKnown, false); assert.equal(result.low, false); assert.equal(result.remaining, 10);
});
