import { test } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, renameSync, rmSync, openSync, closeSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GitReader } from '../git-core.mjs';

// Explicit sandbox-only adapter. It exercises real Git and the production argument
// construction/parsers, NOT execFile's asynchronous pipe/timeout implementation.
// execFile ignores stdio, whereas execFileSync supports regular-file descriptors.
const fileStdio = process.env.GIT_TEST_FILE_STDIO === '1';
function runFile(file, args, options = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'git-test-stdio-'));
  const outPath = path.join(dir, 'out');
  const errPath = path.join(dir, 'err');
  const out = openSync(outPath, 'w+');
  const err = openSync(errPath, 'w+');
  let failure;
  try { cp.execFileSync(file, args, { ...options, stdio: ['ignore', out, err] }); }
  catch (error) { failure = error; }
  finally { closeSync(out); closeSync(err); }
  try {
    const stdout = readFileSync(outPath, 'utf8');
    const stderr = readFileSync(errPath, 'utf8');
    if (failure) { failure.stdout = stdout; failure.stderr = stderr; failure.code = failure.status ?? failure.code; }
    return { error: failure, stdout, stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

if (fileStdio) {
  cp.execFile = (file, args, options, callback) => {
    const result = runFile(file, args, options);
    queueMicrotask(() => callback(result.error, result.stdout, result.stderr));
  };
}
function git(root, ...args) {
  const result = runFile('git', args, { cwd: root, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' }, timeout: 10000 });
  if (result.error) throw result.error;
  return result.stdout.trim();
}
function repository(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'git-reader-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', '中文作者');
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
  return root;
}
function write(root, name, text) { writeFileSync(path.join(root, name), text); }
function commit(root, subject) { git(root, 'add', '--all'); git(root, 'commit', '-m', subject); return git(root, 'rev-parse', 'HEAD'); }

test('unborn repository and non-repository have predictable results', async t => {
  const root = repository(t);
  const reader = new GitReader(root);
  assert.deepEqual(await reader.snapshot(), { isRepository: true, branch: 'main', status: [], branches: [], commits: [] });
  assert.equal(await reader.diff(), '');
  write(root, '新文件.txt', 'hello\n');
  assert.deepEqual((await reader.snapshot()).status, [{ path: '新文件.txt', index: '?', worktree: '?', oldPath: null }]);
  git(root, 'add', '--all');
  assert.match(await reader.diff({ staged: true }), /hello/);
  const plain = mkdtempSync(path.join(tmpdir(), 'not-git-'));
  t.after(() => rmSync(plain, { recursive: true, force: true }));
  assert.deepEqual(await new GitReader(plain).snapshot(), { isRepository: false, branch: null, status: [], branches: [], commits: [] });
  await assert.rejects(new GitReader(plain).diff(), { code: 'NOT_GIT_REPOSITORY' });
});

test('history, refs, Unicode rename, staged and worktree diffs', async t => {
  const root = repository(t);
  write(root, '原始 中文.txt', 'one\ntwo\nthree\n');
  const initial = commit(root, '首次提交');
  git(root, 'branch', 'feature');
  git(root, 'tag', 'v1');
  renameSync(path.join(root, '原始 中文.txt'), path.join(root, '重命名 中文.txt'));
  git(root, 'add', '--all');
  write(root, '重命名 中文.txt', 'one\ntwo\nthree\nworktree-line\n');
  const reader = new GitReader(root);
  const snapshot = await reader.snapshot();
  assert.equal(snapshot.branch, 'main');
  assert.deepEqual(snapshot.branches, ['feature', 'main']);
  assert.deepEqual(snapshot.status, [{ path: '重命名 中文.txt', index: 'R', worktree: 'M', oldPath: '原始 中文.txt' }]);
  assert.equal(snapshot.commits[0].hash, initial);
  assert.equal(snapshot.commits[0].subject, '首次提交');
  assert.equal(snapshot.commits[0].author, '中文作者');
  assert.deepEqual(snapshot.commits[0].parents, []);
  assert.ok(snapshot.commits[0].refs.includes('tag: v1'));
  assert.ok(!Number.isNaN(Date.parse(snapshot.commits[0].date)));
  assert.match(await reader.diff({ path: '重命名 中文.txt' }), /\+worktree-line/);
  assert.match(await reader.diff({ staged: true }), /rename from 原始 中文.txt/);
  assert.match(await reader.diff({ commit: initial }), /\+one/);
  const second = commit(root, 'second');
  assert.deepEqual((await reader.snapshot()).commits[0].parents, [initial]);
  git(root, 'checkout', '--detach', second);
  assert.equal((await reader.snapshot()).branch, null);
});

test('literal pathspecs, input rejection, and disabled diff drivers', async t => {
  const root = repository(t);
  write(root, '[abc].txt', 'before\n');
  write(root, 'a.txt', 'other-before\n');
  write(root, '.gitattributes', '*.txt diff=unsafe\n');
  commit(root, 'base');
  git(root, 'config', 'diff.unsafe.command', 'definitely-no-such-external-command');
  git(root, 'config', 'diff.unsafe.textconv', 'definitely-no-such-textconv-command');
  write(root, '[abc].txt', 'literal-after\n');
  write(root, 'a.txt', 'other-after\n');
  const reader = new GitReader(root);
  const diff = await reader.diff({ path: '[abc].txt' });
  assert.match(diff, /literal-after/);
  assert.doesNotMatch(diff, /other-after/);
  assert.equal(await reader.diff({ path: ':(glob)*' }), '');
  for (const bad of ['../secret', 'sub/../../secret', '..\\secret', '/etc/passwd', 'C:\\secret', 'C:secret', '\\\\server\\share', 'bad\0path', '']) {
    await assert.rejects(reader.diff({ path: bad }), /path/);
  }
  for (const bad of ['HEAD', '--help', 'abcd~1', 'abcd;echo', 'a'.repeat(65), '', 12]) {
    await assert.rejects(reader.diff({ commit: bad }), /hexadecimal/);
  }
  await assert.rejects(reader.diff({ staged: 'yes' }), /boolean/);
  await assert.rejects(reader.diff({ commit: 'abcd', staged: true }), /cannot be combined/);
  await assert.rejects(reader.diff({ commit: 'deadbeef' }), /Git read failed/);
});

test('subdirectory sessions use repository-root status paths for diffs', async t => {
  const root = repository(t);
  mkdirSync(path.join(root, 'nested'));
  write(root, 'root.txt', 'before\n');
  write(root, 'nested/child.txt', 'child-before\n');
  commit(root, 'base');
  write(root, 'root.txt', 'root-after\n');
  write(root, 'nested/child.txt', 'child-after\n');
  const reader = new GitReader(path.join(root, 'nested'));
  const snapshot = await reader.snapshot();
  assert.deepEqual(snapshot.status.map(entry => entry.path), ['nested/child.txt', 'root.txt']);
  assert.match(await reader.diff({ path: 'root.txt' }), /root-after/);
  assert.match(await new GitReader(path.join(root, 'nested')).diff({ path: 'nested/child.txt' }), /child-after/);
});

test('history is bounded to the most recent 100 commits', async t => {
  const root = repository(t);
  for (let i = 0; i < 103; i++) git(root, 'commit', '--allow-empty', '-m', `commit-${i}`);
  const snapshot = await new GitReader(root).snapshot();
  assert.equal(snapshot.commits.length, 100);
  assert.equal(snapshot.commits[0].subject, 'commit-102');
  assert.equal(snapshot.commits[99].subject, 'commit-3');
});

test('runner always sets resource limits, safe flags and rejects runtime errors', async t => {
  const original = cp.execFile;
  t.after(() => { cp.execFile = original; });
  cp.execFile = (file, args, options, callback) => {
    assert.match(file, /(?:^git$|(?:^|[\\/])git\.exe$)/i);
    assert.equal(options.shell, false);
    assert.equal(options.timeout, 10000);
    assert.equal(options.maxBuffer, 8 * 1024 * 1024);
    assert.ok(args.includes('--literal-pathspecs'));
    assert.equal(options.env.GIT_OPTIONAL_LOCKS, '0');
    assert.equal(options.env.GIT_DIR, undefined);
    callback(Object.assign(new Error('timed out'), { killed: true, code: 'ETIMEDOUT' }), '', '');
  };
  await assert.rejects(new GitReader('.').snapshot(), { code: 'ETIMEDOUT' });
  cp.execFile = (_file, _args, _options, callback) => callback(Object.assign(new Error('output exceeded'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }), '', '');
  await assert.rejects(new GitReader('.').snapshot(), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' });
});
