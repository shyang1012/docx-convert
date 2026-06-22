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

describe('layout-to-table integration', () => {
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

  test('T2: flex rows are converted to tables (more than the single line-items table)', async () => {
    const docx = await HTMLtoDOCX(inlineHTML);
    const parsed = await parseDOCX(docx);
    const tableCount = (parsed.xml.match(/<w:tbl>/g) || []).length;
    // Before T2 only the real <table> rendered (1). Now the flex rows
    // ("상호 : 테스트", "발주일 : …") also become tables → strictly more than 1.
    expect(tableCount).toBeGreaterThan(1);
  });

  test('T2: "상호 : 테스트" sits in one row across cells (not stacked paragraphs)', async () => {
    const docx = await HTMLtoDOCX(inlineHTML);
    const parsed = await parseDOCX(docx);
    // The label/colon/value land in separate <w:tc> cells of one <w:tr>.
    const rowWithSangho = parsed.xml.match(/<w:tr\b[\s\S]*?상호[\s\S]*?<\/w:tr>/);
    expect(rowWithSangho).not.toBeNull();
    const cellCount = (rowWithSangho[0].match(/<w:tc>/g) || []).length;
    expect(cellCount).toBeGreaterThanOrEqual(2);
  });

  test('T5: header bar shaded (fill 1a5276) and "발주서" white text preserved', async () => {
    const docx = await HTMLtoDOCX(inlineHTML);
    const parsed = await parseDOCX(docx);
    // background rgb(26,82,118) → cell shading 1a5276 (no longer white-on-white)
    expect(parsed.xml).toMatch(/w:fill="1a5276"/i);
    expect(parsed.xml).toContain('발주서');
    expect(parsed.xml).toMatch(/w:color w:val="ffffff"/i); // white run still present
  });

  test('T5: 발주처/공급처 boxes render with cell borders', async () => {
    const docx = await HTMLtoDOCX(inlineHTML);
    const parsed = await parseDOCX(docx);
    expect(parsed.xml).toContain('<w:tcBorders');
  });

  test('T4: 발주처/공급처 2-col grid → one row with two side-by-side cells', async () => {
    const docx = await HTMLtoDOCX(inlineHTML);
    const parsed = await parseDOCX(docx);
    expect(parsed.xml).toContain('발주처');
    expect(parsed.xml).toContain('공급처');
    // grid div now emits a wrapping table whose single row holds both boxes as cells,
    // so the outer table around 발주처 also encloses 공급처 (they share one grid row).
    const gridRow = parsed.xml.match(/<w:tr\b[\s\S]*발주처[\s\S]*공급처[\s\S]*?<\/w:tr>/);
    expect(gridRow).not.toBeNull();
  });

  test('T6: header cell padding (9px/18px) emits w:tcMar (135/270)', async () => {
    const docx = await HTMLtoDOCX(inlineHTML);
    const parsed = await parseDOCX(docx);
    // header div padding 9px 18px → synthesized cell carries w:tcMar with those TWIP values
    expect(parsed.xml).toContain('<w:tcMar>');
    expect(parsed.xml).toMatch(/w:w="135"/);
    expect(parsed.xml).toMatch(/w:w="270"/);
  });

  test('T3: signature (flex column, align-items:flex-end) renders right-aligned', async () => {
    const docx = await HTMLtoDOCX(inlineHTML);
    const parsed = await parseDOCX(docx);
    expect(parsed.xml).toContain('발주자');
    // the signature column table carries a right table alignment (w:jc w:val="right" in tblPr)
    expect(parsed.xml).toMatch(/w:jc w:val="right"/);
  });
});
