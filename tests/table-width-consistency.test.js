// A table with an explicit width smaller than the available page width must be
// internally consistent: the declared table width (w:tblW), the column grid
// (sum of w:gridCol), and the cell widths (w:tcW) must all agree. Otherwise Word
// renders the table at the (smaller) tblW while the grid claims a larger width,
// making the table look narrower than intended — the bug seen on landscape
// purchase orders where layout divs carry explicit px widths.

import HTMLtoDOCX from '../index.js';
import { parseDOCX } from './helpers/docx-assertions.js';

const docxXml = async (html, opts) => (await parseDOCX(await HTMLtoDOCX(html, null, opts))).xml;
const firstTable = (xml) => xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)[0];
const num = (s) => (s ? Number(s.match(/\d+/)[0]) : 0);
const gridSum = (tbl) =>
  (tbl.match(/<w:gridCol[^>]*w:w="\d+"/g) || []).reduce((a, s) => a + num(s), 0);

describe('table width consistency (tblW == grid == cells)', () => {
  test('explicit width < page width → grid sum equals tblW', async () => {
    // 200px = 3000 TWIP, well under the default A4 portrait available width.
    const tbl = firstTable(await docxXml('<table style="width:200px"><tr><td>x</td></tr></table>'));
    const tblW = num(tbl.match(/<w:tblW[^>]*w:w="\d+"/)[0]);
    expect(tblW).toBe(3000);
    expect(gridSum(tbl)).toBe(tblW);
  });

  test('explicit width < page, multi-column → grid distributes tblW evenly', async () => {
    const tbl = firstTable(
      await docxXml('<table style="width:300px"><tr><td>a</td><td>b</td></tr></table>')
    );
    const tblW = num(tbl.match(/<w:tblW[^>]*w:w="\d+"/)[0]);
    const cols = (tbl.match(/<w:gridCol[^>]*w:w="\d+"/g) || []).map(num);
    expect(tblW).toBe(4500); // 300px
    expect(cols).toEqual([2250, 2250]);
    expect(cols.reduce((a, b) => a + b, 0)).toBe(tblW);
  });

  test('no explicit width → still fills available space (no regression)', async () => {
    const tbl = firstTable(await docxXml('<table><tr><td>a</td><td>b</td></tr></table>'));
    // default A4 portrait available = 11906 - 1800 - 1800 = 8306
    expect(gridSum(tbl)).toBe(8306);
  });
});
