import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { apply } from '../index.js';
import { GitActions } from '../git-actions.mjs';
import { GitReader } from '../git-core.mjs';
import { OperationJournal } from '../operation-journal.mjs';

const executable = process.env.GIT_TEST_EXECUTABLE || (process.platform === 'win32' ? 'C:\\Program Files\\Git\\cmd\\git.exe' : 'git');
function git(cwd, ...args) {
  return cp.execFileSync(executable, ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false', ...args], {
    cwd, encoding: 'utf8', windowsHide: true, timeout: 10000,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}
async function fixture(t, count = 1) {
  const root = await mkdtemp(path.join(tmpdir(), 'journal-api-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (let i = 0; i < count; i++) {
    const directory = path.join(root, `repo${i}`);
    await mkdir(directory);
    git(directory, 'init', '-b', 'main');
    git(directory, 'config', 'user.name', 'Journal Test');
    git(directory, 'config', 'user.email', 'journal@example.invalid');
  }
  return root;
}
function api(initialRoot, { persisted = false } = {}) {
  const routes = new Map();
  const state = { root: initialRoot };
  apply({
    connection: { fetch: { register: route => routes.set(route.path.split('/').at(-1), route) } },
    sessions: { get: id => !persisted && id !== 'session-missing' ? { header: { cwd: state.root } } : undefined },
    get: () => ({ stat: async id => persisted && id !== 'session-missing' ? { header: { cwd: state.root } } : undefined }),
    sandboxPolicy: { workspaceRoot: initialRoot },
  });
  return {
    state,
    async request(route, body = {}) {
      const response = await routes.get(route).fetch(new Request(`http://localhost/api/git-visualizer/${route}`, {
        method: 'POST', body: JSON.stringify({ sessionId: 'session-journal', ...body }),
      }));
      assert.equal(response.headers.get('cache-control'), 'no-store');
      return { status: response.status, body: await response.json() };
    },
  };
}
const action = (extra = {}) => ({ repository: 'repo0', operation: 'fetch', confirm: true, expectedHead: null, expectedBranch: 'main', ...extra });
function gate() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

// All actual writes (including Git setup) are confined to disposable temp repos.
test('real stage/commit keeps only metadata and response remains compatible', async t => {
  const root = await fixture(t);
  const request = api(root).request;
  const directory = path.join(root, 'repo0');
  const filename = 'private-file.txt';
  const message = 'private commit body TOKEN-do-not-retain';
  await writeFile(path.join(directory, filename), 'private file contents');
  assert.equal((await request('action', action({ operation: 'stage', paths: [filename] }))).status, 200);
  const commit = await request('action', action({ operation: 'commit', message }));
  assert.equal(commit.status, 200, JSON.stringify(commit.body));
  assert.deepEqual(Object.keys(commit.body).sort(), ['message', 'output']);
  assert.equal(git(directory, 'log', '-1', '--format=%s'), message);
  const history = await request('activity');
  assert.equal(history.status, 200);
  assert.equal(history.body.persistent, false);
  assert.equal(history.body.records.length, 2);
  assert.deepEqual(history.body.records.map(record => record.operation), ['commit', 'stage']);
  assert.equal(history.body.records[1].fileCount, 1);
  for (const record of history.body.records) {
    assert.equal(record.repository, 'repo0');
    assert.equal(record.workspaceRoot, root);
    assert.equal(record.sessionId, 'session-journal');
    assert.equal(record.status, 'success');
    assert.ok(record.finishedAt >= record.startedAt);
    assert.ok(record.durationMs >= 0);
    for (const field of ['message', 'paths', 'stdout', 'stderr', 'output', 'args', 'remoteUrl']) assert.equal(Object.hasOwn(record, field), false);
  }
  assert.equal(JSON.stringify(history.body).includes(message), false);
  assert.equal(JSON.stringify(history.body).includes(filename), false);
  // A missing repository must not prevent viewing its old records.
  await rm(directory, { recursive: true, force: true });
  assert.equal((await request('activity', { repository: 'repo0' })).body.records.length, 2);
});

test('running is visible across contexts; session/root and repo filters isolate history', async t => {
  const root = await fixture(t);
  const first = api(root);
  const second = api(root, { persisted: true });
  const entered = gate();
  const release = gate();
  t.mock.method(GitActions.prototype, 'execute', async () => {
    entered.resolve();
    await release.promise;
    return { message: 'fetch completed', output: '' };
  });
  const pending = first.request('action', action());
  try {
    await entered.promise;
    const running = await second.request('activity');
    assert.equal(running.body.records[0].status, 'running');
    assert.equal(Object.hasOwn(running.body.records[0], 'finishedAt'), false);
    assert.equal((await first.request('action', action())).status, 409);
    assert.deepEqual((await second.request('activity', { sessionId: 'session-other' })).body.records, []);
    for (const repository of ['repo', 'REPO0', 'repo0/', '../repo0', 'https://example.invalid/no-repo']) {
      assert.deepEqual((await second.request('activity', { repository })).body.records, []);
    }
    second.state.root = root + '-different';
    assert.deepEqual((await second.request('activity')).body.records, []);
    // Changing the calling context cannot change the action's captured root.
    first.state.root = root + '-switched';
  } finally { release.resolve(); }
  assert.equal((await pending).status, 200);
  second.state.root = root;
  assert.equal((await second.request('activity', { repository: 'repo0' })).body.records[0].status, 'success');
  assert.deepEqual((await first.request('activity')).body.records, []);
});

test('failed/stale/unknown outcomes use only closed machine codes and release locks', async t => {
  const root = await fixture(t);
  const request = api(root).request;
  let failure;
  t.mock.method(GitActions.prototype, 'execute', async () => { throw failure; });
  for (const [error, status, errorCode, http] of [
    [Object.assign(new Error('stale'), { code: 'STALE_STATE' }), 'failed', 'STALE_STATE', 409],
    [Object.assign(new Error('sensitive stderr TOKEN'), { code: 128 }), 'failed', 'GIT_FAILED', 400],
    [Object.assign(new Error('timeout'), { code: 'ETIMEDOUT', uncertain: true }), 'unknown', 'OUTCOME_UNKNOWN', 400],
    [Object.assign(new Error('too much output'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', uncertain: true }), 'unknown', 'OUTCOME_UNKNOWN', 400],
  ]) {
    failure = error;
    assert.equal((await request('action', action())).status, http);
    const [record] = (await request('activity')).body.records;
    assert.equal(record.status, status);
    assert.equal(record.errorCode, errorCode);
    assert.equal(JSON.stringify(record).includes('TOKEN'), false);
  }
  assert.equal((await request('activity')).body.records.length, 4);
});

test('invalid requests never create records; activity uses pure optional string filters', async t => {
  const root = await fixture(t);
  const request = api(root).request;
  for (const body of [{ repository: null }, { repository: 1 }, { repository: '' }, { repository: 'a\0b' }, { repository: 'a'.repeat(32769) }, { clear: true }, { operation: 'fetch' }, { sessionId: 'invalid' }]) {
    assert.ok([400, 413].includes((await request('activity', body)).status));
  }
  assert.equal((await request('activity', { sessionId: 'session-missing' })).status, 404);
  for (const body of [action({ confirm: false }), action({ operation: 'arbitrary' }), action({ message: 'unexpected' }), action({ repository: 'missing' }), action({ operation: 'stage', paths: [] })]) {
    assert.equal((await request('action', body)).status, 400);
  }
  assert.deepEqual((await request('activity')).body.records, []);
  assert.equal((await request('activity', { repository: '\n' })).status, 200);
});

test('global four-request budget works across instances and returns slots after completion', async t => {
  const root = await fixture(t, 4);
  const one = api(root);
  const two = api(root);
  const entered = gate();
  const release = gate();
  let count = 0;
  t.mock.method(GitActions.prototype, 'execute', async () => {
    if (++count === 4) entered.resolve();
    await release.promise;
    return { message: 'fetch completed', output: '' };
  });
  const pending = Array.from({ length: 4 }, (_, i) => one.request('action', action({ repository: `repo${i}` })));
  try {
    await entered.promise;
    assert.equal((await two.request('action', action())).status, 429);
    assert.equal((await two.request('activity')).status, 429);
  } finally { release.resolve(); }
  assert.ok((await Promise.all(pending)).every(response => response.status === 200));
  const history = await two.request('activity');
  assert.equal(history.status, 200);
  assert.equal(history.body.records.length, 4);
  assert.ok(history.body.records.every(record => record.status === 'success'));
});

test('activity is capped at 100 newest records', async t => {
  const root = await fixture(t);
  const request = api(root).request;
  t.mock.method(GitActions.prototype, 'execute', async () => ({ message: 'stage completed', output: '' }));
  for (let i = 1; i <= 103; i++) {
    assert.equal((await request('action', action({ operation: 'stage', paths: Array(i).fill('not-stored.txt') }))).status, 200);
  }
  const records = (await request('activity')).body.records;
  assert.equal(records.length, 100);
  assert.equal(records[0].fileCount, 103);
  assert.equal(records.at(-1).fileCount, 4);
});

test('journal failures cannot execute before begin or misreport completed mutations', async t => {
  const root = await fixture(t);
  const request = api(root).request;
  let executions = 0;
  t.mock.method(GitActions.prototype, 'execute', async () => {
    executions++;
    return { message: 'fetch completed', output: '' };
  });
  const beginMock = t.mock.method(OperationJournal.prototype, 'begin', () => { throw new Error('Busy'); });
  assert.equal((await request('action', action())).status, 400);
  assert.equal(executions, 0);
  beginMock.mock.restore();
  const originalFinish = OperationJournal.prototype.finish;
  let cleanup;
  const finishMock = t.mock.method(OperationJournal.prototype, 'finish', function (...args) {
    cleanup = () => originalFinish.apply(this, args);
    throw new Error('clock failure');
  });
  try {
    assert.equal((await request('action', action())).status, 200);
    assert.equal(executions, 1);
  } finally {
    finishMock.mock.restore();
    cleanup?.();
  }
  assert.equal((await request('action', action())).status, 200);
});

test('_git marks interruptions as uncertain without changing native error codes', async t => {
  let current;
  t.mock.method(cp, 'execFile', (_file, _args, _options, callback) => { callback(current, '', 'private stderr'); });
  const reader = new GitReader(tmpdir());
  for (const [properties, expected] of [
    [{ code: 1, killed: true }, true],
    [{ code: null, signal: 'SIGTERM' }, true],
    [{ code: 'ETIMEDOUT' }, true],
    [{ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }, true],
    [{ code: 'ABORT_ERR' }, true],
    [{ code: 128 }, false],
    [{ code: 'ENOENT' }, false],
  ]) {
    current = Object.assign(new Error('native failure'), properties);
    await assert.rejects(reader._git(['status']), error => error.code === properties.code && error.uncertain === expected);
  }
  current = Object.assign(new Error('accepted but interrupted'), { code: 1, signal: 'SIGTERM' });
  await assert.rejects(reader._git(['status'], [1]), error => error.uncertain === true);
  current = Object.assign(new Error('accepted'), { code: 1 });
  assert.equal((await reader._git(['status'], [1])).code, 1);
});

test('network error wrapper preserves uncertain and code while redacting URLs', async () => {
  const actions = new GitActions(tmpdir());
  actions.details = async () => ({ branch: 'main', head: 'a'.repeat(40), clean: true });
  actions._upstream = async () => ({ remote: 'origin', ref: 'refs/heads/main' });
  actions._git = async () => { throw Object.assign(new Error('https://user:TOKEN@example.invalid failed'), { code: 'ETIMEDOUT', uncertain: true }); };
  await assert.rejects(actions.execute({ operation: 'fetch' }), error => error.uncertain === true && error.code === 'ETIMEDOUT' && !error.message.includes('TOKEN'));
});
