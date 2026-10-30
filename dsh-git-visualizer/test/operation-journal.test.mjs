import test from 'node:test';
import assert from 'node:assert/strict';
import { OperationJournal } from '../operation-journal.mjs';

const scope = { sessionId: 'session-a', workspaceRoot: 'D:\\workspace' };
const metadata = (extra = {}) => ({ ...scope, repository: '.', operation: 'commit', ...extra });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('running records, opaque ids, finish timestamps and durations', () => {
  let now = 1000;
  const journal = new OperationJournal({ clock: () => now });
  const first = journal.begin(metadata({ branch: 'main', fileCount: 2 }));
  const second = journal.begin(metadata({ operation: 'fetch' }));
  assert.match(first, uuid);
  assert.match(second, uuid);
  assert.notEqual(first, second);
  assert.deepEqual(journal.list(scope).map(record => record.id), [second, first]);
  assert.deepEqual(journal.list(scope)[1], {
    id: first, ...metadata({ branch: 'main', fileCount: 2 }), status: 'running', startedAt: 1000,
  });
  now = 1250;
  assert.equal(journal.finish(first, { status: 'success' }), true);
  assert.equal(journal.list(scope)[1].finishedAt, 1250);
  assert.equal(journal.list(scope)[1].durationMs, 250);
  assert.equal(journal.list(scope)[1].status, 'success');
  assert.equal(journal.list(scope)[0].status, 'running');
});

test('global running bound throws Busy across sessions and frees slots on finish', () => {
  const journal = new OperationJournal();
  const ids = Array.from({ length: 4 }, (_, i) => journal.begin(metadata({ sessionId: `s${i}` })));
  assert.throws(() => journal.begin(metadata()), { name: 'Busy', code: 'BUSY', message: 'Busy' });
  journal.finish(ids[0], { status: 'failed', errorCode: 'GIT_FAILED' });
  assert.match(journal.begin(metadata()), uuid);
  assert.equal(journal.list({ ...scope, sessionId: 's1' })[0].status, 'running');
});

test('200 completed global bound, 100 query bound; running records are never evicted', () => {
  const journal = new OperationJournal({ clock: () => 1 });
  const running = Array.from({ length: 3 }, (_, i) => journal.begin(metadata({ repository: `running-${i}` })));
  const completed = [];
  for (let i = 0; i < 205; i++) {
    const id = journal.begin(metadata({ sessionId: i % 2 ? 'session-b' : 'session-a', repository: `repo-${i}` }));
    journal.finish(id, { status: 'success' });
    completed.push(id);
  }
  const fourth = journal.begin(metadata({ repository: 'running-3' }));
  assert.equal(journal.list(scope).length, 100);
  for (let i = 0; i < 205; i++) {
    const records = journal.list({ ...scope, sessionId: i % 2 ? 'session-b' : 'session-a', repository: `repo-${i}` });
    assert.equal(records.length, i < 5 ? 0 : 1);
    if (i >= 5) assert.equal(records[0].id, completed[i]);
  }
  [...running, fourth].forEach((id, i) => {
    const [record] = journal.list({ ...scope, repository: `running-${i}` });
    assert.equal(record.id, id);
    assert.equal(record.status, 'running');
  });
  assert.throws(() => journal.begin(metadata()), { code: 'BUSY' });
});

test('completion order governs eviction, begin order governs queries', () => {
  const journal = new OperationJournal({ clock: () => 1 });
  const oldest = journal.begin(metadata({ repository: 'old-running' }));
  const earlyCompleted = journal.begin(metadata({ repository: 'early-completed' }));
  journal.finish(earlyCompleted, { status: 'success' });
  journal.finish(oldest, { status: 'success' });
  assert.deepEqual(journal.list(scope).map(record => record.id), [earlyCompleted, oldest]);
  for (let i = 0; i < 199; i++) journal.finish(journal.begin(metadata()), { status: 'success' });
  assert.equal(journal.list({ ...scope, repository: 'early-completed' }).length, 0);
  assert.equal(journal.list({ ...scope, repository: 'old-running' })[0].id, oldest);
});

test('input mutation and frozen output snapshots cannot change internal history', () => {
  const journal = new OperationJournal();
  const input = metadata({ branch: 'main', fileCount: 1 });
  const id = journal.begin(input);
  input.sessionId = 'other';
  input.branch = 'changed';
  const query = { ...scope };
  const before = journal.list(query);
  query.sessionId = 'other';
  assert.ok(Object.isFrozen(before));
  assert.ok(Object.isFrozen(before[0]));
  assert.throws(() => before.push({}), TypeError);
  assert.throws(() => { before[0].branch = 'changed'; }, TypeError);
  const result = { status: 'failed', errorCode: 'STALE_STATE' };
  journal.finish(id, result);
  result.errorCode = 'GIT_FAILED';
  const after = journal.list(scope);
  assert.notEqual(before, after);
  assert.notEqual(before[0], after[0]);
  assert.equal(before[0].status, 'running');
  assert.equal(after[0].branch, 'main');
  assert.equal(after[0].errorCode, 'STALE_STATE');
});

