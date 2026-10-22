import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { apply } from '../index.js';
import { GitActions } from '../git-actions.mjs';

const executable = process.env.GIT_TEST_EXECUTABLE || 'git';
function git(cwd, ...args) {
  return cp.execFileSync(executable, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 10000, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' } }).trim();
}
async function workspace(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'git-api-actions-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function repository(root, name = 'repo') {
  const directory = path.join(root, name);
  await mkdir(directory, { recursive: true });
  git(directory, 'init', '-b', 'main');
  git(directory, 'config', 'user.name', 'API Test');
  git(directory, 'config', 'user.email', 'api@example.invalid');
  git(directory, 'config', 'core.autocrlf', 'false');
  await writeFile(path.join(directory, 'file.txt'), 'initial\n');
  git(directory, 'add', '--', 'file.txt');
  git(directory, 'commit', '-m', 'initial');
  return directory;
}
function api(root, { persisted = false, fallback = root } = {}) {
  const routes = new Map();
  apply({
    connection: { fetch: { register: route => routes.set(route.path.split('/').at(-1), route) } },
    sessions: { get: id => !persisted && id === 'session-api' ? { header: { cwd: root } } : undefined },
    get: name => name === 'sessionPersistence' ? { stat: async id => persisted && id === 'session-api' ? { header: { cwd: root } } : undefined } : undefined,
    sandboxPolicy: { workspaceRoot: fallback },
  });
  return async (route, body = {}) => {
    const response = await routes.get(route).fetch(new Request('http://localhost/api/git-visualizer/' + route, {
      method: 'POST', body: JSON.stringify({ sessionId: 'session-api', ...body }),
    }));
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    return { status: response.status, body: await response.json() };
  };
}
async function action(request, operation, parameters = {}, repositoryId = 'repo') {
  const details = await request('details', { repository: repositoryId });
  assert.equal(details.status, 200, JSON.stringify(details.body));
  return request('action', { repository: repositoryId, confirm: true, operation,
    expectedHead: details.body.head, expectedBranch: details.body.branch, ...parameters });
}
function successful(result) {
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(typeof result.body.message, 'string');
  assert.equal(typeof result.body.output, 'string');
}

// Every actual Git write in this file targets a newly-created temporary repository.
test('details and mutations stage/unstage/commit then return fresh snapshot and diff', async t => {
  const root = await workspace(t);
  const repo = await repository(root);
  const request = api(root);
  const scan = await request('repositories');
  assert.equal(scan.body.workspaceRoot, root);
  const initial = await request('details', { repository: 'repo' });
  assert.equal(initial.status, 200);
  assert.equal(initial.body.head, git(repo, 'rev-parse', 'HEAD'));
  assert.equal(initial.body.branch, 'main');
  assert.equal(initial.body.clean, true);
  assert.deepEqual(initial.body.remotes, []);
  assert.equal(initial.body.ahead, 0);
  assert.equal(initial.body.behind, 0);
  await writeFile(path.join(repo, 'file.txt'), 'changed\n');
  successful(await action(request, 'stage', { paths: ['file.txt'] }));
  assert.equal((await request('snapshot', { repository: 'repo' })).body.status[0].index, 'M');
  assert.match((await request('diff', { repository: 'repo', staged: true, path: 'file.txt' })).body.text, /changed/);
  successful(await action(request, 'unstage', { paths: ['file.txt'] }));
  assert.equal((await request('snapshot', { repository: 'repo' })).body.status[0].worktree, 'M');
  successful(await action(request, 'stage', { paths: ['file.txt'] }));
  successful(await action(request, 'commit', { message: 'API commit 中文' }));
  const snapshot = await request('snapshot', { repository: 'repo' });
  assert.equal(snapshot.body.commits[0].subject, 'API commit 中文');
  assert.deepEqual(snapshot.body.status, []);
  const final = await request('details', { repository: 'repo' });
  assert.notEqual(final.body.head, initial.body.head);
  assert.equal(final.body.clean, true);
});

test('unborn HEAD and detached branch accept explicit null expected state', async t => {
  const root = await workspace(t);
  const repo = path.join(root, 'repo');
  await mkdir(repo);
  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.name', 'Unborn API');
  git(repo, 'config', 'user.email', 'unborn@example.invalid');
  const request = api(root);
  const unborn = await request('details', { repository: 'repo' });
  assert.equal(unborn.status, 200);
  assert.equal(unborn.body.head, null);
  assert.equal(unborn.body.branch, 'main');
  await writeFile(path.join(repo, 'first.txt'), 'first commit\n');
  successful(await action(request, 'stage', { paths: ['first.txt'] }));
  successful(await action(request, 'unstage', { paths: ['first.txt'] }));
  assert.equal((await request('snapshot', { repository: 'repo' })).body.status[0].index, '?');
  successful(await action(request, 'stage', { paths: ['first.txt'] }));
  successful(await action(request, 'commit', { message: 'first via API' }));
  assert.equal((await request('snapshot', { repository: 'repo' })).body.commits[0].subject, 'first via API');
  git(repo, 'checkout', '--detach', 'HEAD');
  assert.equal((await request('details', { repository: 'repo' })).body.branch, null);
  await writeFile(path.join(repo, 'first.txt'), 'detached change\n');
  successful(await action(request, 'stage', { paths: ['first.txt'] }));
  assert.equal((await request('snapshot', { repository: 'repo' })).body.status[0].index, 'M');
});

test('branch creation and switching succeed using freshly loaded expected state', async t => {
  const root = await workspace(t);
  await repository(root);
  const request = api(root);
  successful(await action(request, 'createBranch', { branch: 'feature/api' }));
  assert.ok((await request('snapshot', { repository: 'repo' })).body.branches.includes('feature/api'));
  successful(await action(request, 'switchBranch', { branch: 'feature/api' }));
  assert.equal((await request('snapshot', { repository: 'repo' })).body.branch, 'feature/api');
  successful(await action(request, 'switchBranch', { branch: 'main' }));
  assert.equal((await request('details', { repository: 'repo' })).body.branch, 'main');
});

test('fetch/pull/push operate only on temporary local remotes', async t => {
  const root = await workspace(t);
  const repo = await repository(root);
  const remote = path.join(root, 'remote.git');
  await mkdir(remote);
  git(remote, 'init', '--bare', '-b', 'main');
  git(repo, 'remote', 'add', 'origin', remote);
  git(repo, 'push', '-u', 'origin', 'main');
  const request = api(root);
  assert.deepEqual((await request('details', { repository: 'repo' })).body.remotes, [{ name: 'origin' }]);
  await writeFile(path.join(repo, 'file.txt'), 'local commit\n');
  successful(await action(request, 'stage', { paths: ['file.txt'] }));
  successful(await action(request, 'commit', { message: 'push via API' }));
  successful(await action(request, 'push'));
  assert.equal(git(remote, 'rev-parse', 'refs/heads/main'), git(repo, 'rev-parse', 'HEAD'));
  const peer = path.join(root, 'peer');
  git(root, 'clone', remote, peer);
  git(peer, 'config', 'user.name', 'Peer');
  git(peer, 'config', 'user.email', 'peer@example.invalid');
  await writeFile(path.join(peer, 'file.txt'), 'remote change\n');
  git(peer, 'add', '--', 'file.txt');
  git(peer, 'commit', '-m', 'remote commit');
  git(peer, 'push');
  successful(await action(request, 'fetch'));
  assert.equal((await request('details', { repository: 'repo' })).body.behind, 1);
  successful(await action(request, 'pull'));
  assert.equal((await request('snapshot', { repository: 'repo' })).body.commits[0].subject, 'remote commit');
  assert.equal(await readFile(path.join(repo, 'file.txt'), 'utf8'), 'remote change\n');
});

test('actions require explicit confirmation, repository and both expected state fields', async t => {
  const root = await workspace(t);
  const repo = await repository(root);
  await writeFile(path.join(repo, 'file.txt'), 'untouched\n');
  const request = api(root);
  const details = (await request('details', { repository: 'repo' })).body;
  const valid = { repository: 'repo', operation: 'stage', paths: ['file.txt'], confirm: true, expectedHead: details.head, expectedBranch: details.branch };
  for (const key of ['confirm', 'repository', 'expectedHead', 'expectedBranch']) {
    const body = { ...valid };
    delete body[key];
    assert.equal((await request('action', body)).status, 400, key);
  }
  for (const confirm of [false, 'true', 1, null]) assert.equal((await request('action', { ...valid, confirm })).status, 400);
  for (const expectedHead of [1, {}, []]) assert.equal((await request('action', { ...valid, expectedHead })).status, 400);
  for (const expectedBranch of [1, {}, []]) assert.equal((await request('action', { ...valid, expectedBranch })).status, 400);
  assert.equal(git(repo, 'diff', '--cached'), '');
  assert.equal(git(repo, 'rev-parse', 'HEAD'), details.head);
});

test('action parameter and operation allowlists reject arbitrary execution and malformed input', async t => {
  const root = await workspace(t);
  const repo = await repository(root);
  const request = api(root);
  const details = (await request('details', { repository: 'repo' })).body;
  const base = { repository: 'repo', confirm: true, expectedHead: details.head, expectedBranch: details.branch };
  const invalid = [
    { operation: 'reset' }, { operation: 'exec', command: 'git status' }, { operation: 'constructor' },
    { operation: ['fetch'] }, { operation: null }, { operation: 'push', force: true },
    { operation: 'fetch', cwd: root }, { operation: 'fetch', args: [] }, { operation: 'pull', remote: 'evil' },
    { operation: 'fetch', branch: 'main' }, { operation: 'commit', message: 'x', paths: ['file.txt'] },
    { operation: 'stage' }, { operation: 'stage', paths: [] }, { operation: 'stage', paths: [''] },
    { operation: 'stage', paths: [1] }, { operation: 'stage', paths: 'file.txt' },
    { operation: 'stage', paths: ['bad\0file'] }, { operation: 'unstage', paths: Array(257).fill('file.txt') },
    { operation: 'commit', message: '' }, { operation: 'commit', message: '  ' }, { operation: 'commit', message: 3 },
    { operation: 'createBranch', branch: '' }, { operation: 'switchBranch', branch: 1 },
    { operation: 'createBranch', branch: '--help' }, { operation: 'switchBranch', branch: 'main~1' },
  ];
  for (const parameters of invalid) assert.equal((await request('action', { ...base, ...parameters })).status, 400, JSON.stringify(parameters));
  const polluted = JSON.parse(JSON.stringify({ ...base, operation: 'fetch' }).slice(0, -1) + ',"__proto__":{}}');
  assert.equal((await request('action', polluted)).status, 400);
  assert.equal(git(repo, 'rev-parse', 'HEAD'), details.head);
  assert.deepEqual((await request('snapshot', { repository: 'repo' })).body.branches, ['main']);
});

test('repository and file escapes are rejected without writing outside the selected repository', async t => {
  const root = await workspace(t);
  const repo = await repository(root);
  const outside = await workspace(t);
  await repository(outside, '.');
  await writeFile(path.join(outside, 'secret.txt'), 'outside\n');
  await symlink(outside, path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  const request = api(root);
  const details = (await request('details', { repository: 'repo' })).body;
  const base = { repository: 'repo', confirm: true, operation: 'stage', paths: ['file.txt'], expectedHead: details.head, expectedBranch: details.branch };
  for (const repository of [root, outside, '../repo', 'repo/../repo', 'repo/.git', 'link', 'C:\\repo', 'repo//child', null, 2]) {
    assert.equal((await request('action', { ...base, repository })).status, 400, String(repository));
    assert.equal((await request('details', { repository })).status, 400, String(repository));
  }
  for (const file of ['../secret.txt', '..\\secret.txt', '/secret.txt', 'C:\\secret.txt', 'sub/../../secret.txt']) {
    assert.equal((await request('action', { ...base, paths: [file] })).status, 400, file);
  }
  assert.equal(git(repo, 'diff', '--cached'), '');
  assert.equal(git(outside, 'diff', '--cached'), '');
  assert.equal(await readFile(path.join(outside, 'secret.txt'), 'utf8'), 'outside\n');
});

test('stale head or branch is a 409 and releases repository mutex for later actions', async t => {
  const root = await workspace(t);
  const repo = await repository(root);
  const request = api(root);
  const details = (await request('details', { repository: 'repo' })).body;
  await writeFile(path.join(repo, 'file.txt'), 'new content\n');
  const base = { repository: 'repo', confirm: true, operation: 'stage', paths: ['file.txt'], expectedHead: details.head, expectedBranch: details.branch };
  for (const state of [{ expectedHead: '0'.repeat(40) }, { expectedHead: null }, { expectedBranch: 'other' }, { expectedBranch: null }]) {
    const result = await request('action', { ...base, ...state });
    assert.equal(result.status, 409, JSON.stringify(result.body));
    assert.equal(typeof result.body.error, 'string');
  }
  assert.equal(git(repo, 'diff', '--cached'), '');
  successful(await request('action', base));
});

test('canonical repository mutex spans sessions/plugin instances and always releases after failure', async t => {
  const root = await workspace(t);
  const repo = await repository(root);
  const child = path.join(repo, 'nested');
  await mkdir(child);
  const request = api(root);
  const alias = api(child, { persisted: true });
  const details = (await request('details', { repository: 'repo' })).body;
  const body = { repository: 'repo', confirm: true, operation: 'fetch', expectedHead: details.head, expectedBranch: details.branch };
  const original = GitActions.prototype.execute;
  let enter, release;
  const entered = new Promise(resolve => { enter = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  GitActions.prototype.execute = async function () { enter(this.root); await hold; throw new Error('controlled action failure'); };
  t.after(() => { release(); GitActions.prototype.execute = original; });
  const pending = request('action', body);
  await Promise.race([entered, pending.then(result => { throw new Error('Action did not acquire mutex: ' + JSON.stringify(result)); })]);
  try {
    const busy = await alias('action', { ...body, repository: '.' });
    assert.equal(busy.status, 409);
    assert.match(busy.body.error, /仓库|操作/);
    assert.equal((await request('snapshot', { repository: 'repo' })).status, 200);
  } finally { release(); }
  assert.equal((await pending).status, 400);
  GitActions.prototype.execute = original;
  successful(await action(request, 'createBranch', { branch: 'after-failure' }));
});

test('request concurrency is bounded and independent repositories do not share an action mutex', async t => {
  const root = await workspace(t);
  const request = api(root);
  const bodies = [];
  for (let i = 0; i < 4; i++) {
    await repository(root, 'repo' + i);
    const details = (await request('details', { repository: 'repo' + i })).body;
    bodies.push({ repository: 'repo' + i, operation: 'fetch', confirm: true, expectedHead: details.head, expectedBranch: details.branch });
  }
  const original = GitActions.prototype.execute;
  let release, allEntered;
  let entered = 0;
  const hold = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { allEntered = resolve; });
  GitActions.prototype.execute = async function () { if (++entered === 4) allEntered(); await hold; return { message: 'mock success', output: '' }; };
  t.after(() => { release(); GitActions.prototype.execute = original; });
  const pending = bodies.map(body => request('action', body));
  await Promise.race([ready, ...pending.map(item => item.then(result => { throw new Error('Action returned before hold: ' + JSON.stringify(result)); }))]);
  try { assert.equal((await request('details', { repository: 'repo0' })).status, 429); }
  finally { release(); }
  for (const result of await Promise.all(pending)) successful(result);
  GitActions.prototype.execute = original;
  assert.equal((await request('details', { repository: 'repo0' })).status, 200);
});

test('persisted sessions use their server root, not caller-supplied cwd', async t => {
  const root = await workspace(t);
  const repo = await repository(root);
  const request = api(root, { persisted: true, fallback: path.join(root, 'not-the-session-root') });
  assert.equal((await request('details', { repository: 'repo' })).body.head, git(repo, 'rev-parse', 'HEAD'));
  const details = (await request('details', { repository: 'repo' })).body;
  assert.equal((await request('action', { repository: 'repo', operation: 'fetch', confirm: true, expectedHead: details.head, expectedBranch: details.branch, cwd: repo })).status, 400);
});
