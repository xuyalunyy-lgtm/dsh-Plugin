import { test } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, renameSync, rmSync, mkdirSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GitReader } from '../git-core.mjs';
import { GitActions } from '../git-actions.mjs';

const gitExe = process.platform === 'win32' ? 'C:\\Program Files\\Git\\cmd\\git.exe' : 'git';
function git(root, ...args) {
  return cp.execFileSync(gitExe, ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false', ...args], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}
function repo(t, initial = true) {
  const root = mkdtempSync(path.join(tmpdir(), 'git-actions-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Actions Test');
  git(root, 'config', 'user.email', 'actions@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
  if (initial) {
    write(root, 'base.txt', 'base\n');
    git(root, 'add', '--all');
    git(root, 'commit', '-m', 'base');
  }
  return root;
}
const write = (root, file, content) => writeFileSync(path.join(root, file), content);
const act = (root, operation, fields = {}) => new GitActions(root).execute({ operation, ...fields });

// All mutations below are confined to freshly allocated temporary repositories.
test('details is separate from the stable snapshot and handles unborn, untracked and detached', async t => {
  const root = repo(t, false);
  const reader = new GitReader(root);
  assert.deepEqual(await reader.details(), { head: null, branch: 'main', upstream: null, ahead: 0, behind: 0, remotes: [], clean: true, conflicts: false });
  assert.deepEqual(Object.keys(await reader.snapshot()), ['isRepository', 'branch', 'status', 'branches', 'commits']);
  write(root, 'new.txt', 'new\n');
  assert.equal((await reader.details()).clean, false);
  await act(root, 'stage', { paths: ['new.txt'] });
  await act(root, 'commit', { message: 'first', expectedHead: null, expectedBranch: 'main' });
  git(root, 'checkout', '--detach');
  assert.equal((await reader.details()).branch, null);
});

test('literal path selection and rename pairs', async t => {
  const root = repo(t);
  write(root, '[abc].txt', 'literal\n');
  write(root, 'a.txt', 'not selected\n');
  await act(root, 'stage', { paths: ['[abc].txt'] });
  assert.equal(git(root, 'diff', '--cached', '--name-only'), '[abc].txt');
  await act(root, 'unstage', { paths: ['[abc].txt'] });
  assert.equal(git(root, 'diff', '--cached', '--name-only'), '');
  assert.equal(readFileSync(path.join(root, '[abc].txt'), 'utf8'), 'literal\n');
  renameSync(path.join(root, 'base.txt'), path.join(root, 'renamed.txt'));
  await act(root, 'stage', { paths: ['base.txt', 'renamed.txt'] });
  assert.match(git(root, 'diff', '--cached', '--name-status'), /R100\s+base.txt\s+renamed.txt/);
  await act(root, 'unstage', { paths: ['base.txt', 'renamed.txt'] });
  assert.equal(git(root, 'diff', '--cached', '--name-only'), '');
  assert.ok(existsSync(path.join(root, 'renamed.txt')));
});

test('unborn unstage uses cached removal even with subsequently edited staged file', async t => {
  const root = repo(t, false);
  write(root, 'new.txt', 'staged\n');
  await act(root, 'stage', { paths: ['new.txt'] });
  write(root, 'new.txt', 'working\n');
  await act(root, 'unstage', { paths: ['new.txt'] });
  assert.equal(git(root, 'ls-files'), '');
  assert.equal(readFileSync(path.join(root, 'new.txt'), 'utf8'), 'working\n');
});

test('rejects invalid arguments, metadata, directory escapes and symlink ancestors', async t => {
  const root = repo(t);
  const action = new GitActions(root);
  for (const operation of ['reset', 'exec', '--help', null]) await assert.rejects(action.execute({ operation }), /Unsupported/);
  for (const paths of [undefined, [], Array(201).fill('base.txt'), [''], ['.'], ['../secret'], ['C:secret'], ['/etc/passwd'], ['nested/../../x'], ['..\\secret'], ['.git/config'], ['.GIT/config'], ['dir/.git/config'], ['.git./config'], ['dir:stream'], ['foo\0bar']]) {
    await assert.rejects(action.execute({ operation: 'stage', paths }));
  }
  await assert.rejects(action.execute({ operation: 'stage', paths: ['base.txt'], command: 'oops' }), /Invalid/);
  await assert.rejects(action.execute({ operation: 'fetch', paths: ['base.txt'] }), /paths/);
  await assert.rejects(action.execute({ operation: 'stage', paths: ['base.txt'], expectedHead: '--help' }), /expectedHead/);
  mkdirSync(path.join(root, 'outside'));
  try { symlinkSync(path.join(root, 'outside'), path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code === 'EPERM') return; throw error; }
  await assert.rejects(action.execute({ operation: 'stage', paths: ['link/file.txt'] }), /symlink/);
});

test('expected head and branch prevent stale actions before any mutation', async t => {
  const root = repo(t);
  write(root, 'new.txt', 'new\n');
  const state = await new GitReader(root).details();
  for (const expected of [{ expectedHead: null }, { expectedHead: '0'.repeat(40) }, { expectedBranch: 'other' }, { expectedBranch: null }]) {
    await assert.rejects(act(root, 'stage', { paths: ['new.txt'], ...expected }), { code: 'STALE_STATE', status: 409 });
  }
  assert.equal(git(root, 'diff', '--cached', '--name-only'), '');
  await act(root, 'stage', { paths: ['new.txt'], expectedHead: state.head, expectedBranch: state.branch });
});

test('commit only staged changes, skips hooks/signing, refuses empty message and empty index', async t => {
  const root = repo(t);
  for (const message of [undefined, '', '  ', null, 'bad\0message']) await assert.rejects(act(root, 'commit', { message }), /message/);
  await assert.rejects(act(root, 'commit', { message: 'empty' }), /No staged/);
  write(root, 'base.txt', 'staged\n');
  await act(root, 'stage', { paths: ['base.txt'] });
  write(root, 'base.txt', 'unstaged\n');
  write(root, 'untracked.txt', 'untracked\n');
  const hooks = path.join(root, 'blocking-hooks');
  mkdirSync(hooks);
  writeFileSync(path.join(hooks, 'pre-commit'), '#!/bin/sh\nexit 99\n', { mode: 0o755 });
  git(root, 'config', 'core.hooksPath', hooks);
  git(root, 'config', 'commit.gpgSign', 'true');
  git(root, 'config', 'gpg.program', 'does-not-exist');
  const before = git(root, 'rev-parse', 'HEAD');
  const result = await act(root, 'commit', { message: 'safe commit' });
  assert.equal(typeof result.output, 'string');
  assert.equal(git(root, 'show', 'HEAD:base.txt'), 'staged');
  assert.equal(git(root, 'rev-parse', 'HEAD^'), before);
  assert.match(git(root, 'status', '--porcelain'), /M base.txt/);
  assert.match(git(root, 'status', '--porcelain'), /\?\? untracked.txt/);
});

test('createBranch does not switch; switch requires clean including untracked; branch injection rejected', async t => {
  const root = repo(t);
  await act(root, 'createBranch', { branch: 'feature/中文' });
  assert.equal(git(root, 'branch', '--show-current'), 'main');
  for (const branch of ['--help', '-D', 'bad..name', 'space name', '@{-1}', 'main\0x', '']) await assert.rejects(act(root, 'createBranch', { branch }), /branch/);
  write(root, 'untracked.txt', 'blocks\n');
  await assert.rejects(act(root, 'switchBranch', { branch: 'feature/中文' }), /clean/);
  rmSync(path.join(root, 'untracked.txt'));
  await act(root, 'switchBranch', { branch: 'feature/中文' });
  assert.equal(git(root, 'branch', '--show-current'), 'feature/中文');
});

test('conflicts are reported and cannot be committed', async t => {
  const root = repo(t);
  git(root, 'branch', 'other');
  write(root, 'base.txt', 'main\n');
  git(root, 'add', '--all'); git(root, 'commit', '-m', 'main');
  git(root, 'switch', 'other');
  write(root, 'base.txt', 'other\n');
  git(root, 'add', '--all'); git(root, 'commit', '-m', 'other');
  assert.throws(() => git(root, 'merge', 'main'));
  assert.equal((await new GitReader(root).details()).conflicts, true);
  await assert.rejects(act(root, 'commit', { message: 'conflicted' }), /conflict/);
  write(root, 'base.txt', 'resolved\n');
  await act(root, 'stage', { paths: ['base.txt'] });
  assert.equal((await new GitReader(root).details()).conflicts, false);
  await act(root, 'commit', { message: 'resolved conflict' });
});

test('network requires configured upstream; local bare fetch/pull/push are explicit and non-force', async t => {
  const root = repo(t);
  for (const operation of ['fetch', 'pull', 'push']) await assert.rejects(act(root, operation), /upstream/);
  const bare = mkdtempSync(path.join(tmpdir(), 'git-actions-bare-'));
  t.after(() => rmSync(bare, { recursive: true, force: true }));
  git(bare, 'init', '--bare', '-b', 'main');
  git(root, 'remote', 'add', 'origin', bare);
  git(root, 'push', '-u', 'origin', 'main');
  const peer = repo(t, false);
  git(peer, 'remote', 'add', 'origin', bare);
  git(peer, 'fetch', 'origin');
  git(peer, 'reset', '--hard', 'origin/main');
  git(peer, 'branch', '--set-upstream-to=origin/main', 'main');
  write(peer, 'remote.txt', 'remote\n'); git(peer, 'add', '--all'); git(peer, 'commit', '-m', 'remote'); git(peer, 'push');
  await act(root, 'fetch');
  let details = await new GitReader(root).details();
  assert.equal(details.upstream, 'origin/main');
  assert.equal(details.behind, 1);
  assert.deepEqual(details.remotes, [{ name: 'origin' }]);
  write(root, 'untracked.txt', 'blocks\n');
  await assert.rejects(act(root, 'pull'), /clean/);
  rmSync(path.join(root, 'untracked.txt'));
  await act(root, 'pull');
  assert.equal(readFileSync(path.join(root, 'remote.txt'), 'utf8'), 'remote\n');
  write(root, 'local.txt', 'local\n'); await act(root, 'stage', { paths: ['local.txt'] }); await act(root, 'commit', { message: 'local' });
  details = await new GitReader(root).details(); assert.equal(details.ahead, 1);
  git(root, 'config', 'remote.origin.push', '+refs/heads/main:refs/heads/not-allowed');
  git(root, 'config', 'remote.origin.mirror', 'true');
  git(root, 'config', 'push.followTags', 'true');
  await act(root, 'push');
  assert.equal(git(bare, 'rev-parse', 'main'), git(root, 'rev-parse', 'HEAD'));
  assert.equal(git(bare, 'for-each-ref', '--format=%(refname)', 'refs/heads/'), 'refs/heads/main');
  git(root, 'reset', '--hard', 'HEAD~1');
  await assert.rejects(act(root, 'push'), /rejected|non-fast-forward|fetch first/i);
  write(root, 'diverged.txt', 'local divergent commit\n');
  await act(root, 'stage', { paths: ['diverged.txt'] });
  await act(root, 'commit', { message: 'diverged' });
  const divergentHead = git(root, 'rev-parse', 'HEAD');
  await assert.rejects(act(root, 'pull'), /fast-forward|divergent/i);
  assert.equal(git(root, 'rev-parse', 'HEAD'), divergentHead);
});

test('network argument construction avoids configured push refspec and redacts URL credentials', async () => {
  const calls = [];
  const actions = new GitActions('.');
  actions.details = async () => ({ head: 'a'.repeat(40), branch: 'main', remotes: [{ name: 'origin' }], clean: true, conflicts: false });
  actions._git = async (args, _codes, options) => {
    calls.push({ args, options });
    if (args[0] === 'config') return { stdout: args[1] === '--get-all' ? 'refs/heads/main\n' : 'origin\n', code: 0, stderr: '' };
    return { stdout: 'From https://user:secret@example.invalid/repo.git', stderr: '', code: 0 };
  };
  for (const operation of ['fetch', 'pull', 'push']) {
    const result = await actions.execute({ operation });
    assert.doesNotMatch(result.output, /secret|example.invalid/);
    const call = calls.at(-1);
    assert.equal(call.options.timeout, 60000);
    assert.ok(call.args.includes('credential.interactive=false'));
    assert.ok(call.args.includes('core.askPass='));
    assert.ok(call.args.includes('core.hooksPath=/dev/null'));
    assert.ok(!call.args.includes('credential.helper='));
  }
  const push = calls.at(-1).args;
  assert.ok(push.includes('--no-force'));
  assert.ok(push.includes('--no-mirror'));
  assert.ok(push.includes('--no-verify'));
  assert.deepEqual(push.slice(-3), ['--', 'origin', 'refs/heads/main:refs/heads/main']);
  actions._git = async args => {
    if (args[0] === 'config') return { stdout: args[1] === '--get-all' ? 'refs/heads/main\n' : 'origin\n', code: 0, stderr: '' };
    if (args[0] === 'check-ref-format') return { stdout: '', stderr: '', code: 0 };
    throw new Error('Could not fetch https://user:secret@example.invalid/repo.git');
  };
  await assert.rejects(actions.execute({ operation: 'fetch' }), error => !/secret|example.invalid/.test(error.message));
});

test('runner permits bounded network timeout and forces noninteractive SSH', async t => {
  const original = cp.execFile;
  t.after(() => { cp.execFile = original; });
  cp.execFile = (_file, _args, options, callback) => {
    assert.equal(options.timeout, 60000);
    assert.equal(options.env.GIT_TERMINAL_PROMPT, '0');
    assert.equal(options.env.GCM_INTERACTIVE, 'Never');
    assert.match(options.env.GIT_SSH_COMMAND, /BatchMode=yes/);
    callback(null, 'ok', '');
  };
  assert.equal((await new GitReader('.')._git(['fetch'], [], { timeout: 60000 })).stdout, 'ok');
  await assert.rejects(new GitReader('.')._git([], [], { timeout: 60001 }), /timeout/);
});