test('mandatory session/root isolation and exact optional repo filtering', () => {
  const journal = new OperationJournal();
  const a = journal.begin(metadata());
  const b = journal.begin(metadata({ repository: 'sub' }));
  journal.begin(metadata({ sessionId: 'other' }));
  journal.begin(metadata({ workspaceRoot: 'D:\\workspace-other' }));
  assert.deepEqual(journal.list(scope).map(record => record.id), [b, a]);
  assert.deepEqual(journal.list({ ...scope, repository: '.' }).map(record => record.id), [a]);
  for (const repository of ['su', 'sub/', 'SUB']) assert.deepEqual(journal.list({ ...scope, repository }), []);
  assert.deepEqual(journal.list({ ...scope, sessionId: 'session' }), []);
  assert.deepEqual(journal.list({ ...scope, workspaceRoot: 'd:\\workspace' }), []);
  for (const query of [undefined, {}, { sessionId: scope.sessionId }, { workspaceRoot: scope.workspaceRoot }, { ...scope, repository: null }]) {
    assert.throws(() => journal.list(query), TypeError);
  }
  // The same host instance retains history across repeated session switches.
  journal.list({ ...scope, sessionId: 'other' });
  assert.equal(journal.list(scope).length, 2);
  assert.deepEqual(new OperationJournal().list(scope), []);
});

test('sensitive and arbitrary fields are never read, copied or retained', () => {
  const journal = new OperationJournal();
  const secret = 'https://user:TOKEN@example.invalid/repo';
  const input = metadata({ message: secret, paths: ['secret.txt'], stdout: secret, stderr: secret, remoteUrl: secret, request: { token: secret } });
  Object.defineProperty(input, 'rawRequest', { enumerable: true, get() { throw new Error('must not read'); } });
  const id = journal.begin(input);
  journal.finish(id, { status: 'failed', errorCode: 'GIT_FAILED', message: secret, stderr: secret });
  const [record] = journal.list(scope);
  assert.deepEqual(Object.keys(record).sort(), ['id', 'sessionId', 'workspaceRoot', 'repository', 'operation', 'status', 'startedAt', 'finishedAt', 'durationMs', 'errorCode'].sort());
  assert.equal(JSON.stringify(record).includes('TOKEN'), false);
  for (const field of ['sessionId', 'workspaceRoot', 'repository', 'branch']) {
    assert.throws(() => journal.begin(metadata({ [field]: secret })), error => error instanceof TypeError && !error.message.includes('TOKEN'));
  }
});

test('unknown remains terminal; invalid and repeated finish never rewrite history', () => {
  let now = 10;
  const journal = new OperationJournal({ clock: () => now });
  const id = journal.begin(metadata());
  for (const result of [null, [], {}, { status: 'running' }, { status: 'failed', errorCode: 'secret body' }, { status: 'success', errorCode: 'GIT_FAILED' }]) {
    assert.throws(() => journal.finish(id, result), TypeError);
    assert.equal(journal.list(scope)[0].status, 'running');
  }
  now = 30;
  assert.equal(journal.finish(id, { status: 'unknown', errorCode: 'OUTCOME_UNKNOWN' }), true);
  const snapshot = journal.list(scope);
  now = 90;
  assert.equal(journal.finish(id, { status: 'success' }), false);
  assert.equal(journal.finish('absent', { status: 'failed' }), false);
  assert.throws(() => journal.finish(id, { status: 'oops' }), TypeError);
  assert.deepEqual(journal.list(scope), snapshot);
  assert.equal(snapshot[0].status, 'unknown');
  assert.equal(snapshot[0].durationMs, 20);
});

test('invalid metadata and clocks are atomic; backwards clocks do not yield negative duration', () => {
  let now = 20;
  const journal = new OperationJournal({ clock: () => now });
  for (const input of [null, [], metadata({ sessionId: {} }), metadata({ workspaceRoot: '' }), metadata({ repository: 'a\n' }), metadata({ operation: 'arbitrary' }), metadata({ branch: {} }), metadata({ fileCount: -1 }), metadata({ fileCount: 1.5 }), metadata({ fileCount: Infinity }), metadata({ sessionId: 'x'.repeat(513) })]) {
    assert.throws(() => journal.begin(input), TypeError);
  }
  assert.deepEqual(journal.list(scope), []);
  now = NaN;
  assert.throws(() => journal.begin(metadata()), TypeError);
  now = 20;
  const id = journal.begin(metadata({ fileCount: 0 }));
  now = Infinity;
  assert.throws(() => journal.finish(id, { status: 'success' }), TypeError);
  assert.equal(journal.list(scope)[0].status, 'running');
  now = 10;
  journal.finish(id, { status: 'success' });
  assert.equal(journal.list(scope)[0].durationMs, 0);
  assert.equal(journal.list(scope)[0].finishedAt, 10);
  assert.throws(() => new OperationJournal({ clock: 1 }), TypeError);
});
