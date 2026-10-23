// Shared presentation/navigation state, independent from PDF or Markdown rendering.
export function matchPosition(query, total, current, {loading = false, error = ''} = {}) {
  if (loading) return {status: 'loading', current: 0, total: 0};
  if (error) return {status: 'error', current: 0, total: 0};
  if (!query) return {status: 'idle', current: 0, total: 0};
  if (!total) return {status: 'empty', current: 0, total: 0};
  const index = Number.isInteger(current) && current >= 0 && current < total ? current : 0;
  return {status: 'matched', current: index + 1, total};
}

export function nextMatchIndex(current, delta, total) {
  if (!total) return 0;
  const index = Number.isInteger(current) && current >= 0 && current < total ? current : 0;
  return ((index + delta) % total + total) % total;
}

// User-facing ordinals are 1-based. Do not silently coerce blank, decimal,
// exponential or signed input into a different destination.
export function matchJumpTarget(value, results) {
  const total = results.length;
  if (!total) return {ok: false, error: 'jumpUnavailable'};
  const text = String(value).trim();
  if (!text) return {ok: false, error: 'jumpRequired'};
  if (!/^[0-9]+$/.test(text)) return {ok: false, error: 'jumpInteger'};
  const ordinal = Number(text);
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > total) {
    return {ok: false, error: 'jumpRange'};
  }
  return {ok: true, ordinal, index: ordinal - 1, page: results[ordinal - 1].page};
}

// React/native composition flags and keyCode 229 cover IME Enter commits.
// The explicit composition lifecycle flag is a fallback for browser variations.
export function isComposingKey(event, composing = false) {
  return Boolean(composing || event.isComposing || event.nativeEvent?.isComposing
    || event.keyCode === 229 || event.nativeEvent?.keyCode === 229);
}
