// T8 (docx-convert-xku.8): inline ↔ table output parity.
//
// etc/test source/ ships the same purchase order in two forms:
//   - purchase-order-inline.html : <div> flex/grid + inline styles (our layout-to-table path)
//   - purchase-order-table.html  : explicit <table> markup (the traditional path)
// The epic's whole point is that a web-style div layout produces the SAME .docx structure
// as hand-authored tables. This pins that parity so any future regression in the layout
// pass is caught immediately. Comparisons are relative (inline === table), not hardcoded,
// so the assertions survive fixture edits. [shyang 2026-06-22]

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import HTMLtoDOCX from '../index.js';
import { parseDOCX } from './helpers/docx-assertions.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', 'etc', 'test source', name), 'utf-8');

const tableCount = (xml) => (xml.match(/<w:tbl>/g) || []).length;
const fillSet = (xml) => [...new Set(xml.match(/w:fill="[0-9a-fA-F]{6}"/g) || [])].sort();
const jcSet = (xml) => [...new Set(xml.match(/w:jc w:val="(?:left|right|center)"/g) || [])].sort();

describe('purchase-order parity (inline div layout === explicit table)', () => {
  let inline;
  let table;

  beforeAll(async () => {
    inline = await parseDOCX(await HTMLtoDOCX(read('purchase-order-inline.html')));
    table = await parseDOCX(await HTMLtoDOCX(read('purchase-order-table.html')));
  });

  test('both outputs parse (valid .docx that Word can open)', () => {
    expect(inline.xml).toContain('<w:document');
    expect(table.xml).toContain('<w:document');
    expect(tableCount(inline.xml)).toBeGreaterThan(1); // layout actually produced tables
  });

  test('table count is equal', () => {
    expect(tableCount(inline.xml)).toBe(tableCount(table.xml));
  });

  test('cell background fills match (header 1a5276 etc.)', () => {
    expect(fillSet(inline.xml)).toEqual(fillSet(table.xml));
    expect(fillSet(inline.xml)).toContain('w:fill="1a5276"'); // header bar present
  });

  test('text alignments match (left/center/right)', () => {
    expect(jcSet(inline.xml)).toEqual(jcSet(table.xml));
  });

  test('key business tokens are present in both', () => {
    const tokens = ['발주서', '품목', '공급가액', '부가세', '합계', '14,000,000'];
    const inlineText = inline.paragraphs.map((p) => p.text).join(' ');
    const tableText = table.paragraphs.map((p) => p.text).join(' ');
    tokens.forEach((t) => {
      expect(inlineText).toContain(t);
      expect(tableText).toContain(t);
    });
  });
});
