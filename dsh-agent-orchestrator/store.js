import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

const MAX_BYTES = 8 * 1024 * 1024;
const HOST = hostname();
const MESSAGES = Object.freeze({
  STORE_UNAVAILABLE: '任务存储需要明确的绝对 profile 专属目录。',
  STORE_LOCKED: '任务存储已被其他实例占用，或无法安全确认旧实例已退出。',
  STORE_CORRUPT: '任务存储内容损坏、版本不受支持或超过容量限制；未重置数据。',
  STORE_WRITE_FAILED: '任务存储写入未确认；已停止后续修改，请关闭并重新检查。',
  STORE_CLOSED: '任务存储已关闭。',
  STORE_MUTATOR_ASYNC: '任务存储更新必须使用同步函数。',
});
class StoreError extends Error {
  constructor(code, cause) {
    super(MESSAGES[code], cause === undefined ? undefined : { cause });
    this.name = 'JobStoreError';
    this.code = code;
  }
}
const fail = (code, cause) => { throw new StoreError(code, cause); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function validDocument(value) {
  return record(value) && value.version === 1 && Array.isArray(value.jobs) && record(value.requests);
}
function parseDocument(text) {
  let value;
  try { value = JSON.parse(text); } catch (error) { fail('STORE_CORRUPT', error); }
  if (!validDocument(value)) fail('STORE_CORRUPT');
  return value;
}
function serialize(value) {
  if (!validDocument(value)) fail('STORE_CORRUPT');
  let text;
  try { text = `${JSON.stringify(value)}\n`; } catch (error) { fail('STORE_CORRUPT', error); }
  if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) fail('STORE_CORRUPT');
  // Do not silently publish non-JSON changes (undefined/function/symbol/non-finite).
  const stored = parseDocument(text);
  if (!isDeepStrictEqual(stored, value)) fail('STORE_CORRUPT');
  return { text, stored };
}
/** All removals are restricted to one exact path in our resolved data directory. */
async function unlinkOwned(directory, path) {
  const target = resolve(path);
  if (dirname(target) !== directory) fail('STORE_WRITE_FAILED');
  try { await unlink(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function syncDirectory(directory) {
  // Windows cannot open a directory this way; file fsync still precedes rename.
  if (process.platform === 'win32') return;
  const handle = await open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}
async function readBounded(path, limit, code) {
  const handle = await open(path, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > limit) fail(code);
    const buffer = Buffer.alloc(limit + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > limit) fail(code);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally { await handle.close(); }
}
function validLock(value) {
  return record(value) && Number.isInteger(value.pid) && value.pid > 0 && value.pid <= 2147483647
    && typeof value.hostname === 'string' && typeof value.token === 'string'
    && /^[a-f0-9-]{36}$/.test(value.token) && typeof value.createdAt === 'string';
}
async function readLock(path) {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) return null;
    const value = JSON.parse(await readBounded(path, 4096, 'STORE_LOCKED'));
    return validLock(value) ? value : null;
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    return null;
  }
}
function sameLock(left, right) {
  return left !== null && right !== null && left !== undefined && right !== undefined
    && left.token === right.token && left.pid === right.pid && left.hostname === right.hostname;
}
function provenExited(value) {
  if (!value || value.hostname !== HOST || value.pid === process.pid) return false;
  try { process.kill(value.pid, 0); return false; }
  catch (error) { return error.code === 'ESRCH'; }
}
async function createLockFile(path, value) {
  const handle = await open(path, 'wx', 0o600);
  try { await handle.writeFile(`${JSON.stringify(value)}\n`, 'utf8'); await handle.sync(); }
  finally { await handle.close(); }
}
async function reclaimExitedLock(directory, lockPath, previous) {
  if (!provenExited(previous)) return false;
  // Contenders of the same stale generation serialize through a separate wx
  // claim. A crashed/incomplete claim is conservatively left for inspection.
  const claimPath = join(directory, `writer.lock.takeover-${previous.token}`);
  const claim = { pid: process.pid, hostname: HOST, token: randomUUID(), createdAt: new Date().toISOString() };
  try { await createLockFile(claimPath, claim); }
  catch (error) { if (['EEXIST', 'EPERM', 'EACCES'].includes(error.code)) return false; throw error; }
  try {
    const current = await readLock(lockPath);
    if (!sameLock(previous, current) || !provenExited(current)) return false;
    const retiredPath = join(directory, `writer.lock.stale-${previous.token}-${randomUUID()}`);
    // Never unlink the canonical lock: rename the verified dead generation so
    // another contender's newly-created writer.lock can never be removed here.
    try { await rename(lockPath, retiredPath); }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    const retired = await readLock(retiredPath);
    if (!sameLock(previous, retired) || !provenExited(retired)) fail('STORE_LOCKED');
    await unlinkOwned(directory, retiredPath);
    return true;
  } finally {
    if (sameLock(await readLock(claimPath), claim)) await unlinkOwned(directory, claimPath);
  }
}
async function acquireLock(directory, lockPath) {
  const value = { pid: process.pid, hostname: HOST, token: randomUUID(), createdAt: new Date().toISOString() };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { await createLockFile(lockPath, value); return value; }
    catch (error) {
      if (!['EEXIST', 'EPERM', 'EACCES'].includes(error.code)) fail('STORE_LOCKED', error);
      const current = await readLock(lockPath);
      if (current === undefined && attempt < 3) continue;
      if (!current || !await reclaimExitedLock(directory, lockPath, current)) fail('STORE_LOCKED');
    }
  }
  fail('STORE_LOCKED');
}

