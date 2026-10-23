import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GitActions } from '../git-actions.mjs';
import { apply } from '../index.js';

const executable = process.platform === 'win32' ? 'C:\\Program Files\\Git\\cmd\\git.exe' : 'git';
function git(cwd, ...args) {
  return cp.execFileSync(executable, ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false', ...args], {
    cwd, encoding: 'utf8', windowsHide: true, timeout: 10000,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}
// Every write (including setup and cleanup) is confined to this temporary tree.
function repo(t, initial = true) {
  const directory = mkdtempSync(path.join(tmpdir(), 'branch-actions-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'repo');
  mkdirSync(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Branch Test');
  git(root, 'config', 'user.email', 'branch@example.invalid');
  if (initial) git(root, 'commit', '--allow-empty', '-m', 'base');
  return root;
}
async function act(root, operation, branch, extra = {}) {
  const actions = new GitActions(root);
  const state = await actions.details();
  return actions.execute({ operation, branch, expectedHead: state.head, expectedBranch: state.branch, ...extra });
}
const refs = root => git(root, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/remotes/');
const local = (root, branch) => git(root, 'show-ref', '--verify', '--hash', `refs/heads/${branch}`);

function api(root) {
  const routes = new Map();
  apply({
    connection: { fetch: { register: route => routes.set(route.path.split('/').at(-1), route) } },
    sessions: { get: () => ({ header: { cwd: root } }) },
    sandboxPolicy: { workspaceRoot: root },
  });
  return async body => {
    const response = await routes.get('action').fetch(new Request('http://localhost/api/git-visualizer/action', {
      method: 'POST', body: JSON.stringify({ sessionId: 'session-branches', repository: '.', ...body }),
    }));
    return { status: response.status, body: await response.json() };
  };
}

test('create then delete merged local branch; remote refs and config remain untouched', async t => {
  const root = repo(t);
  const head = git(root, 'rev-parse', 'HEAD');
  git(root, 'update-ref', 'refs/remotes/origin/feature/中文', head);
  const before = refs(root);
  const config = readFileSync(path.join(root, '.git', 'config'), 'utf8');
  await act(root, 'createBranch', 'feature/中文');
  assert.equal(local(root, 'feature/中文'), head);
  assert.equal(git(root, 'branch', '--show-current'), 'main');
  const result = await act(root, 'deleteBranch', 'feature/中文');
  assert.equal(result.message, 'deleteBranch completed');
  assert.equal(git(root, 'for-each-ref', '--format=%(refname)', 'refs/heads/feature/'), '');
  assert.equal(refs(root), before);
  assert.equal(readFileSync(path.join(root, '.git', 'config'), 'utf8'), config);
});

test('creation uses the confirmed commit even if external HEAD changes after state read', async t => {
  const root = repo(t);
  const head = local(root, 'main');
  const actions = new GitActions(root);
  const validate = actions._branch.bind(actions);
  actions._branch = async branch => {
    const result = await validate(branch);
    git(root, 'commit', '--allow-empty', '-m', 'external HEAD change');
    return result;
  };
  await actions.execute({ operation: 'createBranch', branch: 'confirmed', expectedHead: head, expectedBranch: 'main' });
  assert.equal(local(root, 'confirmed'), head);
  assert.notEqual(local(root, 'main'), head);
});

test('unmerged branch refused even when its upstream contains its commit', async t => {
  const root = repo(t);
  git(root, 'switch', '-c', 'topic');
  git(root, 'commit', '--allow-empty', '-m', 'topic only');
  const tip = local(root, 'topic');
  git(root, 'update-ref', 'refs/remotes/origin/topic', tip);
  git(root, 'remote', 'add', 'origin', root);
  git(root, 'config', 'branch.topic.remote', 'origin');
  git(root, 'config', 'branch.topic.merge', 'refs/heads/topic');
  git(root, 'switch', 'main');
  assert.equal(git(root, 'rev-parse', 'topic@{upstream}'), tip);
  const before = refs(root);
  await assert.rejects(act(root, 'deleteBranch', 'topic'), /not fully merged into the current HEAD/);
  assert.equal(local(root, 'topic'), tip);
  assert.equal(refs(root), before);
});

test('native -d upstream merge check remains in addition to the HEAD check', async t => {
  const root = repo(t);
  const base = local(root, 'main');
  git(root, 'commit', '--allow-empty', '-m', 'merged into HEAD');
  git(root, 'branch', 'topic');
  git(root, 'update-ref', 'refs/remotes/origin/topic', base);
  git(root, 'remote', 'add', 'origin', root);
  git(root, 'config', 'branch.topic.remote', 'origin');
  git(root, 'config', 'branch.topic.merge', 'refs/heads/topic');
  const tip = local(root, 'topic');
  await assert.rejects(act(root, 'deleteBranch', 'topic'), /not fully merged/);
  assert.equal(local(root, 'topic'), tip);
});

test('current, absent, remote-only and symbolic refs cannot be deleted', async t => {
  const root = repo(t);
  const head = local(root, 'main');
  git(root, 'update-ref', 'refs/remotes/origin/remote-only', head);
  git(root, 'tag', 'tag-only');
  git(root, 'symbolic-ref', 'refs/heads/alias', 'refs/heads/main');
  const before = refs(root);
  await assert.rejects(act(root, 'deleteBranch', 'main'), /current branch/);
  for (const name of ['absent', 'origin/remote-only', 'tag-only', 'refs/heads/main']) {
    await assert.rejects(act(root, 'deleteBranch', name), /Local branch does not exist/);
  }
  await assert.rejects(act(root, 'deleteBranch', 'alias'), /symbolic ref/);
  assert.equal(local(root, 'main'), head);
  assert.equal(refs(root), before);
});

test('native Git guard refuses branch in other worktree', async t => {
  const root = repo(t);
  git(root, 'branch', 'occupied');
  git(root, 'worktree', 'add', path.join(path.dirname(root), 'linked'), 'occupied');
  await assert.rejects(act(root, 'deleteBranch', 'occupied'), /another worktree/);
  assert.equal(local(root, 'occupied'), local(root, 'main'));
});

test('empty repository has explicit HEAD error for create and delete', async t => {
  const root = repo(t, false);
  for (const operation of ['createBranch', 'deleteBranch']) {
    await assert.rejects(act(root, operation, 'topic'), /requires an existing HEAD commit/);
  }
});

test('illegal branch inputs and stale head/branch are rejected without writes', async t => {
  const root = repo(t);
  git(root, 'branch', 'topic');
  for (const branch of ['', '--delete', '-D', 'bad\0name', 'main:topic', 'main^{commit}', 'main~1', 'bad..name', '@{-1}', 'a\nb', 'a b']) {
    await assert.rejects(act(root, 'deleteBranch', branch), /Invalid branch name/);
  }
  for (const extra of [{ expectedHead: '0'.repeat(40) }, { expectedBranch: 'other' }]) {
    await assert.rejects(act(root, 'deleteBranch', 'topic', extra), { code: 'STALE_STATE', status: 409 });
  }
  assert.equal(local(root, 'topic'), local(root, 'main'));
});

test('API deletion requires confirmation/state and rejects force or unrelated parameters', async t => {
  const root = repo(t);
  const request = api(root);
  git(root, 'branch', 'topic');
  const body = { operation: 'deleteBranch', branch: 'topic', confirm: true, expectedHead: local(root, 'main'), expectedBranch: 'main' };
  for (const field of ['confirm', 'expectedHead', 'expectedBranch']) {
    const invalid = { ...body }; delete invalid[field];
    assert.equal((await request(invalid)).status, 400);
  }
  for (const extra of [{ force: true }, { remote: true }, { paths: ['file'] }, { confirm: false }]) {
    assert.equal((await request({ ...body, ...extra })).status, 400);
  }
  assert.equal((await request({ ...body, expectedHead: '0'.repeat(40) })).status, 409);
  assert.equal(local(root, 'topic'), body.expectedHead);
  assert.equal((await request(body)).status, 200);
});

test('state and target rechecks reject intervening external changes', async t => {
  for (const changed of ['head', 'target']) {
    const root = repo(t);
    git(root, 'branch', 'topic');
    const originalTip = local(root, 'topic');
    const actions = new GitActions(root);
    const run = actions._git.bind(actions);
    actions._git = async (...parameters) => {
      const result = await run(...parameters);
      if (parameters[0][0] === 'merge-base') {
        git(root, 'commit', '--allow-empty', '-m', 'external change');
        if (changed === 'target') {
          git(root, 'branch', '-f', 'topic', 'HEAD');
          git(root, 'reset', '--soft', originalTip);
        }
      }
      return result;
    };
    await assert.rejects(actions.execute({ operation: 'deleteBranch', branch: 'topic' }), { code: 'STALE_STATE' });
    assert.ok(local(root, 'topic'));
  }
});
