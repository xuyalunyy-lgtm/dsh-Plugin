import { randomUUID } from 'node:crypto';

const OPERATIONS = new Set(['stage', 'unstage', 'commit', 'createBranch', 'deleteBranch', 'switchBranch', 'fetch', 'pull', 'push']);
const STATUSES = new Set(['success', 'failed', 'unknown']);
const ERROR_CODES = new Set(['STALE_STATE', 'GIT_FAILED', 'OUTCOME_UNKNOWN']);
const MAX_COMPLETED = 200;
const MAX_RUNNING = 4;
const MAX_RESULTS = 100;

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected metadata object');
}

function text(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength || /[\x00-\x1f\x7f]/.test(value)
    || /[a-z][a-z\d+.-]*:\/\//i.test(value) || /^[^\s@/:]+@[^\s:]+:/.test(value)) {
    // Never echo a rejected value (which might contain secrets).
    throw new TypeError(`Invalid ${field}`);
  }
  return value;
}

/**
 * Ephemeral, host-process-only journal. Keep one instance at host scope, not per
 * page/session, so page/session switches can query the same session's history.
 * Nothing is persisted; a new instance / host restart starts empty.
 *
 * Accept ONLY server-validated metadata: caller must authorize sessionId, resolve
 * workspaceRoot and validate repository through repository discovery. This class
 * is not an authorization or repository-validation boundary. Identity comparisons
 * are exact (no path normalization, prefix matching or cross-session fallback).
 * Never pass raw requests, Git output, commit bodies, path lists or remote URLs.
 * Unknown properties are ignored, never copied or retained. No free-text message
 * field exists; UI maps the closed machine errorCode vocabulary to descriptions.
 *
 * Limits apply globally to this instance: 200 completed + 4 running. Completion
 * evicts the oldest completed record by completion order, never a running record.
 * list returns at most 100 records, newest begin first (including tied clocks),
 * as a frozen array of frozen flat copies. Timestamps are epoch milliseconds.
 */
export class OperationJournal {
  #clock;
  #records = new Map();
  #completed = [];
  #running = 0;

  constructor({ clock = Date.now } = {}) {
    if (typeof clock !== 'function') throw new TypeError('Invalid clock');
    this.#clock = clock;
  }

  #now() {
    const now = this.#clock();
    if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('Invalid clock result');
    return now;
  }

  /** Returns an opaque UUID. Overflow throws Error with name Busy / code BUSY. */
  begin(input) {
    object(input);
    const { sessionId, workspaceRoot, repository, operation, branch, fileCount } = input;
    const record = {
      sessionId: text(sessionId, 'sessionId', 512),
      workspaceRoot: text(workspaceRoot, 'workspaceRoot', 32768),
      repository: text(repository, 'repository', 32768),
    };
    if (!OPERATIONS.has(operation)) throw new TypeError('Invalid operation');
    record.operation = operation;
    if (branch !== undefined) record.branch = text(branch, 'branch', 1024);
    if (fileCount !== undefined) {
      if (!Number.isSafeInteger(fileCount) || fileCount < 0) throw new TypeError('Invalid fileCount');
      record.fileCount = fileCount;
    }
    if (this.#running >= MAX_RUNNING) throw Object.assign(new Error('Busy'), { name: 'Busy', code: 'BUSY' });
    const startedAt = this.#now();
    const id = randomUUID();
    this.#records.set(id, { id, ...record, status: 'running', startedAt });
    this.#running++;
    return id;
  }

  /**
   * Returns true on first completion, false for absent/already completed ids.
   * Invalid arguments throw without mutation. No duplicate finish can rewrite
   * history. unknown is terminal and retained just like success/failed.
   */
  finish(id, result) {
    if (typeof id !== 'string' || !id) throw new TypeError('Invalid id');
    object(result);
    const { status, errorCode } = result;
    if (!STATUSES.has(status)) throw new TypeError('Invalid status');
    if (errorCode !== undefined && !ERROR_CODES.has(errorCode)) throw new TypeError('Invalid errorCode');
    if (status === 'success' && errorCode !== undefined) throw new TypeError('Successful result cannot have errorCode');
    const record = this.#records.get(id);
    if (!record || record.status !== 'running') return false;
    const finishedAt = this.#now();
    const completed = { ...record, status, finishedAt, durationMs: Math.max(0, finishedAt - record.startedAt) };
    if (errorCode !== undefined) completed.errorCode = errorCode;
    this.#records.set(id, completed);
    this.#running--;
    this.#completed.push(id);
    if (this.#completed.length > MAX_COMPLETED) this.#records.delete(this.#completed.shift());
    return true;
  }

  list(query) {
    object(query);
    const { sessionId, workspaceRoot, repository } = query;
    text(sessionId, 'sessionId', 512);
    text(workspaceRoot, 'workspaceRoot', 32768);
    // A query filter is never retained or used for filesystem access. Permit
    // stale/nonexistent identifiers; only validate its primitive string envelope.
    if (repository !== undefined && (typeof repository !== 'string' || !repository
      || repository.length > 32768 || repository.includes('\0'))) throw new TypeError('Invalid repository');
    const records = [...this.#records.values()].reverse()
      .filter(record => record.sessionId === sessionId && record.workspaceRoot === workspaceRoot
        && (repository === undefined || record.repository === repository))
      .slice(0, MAX_RESULTS)
      .map(record => Object.freeze({ ...record }));
    return Object.freeze(records);
  }
}
