import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scanRepositories, selectRepository } from '../repository-discovery.mjs';
import { GitReader } from '../git-core.mjs';
import { apply } from '../index.js';

const gitExecutable = process.env.GIT_TEST_EXECUTABLE || 'git';
function git(cwd, ...args) {
  return cp.execFileSync(gitExecutable, args, { cwd, encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } }).trim();
}
async function workspace(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'repositories-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function init(root, relative = '.', branch = 'main') {
  const target = path.join(root, relative);
  await mkdir(target, { recursive: true });
  git(target, 'init', '-b', branch);
  git(target, 'config', 'user.name', 'Repository Test');
  git(target, 'config', 'user.email', 'repository@example.invalid');
  return target;
}
async function commit(root, text) {
  await writeFile(path.join(root, 'file.txt'), text + '\n');
  git(root, 'add', '--all');
  git(root, 'commit', '-m', text);
}

test('scan includes depth 0 and 5, excludes 6, and continues inside repositories', async t => {
  const root = await workspace(t);
  await init(root);
  await init(root, 'nested');
  await init(root, 'a/b/c/d/e');
  await init(root, 'a/b/c/d/e/f');
  const scan = await scanRepositories(root);
  assert.deepEqual(scan.repositories.map(repo => repo.id), ['.', 'nested', 'a/b/c/d/e']);
  assert.equal(scan.repositories.at(-1).depth, 5);
  assert.equal(scan.repositories[0].kind, 'repository');
  assert.equal(scan.repositories[0].path, root);
  assert.equal(scan.maxDepth, 5);
  assert.equal(scan.truncated, false);
  assert.deepEqual(scan.warnings, []);
  assert.equal(scan.visited, 7);
  await assert.rejects(selectRepository(root, 'a/b/c/d/e/f'), /depth/);
});

test('scan and selection validate worktree and submodule git files', async t => {
  const root = await workspace(t);
  const main = await init(root, 'main');
  await commit(main, 'base');
  git(main, 'worktree', 'add', '-b', 'linked', path.join(root, 'linked'));
  const source = await init(root, 'source');
  await commit(source, 'source');
  git(main, '-c', 'protocol.file.allow=always', 'submodule', 'add', source, 'module');
  const scan = await scanRepositories(root);
  assert.equal(scan.truncated, false);
  assert.equal(scan.repositories.find(repo => repo.id === 'linked').kind, 'worktree');
  assert.equal(scan.repositories.find(repo => repo.id === 'main/module').kind, 'submodule');
  assert.equal((await selectRepository(root, 'linked')).path, path.join(root, 'linked'));
  assert.equal((await selectRepository(root, 'main/module')).kind, 'submodule');
});

