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
