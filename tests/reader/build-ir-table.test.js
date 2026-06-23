import { describe, test, expect } from 'vitest';
import { parseOoxml } from '../../src/reader/ooxml-parse.js';
import { buildIr } from '../../src/reader/build-ir.js';

const ir = (bodyXml, ctx = {}) =>
  buildIr(parseOoxml(`<w:document><w:body>${bodyXml}</w:body></w:document>`), ctx);

describe('build-ir: table', () => {
  test('table → rows of cell inlines', () => {
    const body =
      '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
    expect(ir(body)[0]).toEqual({ type: 'table', rows: [[[{ text: 'A' }], [{ text: 'B' }]]] });
  });

  test('merged cell (gridSpan) — flattened, content preserved', () => {
    const body =
      '<w:tbl><w:tr>' +
      '<w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>Merged</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>Normal</w:t></w:r></w:p></w:tc>' +
      '</w:tr></w:tbl>';
    const result = ir(body);
    expect(result[0].type).toBe('table');
    // Two cells in the row (gridSpan ignored → flattened)
    const row = result[0].rows[0];
    expect(row).toHaveLength(2);
    expect(row[0]).toEqual([{ text: 'Merged' }]);
    expect(row[1]).toEqual([{ text: 'Normal' }]);
  });
});

describe('build-ir: image placeholder', () => {
  test('run with w:drawing → image inline with alt from wp:docPr descr', () => {
    const body =
      '<w:p><w:r>' +
      '<w:drawing><wp:inline><wp:docPr descr="logo"/></wp:inline></w:drawing>' +
      '</w:r></w:p>';
    const blocks = ir(body);
    expect(blocks[0].children).toEqual([{ type: 'image', alt: 'logo' }]);
  });

  test('run with w:drawing but no descr → alt is empty string', () => {
    const body =
      '<w:p><w:r>' +
      '<w:drawing><wp:inline><wp:docPr/></wp:inline></w:drawing>' +
      '</w:r></w:p>';
    const blocks = ir(body);
    expect(blocks[0].children).toEqual([{ type: 'image', alt: '' }]);
  });

  // Final-review fix: numId=0 means "remove inherited numbering" → not a list.
  test('numId=0 paragraph is a normal paragraph, not a list', () => {
    const blocks = ir(
      '<w:p><w:pPr><w:numPr><w:numId w:val="0"/></w:numPr></w:pPr><w:r><w:t>x</w:t></w:r></w:p>'
    );
    expect(blocks[0]).toEqual({ type: 'paragraph', children: [{ text: 'x' }] });
  });
});
