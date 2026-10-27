export const PDF_PAGE_GAP = 12;
export const PDF_OUTER_PADDING = 8;

// Hidden tabs keep their last useful geometry, but visibility is an independent
// transition so returning at identical dimensions still retries pending work.
export function measurePdfViewport(previous, measurement) {
  const visible = measurement.width > 0 && measurement.height > 0;
  const revision = (previous.measurementRevision || 0) + (visible !== previous.visible ? 1 : 0);
  if (!visible) return previous.visible === false ? previous : {...previous, visible: false, measurementRevision: revision};
  if (previous.visible && previous.width === measurement.width && previous.height === measurement.height && previous.top === measurement.top) return previous;
  return {width: measurement.width, height: measurement.height, top: measurement.top, visible: true, measurementRevision: revision};
}

// Metrics come from PDFPageProxy.getViewport({scale: 1}), including rotation/UserUnit.
export function buildPageLayout(metrics, availableWidth) {
  const width = Math.max(1, Number.isFinite(availableWidth) ? availableWidth : 1);
  let top = PDF_OUTER_PADDING;
  const pages = metrics.map((metric, index) => {
    const scale = Math.min(2, Math.max(1, width - 2 * PDF_OUTER_PADDING) / metric.width);
    const page = {page: index + 1, top, width: metric.width * scale, height: metric.height * scale, scale};
    page.left = Math.max(PDF_OUTER_PADDING, (width - page.width) / 2);
    top += page.height + PDF_PAGE_GAP;
    return page;
  });
  return {width, pages, totalHeight: pages.length ? top - PDF_PAGE_GAP + PDF_OUTER_PADDING : 0};
}

export function pageAtOffset(layout, scrollTop) {
  if (!layout.pages.length) return null;
  let low = 0, high = layout.pages.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (layout.pages[mid].top <= scrollTop) low = mid + 1; else high = mid;
  }
  return layout.pages[Math.max(0, low - 1)];
}

export function visiblePageNumbers(layout, scrollTop, viewportHeight, overscan = viewportHeight) {
  if (!layout.pages.length || viewportHeight <= 0) return [];
  const from = Math.max(0, scrollTop - Math.max(0, overscan));
  const to = scrollTop + viewportHeight + Math.max(0, overscan);
  const first = pageAtOffset(layout, from).page - 1, found = [];
  for (let index = first; index < layout.pages.length; index++) {
    const page = layout.pages[index];
    if (page.top > to) break;
    if (page.top + page.height >= from) found.push(page.page);
  }
  return found;
}

export function capturePageAnchor(layout, scrollTop) {
  const page = pageAtOffset(layout, scrollTop);
  return page ? {page: page.page, ratio: (scrollTop - page.top) / page.height} : {page: 1, ratio: 0};
}
export function restorePageAnchor(layout, anchor) {
  const page = layout.pages[Math.min(layout.pages.length - 1, Math.max(0, (anchor?.page || 1) - 1))];
  return page ? Math.max(0, page.top + page.height * (Number.isFinite(anchor?.ratio) ? anchor.ratio : 0)) : 0;
}

export function groupPageMatches(results) {
  const grouped = new Map();
  results.forEach((match, globalIndex) => {
    let group = grouped.get(match.page);
    if (!group) grouped.set(match.page, group = {matches: [], globalIndexes: []});
    group.matches.push(match); group.globalIndexes.push(globalIndex);
  });
  return grouped;
}

// A nearby page or a stale source/layout/query must never consume another target's intent.
export function pdfReadyMatches(expected, actual) {
  return Boolean(expected && actual && expected.source === actual.source
    && expected.layoutWidth === actual.layoutWidth && expected.token === actual.token
    && expected.page === actual.page);
}

export function mountedPdfPages(layout, scrollTop, viewportHeight, pendingTarget) {
  const mounted = new Set(visiblePageNumbers(layout, scrollTop, viewportHeight));
  if (Number.isInteger(pendingTarget) && pendingTarget >= 1 && pendingTarget <= layout.pages.length) mounted.add(pendingTarget);
  return mounted;
}

// User scrolling cancels a pending automatic jump; ordinary/programmatic scroll does not.
export function isManualScrollKey(event) {
  return !event.ctrlKey && !event.metaKey && !event.altKey && ['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key);
}

export function revealAxis(scrollOffset, viewportSize, itemOffset, itemSize) {
  if (viewportSize <= 0) return scrollOffset;
  if (itemOffset < scrollOffset || itemSize > viewportSize) return Math.max(0, itemOffset);
  if (itemOffset + itemSize > scrollOffset + viewportSize) return Math.max(0, itemOffset + itemSize - viewportSize);
  return scrollOffset;
}

export function normalizedPdfMetric(viewport) {
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0) {
    throw new Error('Invalid PDF page dimensions');
  }
  return {width: viewport.width, height: viewport.height};
}

export const EMPTY_PAGE_MATCHES = Object.freeze({matches: Object.freeze([]), globalIndexes: Object.freeze([])});
