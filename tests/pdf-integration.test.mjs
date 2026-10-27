import test from 'node:test';
import assert from 'node:assert/strict';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { findMatches, pdfPageText, intersections, decodeMarkdown } from '../src/search.mjs';
import { normalizedPdfMetric, buildPageLayout } from '../src/continuous-pdf.mjs';

// Self-contained valid two-page PDF fixture; no user documents or network.
function twoPagePdf() {
  const contents = [
    'BT /F1 12 Tf 50 750 Td (First page: needle Alpha) Tj ET',
    'BT /F1 12 Tf 50 750 Td (Second page: NEEDLE needle omega) Tj ET',
  ];
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ...contents.map(s => `<< /Length ${s.length} >>\nstream\n${s}\nendstream`),
  ];
  let document = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(document, 'ascii'));
    document += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(document, 'ascii');
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(document, 'ascii'));
}

test('real PDF.js extracts and searches both pages with correct page association', async () => {
  const original = twoPagePdf();
  const task = getDocument({ data: original.slice(), useSystemFonts: true, isEvalSupported: false });
  try {
    const doc = await task.promise;
    assert.equal(doc.numPages, 2);
    const results = [],metrics=[];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      metrics.push(normalizedPdfMetric(page.getViewport({scale:1})));
      const content = await page.getTextContent();
      const { text, spans } = pdfPageText(content.items);
      const matches = findMatches(text, 'needle');
      assert.ok(spans.length > 0);
      for (const match of matches) {
        assert.equal(text.slice(match.start, match.end).toLowerCase(), 'needle');
        assert.ok(spans.some(span => intersections(span.start, span.end, [match]).length > 0));
        results.push({ pageNumber, ...match });
      }
      if (pageNumber === 2) assert.equal(findMatches(text, 'needle', true).length, 1);
    }
    assert.deepEqual(results.map(r => r.pageNumber), [1, 2, 2]);
    assert.deepEqual(metrics,[{width:612,height:792},{width:612,height:792}]);
    const layout=buildPageLayout(metrics,628);
    assert.equal(layout.pages[1].top,8+792+12);
    assert.equal(layout.totalHeight,8+792+12+792+8);
    assert.ok(original.byteLength > 0, 'the shared original buffer stays intact');
  } finally { await task.destroy(); }
});

test('Chinese cross-span and supplementary characters preserve source offsets', () => {
  const { text, spans } = pdfPageText([{ str: '😀中文' }, { str: '内容搜索', hasEOL: true }, { str: '末行' }]);
  const matches = findMatches(text, '文内容');
  assert.deepEqual(matches, [{ start: 3, end: 6 }]);
  assert.deepEqual(intersections(spans[0].start, spans[0].end, matches), [{ start: 3, end: 4, index: 0 }]);
  assert.deepEqual(intersections(spans[1].start, spans[1].end, matches), [{ start: 0, end: 2, index: 0 }]);
  assert.equal(findMatches(text, '搜索末行').length, 0);
});

test('full Markdown content beyond the first text page remains searchable', () => {
  const source = '# 标题\n' + '普通内容\n'.repeat(20000) + '\n末尾唯一关键词';
  const decoded = decodeMarkdown(new TextEncoder().encode(source));
  const matches = findMatches(decoded, '唯一关键词');
  assert.equal(matches.length, 1);
  assert.equal(decoded.slice(matches[0].start, matches[0].end), '唯一关键词');
});

test('escaped regex symbols, Unicode casefold and BOM decoding do not shift matches', () => {
  assert.deepEqual(findMatches('前缀 [a+b].* 后缀', '[a+b].*'), [{ start: 3, end: 10 }]);
  assert.deepEqual(findMatches('İ x X', 'x'), [{ start: 2, end: 3 }, { start: 4, end: 5 }]);
  assert.equal(decodeMarkdown(new Uint8Array([0xfe, 0xff, 0x4e, 0x2d, 0x65, 0x87])), '中文');
  assert.throws(() => decodeMarkdown(new Uint8Array([0xc3, 0x28])));
});
