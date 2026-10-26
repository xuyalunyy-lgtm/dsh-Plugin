import {RESULTS_PAGE_SIZE} from './result-list.mjs';

const nonNegative = value => Number.isFinite(value) && value >= 0 ? value : 0;
const integer = (value, fallback = 0) => Number.isSafeInteger(value) && value >= 0 ? value : fallback;

export function documentViewKey(sessionId, tabId, resourceAddress) {
  return JSON.stringify([sessionId, tabId, resourceAddress]);
}

// Whitelist primitive view fields only: never retain bytes, PDF objects, DOM,
// result arrays, errors or transient input/composition state.
export function normalizeViewState(value = {}, limits) {
  let current = integer(value.current), page = Math.max(1, integer(value.page, 1)), listPage = integer(value.listPage);
  if (limits) {
    current = Math.min(current, Math.max(0, limits.totalMatches - 1));
    page = Math.min(page, Math.max(1, limits.totalPages));
    listPage = Math.min(listPage, Math.max(0, Math.ceil(limits.totalMatches / RESULTS_PAGE_SIZE) - 1));
  }
  return {
    query: typeof value.query === 'string' ? value.query : '', sensitive: value.sensitive === true,
    current, page, listExpanded: value.listExpanded === true, listPage,
    scrollTop: nonNegative(value.scrollTop), scrollLeft: nonNegative(value.scrollLeft),
    ...(value.pendingReveal === true ? {pendingReveal: true} : {}),
  };
}

export function createViewStateCache() {
  const records = new Map();
  let disposed = false;
  function close(key, record) {
    record.active = false;
    record.signal.removeEventListener('abort', record.abort);
    if (records.get(key) === record) records.delete(key);
  }
  return {
    // Pure read for a React state initializer; retain/abort wiring happens in effect.
    read(key) {
      const record = records.get(key);
      return !disposed && record?.active && !record.signal.aborted && record.snapshot
        ? {...record.snapshot} : undefined;
    },
    retain(key, signal) {
      if (disposed || !signal || signal.aborted) return {save: () => false, release() {}};
      let record = records.get(key);
      if (record && record.signal !== signal) { close(key, record); record = undefined; }
      if (!record) {
        record = {active: true, signal, snapshot: undefined, abort: null};
        const owned = record;
        record.abort = () => close(key, owned);
        records.set(key, record);
        signal.addEventListener('abort', record.abort, {once: true});
      }
      let released = false;
      return {
        save(value) {
          if (released || disposed || !record.active || signal.aborted || records.get(key) !== record) return false;
          record.snapshot = normalizeViewState(value);
          return true;
        },
        // A view unmount is not a tab close. Keep the snapshot until tab abort.
        release() { released = true; },
      };
    },
    dispose() {
      disposed = true;
      for (const [key, record] of records) close(key, record);
    },
    get size() { return records.size; },
  };
}

export function createScrollCoordinator(initial = {}) {
  let epoch = 0, token = 0, ready = false;
  let saved = {scrollTop: nonNegative(initial.scrollTop), scrollLeft: nonNegative(initial.scrollLeft)};
  let pending = initial.pendingReveal === true ? {kind: 'reveal', token} : {kind: 'restore', token, ...saved};
  return {
    beginLoad() {
      epoch++; ready = false;
      if (!pending) pending = {kind: 'restore', token: ++token, ...saved};
      return epoch;
    },
    renderStarted(loadEpoch) {
      if (loadEpoch !== epoch) return false;
      ready = false;
      // Resizing a canvas can clamp its scrollport before the new page is ready.
      // Restore the last accepted position after redraw; never replace navigation.
      // Reuse the render's revision so its onReady callback can consume this plan.
      if (!pending) pending = {kind: 'restore', token, ...saved};
      return true;
    },
    reveal() { ready = false; pending = {kind: 'reveal', token: ++token}; return token; },
    restore(offsets = {}) {
      ready = false;
      pending = {kind: 'restore', token: ++token, scrollTop: nonNegative(offsets.scrollTop), scrollLeft: nonNegative(offsets.scrollLeft)};
      return token;
    },
    plan(loadEpoch, expectedRevision = token) {
      return loadEpoch === epoch && expectedRevision === token ? (pending ? {...pending} : {kind: 'none', token}) : null;
    },
    complete(loadEpoch, intentToken, offsets) {
      if (loadEpoch !== epoch || intentToken !== token) return false;
      saved = {scrollTop: nonNegative(offsets.scrollTop), scrollLeft: nonNegative(offsets.scrollLeft)};
      pending = null; ready = true;
      return true;
    },
    capture(loadEpoch, offsets) {
      if (loadEpoch !== epoch || !ready || pending) return false;
      saved = {scrollTop: nonNegative(offsets.scrollTop), scrollLeft: nonNegative(offsets.scrollLeft)};
      return true;
    },
    snapshot() {
      const offsets = pending?.kind === 'restore' ? pending : saved;
      return {scrollTop: offsets.scrollTop, scrollLeft: offsets.scrollLeft, pendingReveal: pending?.kind === 'reveal'};
    },
    get revision() { return token; },
  };
}
