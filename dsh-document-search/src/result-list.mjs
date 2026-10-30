export const RESULTS_PAGE_SIZE = 40;

export function resultPageWindow(total, requestedPage) {
  const pageCount = Math.ceil(total / RESULTS_PAGE_SIZE);
  const page = Math.min(Math.max(Number.isInteger(requestedPage) ? requestedPage : 0, 0), Math.max(0, pageCount - 1));
  const start = page * RESULTS_PAGE_SIZE;
  const end = Math.min(total, start + RESULTS_PAGE_SIZE);
  return {page, pageCount, start, end, from: total ? start + 1 : 0, to: end, total};
}

// Move only the result-list scrollport; never scroll document/chat ancestors.
export function listScrollForItem(scrollTop, viewportHeight, itemTop, itemHeight) {
  if (viewportHeight <= 0) return scrollTop;
  if (itemTop < scrollTop || itemHeight > viewportHeight) return Math.max(0, itemTop);
  if (itemTop + itemHeight > scrollTop + viewportHeight) return Math.max(0, itemTop + itemHeight - viewportHeight);
  return scrollTop;
}

export function buildLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\r') {
      if (text[i + 1] === '\n') i++;
      starts.push(i + 1);
    } else if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

export function lineNumberAt(starts, offset) {
  let low = 0, high = starts.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (starts[middle] <= offset) low = middle + 1;
    else high = middle;
  }
  return Math.max(1, low);
}

function splitsSurrogatePair(text, boundary) {
  const before = text.charCodeAt(boundary - 1), after = text.charCodeAt(boundary);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

// Bound each row even when the query itself is very long. Keep offsets in the
// original UTF-16 text and never cut a context or shortened-hit surrogate pair.
export function matchContext(text, start, end) {
  let left = Math.max(0, start - 48), right = Math.min(text.length, end + 48);
  if (splitsSurrogatePair(text, left)) left--;
  if (splitsSurrogatePair(text, right)) right++;
  let shownEnd = Math.min(end, start + 120);
  if (splitsSurrogatePair(text, shownEnd)) shownEnd++;
  return {
    before: text.slice(left, start), match: text.slice(start, shownEnd), after: text.slice(end, right),
    leadingEllipsis: left > 0, trailingEllipsis: right < text.length, matchTruncated: shownEnd < end,
  };
}

export function createResultPage(pages, results, requestedPage, {isPdf = false, lineStarts} = {}) {
  const window = resultPageWindow(results.length, requestedPage);
  const starts = isPdf ? undefined : (lineStarts ?? buildLineStarts(pages[0]?.text ?? ''));
  const items = results.slice(window.start, window.end).map((result, localIndex) => ({
    index: window.start + localIndex, ordinal: window.start + localIndex + 1,
    page: result.page,
    line: isPdf ? undefined : lineNumberAt(starts, result.start),
    ...matchContext(pages[result.page - 1].text, result.start, result.end),
  }));
  return {...window, items};
}
