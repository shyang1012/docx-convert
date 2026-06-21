// Integration regression for the layout-to-table preprocessing hook (T1, F-02).
//
// T1 wires transformLayoutTree into the body render path but must be a NO-OP. This test
// converts the real purchase-order-inline.html (div + flex/grid + inline styles) end to
// end via HTMLtoDOCX and asserts the hook is connected without breaking output: all key
// content survives and the real <table> still renders. Once T2~T4 add conversion, this
// file becomes the harness for layout/colour fidelity assertions.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import HTMLtoDOCX from '../index.js';
import { parseDOCX } from './helpers/docx-assertions.js';

const here = dirname(fileURLToPath(import.meta.url));
const inlineHTML = readFileSync(
  join(here, '..', 'etc', 'test source', 'purchase-order-inline.html'),
  'utf-8'
);

describe('layout-to-table integration (T1 no-op regression)', () => {
  test('purchase-order-inline converts with all key content (hook wired, no-op)', async () => {
    const docx = await HTMLtoDOCX(inlineHTML);
    const parsed = await parseDOCX(docx);
    const allText = parsed.paragraphs.map((p) => p.text).join(' ');

    [
      '발주서',
      '발주처',
      '공급처',
      '품목',
      '규격',
      '수량',
      '단가',
      '금액',
      '공급가액',
      '부가세',
      '합계',
      '14,000,000',
    ].forEach((token) => expect(allText).toContain(token));
  });

  test('the real <table> (line items) still renders as a w:tbl', async () => {
    const docx = await HTMLtoDOCX(inlineHTML);
    const parsed = await parseDOCX(docx);
    expect(parsed.xml).toContain('<w:tbl');
  });
});
