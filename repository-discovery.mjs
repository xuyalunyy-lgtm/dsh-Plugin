import path from 'node:path';
import { lstat, realpath, opendir, readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { GitReader } from './git-core.mjs';

export const MAX_DEPTH = 5;
export const SCAN_LIMITS = Object.freeze({ maxDirectories: 5000, maxRepositories: 100, timeoutMs: 5000 });
const absent = error => error?.code === 'ENOENT' || error?.code === 'ENOTDIR';
const within = (root, target) => { const rel = path.relative(root, target); return rel === '' || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`)); };

async function canonicalRoot(root) {
  if (typeof root !== 'string' || !root || root.includes('\0')) throw new TypeError('Invalid workspace root');
  const absolute = path.resolve(root);
  const info = await lstat(absolute);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Workspace root must be a real directory, not a symlink');
  return realpath(absolute);
}

async function markerKind(directory) {
  const marker = path.join(directory, '.git');
  let info;
  try { info = await lstat(marker); } catch (error) { if (absent(error)) return null; throw error; }
  if (info.isSymbolicLink()) throw new Error('Symlink .git markers are not supported');
  if (info.isDirectory()) return 'repository';
  if (!info.isFile() || info.size > 65536) throw new Error('Invalid .git marker');
  const match = /^gitdir: (.+)\r?\n?$/.exec(await readFile(marker, 'utf8'));
  if (!match) throw new Error('Invalid .git file');
  const gitDir = path.resolve(directory, match[1].replace(/\r$/, ''));
  try { await lstat(path.join(gitDir, 'commondir')); return 'worktree'; }
  catch (error) { if (!absent(error)) throw error; }
  return 'submodule';
}

async function describe(root, directory, id, depth, allowAncestor = false) {
  const kind = await markerKind(directory);
  if (!kind && !allowAncestor) return null;
  const reader = new GitReader(directory);
  if (!await reader._isRepository()) {
    if (kind) throw new Error('Invalid Git repository marker');
    return null;
  }
  const top = await realpath(reader.root);
  if (top !== directory) {
    // The sole compatibility exception: '.' can refer to the containing repository
    // when a session was opened inside it. Named selections never climb upward.
    if (kind) throw new Error('Git marker does not identify this directory as a repository');
    if (!allowAncestor || !within(top, directory)) return null;
    return { id, name: path.basename(top), path: top, depth, kind: 'ancestor' };
  }
  return { id, name: path.basename(directory) || directory, path: directory, depth, kind: kind || 'repository' };
}

/** Scan depth 0..5, without following directory links or entering Git internals.
 * Limits may be lowered by callers; they cannot enlarge the production budget.
 * 'ancestor' explicitly denotes the legacy '.' selection outside a subdirectory root.
 */
export async function scanRepositories(root, options = {}) {
  const limits = Object.fromEntries(Object.entries(SCAN_LIMITS).map(([key, value]) => {
    const requested = options[key] ?? value;
    if (!Number.isInteger(requested) || requested < 1) throw new TypeError(`Invalid ${key}`);
    return [key, Math.min(value, requested)];
  }));
  const result = { repositories: [], truncated: false, warnings: [], visited: 0, maxDepth: MAX_DEPTH };
  const deadline = performance.now() + limits.timeoutMs;
  const timeout = Object.assign(new Error('Repository scan time limit reached'), { code: 'SCAN_TIMEOUT' });
  const bounded = async (operation, cleanup) => {
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw timeout;
    let timer, expired = false;
    const pending = operation().then(value => {
      if (expired && cleanup) void cleanup(value).catch(() => {});
      return value;
    });
    try { return await Promise.race([pending, new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(timeout); }, remaining); })]); }
    finally { clearTimeout(timer); }
  };
  const truncate = message => { result.truncated = true; result.warnings.push(message); };
  let base;
  try { base = await bounded(() => canonicalRoot(root)); }
  catch (error) { truncate(String(error.message)); return result; }
  const queue = [{ directory: base, id: '.', depth: 0 }];
  try {
    for (let cursor = 0; cursor < queue.length; cursor++) {
      if (result.visited >= limits.maxDirectories) { truncate('Repository scan directory limit reached'); break; }
      const item = queue[cursor];
      result.visited++;
      try {
        const info = await bounded(() => lstat(item.directory));
        if (info.isSymbolicLink() || !info.isDirectory()) continue;
        const canonical = await bounded(() => realpath(item.directory));
        if (canonical !== item.directory || !within(base, canonical)) continue;
        try {
          const repo = await bounded(() => describe(base, canonical, item.id, item.depth, item.depth === 0));
          if (repo) {
            result.repositories.push(repo);
            if (result.repositories.length >= limits.maxRepositories) { truncate('Repository scan repository limit reached'); break; }
          }
        } catch (error) {
          if (error.code === 'SCAN_TIMEOUT') throw error;
          result.warnings.push(`${item.id}: ${error.message}`);
        }
        if (item.depth === MAX_DEPTH) continue;
        // Streaming enumeration avoids allocating an unbounded directory listing.
        const directory = await bounded(() => opendir(canonical), handle => handle.close());
        try {
          while (true) {
            const entry = await bounded(() => directory.read());
            if (!entry) break;
            if (entry.name.toLowerCase() === '.git' || !entry.isDirectory() || entry.isSymbolicLink()) continue;
            if (queue.length >= limits.maxDirectories) { truncate('Repository scan directory limit reached'); break; }
            queue.push({ directory: path.join(canonical, entry.name), id: item.id === '.' ? entry.name : `${item.id}/${entry.name}`, depth: item.depth + 1 });
          }
        } finally { await directory.close().catch(() => {}); }
      } catch (error) {
        if (error.code === 'SCAN_TIMEOUT') throw error;
        truncate(`${item.id}: ${error.message}`);
      }
    }
  } catch (error) { truncate(error.message); }
  result.repositories.sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
  result.warnings = [...new Set(result.warnings)];
  return result;
}

/** Resolve only server-root-relative IDs. Returns a verified repository descriptor. */
export async function selectRepository(root, id = '.') {
  if (typeof id !== 'string' || !id || id.includes('\0') || path.posix.isAbsolute(id) || path.win32.isAbsolute(id) || /^[a-z]:/i.test(id)) throw new TypeError('Invalid repository id');
  const parts = id === '.' ? [] : id.replaceAll('\\', '/').split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git' || /[:]/.test(part) || /[. ]$/.test(part)) || parts.length > MAX_DEPTH) throw new Error('Repository id must stay within workspace depth 5');
  const base = await canonicalRoot(root);
  let directory = base;
  for (const part of parts) {
    directory = path.join(directory, part);
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Repository path must not contain symlinks');
    if (await realpath(directory) !== directory || !within(base, directory)) throw new Error('Repository path escapes workspace');
  }
  const repository = await describe(base, directory, parts.join('/') || '.', parts.length, parts.length === 0);
  if (!repository) throw new Error('Selected directory is not a Git repository');
  return repository;
}