/** One lifetime owner per profile. Never store an Agent, auth token or live handle. */
export async function openJobStore({ directory } = {}) {
  if (typeof directory !== 'string' || !isAbsolute(directory)) fail('STORE_UNAVAILABLE');
  const root = resolve(directory);
  const dataPath = join(root, 'jobs.json');
  const lockPath = join(root, 'writer.lock');
  try { await mkdir(root, { recursive: true, mode: 0o700 }); }
  catch (error) { fail('STORE_UNAVAILABLE', error); }
  const lock = await acquireLock(root, lockPath);
  let current;
  let closed = false;
  let poisoned = false;
  let queue = Promise.resolve();
  let closing;
  async function releaseLock() {
    if (sameLock(await readLock(lockPath), lock)) await unlinkOwned(root, lockPath);
  }
  async function commit(next) {
    const { text, stored } = serialize(next);
    const temp = join(root, `.jobs-${lock.token}-${randomUUID()}.tmp`);
    try {
      if (!sameLock(await readLock(lockPath), lock)) fail('STORE_LOCKED');
      const handle = await open(temp, 'wx', 0o600);
      try { await handle.writeFile(text, 'utf8'); await handle.sync(); }
      finally { await handle.close(); }
      await rename(temp, dataPath); // Do not delete the old data before replacing.
      await syncDirectory(root);
      return stored;
    } finally {
      await unlinkOwned(root, temp).catch(() => {});
    }
  }
  try {
    try { current = parseDocument(await readBounded(dataPath, MAX_BYTES, 'STORE_CORRUPT')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try { current = await commit({ version: 1, jobs: [], requests: {} }); }
      catch (writeError) { fail('STORE_WRITE_FAILED', writeError); }
    }
  } catch (error) {
    await releaseLock().catch(() => {});
    if (error instanceof StoreError) throw error;
    fail('STORE_CORRUPT', error);
  }
  return {
    snapshot() {
      if (closed) fail('STORE_CLOSED');
      if (poisoned) fail('STORE_WRITE_FAILED');
      return structuredClone(current);
    },
    update(mutator) {
      if (closed) return Promise.reject(new StoreError('STORE_CLOSED'));
      const work = queue.then(async () => {
        if (poisoned) fail('STORE_WRITE_FAILED');
        if (typeof mutator !== 'function') throw new TypeError('mutator must be a synchronous function');
        const draft = structuredClone(current);
        const result = mutator(draft);
        if (result && typeof result.then === 'function') {
          void Promise.resolve(result).catch(() => {});
          fail('STORE_MUTATOR_ASYNC');
        }
        const detached = structuredClone(result);
        try {
          const stored = await commit(draft);
          current = stored;
          return detached;
        } catch (error) {
          // A disk error after rename has an uncertain commit outcome: no later
          // mutator may run against our stale memory or trigger new dispatch.
          poisoned = true;
          fail('STORE_WRITE_FAILED', error);
        }
      });
      queue = work.then(() => {}, () => {});
      return work;
    },
    close() {
      if (closing) return closing;
      closed = true;
      closing = queue.then(releaseLock);
      return closing;
    },
  };
}
