import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GitReader } from '../git-core.mjs';
import { apply } from '../index.js';

const executable = process.env.GIT_TEST_EXECUTABLE || 'git';
function git(cwd, ...args) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.toUpperCase().startsWith('GIT_')) delete env[key];
  return cp.execFileSync(executable, ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false', ...args], {
    cwd, encoding: 'utf8', windowsHide: true, timeout: 10000,
    env: { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}
async function directory(t) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'git-summary-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
async function repository(t, { unborn = false } = {}) {
  const root = await directory(t);
  git(root, 'init', '-b', 'main');
  for (const [key, value] of Object.entries({ 'user.name': 'Summary Test', 'user.email': 'summary@example.invalid', 'core.autocrlf': 'false', 'core.excludesFile': '/dev/null', 'status.renames': 'true' })) git(root, 'config', key, value);
  if (!unborn) {
    await fs.writeFile(path.join(root, 'tracked.txt'), 'initial\n');
    git(root, 'add', '--', 'tracked.txt');
    git(root, 'commit', '-m', 'initial');
  }
  return root;
}
class RecordingReader extends GitReader {
  calls = [];
  async _git(args, ...rest) {
    this.calls.push([...args]);
    return super._git(args, ...rest);
  }
  async snapshot() { assert.fail('summary must not call snapshot'); }
  async details() { assert.fail('summary must not call details'); }
  async diff() { assert.fail('summary must not call diff'); }
}
async function summary(root) {
  const reader = new RecordingReader(root);
  const before = Date.now();
  const result = await reader.summary();
  assert.deepEqual(reader.calls, [
    ['rev-parse', '--show-toplevel'],
    ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'],
  ]);
  assert.equal(new Date(result.checkedAt).toISOString(), result.checkedAt);
  assert.ok(Date.parse(result.checkedAt) >= before && Date.parse(result.checkedAt) <= Date.now());
  assert.deepEqual(Object.keys(result).sort(), ['branch', 'head', 'upstream', 'ahead', 'behind', 'changes', 'staged', 'untracked', 'conflicts', 'checkedAt'].sort());
  return result;
}
function counts(result, expected) {
  assert.deepEqual([result.changes, result.staged, result.untracked, result.conflicts], expected);
}
function api(root, persisted = false) {
  const routes = new Map();
  apply({
    connection: { fetch: { register: route => routes.set(route.path.split('/').at(-1), route) } },
    sessions: { get: id => !persisted && id === 'session-summary' ? { header: { cwd: root } } : undefined },
    get: name => name === 'sessionPersistence' ? { stat: async id => persisted && id === 'session-summary' ? { header: { cwd: root } } : undefined } : undefined,
    sandboxPolicy: { workspaceRoot: root },
  });
  return async (body = {}) => {
    const route = routes.get('summary');
    assert.deepEqual(route.methods, ['POST']);
    const response = await route.fetch(new Request('http://localhost/api/git-visualizer/summary', {
      method: 'POST', body: JSON.stringify({ sessionId: 'session-summary', ...body }),
    }));
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    return { status: response.status, body: await response.json() };
  };
}

// All writes below are confined to fresh temporary repositories, with hooks/signing disabled.
test('summary is clean and lightweight, normalizes subdirectories, and leaves missing divergence unknown', async t => {
  const root = await repository(t);
  const nested = path.join(root, 'nested');
  await fs.mkdir(nested);
  const result = await summary(nested);
  assert.equal(result.branch, 'main');
  assert.equal(result.head, git(root, 'rev-parse', 'HEAD'));
  assert.equal(result.upstream, null);
  assert.equal(result.ahead, null);
  assert.equal(result.behind, null);
  counts(result, [0, 0, 0, 0]);
  const reader = new RecordingReader(nested);
  await reader.summary();
  assert.equal(reader.root.toLowerCase(), root.toLowerCase());
});

test('summary counts dirty, staged plus unstaged, untracked, and rename paths once', async t => {
  const root = await repository(t);
  await fs.writeFile(path.join(root, 'tracked.txt'), 'index change\n');
  counts(await summary(root), [1, 0, 0, 0]);
  git(root, 'add', '--', 'tracked.txt');
  await fs.writeFile(path.join(root, 'tracked.txt'), 'worktree change\n');
  await fs.mkdir(path.join(root, 'new'));
  await fs.writeFile(path.join(root, 'new', '中文.txt'), 'untracked\n');
  await fs.writeFile(path.join(root, 'new', '# branch.head fake'), 'untracked\n');
  counts(await summary(root), [3, 1, 2, 0]);
  git(root, 'add', '--all');
  git(root, 'commit', '-m', 'changes');
  git(root, 'mv', 'tracked.txt', 'renamed.txt');
  counts(await summary(root), [1, 1, 0, 0]);
});

test('summary handles unborn and detached HEAD', async t => {
  const root = await repository(t, { unborn: true });
  let result = await summary(root);
  assert.equal(result.head, null);
  assert.equal(result.branch, 'main');
  counts(result, [0, 0, 0, 0]);
  await fs.writeFile(path.join(root, 'first.txt'), 'first\n');
  git(root, 'add', '--', 'first.txt');
  counts(await summary(root), [1, 1, 0, 0]);
  git(root, 'commit', '-m', 'first');
  git(root, 'checkout', '--detach', 'HEAD');
  result = await summary(root);
  assert.equal(result.branch, null);
  assert.equal(result.head, git(root, 'rev-parse', 'HEAD'));
  assert.equal(result.ahead, null);
  assert.equal(result.behind, null);
});

test('summary reads local upstream refs with zero, ahead, behind and diverged counts without network', async t => {
  const root = await repository(t);
  git(root, 'branch', 'upstream');
  git(root, 'branch', '--set-upstream-to=upstream', 'main');
  const check = async (ahead, behind) => {
    const result = await summary(root);
    assert.equal(result.upstream, 'upstream');
    assert.deepEqual([result.ahead, result.behind], [ahead, behind]);
  };
  await check(0, 0);
  git(root, 'checkout', 'upstream');
  git(root, 'commit', '--allow-empty', '-m', 'upstream ahead');
  git(root, 'checkout', 'main');
  await check(0, 1);
  git(root, 'commit', '--allow-empty', '-m', 'main ahead');
  await check(1, 1);
  git(root, 'branch', '-f', 'upstream', 'main~1');
  await check(1, 0);
  git(root, 'branch', '-D', 'upstream');
  const gone = await summary(root);
  assert.equal(gone.upstream, 'upstream');
  assert.deepEqual([gone.ahead, gone.behind], [null, null]);
});

test('summary counts actual unmerged paths as conflicts, not resolved staged changes', async t => {
  const root = await repository(t);
  git(root, 'checkout', '-b', 'other');
  await fs.writeFile(path.join(root, 'tracked.txt'), 'other\n');
  git(root, 'add', '--all');
  git(root, 'commit', '-m', 'other');
  git(root, 'checkout', 'main');
  await fs.writeFile(path.join(root, 'tracked.txt'), 'main\n');
  git(root, 'add', '--all');
  git(root, 'commit', '-m', 'main');
  assert.throws(() => git(root, 'merge', '--no-edit', 'other'));
  counts(await summary(root), [1, 0, 0, 1]);
});

test('porcelain NUL parsing treats rename original paths and all record paths as opaque', async () => {
  const reader = new RecordingReader(process.cwd());
  const oid = 'a'.repeat(40);
  const records = [`# branch.oid ${oid}`, '# branch.head main', '# branch.upstream origin/main', '# branch.ab +3 -4'];
  for (const fake of ['# branch.head injected', '# branch.oid (initial)', '# branch.upstream evil', '# branch.ab +99 -98', '? fake', 'u UU fake', '2 R. fake']) {
    records.push('2 R. N... 100644 100644 100644 a b R100 renamed\n# branch.head false', fake);
  }
  records.push('1 .M N... 100644 100644 100644 a b # branch.head wrong', '? # branch.ab +88 -88', '? line\n# branch.upstream evil', 'u UU N... 100644 100644 100644 100644 a b c conflict', '! ignored');
  reader._git = async args => {
    reader.calls.push([...args]);
    return { code: 0, stderr: '', stdout: args[0] === 'rev-parse' ? process.cwd() + '\n' : records.join('\0') + '\0' };
  };
  const result = await reader.summary();
  assert.equal(result.branch, 'main');
  assert.equal(result.head, oid);
  assert.equal(result.upstream, 'origin/main');
  assert.deepEqual([result.ahead, result.behind], [3, 4]);
  counts(result, [11, 7, 2, 1]);
  assert.equal(reader.calls.length, 2);
});

test('summary API enforces allowed parameters, session authorization, repository selection and non-repository 400', async t => {
  const root = await repository(t);
  for (const persisted of [false, true]) {
    const request = api(root, persisted);
    const result = await request({ repository: '.' });
    assert.equal(result.status, 200);
    assert.equal(result.body.head, git(root, 'rev-parse', 'HEAD'));
    counts(result.body, [0, 0, 0, 0]);
    for (const extra of ['path', 'commit', 'staged', 'operation', 'confirm', 'unexpected']) {
      assert.equal((await request({ repository: '.', [extra]: true })).status, 400);
    }
    for (const repository of ['../', root, null, 1, 'missing', '.git']) {
      assert.equal((await request({ repository })).status, 400);
    }
    assert.equal((await request({ sessionId: 'invalid' })).status, 400);
    assert.equal((await request({ sessionId: 'session-missing' })).status, 404);
  }
  const plain = await directory(t);
  await assert.rejects(new GitReader(plain).summary(), { code: 'NOT_GIT_REPOSITORY' });
  assert.equal((await api(plain)()).status, 400);
});
