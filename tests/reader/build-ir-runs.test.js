import { describe, test, expect } from 'vitest';
import { parseOoxml } from '../../src/reader/ooxml-parse.js';
import { buildIr } from '../../src/reader/build-ir.js';

const ir = (bodyXml) =>
  buildIr(parseOoxml(`<w:document><w:body>${bodyXml}</w:body></w:document>`), {});

test('bold + italic runs map to inline marks', () => {
  const blocks = ir('<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r><w:r><w:t> plain</w:t></w:r></w:p>');
  expect(blocks).toEqual([
    { type: 'paragraph', children: [
      { text: 'bold', bold: true },
      { text: ' plain' },
    ] },
  ]);
});
