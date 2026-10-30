import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GitReader } from '../git-core.mjs';
import { apply } from '../index.js';

const executable = process.platform === 'win32' ? 'C:\\Program Files\\Git\\cmd\\git.exe' : 'git';
function git(cwd, ...args) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.toUpperCase().startsWith('GIT_')) delete env[key];
  return cp.execFileSync(executable, ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false', ...args], {
    cwd, encoding: 'utf8', windowsHide: true, timeout: 10000,
    env: { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}
// All setup writes and cleanup are confined to newly created temporary trees.
function directory(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'branch-metadata-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function repo(t, initial = true) {
  const parent = directory(t);
  const root = path.join(parent, 'repo');
  mkdirSync(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Metadata Test');
  git(root, 'config', 'user.email', 'metadata@example.invalid');
  if (initial) git(root, 'commit', '--allow-empty', '-m', 'base');
  return root;
}
class RecordingReader extends GitReader {
  calls = [];
  async _git(args, ...rest) { this.calls.push([...args]); return super._git(args, ...rest); }
  async snapshot() { assert.fail('metadata must not read snapshot'); }
  async details() { assert.fail('metadata must not read details'); }
}
function shape(result) {
  assert.deepEqual(Object.keys(result).sort(), ['head', 'branches', 'checkedAt'].sort());
  assert.equal(new Date(result.checkedAt).toISOString(), result.checkedAt);
  for (const branch of result.branches) {
    assert.deepEqual(Object.keys(branch).sort(), ['name', 'tip', 'updatedAt', 'current', 'merged', 'worktrees', 'deleteBlockedReason'].sort());
    assert.match(branch.tip, /^[a-f0-9]{40,64}$/);
    assert.ok(Number.isFinite(Date.parse(branch.updatedAt)));
  }
}
const byName = result => Object.fromEntries(result.branches.map(branch => [branch.name, branch]));

test('batch metadata covers real merged/unmerged branches and linked worktree occupancy', async t => {
  const root = repo(t);
  const head = git(root, 'rev-parse', 'HEAD');
  for (const name of ['merged', 'occupied', 'feature/中文', ...Array.from({ length: 12 }, (_, i) => `many-${i}`)]) git(root, 'branch', name);
  git(root, 'switch', '-c', 'unmerged');
  git(root, 'commit', '--allow-empty', '-m', 'topic');
  const topic = git(root, 'rev-parse', 'HEAD');
  git(root, 'switch', 'main');
  // Full refs avoid confusion with same-named tags and omit remote branches.
  git(root, 'tag', 'merged', topic);
  git(root, 'update-ref', 'refs/remotes/origin/remote-only', head);
  const linked = path.join(path.dirname(root), 'linked with spaces');
  git(root, 'worktree', 'add', linked, 'occupied');
  const reader = new RecordingReader(root);
  const result = await reader.branchMetadata();
  shape(result);
  const branches = byName(result);
  assert.equal(result.head, head);
  assert.equal(result.branches.length, 17);
  assert.equal(branches.main.current, true);
  assert.equal(branches.main.deleteBlockedReason, 'current');
  assert.equal(branches.main.merged, true);
  assert.equal(branches.main.worktrees.length, 1);
  assert.equal(branches.merged.tip, head);
  assert.equal(branches.merged.merged, true);
  assert.equal(branches.merged.deleteBlockedReason, null);
  assert.deepEqual(branches.merged.worktrees, []);
  assert.equal(branches.unmerged.tip, topic);
  assert.equal(branches.unmerged.merged, false);
  assert.equal(branches.unmerged.deleteBlockedReason, 'unmerged');
  assert.equal(branches.occupied.merged, true);
  assert.equal(branches.occupied.deleteBlockedReason, 'worktree');
  assert.deepEqual(branches.occupied.worktrees.map(p => path.resolve(p).toLowerCase()), [linked.toLowerCase()]);
  assert.equal(reader.calls.length, 6, 'spawn count must not grow with branches');
  assert.deepEqual(reader.calls.filter(args => args[0] === 'for-each-ref'), [
    ['for-each-ref', '--format=%(refname)%00%(objectname)%00%(committerdate:iso-strict)', 'refs/heads/'],
    ['for-each-ref', `--merged=${head}`, '--format=%(refname)', 'refs/heads/'],
  ]);
  assert.deepEqual(reader.calls.at(-1), ['worktree', 'list', '--porcelain', '-z']);
});

test('unborn HEAD has no invented branch row, and existing refs have unknown merged/no-head', async t => {
  const root = repo(t, false);
  const reader = new RecordingReader(root);
  assert.deepEqual((await reader.branchMetadata()).branches, []);
  assert.equal(reader.calls.some(args => args.some(arg => arg.startsWith('--merged='))), false);
  git(root, 'commit', '--allow-empty', '-m', 'base');
  git(root, 'branch', 'existing');
  git(root, 'symbolic-ref', 'HEAD', 'refs/heads/unborn');
  const result = await reader.branchMetadata();
  shape(result);
  assert.equal(result.head, null);
  assert.equal(result.branches.length, 2);
  for (const branch of result.branches) {
    assert.equal(branch.current, false);
    assert.equal(branch.merged, null);
    assert.equal(branch.deleteBlockedReason, 'no-head');
  }
});

test('detached HEAD still computes merged status without marking a current branch', async t => {
  const root = repo(t);
  git(root, 'branch', 'merged');
  git(root, 'checkout', '--detach', 'HEAD');
  const result = await new GitReader(root).branchMetadata();
  shape(result);
  assert.equal(result.head, git(root, 'rev-parse', 'HEAD'));
  for (const branch of result.branches) {
    assert.equal(branch.current, false);
    assert.equal(branch.merged, true);
    assert.deepEqual(branch.worktrees, []);
    assert.equal(branch.deleteBlockedReason, null);
  }
});

test('merged query pins the HEAD already read despite an external commit during metadata read', async t => {
  const root = repo(t);
  git(root, 'switch', '-c', 'future');
  git(root, 'commit', '--allow-empty', '-m', 'future');
  git(root, 'switch', 'main');
  const head = git(root, 'rev-parse', 'HEAD');
  const reader = new RecordingReader(root);
  const run = reader._git.bind(reader);
  reader._git = async (args, ...rest) => {
    if (args[0] === 'for-each-ref' && args.some(arg => arg.startsWith('--merged='))) git(root, 'merge', '--ff-only', 'future');
    return run(args, ...rest);
  };
  const result = await reader.branchMetadata();
  assert.equal(result.head, head);
  assert.notEqual(git(root, 'rev-parse', 'HEAD'), head);
  assert.equal(byName(result).future.merged, false);
  assert.ok(reader.calls.some(args => args.includes(`--merged=${head}`)));
});

test('porcelain -z treats newline/space/quote paths and misleading field text as opaque', async () => {
  const reader = new GitReader(process.cwd());
  const head = 'a'.repeat(40);
  const paths = [' /tmp/with spaces ', '/tmp/line\nbranch refs/heads/victim\nworktree fake', '/tmp/"quoted"\\backslash'];
  const records = paths.flatMap(p => [`worktree ${p}`, `HEAD ${head}`, 'branch refs/heads/occupied', 'locked reason\nbranch refs/heads/victim', '']);
  records.push('worktree /tmp/detached\nbranch refs/heads/victim', `HEAD ${head}`, 'detached', '', 'worktree /tmp/bare', 'bare', '');
  reader._git = async args => {
    let stdout;
    if (args[0] === 'rev-parse') stdout = args[1] === '--show-toplevel' ? process.cwd() + '\n' : head + '\n';
    else if (args[0] === 'symbolic-ref') return { stdout: '', code: 1, stderr: '' };
    else if (args[0] === 'worktree') stdout = records.join('\0') + '\0';
    else if (args.some(arg => arg.startsWith('--merged='))) stdout = 'refs/heads/occupied\nrefs/heads/victim\n';
    else stdout = ['occupied', 'victim'].map(name => `refs/heads/${name}\0${head}\0${'2026-10-23T09:00:00+00:00'}\n`).join('');
    return { stdout, code: 0, stderr: '' };
  };
  const branches = byName(await reader.branchMetadata());
  assert.deepEqual(branches.occupied.worktrees, paths);
  assert.equal(branches.occupied.deleteBlockedReason, 'worktree');
  assert.deepEqual(branches.victim.worktrees, []);
  assert.equal(branches.victim.deleteBlockedReason, null);
});

function api(root, persisted = false) {
  const routes = new Map();
  apply({
    connection: { fetch: { register: route => routes.set(route.path.split('/').at(-1), route) } },
    sessions: { get: id => !persisted && id === 'session-metadata' ? { header: { cwd: root } } : undefined },
    get: () => ({ stat: async id => persisted && id === 'session-metadata' ? { header: { cwd: root } } : undefined }),
    sandboxPolicy: { workspaceRoot: root },
  });
  const route = routes.get('branchMetadata');
  assert.deepEqual(route.methods, ['POST']);
  return async (body = {}) => {
    const response = await route.fetch(new Request('http://localhost/api/git-visualizer/branchMetadata', {
      method: 'POST', body: JSON.stringify({ sessionId: 'session-metadata', ...body }),
    }));
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    return { status: response.status, body: await response.json() };
  };
}

test('API permits only sessionId/repository and validates repository/session boundaries', async t => {
  const root = repo(t);
  for (const persisted of [false, true]) {
    const request = api(root, persisted);
    const result = await request({ repository: '.' });
    assert.equal(result.status, 200);
    shape(result.body);
    assert.equal(result.body.head, git(root, 'rev-parse', 'HEAD'));
    assert.equal((await request()).status, 200);
    for (const extra of ['path', 'commit', 'staged', 'operation', 'confirm', 'expectedHead', 'expectedBranch', 'branch', 'head', 'unexpected']) {
      assert.equal((await request({ [extra]: true })).status, 400, extra);
    }
    for (const repository of ['../', root, null, 1, {}, [], 'missing', '.git', 'a\0b']) {
      assert.equal((await request({ repository })).status, 400);
    }
    assert.equal((await request({ sessionId: 'invalid' })).status, 400);
    assert.equal((await request({ sessionId: 'session-missing' })).status, 404);
  }
  // Selection must use the nested repository, not silently fall back to workspace.
  const workspace = path.dirname(root);
  const nested = await api(workspace)({ repository: 'repo' });
  assert.equal(nested.status, 200);
  assert.equal(nested.body.head, git(root, 'rev-parse', 'HEAD'));
  const plain = directory(t);
  await assert.rejects(new GitReader(plain).branchMetadata(), { code: 'NOT_GIT_REPOSITORY' });
  assert.equal((await api(plain)()).status, 400);
});
