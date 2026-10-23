import childProcess from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { previewUntracked } from './git-preview.mjs';

function gitExecutable() {
  if (process.platform !== 'win32') return 'git';
  const search = (process.env.PATH || process.env.Path || '').split(path.delimiter);
  for (const directory of search) {
    if (directory && existsSync(path.join(directory.replace(/^"|"$/g, ''), 'git.exe'))) return 'git';
  }
  const locations = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'cmd', 'git.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'cmd', 'git.exe'),
    'D:\\Program Files\\Git\\cmd\\git.exe',
  ];
  return locations.find(candidate => existsSync(candidate)) || 'git';
}

const TIMEOUT = 10_000;
const MAX_BUFFER = 8 * 1024 * 1024;
const BASE_ARGS = ['--no-pager', '--literal-pathspecs', '-c', 'core.quotepath=false', '-c', 'color.ui=false'];

/** Read-only Git access. Methods are asynchronous; no shell is ever invoked. */
export class GitReader {
  constructor(root) {
    if (typeof root !== 'string' || !root || root.includes('\0')) throw new TypeError('root must be a directory path');
    this.root = path.resolve(root);
  }

  async _git(args, acceptedCodes = [], { timeout = TIMEOUT } = {}) {
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 60_000) throw new TypeError('Invalid Git timeout');
    // Do not let inherited Git routing/pathspec variables change the repository or
    // turn a literal user path into a glob. No optional index refresh/locks.
    const env = { ...process.env };
    for (const name of Object.keys(env)) if (name.toUpperCase().startsWith('GIT_')) delete env[name];
    Object.assign(env, {
      GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never',
      GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o NumberOfPasswordPrompts=0 -o ConnectTimeout=15',
      GIT_SSH_VARIANT: 'ssh', LC_ALL: 'C',
    });
    return new Promise((resolve, reject) => {
      childProcess.execFile(gitExecutable(), [...BASE_ARGS, ...args], {
        cwd: this.root, env, encoding: 'utf8', shell: false,
        windowsHide: true, timeout, maxBuffer: MAX_BUFFER,
      }, (error, stdout, stderr) => {
        const uncertain = Boolean(error && (error.killed || error.signal
          || ['ETIMEDOUT', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', 'ABORT_ERR'].includes(error.code)));
        if (error && (!acceptedCodes.includes(error.code) || uncertain)) {
          const failure = new Error(`Git read failed: ${String(stderr || error.message).trim()}`);
          failure.code = error.code;
          // Killing/losing a child does not prove a mutation was rolled back.
          // Preserve native code for existing callers; journal uses only this flag.
          failure.uncertain = uncertain;
          failure.cause = error;
          reject(failure);
        } else resolve({ stdout, stderr, code: error?.code ?? 0 });
      });
    });
  }

  async _isRepository() {
    const result = await this._git(['rev-parse', '--show-toplevel'], [128]);
    if (result.code === 0) {
      // Porcelain paths are relative to the worktree root, even when opened from
      // a subdirectory. Resolve future diffs against that same root.
      this.root = path.resolve(result.stdout.replace(/\r?\n$/, ''));
      return true;
    }
    if (/not a git repository/i.test(result.stderr)) return false;
    const error = new Error(`Git read failed: ${result.stderr.trim()}`);
    error.code = result.code;
    throw error;
  }

  /** Lightweight local-only summary from a single porcelain-v2 status read.
   * changes counts paths (including untracked/unmerged); staged counts resolved
   * index changes only. Missing branch.ab means unknown, not zero divergence.
   */
  async summary() {
    if (!await this._isRepository()) throw Object.assign(new Error('Not a Git repository'), { code: 'NOT_GIT_REPOSITORY' });
    const { stdout } = await this._git(['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all']);
    const result = {
      branch: null, head: null, upstream: null, ahead: null, behind: null,
      changes: 0, staged: 0, untracked: 0, conflicts: 0,
      checkedAt: new Date().toISOString(),
    };
    const records = stdout.split('\0');
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (record.startsWith('# branch.oid ')) {
        const oid = record.slice(13);
        result.head = oid === '(initial)' ? null : oid;
      } else if (record.startsWith('# branch.head ')) {
        const branch = record.slice(14);
        result.branch = branch === '(detached)' ? null : branch;
      } else if (record.startsWith('# branch.upstream ')) {
        result.upstream = record.slice(18);
      } else if (record.startsWith('# branch.ab ')) {
        const counts = /^# branch\.ab \+(\d+) -(\d+)$/.exec(record);
        if (counts) {
          result.ahead = Number(counts[1]);
          result.behind = Number(counts[2]);
        }
      } else if (record.startsWith('1 ') || record.startsWith('2 ')) {
        result.changes++;
        if (record[2] !== '.') result.staged++;
        // In -z mode type 2 has a second NUL-delimited original pathname.
        // It is opaque: even a name resembling a header is never metadata.
        if (record[0] === '2') i++;
      } else if (record.startsWith('u ')) {
        result.changes++;
        result.conflicts++;
      } else if (record.startsWith('? ')) {
        result.changes++;
        result.untracked++;
      }
    }
    return result;
  }

  /** On-demand local branch hints, not authorization for a later deletion.
   * Merged means reachable from this call's fixed HEAD; Git's native -d upstream
   * check and all fresh mutation-time validation remain independently required.
   */
  async branchMetadata() {
    if (!await this._isRepository()) throw Object.assign(new Error('Not a Git repository'), { code: 'NOT_GIT_REPOSITORY' });
    const currentResult = await this._git(['symbolic-ref', '--quiet', 'HEAD'], [1]);
    const currentRef = currentResult.stdout.trim() || null;
    const headResult = await this._git(['rev-parse', '--verify', '--quiet', 'HEAD'], [1]);
    const head = headResult.code === 0 ? headResult.stdout.trim() : null;
    const refs = await this._git(['for-each-ref', '--format=%(refname)%00%(objectname)%00%(committerdate:iso-strict)', 'refs/heads/']);
    const mergedRefs = head === null ? null : new Set((await this._git([
      'for-each-ref', `--merged=${head}`, '--format=%(refname)', 'refs/heads/',
    ])).stdout.split(/\r?\n/).filter(Boolean));
    const worktreeResult = await this._git(['worktree', 'list', '--porcelain', '-z']);
    const worktreesByRef = new Map();
    let worktreePath = null;
    // -z terminates individual fields AND records with NUL. Never split paths
    // on newlines, trim them, or unquote them: path contents are opaque here.
    for (const field of worktreeResult.stdout.split('\0')) {
      if (field === '') worktreePath = null;
      else if (field.startsWith('worktree ')) worktreePath = field.slice(9);
      else if (field.startsWith('branch refs/heads/') && worktreePath !== null) {
        const ref = field.slice(7);
        if (!worktreesByRef.has(ref)) worktreesByRef.set(ref, []);
        worktreesByRef.get(ref).push(worktreePath);
      }
    }
    const branches = refs.stdout.split(/\r?\n/).filter(Boolean).map(record => {
      const [ref, tip, updatedAt] = record.split('\0');
      const current = ref === currentRef;
      const merged = mergedRefs === null ? null : mergedRefs.has(ref);
      const worktrees = worktreesByRef.get(ref) || [];
      const deleteBlockedReason = current ? 'current' : worktrees.length ? 'worktree'
        : head === null ? 'no-head' : !merged ? 'unmerged' : null;
      return { name: ref.slice('refs/heads/'.length), tip, updatedAt, current, merged, worktrees, deleteBlockedReason };
    });
    return { head, branches, checkedAt: new Date().toISOString() };
  }

  /** { isRepository, branch: string|null, status, branches: string[], commits } */
  async snapshot() {
    return (await this._snapshot()).snapshot;
  }

  /** One refresh, sharing only this call's HEAD/branch/status reads. Never cached:
   * details() used by mutations must still re-read the repository each time.
   */
  async overview() {
    const { snapshot, state } = await this._snapshot();
    return { snapshot, details: state ? await this._details(state) : null };
  }

  async _snapshot() {
    const empty = { isRepository: false, branch: null, status: [], branches: [], commits: [] };
    if (!await this._isRepository()) return { snapshot: empty, state: null };
    const branchResult = await this._git(['symbolic-ref', '--quiet', '--short', 'HEAD'], [1]);
    const statusResult = await this._git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--renames']);
    const branchList = await this._git(['for-each-ref', '--format=%(refname:short)', 'refs/heads/']);
    const head = await this._git(['rev-parse', '--verify', '--quiet', 'HEAD'], [1]);
    const status = [];
    const records = statusResult.stdout.split('\0');
    for (let i = 0; i < records.length && records[i]; i++) {
      const record = records[i];
      const index = record[0];
      const worktree = record[1];
      const renamed = /[RC]/.test(index + worktree);
      status.push({ path: record.slice(3), index, worktree, oldPath: renamed ? records[++i] : null });
    }
    const commits = [];
    if (head.code === 0) {
      // Pin history to the HEAD already read, even if an external commit happens
      // before log runs; overview.details.head then agrees with commits[0].hash.
      const log = await this._git(['log', '-100', '-z', '--date=iso-strict', '--format=%H%x00%P%x00%s%x00%an%x00%aI%x00%D', head.stdout.trim(), '--']);
      const fields = log.stdout.split('\0');
      for (let i = 0; i + 5 < fields.length; i += 6) {
        const [hash, parents, subject, author, date, refs] = fields.slice(i, i + 6);
        commits.push({ hash, parents: parents ? parents.split(' ') : [], subject, author, date, refs: refs ? refs.split(', ') : [] });
      }
    }
    const branch = branchResult.stdout.trim() || null;
    return {
      snapshot: { isRepository: true, branch, status, branches: branchList.stdout.split('\n').filter(Boolean), commits },
      state: { head: head.code === 0 ? head.stdout.trim() : null, branch, clean: statusResult.stdout.length === 0 },
    };
  }

  /** Additional operation state; deliberately separate from the stable snapshot shape. */
  async details() {
    if (!await this._isRepository()) throw Object.assign(new Error('Not a Git repository'), { code: 'NOT_GIT_REPOSITORY' });
    const headResult = await this._git(['rev-parse', '--verify', '--quiet', 'HEAD'], [1]);
    const branchResult = await this._git(['symbolic-ref', '--quiet', '--short', 'HEAD'], [1]);
    const statusResult = await this._git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--renames']);
    return this._details({
      head: headResult.code === 0 ? headResult.stdout.trim() : null,
      branch: branchResult.stdout.trim() || null, clean: statusResult.stdout.length === 0,
    });
  }

  async _details({ head, branch, clean }) {
    const remoteResult = await this._git(['remote']);
    let upstream = null, ahead = 0, behind = 0;
    if (branch) {
      const tracking = await this._git(['for-each-ref', '--format=%(upstream:short)', `refs/heads/${branch}`]);
      upstream = tracking.stdout.trim() || null;
      if (head && upstream) {
        const counts = await this._git(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}', '--'], [128]);
        if (counts.code === 0) [ahead, behind] = counts.stdout.trim().split(/\s+/).map(Number);
      }
    }
    const unmerged = await this._git(['ls-files', '--unmerged', '-z']);
    return {
      head, branch, upstream, ahead, behind,
      remotes: remoteResult.stdout.split(/\r?\n/).filter(Boolean).map(name => ({ name })),
      clean, conflicts: unmerged.stdout.length > 0,
    };
  }

  /** Bounded UTF-8 preview of an exactly matched, non-ignored untracked file. */
  async previewUntracked(file) {
    return previewUntracked(this, file);
  }

  _pathspec(value) {
    if (value === undefined) return [];
    if (typeof value !== 'string' || !value || value.includes('\0') || path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[a-z]:/i.test(value)) {
      throw new TypeError('path must be a non-empty repository-relative path');
    }
    // Treat both slash styles as separators even on POSIX to reject Windows escapes.
    const normalized = value.replaceAll('\\', '/');
    if (normalized.split('/').includes('..')) throw new RangeError('path must not escape the repository');
    const relative = path.relative(this.root, path.resolve(this.root, normalized));
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new RangeError('path must not escape the repository');
    return [normalized];
  }

  /** Working-tree diff by default; staged=true selects index; commit selects its patch. */
  async diff({ path: file, staged = false, commit } = {}) {
    const paths = this._pathspec(file);
    if (typeof staged !== 'boolean') throw new TypeError('staged must be a boolean');
    if (commit !== undefined && (typeof commit !== 'string' || !/^[0-9a-fA-F]{4,64}$/.test(commit))) {
      throw new TypeError('commit must be a 4–64 character hexadecimal object id');
    }
    if (commit !== undefined && staged) throw new TypeError('commit and staged cannot be combined');
    if (!await this._isRepository()) {
      const error = new Error('Not a Git repository');
      error.code = 'NOT_GIT_REPOSITORY';
      throw error;
    }
    const safe = ['--no-ext-diff', '--no-textconv', '--no-color', '--src-prefix=a/', '--dst-prefix=b/'];
    const args = commit === undefined
      ? ['diff', ...safe, ...(staged ? ['--cached'] : []), '--', ...paths]
      : ['show', '--format=', '--first-parent', ...safe, `${commit}^{commit}`, '--', ...paths];
    return (await this._git(args)).stdout;
  }
}
