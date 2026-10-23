// UTF-16 offsets always refer to the original text. RegExp /iu performs
// simple Unicode case folding without changing string lengths (e.g. İ).
export function findMatches(text, query, caseSensitive = false) {
  if (!query) return [];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, caseSensitive ? 'gu' : 'giu');
  return Array.from(text.matchAll(regex), m => ({ start: m.index, end: m.index + m[0].length }));
}
export function pdfPageText(items) {
  let text = '';
  const spans = [];
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const start = text.length;
    text += item.str;
    spans.push({ start, end: text.length });
    if (item.hasEOL) text += '\n';
  }
  return { text, spans };
}
export function intersections(start, end, matches) {
  return matches.flatMap((match, index) => match.end > start && match.start < end
    ? [{ start: Math.max(start, match.start) - start, end: Math.min(end, match.end) - start, index }]
    : []);
}
export function decodeMarkdown(data) {
  if (data[0] === 0xff && data[1] === 0xfe) return new TextDecoder('utf-16le', { fatal: true }).decode(data);
  if (data[0] === 0xfe && data[1] === 0xff) return new TextDecoder('utf-16be', { fatal: true }).decode(data);
  return new TextDecoder('utf-8', { fatal: true }).decode(data);
}
