import path from 'node:path';
import { lstat, realpath } from 'node:fs/promises';
import { GitReader } from './git-core.mjs';

const OPERATIONS = new Set(['stage', 'unstage', 'commit', 'createBranch', 'deleteBranch', 'switchBranch', 'fetch', 'pull', 'push']);
const KEYS = new Set(['operation', 'paths', 'message', 'branch', 'expectedHead', 'expectedBranch']);
const NO_HOOKS = ['-c', 'core.hooksPath=/dev/null'];
const NETWORK = [...NO_HOOKS, '-c', 'credential.interactive=false', '-c', 'core.askPass=', '-c', 'protocol.ext.allow=never'];
const absent = error => error?.code === 'ENOENT' || error?.code === 'ENOTDIR';
const redact = value => String(value).replace(/\b(?:https?|ssh|git|file):\/\/[^\s'"<>]+/gi, '[remote URL]').replace(/\b[^\s@/:]+@[^\s:]+:[^\s]+/g, '[remote URL]');

/** Mutations on an already discovery-validated repository. The caller serializes
 * operations per repository. Paths are always literal, never shell/pathspec code.
 * Hooks and signing are intentionally disabled to prevent background GUI prompts.
 */
export class GitActions extends GitReader {
  async _paths(paths) {
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > 200) throw new TypeError('paths must contain 1–200 repository-relative paths');
    const root = await realpath(this.root);
    const result = [];
    for (const input of paths) {
      const [normalized] = this._pathspec(input);
      const parts = normalized.split('/');
      if (parts.some(part => !part || part === '.' || part === '..' || /[:]/.test(part) || /[. ]$/.test(part) || part.toLowerCase() === '.git')) {
        throw new TypeError('path must not address Git metadata or escape the repository');
      }
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        current = path.join(current, parts[i]);
        try {
          const info = await lstat(current);
          // A leaf symlink is a Git-tracked object, but traversing one is forbidden.
          if (i < parts.length - 1 && info.isSymbolicLink()) throw new Error('path must not contain a symlink ancestor');
          if (!info.isSymbolicLink()) {
            const resolved = await realpath(current);
            const relative = path.relative(root, resolved);
            if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('path escapes repository');
          }
        } catch (error) { if (!absent(error)) throw error; }
      }
      result.push(normalized);
    }
    return [...new Set(result)];
  }

  async _branch(branch) {
    if (typeof branch !== 'string' || !branch || branch.startsWith('-') || branch.includes('\0') || branch.startsWith('@{-')) throw new TypeError('Invalid branch name');
    const valid = await this._git(['check-ref-format', '--branch', branch], [128, 1]);
    if (valid.code !== 0 || valid.stdout.trim() !== branch) throw new TypeError('Invalid branch name');
    return branch;
  }

  async _localBranchTip(branch) {
    const ref = `refs/heads/${branch}`;
    const symbolic = await this._git(['symbolic-ref', '--quiet', ref], [1]);
    if (symbolic.code === 0) throw new Error('Only a real local branch ref can be deleted (not a symbolic ref)');
    const target = await this._git(['show-ref', '--verify', '--hash', ref], [1, 128]);
    if (target.code !== 0) throw new Error('Local branch does not exist');
    return target.stdout.trim();
  }

  async _upstream(state) {
    if (!state.branch || !state.head) throw new Error('Network operations require a current committed branch');
    const remote = await this._git(['config', '--get', `branch.${state.branch}.remote`], [1]);
    const merge = await this._git(['config', '--get-all', `branch.${state.branch}.merge`], [1]);
    const name = remote.stdout.trim();
    const refs = merge.stdout.trim().split(/\r?\n/).filter(Boolean);
    if (remote.code !== 0 || merge.code !== 0 || !name || name.startsWith('-') || !state.remotes.some(item => item.name === name) || refs.length !== 1 || !refs[0].startsWith('refs/heads/')) {
      throw new Error('A single configured upstream remote and branch is required');
    }
    const valid = await this._git(['check-ref-format', refs[0]], [1]);
    if (valid.code !== 0) throw new Error('Invalid upstream branch');
    return { remote: name, ref: refs[0] };
  }

  async execute(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !KEYS.has(key))) throw new TypeError('Invalid Git action arguments');
    const { operation, paths, message, branch, expectedHead, expectedBranch } = input;
    if (!OPERATIONS.has(operation)) throw new TypeError('Unsupported Git operation');
    if (paths !== undefined && operation !== 'stage' && operation !== 'unstage') throw new TypeError('paths are only allowed for stage/unstage');
    if (message !== undefined && operation !== 'commit') throw new TypeError('message is only allowed for commit');
    if (branch !== undefined && operation !== 'createBranch' && operation !== 'deleteBranch' && operation !== 'switchBranch') throw new TypeError('branch is only allowed for branch operations');
    if (expectedHead !== undefined && expectedHead !== null && (typeof expectedHead !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(expectedHead))) throw new TypeError('Invalid expectedHead');
    if (expectedBranch !== undefined && expectedBranch !== null && (typeof expectedBranch !== 'string' || !expectedBranch || expectedBranch.includes('\0'))) throw new TypeError('Invalid expectedBranch');
    const state = await this.details();
    if ((expectedHead !== undefined && expectedHead !== state.head) || (expectedBranch !== undefined && expectedBranch !== state.branch)) {
      throw Object.assign(new Error('Repository state changed; refresh before trying again'), { code: 'STALE_STATE', status: 409 });
    }
    let args;
    let network = false;
    switch (operation) {
      case 'stage': args = ['add', '--', ...await this._paths(paths)]; break;
      case 'unstage': {
        const selected = await this._paths(paths);
        args = state.head ? ['restore', '--staged', '--', ...selected] : ['rm', '--cached', '--force', '-r', '--ignore-unmatch', '--', ...selected];
        break;
      }
      case 'commit': {
        if (typeof message !== 'string' || !message.trim() || message.includes('\0') || message.length > 100_000) throw new TypeError('commit message must be non-empty');
        if (state.conflicts) throw new Error('Resolve conflicts before committing');
        const staged = await this._git(['diff', '--cached', '--quiet', '--exit-code', '--no-ext-diff', '--no-textconv', '--'], [1]);
        if (staged.code === 0) throw new Error('No staged changes to commit');
        args = [...NO_HOOKS, '-c', 'commit.gpgSign=false', 'commit', '--no-amend', '--no-gpg-sign', '-m', message, '--'];
        break;
      }
      case 'createBranch':
        if (!state.head) throw new Error('Creating a branch requires an existing HEAD commit');
        args = ['branch', '--', await this._branch(branch), state.head];
        break;
      case 'deleteBranch': {
        const name = await this._branch(branch);
        if (!state.head) throw new Error('Deleting a branch requires an existing HEAD commit');
        if (name === state.branch) throw new Error('Cannot delete the current branch');
        const tip = await this._localBranchTip(name);
        // -d alone may accept a branch merged into its upstream but not HEAD.
        const merged = await this._git(['merge-base', '--is-ancestor', tip, state.head], [1]);
        if (merged.code !== 0) throw new Error('Cannot delete a branch that is not fully merged into the current HEAD');
        const current = await this.details();
        const currentTip = await this._localBranchTip(name);
        if (current.head !== state.head || current.branch !== state.branch || currentTip !== tip) {
          throw Object.assign(new Error('Repository state or target branch changed; refresh before trying again'), { code: 'STALE_STATE', status: 409 });
        }
        // Rechecks reduce external races; they cannot make this atomic with other
        // Git processes. Retain native -d merge and linked-worktree guards.
        args = ['branch', '--delete', '--', name];
        break;
      }
      case 'switchBranch':
        if (!state.clean) throw new Error('A clean worktree (including untracked files) is required to switch branches');
        args = [...NO_HOOKS, 'switch', '--no-guess', '--', await this._branch(branch)];
        break;
      default: {
        if (operation === 'pull' && !state.clean) throw new Error('A clean worktree (including untracked files) is required to pull');
        const upstream = await this._upstream(state);
        network = true;
        if (operation === 'fetch') args = [...NETWORK, 'fetch', '--no-recurse-submodules', '--no-tags', '--', upstream.remote, `${upstream.ref}:refs/remotes/${upstream.remote}/${upstream.ref.slice('refs/heads/'.length)}`];
        if (operation === 'pull') args = [...NETWORK, '-c', 'merge.gpgSign=false', 'pull', '--ff-only', '--no-rebase', '--no-recurse-submodules', '--no-tags', '--', upstream.remote, upstream.ref];
        if (operation === 'push') args = [...NETWORK, '-c', `remote.${upstream.remote}.mirror=false`, '-c', 'push.followTags=false', 'push', '--no-force', '--no-mirror', '--no-follow-tags', '--signed=false', '--no-verify', '--recurse-submodules=no', '--', upstream.remote, `refs/heads/${state.branch}:${upstream.ref}`];
      }
    }
    try {
      const result = await this._git([...NO_HOOKS, ...args], [], { timeout: network ? 60_000 : 10_000 });
      return { message: `${operation} completed`, output: redact([result.stdout, result.stderr].filter(Boolean).join('\n').trim()) };
    } catch (error) {
      if (operation === 'deleteBranch' && /checked out|used by worktree/i.test(error.message)) {
        throw new Error(`Cannot delete a branch checked out in another worktree: ${error.message}`);
      }
      if (!network) throw error;
      throw Object.assign(new Error(redact(error.message)), { code: error.code });
    }
  }
}