test('rejects absolute, escape, invalid, internal and symlink selections', async t => {
  const root = await workspace(t);
  await init(root, 'safe');
  const outside = await workspace(t);
  await init(outside);
  await symlink(outside, path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  await symlink(path.join(root, 'safe'), path.join(root, 'inside-link'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const id of ['../outside', 'safe/../../outside', 'safe\\..\\outside', root, '/tmp', 'C:\\repo', 'C:repo', '\\\\server\\share', 'safe/.git', 'safe/../safe', 'safe//x', 'safe/./x', 'safe/.. /x', '', null, 4, 'bad\0id', 'link', 'inside-link']) {
    await assert.rejects(selectRepository(root, id), undefined, String(id));
  }
  const scan = await scanRepositories(root);
  assert.deepEqual(scan.repositories.map(repo => repo.id), ['safe']);
  await assert.rejects(selectRepository(path.join(root, 'link'), '.'), /symlink/);
});

test('invalid markers are not repositories and ordinary nested folders cannot select ancestors', async t => {
  const root = await workspace(t);
  await init(root);
  await mkdir(path.join(root, 'plain'));
  await mkdir(path.join(root, 'fake-directory', '.git'), { recursive: true });
  await mkdir(path.join(root, 'fake-file'));
  await writeFile(path.join(root, 'fake-file', '.git'), 'not a gitdir pointer');
  await mkdir(path.join(root, 'broken-file'));
  await writeFile(path.join(root, 'broken-file', '.git'), 'gitdir: absent\n');
  const scan = await scanRepositories(root);
  assert.deepEqual(scan.repositories.map(repo => repo.id), ['.']);
  assert.ok(scan.warnings.length >= 2);
  for (const id of ['plain', 'fake-directory', 'fake-file', 'broken-file']) await assert.rejects(selectRepository(root, id));
});

test('plain workspace returns empty and only checks Git once for root compatibility', async t => {
  const root = await workspace(t);
  await mkdir(path.join(root, 'a/b/c'), { recursive: true });
  const original = GitReader.prototype._isRepository;
  let checks = 0;
  GitReader.prototype._isRepository = async function () { checks++; return original.call(this); };
  t.after(() => { GitReader.prototype._isRepository = original; });
  const scan = await scanRepositories(root);
  assert.deepEqual(scan.repositories, []);
  assert.equal(scan.truncated, false);
  assert.equal(scan.visited, 4);
  assert.equal(checks, 1);
  await assert.rejects(selectRepository(root), /not a Git repository/);
});

test('dot selection explicitly preserves session-inside-repository behavior', async t => {
  const root = await workspace(t);
  await init(root);
  await mkdir(path.join(root, 'child'));
  const selected = await selectRepository(path.join(root, 'child'), '.');
  assert.equal(selected.path, root);
  assert.equal(selected.kind, 'ancestor');
  assert.equal(selected.id, '.');
  assert.deepEqual((await scanRepositories(path.join(root, 'child'))).repositories, [selected]);
});

test('directory, repository and wall-clock budgets explicitly report truncation', async t => {
  const root = await workspace(t);
  await init(root, 'one');
  await init(root, 'two');
  for (const options of [{ maxDirectories: 1 }, { maxRepositories: 1 }]) {
    const scan = await scanRepositories(root, options);
    assert.equal(scan.truncated, true);
    assert.ok(scan.warnings.some(warning => /limit/.test(warning)));
    assert.ok(scan.visited <= (options.maxDirectories || 5000));
    assert.ok(scan.repositories.length <= (options.maxRepositories || 100));
  }
  const original = GitReader.prototype._isRepository;
  GitReader.prototype._isRepository = async () => { await new Promise(resolve => setTimeout(resolve, 50)); return false; };
  t.after(() => { GitReader.prototype._isRepository = original; });
  const timed = await scanRepositories(root, { timeoutMs: 10 });
  assert.equal(timed.truncated, true);
  assert.ok(timed.warnings.some(warning => /time limit/.test(warning)));
});

test('routes discover and isolate independent repositories using server session root', async t => {
  const root = await workspace(t);
  const one = await init(root, 'one', 'first');
  const two = await init(root, 'two', 'second');
  await commit(one, 'first base');
  await commit(two, 'second base');
  await writeFile(path.join(one, 'file.txt'), 'ONLY_ONE\n');
  await writeFile(path.join(two, 'file.txt'), 'ONLY_TWO\n');
  const routes = new Map();
  apply({ connection: { fetch: { register: route => routes.set(route.path.split('/').at(-1), route) } }, sessions: { get: id => id === 'session-test' ? { header: { cwd: root } } : undefined }, get: () => undefined, sandboxPolicy: { workspaceRoot: two } });
  const request = async (action, body = {}) => {
    const response = await routes.get(action).fetch(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ sessionId: 'session-test', ...body }) }));
    return { status: response.status, body: await response.json() };
  };
  assert.equal(routes.size, 9);
  assert.deepEqual((await request('repositories')).body.repositories.map(repo => repo.id), ['one', 'two']);
  assert.equal((await request('snapshot', { repository: 'one', cwd: two })).body.branch, 'first');
  assert.equal((await request('snapshot', { repository: 'two', root: one })).body.branch, 'second');
  const first = await request('diff', { repository: 'one', path: 'file.txt' });
  assert.equal(first.status, 200);
  assert.match(first.body.text, /ONLY_ONE/);
  assert.doesNotMatch(first.body.text, /ONLY_TWO/);
  assert.match((await request('diff', { repository: 'two', path: 'file.txt' })).body.text, /ONLY_TWO/);
  assert.equal((await request('snapshot')).status, 400);
  assert.equal((await request('snapshot', { repository: two })).status, 400);
  assert.equal((await request('diff', { repository: '../two' })).status, 400);
  assert.equal((await request('snapshot', { repository: null })).status, 400);
});
