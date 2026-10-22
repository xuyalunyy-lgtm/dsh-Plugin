import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GitReader } from '../git-core.mjs';
import { GitActions } from '../git-actions.mjs';
import { apply } from '../index.js';

const MAX_BYTES = 256 * 1024;
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
  const root = await fs.mkdtemp(path.join(tmpdir(), 'git-read-optimization-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
async function repository(t, { unborn = false } = {}) {
  const root = await directory(t);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Read Test');
  git(root, 'config', 'user.email', 'read@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
  git(root, 'config', 'core.excludesFile', '/dev/null');
  if (!unborn) {
    await fs.writeFile(path.join(root, 'tracked.txt'), 'tracked content\n');
    git(root, 'add', '--', 'tracked.txt');
    git(root, 'commit', '-m', 'initial');
  }
  return root;
}
class CountingReader extends GitReader {
  calls = [];
  async _git(args, ...rest) {
    this.calls.push([...args]);
    return super._git(args, ...rest);
  }
}
function api(root, { persisted = false } = {}) {
  const routes = new Map();
  apply({
    connection: { fetch: { register: route => routes.set(route.path.split('/').at(-1), route) } },
    sessions: { get: id => !persisted && id === 'session-read' ? { header: { cwd: root } } : undefined },
    get: name => name === 'sessionPersistence' ? { stat: async id => persisted && id === 'session-read' ? { header: { cwd: root } } : undefined } : undefined,
    sandboxPolicy: { workspaceRoot: root },
  });
  return async (route, body = {}) => {
    const definition = routes.get(route);
    assert.deepEqual(definition.methods, ['POST']);
    const response = await definition.fetch(new Request('http://localhost/api/git-visualizer/' + route, {
      method: 'POST', body: JSON.stringify({ sessionId: 'session-read', ...body }),
    }));
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    return { status: response.status, body: await response.json() };
  };
}

// All Git writes and race simulations below are confined to fresh temporary repos.
test('overview is identical to snapshot + details and eliminates four repeated Git reads', async t => {
  const root = await repository(t);
  git(root, 'branch', 'feature');
  await fs.writeFile(path.join(root, 'tracked.txt'), 'worktree change\n');
  await fs.writeFile(path.join(root, '新文件.txt'), '未跟踪\n');
  const old = new CountingReader(root);
  const expected = { snapshot: await old.snapshot(), details: await old.details() };
  const reader = new CountingReader(root);
  assert.deepEqual(await reader.overview(), expected);
  assert.equal(reader.calls.length, old.calls.length - 4);
  assert.equal(reader.calls.length, 9);
  for (const command of ['status', 'symbolic-ref']) {
    assert.equal(old.calls.filter(args => args[0] === command).length, 2);
    assert.equal(reader.calls.filter(args => args[0] === command).length, 1);
  }
  for (const flag of ['--show-toplevel', '--verify']) {
    assert.equal(old.calls.filter(args => args[0] === 'rev-parse' && args.includes(flag)).length, 2);
    assert.equal(reader.calls.filter(args => args[0] === 'rev-parse' && args.includes(flag)).length, 1);
  }
});

test('overview pins history to its reused HEAD if an external commit races with log', async t => {
  const root = await repository(t);
  const reader = new GitReader(root);
  const original = reader._git.bind(reader);
  const before = git(root, 'rev-parse', 'HEAD');
  let committed = false;
  reader._git = async (args, ...rest) => {
    if (args[0] === 'log' && !committed) {
      committed = true;
      git(root, 'commit', '--allow-empty', '-m', 'raced external commit');
    }
    return original(args, ...rest);
  };
  const overview = await reader.overview();
  assert.equal(committed, true);
  assert.equal(overview.snapshot.commits[0].hash, before);
  assert.equal(overview.details.head, before);
  assert.notEqual((await reader.details()).head, before);
});

test('overview handles unborn, detached and non-repository states without changing old interfaces', async t => {
  const root = await repository(t, { unborn: true });
  const reader = new GitReader(root);
  let result = await reader.overview();
  assert.deepEqual(result.snapshot, await reader.snapshot());
  assert.deepEqual(result.details, await reader.details());
  assert.equal(result.details.head, null);
  assert.equal(result.details.branch, 'main');
  git(root, 'commit', '--allow-empty', '-m', 'first');
  git(root, 'checkout', '--detach', 'HEAD');
  result = await reader.overview();
  assert.deepEqual(result.snapshot, await reader.snapshot());
  assert.deepEqual(result.details, await reader.details());
  assert.equal(result.snapshot.branch, null);
  assert.equal(result.details.branch, null);
  const plain = new GitReader(await directory(t));
  assert.deepEqual(await plain.overview(), { snapshot: await plain.snapshot(), details: null });
  await assert.rejects(plain.details(), { code: 'NOT_GIT_REPOSITORY' });
  await assert.rejects(plain.previewUntracked('file.txt'), { code: 'NOT_GIT_REPOSITORY' });
});

test('overview keeps tracking/conflict state and standalone mutation details stay fresh', async t => {
  const root = await repository(t);
  git(root, 'branch', 'upstream');
  git(root, 'branch', '--set-upstream-to=upstream', 'main');
  git(root, 'commit', '--allow-empty', '-m', 'ahead');
  const reader = new GitActions(root);
  const first = await reader.overview();
  assert.deepEqual(first.details, await reader.details());
  assert.equal(first.details.ahead, 1);
  assert.equal(first.details.behind, 0);
  assert.equal(first.details.upstream, 'upstream');
  await fs.writeFile(path.join(root, 'untracked.txt'), 'new\n');
  assert.equal((await reader.details()).clean, false);
  await assert.rejects(reader.execute({ operation: 'switchBranch', branch: 'upstream', expectedHead: first.details.head, expectedBranch: 'main' }), /clean worktree/);
  git(root, 'add', '--', 'untracked.txt');
  git(root, 'commit', '-m', 'new head');
  await assert.rejects(reader.execute({ operation: 'fetch', expectedHead: first.details.head, expectedBranch: 'main' }), { code: 'STALE_STATE' });
  git(root, 'checkout', 'upstream');
  const fresh = await reader.details();
  assert.equal(fresh.branch, 'upstream');
  assert.notEqual(fresh.head, first.details.head);
  assert.equal(fresh.clean, true);

  await fs.writeFile(path.join(root, 'tracked.txt'), 'upstream edit\n');
  git(root, 'add', '--', 'tracked.txt');
  git(root, 'commit', '-m', 'upstream edit');
  git(root, 'checkout', 'main');
  await fs.writeFile(path.join(root, 'tracked.txt'), 'main edit\n');
  git(root, 'add', '--', 'tracked.txt');
  git(root, 'commit', '-m', 'main edit');
  assert.throws(() => git(root, 'merge', '--no-edit', 'upstream'));
  const conflicted = await reader.overview();
  assert.equal(conflicted.details.conflicts, true);
  assert.deepEqual(conflicted.snapshot, await reader.snapshot());
  assert.deepEqual(conflicted.details, await reader.details());
});

test('preview reads empty, Unicode, literal and nested untracked files relative to normalized repository root', async t => {
  const root = await repository(t);
  await fs.mkdir(path.join(root, 'nested'));
  const files = new Map([
    ['empty.txt', ''], ['文本 中文.txt', '中文第一行\n第二行🙂\n'],
    ['[abc].txt', 'only literal\n'], ['a.txt', 'not the bracket path\n'],
    ['--flag.txt', 'not an option'], ['nested/child.txt', 'one\r\ntwo\rthree'],
    ['replacement.txt', 'literal replacement character: �'],
  ]);
  for (const [name, text] of files) await fs.writeFile(path.join(root, name), text);
  const reader = new GitReader(path.join(root, 'nested'));
  for (const [name, text] of files) {
    const result = await reader.previewUntracked(name);
    assert.equal(result.text, text);
    assert.equal(result.bytes, Buffer.byteLength(text));
    assert.equal(result.binary, false);
    assert.equal(result.truncated, false);
    assert.equal(result.lines, text ? text.split(/\r\n|\r|\n/).length - (/[\r\n]$/.test(text) ? 1 : 0) : 0);
  }
  assert.equal(path.normalize(reader.root).toLowerCase(), root.toLowerCase());
  assert.equal((await reader.previewUntracked('nested\\child.txt')).text, files.get('nested/child.txt'));
  assert.deepEqual(await reader.previewUntracked('empty.txt'), { text: '', binary: false, truncated: false, bytes: 0, lines: 0 });
});

test('preview caps physical reads at 256 KiB plus four detection bytes without readFile', async t => {
  const root = await repository(t);
  const target = path.join(root, 'large.txt');
  const bytes = 4 * 1024 * 1024;
  await fs.writeFile(target, Buffer.alloc(bytes, 'x'));
  const open = fs.open, readFile = fs.readFile;
  let sampled = 0, furthestRequested = 0, closed = false;
  fs.readFile = async () => { throw new Error('Unbounded readFile must not be used by preview'); };
  fs.open = async (file, flags, ...rest) => {
    assert.equal(file, target);
    if (process.platform !== 'win32') assert.ok(flags & constants.O_NOFOLLOW);
    const handle = await open(file, flags, ...rest);
    const read = handle.read.bind(handle), close = handle.close.bind(handle);
    handle.read = async (buffer, offset, length, position) => {
      furthestRequested = Math.max(furthestRequested, position + length);
      assert.ok(buffer.length <= MAX_BYTES + 4);
      // Exercise the short-read loop instead of assuming a read fills its buffer.
      const result = await read(buffer, offset, Math.min(length, 16 * 1024), position);
      sampled += result.bytesRead;
      return result;
    };
    handle.close = async () => { closed = true; return close(); };
    return handle;
  };
  try {
    const result = await new GitReader(root).previewUntracked('large.txt');
    assert.deepEqual(result, { text: 'x'.repeat(MAX_BYTES), binary: false, truncated: true, bytes, lines: 1 });
    assert.equal(sampled, MAX_BYTES + 4);
    assert.ok(furthestRequested <= MAX_BYTES + 4);
    assert.equal(closed, true);
  } finally { fs.open = open; fs.readFile = readFile; }
});

test('preview respects exact byte/line limits and never splits UTF-8 into replacement glyphs', async t => {
  const root = await repository(t);
  const reader = new GitReader(root);
  await fs.writeFile(path.join(root, 'exact.txt'), 'x'.repeat(MAX_BYTES));
  assert.equal((await reader.previewUntracked('exact.txt')).truncated, false);
  const unicode = 'a'.repeat(MAX_BYTES - 1) + '中文🙂';
  await fs.writeFile(path.join(root, 'boundary.txt'), unicode);
  const boundary = await reader.previewUntracked('boundary.txt');
  assert.equal(boundary.text, 'a'.repeat(MAX_BYTES - 1));
  assert.equal(boundary.bytes, Buffer.byteLength(unicode));
  assert.equal(boundary.binary, false);
  assert.equal(boundary.truncated, true);
  assert.doesNotMatch(boundary.text, /�/);
  const lines = Array.from({ length: 2005 }, (_, index) => `第${index}行\r\n`);
  await fs.writeFile(path.join(root, 'lines.txt'), lines.join(''));
  const result = await reader.previewUntracked('lines.txt');
  assert.equal(result.text, lines.slice(0, 2000).join(''));
  assert.equal(result.lines, 2000);
  assert.equal(result.truncated, true);
  for (const text of ['line\n'.repeat(2000), 'line\n'.repeat(1999) + 'last']) {
    await fs.writeFile(path.join(root, 'exact-lines.txt'), text);
    const exact = await reader.previewUntracked('exact-lines.txt');
    assert.equal(exact.text, text);
    assert.equal(exact.lines, 2000);
    assert.equal(exact.truncated, false);
  }
});

test('binary, invalid UTF-8 and incomplete code points produce explanatory messages', async t => {
  const root = await repository(t);
  const reader = new GitReader(root);
  for (const [name, contents] of [
    ['null-byte.bin', Buffer.from([65, 0, 66])], ['controls.bin', Buffer.from([1, 2, 3])],
    ['invalid.bin', Buffer.from([0xc0, 0xaf])], ['unfinished.bin', Buffer.from([0xe4, 0xb8])],
  ]) {
    await fs.writeFile(path.join(root, name), contents);
    const result = await reader.previewUntracked(name);
    assert.equal(result.binary, true);
    assert.equal(result.bytes, contents.length);
    assert.equal(result.lines, 0);
    assert.equal(result.truncated, false);
    assert.match(result.text, /二进制|UTF-8/);
    assert.doesNotMatch(result.text, /�/);
  }
});

test('preview refuses tracked, staged, ignored files and anything but an exact untracked match', async t => {
  const root = await repository(t);
  await fs.writeFile(path.join(root, '.gitignore'), 'ignored.txt\nignored-dir/\n');
  await fs.writeFile(path.join(root, 'ignored.txt'), 'secret ignored\n');
  await fs.mkdir(path.join(root, 'ignored-dir'));
  await fs.writeFile(path.join(root, 'ignored-dir', 'secret.txt'), 'secret ignored directory\n');
  await fs.writeFile(path.join(root, 'staged.txt'), 'staged\n');
  git(root, 'add', '--', 'staged.txt');
  await fs.writeFile(path.join(root, 'exact.txt'), 'valid\n');
  const reader = new GitReader(root);
  for (const name of ['tracked.txt', 'staged.txt', 'ignored.txt', 'ignored-dir/secret.txt']) {
    await assert.rejects(reader.previewUntracked(name), /untracked, non-ignored/);
  }
  const original = reader._git.bind(reader);
  for (const output of ['', 'exact.txt.more\0', 'exact.txt\0other.txt\0', 'exact.txt', './exact.txt\0']) {
    reader._git = async (args, ...rest) => args[0] === 'ls-files' && args.includes('--others') ? { stdout: output } : original(args, ...rest);
    await assert.rejects(reader.previewUntracked('exact.txt'), /untracked, non-ignored/);
  }
});

test('preview rejects traversal, Git metadata, Windows devices/aliases and malformed paths', async t => {
  const root = await repository(t);
  const reader = new GitReader(root);
  const invalid = [
    undefined, null, 4, {}, '', '.', '..', '../secret', '..\\secret', 'child/../../secret',
    '/etc/passwd', 'C:\\secret', 'C:secret', '\\\\server\\share', '\\\\?\\C:\\secret',
    'a//b', './tracked.txt', 'a/./b', 'a/', 'a\\', 'bad\0path', 'bad\npath', 'x'.repeat(4097),
    '.git/config', '.GIT/config', 'child/.git/config', 'git~1/config', '.git~1/config',
    'file:stream', 'file::$DATA', 'trailing.', 'trailing ', 'NUL', 'aux.txt', 'CON .txt',
    'COM0.txt', 'LPT0.txt', 'COM1/name', 'LPT².log', 'CONIN$', 'CONOUT$', 'a*.txt', 'a?.txt', 'bad|file', 'bad<file',
  ];
  for (const input of invalid) await assert.rejects(reader.previewUntracked(input), /path/, String(input));
  await fs.mkdir(path.join(root, 'directory'));
  await fs.writeFile(path.join(root, 'directory', 'file.txt'), 'child\n');
  await assert.rejects(reader.previewUntracked('directory'), /regular file/);
  await assert.rejects(reader.previewUntracked('missing.txt'), { code: 'ENOENT' });
});

test('preview rejects a separate Git metadata directory even when not named .git', async t => {
  const root = await directory(t);
  git(root, 'init', '--separate-git-dir', path.join(root, 'admin'), '-b', 'main');
  await assert.rejects(new GitReader(root).previewUntracked('admin/config'), /metadata/);
});

test('preview refuses ancestor and leaf symlinks/junctions, including links staying inside the repo', async t => {
  const root = await repository(t);
  const outside = await directory(t);
  await fs.writeFile(path.join(outside, 'secret.txt'), 'outside secret\n');
  await fs.mkdir(path.join(root, 'real'));
  await fs.writeFile(path.join(root, 'real', 'file.txt'), 'inside\n');
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  await fs.symlink(outside, path.join(root, 'external'), type);
  await fs.symlink(path.join(root, 'real'), path.join(root, 'internal'), type);
  const reader = new GitReader(root);
  for (const name of ['external/secret.txt', 'internal/file.txt', 'external', 'internal']) {
    await assert.rejects(reader.previewUntracked(name), /symlink|junction/);
  }
  await t.test('leaf file symlink is never read', async subtest => {
    try { await fs.symlink(path.join(outside, 'secret.txt'), path.join(root, 'leaf.txt'), 'file'); }
    catch (error) {
      if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) return subtest.skip('Windows file symlink privilege unavailable; directory junctions tested above');
      throw error;
    }
    await assert.rejects(reader.previewUntracked('leaf.txt'), /symlink|junction/);
  });
});

test('preview rejects an ancestor swapped for a junction between inspection and open before reading', async t => {
  const root = await repository(t);
  const outside = await directory(t);
  await fs.writeFile(path.join(outside, 'file.txt'), 'outside secret\n');
  const parent = path.join(root, 'parent');
  await fs.mkdir(parent);
  await fs.writeFile(path.join(parent, 'file.txt'), 'untracked\n');
  const open = fs.open;
  let reads = 0, closed = false;
  fs.open = async (...args) => {
    await fs.rename(parent, path.join(root, 'saved-parent'));
    await fs.symlink(outside, parent, process.platform === 'win32' ? 'junction' : 'dir');
    const handle = await open(...args);
    const read = handle.read.bind(handle), close = handle.close.bind(handle);
    handle.read = async (...readArgs) => { reads++; return read(...readArgs); };
    handle.close = async () => { closed = true; return close(); };
    return handle;
  };
  try {
    await assert.rejects(new GitReader(root).previewUntracked('parent/file.txt'), /变化|symlink|junction/);
    assert.equal(reads, 0);
    assert.equal(closed, true);
  } finally { fs.open = open; }
});

test('preview rechecks file-handle metadata and untracked eligibility after the bounded read', async t => {
  const root = await repository(t);
  const open = fs.open;
  for (const change of ['content', 'stage', 'ignore']) {
    const name = `${change}.txt`;
    const target = path.join(root, name);
    await fs.writeFile(target, 'initial content\n');
    let closed = false, changed = false;
    fs.open = async (...args) => {
      const handle = await open(...args);
      const read = handle.read.bind(handle), close = handle.close.bind(handle);
      handle.read = async (...readArgs) => {
        const result = await read(...readArgs);
        if (!changed) {
          changed = true;
          if (change === 'content') await fs.writeFile(target, 'changed after read\n');
          if (change === 'stage') git(root, 'add', '--', name);
          if (change === 'ignore') await fs.writeFile(path.join(root, '.gitignore'), name + '\n');
        }
        return result;
      };
      handle.close = async () => { closed = true; return close(); };
      return handle;
    };
    try {
      await assert.rejects(new GitReader(root).previewUntracked(name), /变化|untracked, non-ignored/);
      assert.equal(changed, true);
      assert.equal(closed, true);
    } finally { fs.open = open; }
  }
});

test('overview and preview POST APIs preserve old routes and use live or persisted session roots', async t => {
  const root = await repository(t);
  await fs.writeFile(path.join(root, 'preview.txt'), 'preview 中文\n');
  for (const persisted of [false, true]) {
    const request = api(root, { persisted });
    const result = await request('overview', { repository: '.' });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.deepEqual(result.body.snapshot, (await request('snapshot')).body);
    assert.deepEqual(result.body.details, (await request('details')).body);
    assert.equal((await request('diff', { path: 'tracked.txt' })).status, 200);
    const preview = await request('preview', { repository: '.', path: 'preview.txt' });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.deepEqual(preview.body, { text: 'preview 中文\n', binary: false, truncated: false, bytes: Buffer.byteLength('preview 中文\n'), lines: 1 });
  }
});

test('preview API strictly allows only sessionId/repository/path and retains session/resource validation', async t => {
  const root = await repository(t);
  await fs.writeFile(path.join(root, 'preview.txt'), 'read only\n');
  const request = api(root);
  for (const body of [
    {}, { path: '' }, { path: null }, { path: [] }, { path: 4 }, { path: 'bad\0file' },
    { path: 'x'.repeat(4097) }, { path: 'tracked.txt' }, { path: '.git/config' }, { path: '../secret' },
    { path: 'preview.txt', cwd: root }, { path: 'preview.txt', staged: false },
    { path: 'preview.txt', commit: 'abcd' }, { path: 'preview.txt', operation: 'stage' },
    { path: 'preview.txt', repository: '../' }, { path: 'preview.txt', repository: root },
    { path: 'preview.txt', repository: null }, { path: 'preview.txt', repository: [] },
  ]) assert.equal((await request('preview', body)).status, 400, JSON.stringify(body));
  const polluted = JSON.parse('{"path":"preview.txt","__proto__":{}}');
  assert.equal((await request('preview', polluted)).status, 400);
  assert.equal((await request('preview', { path: 'preview.txt', sessionId: '../session-read' })).status, 400);
  assert.equal((await request('preview', { path: 'preview.txt', sessionId: 'session-unknown' })).status, 404);
  assert.equal((await request('preview', { path: 'x'.repeat(17000) })).status, 413);
  assert.equal((await request('overview', { path: 'preview.txt' })).status, 400);
  assert.equal((await request('overview', { repository: '../' })).status, 400);
  assert.equal(git(root, 'diff', '--cached'), '');
});
