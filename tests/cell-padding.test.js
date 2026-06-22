// CSS padding → cell-level w:tcMar (T6, docx-convert-xku.6).
// w:tcMar (cell) overrides the table default w:tblCellMar (160) per cell, so cells
// without padding keep 160 (no regression) and only padded cells emit tcMar.

import HTMLtoDOCX from '../index.js';
import { parseDOCX } from './helpers/docx-assertions.js';

const docxXml = async (html) => (await parseDOCX(await HTMLtoDOCX(html))).xml;

// 9px → 135 TWIP, 18px → 270, 4.5px → 68 (pixelToTWIP)
describe('CSS padding → w:tcMar (T6)', () => {
  test('padding shorthand (single value) → all four sides in TWIP', async () => {
    const xml = await docxXml('<table><tr><td style="padding: 9px">x</td></tr></table>');
    const tcMar = xml.match(/<w:tcMar>[\s\S]*?<\/w:tcMar>/);
    expect(tcMar).not.toBeNull();
    ['top', 'bottom', 'start', 'left', 'end', 'right'].forEach(() => {});
    expect((tcMar[0].match(/w:w="135"/g) || []).length).toBe(4); // 4 sides @ 135
  });

  test('padding shorthand (two values) → vertical / horizontal split', async () => {
    const xml = await docxXml('<table><tr><td style="padding: 9px 18px">x</td></tr></table>');
    const tcMar = xml.match(/<w:tcMar>[\s\S]*?<\/w:tcMar>/)[0];
    // top/bottom = 135, left/right = 270
    expect((tcMar.match(/w:w="135"/g) || []).length).toBe(2);
    expect((tcMar.match(/w:w="270"/g) || []).length).toBe(2);
  });

  test('individual padding-left overrides shorthand', async () => {
    const xml = await docxXml('<table><tr><td style="padding: 9px; padding-left: 18px">x</td></tr></table>');
    const tcMar = xml.match(/<w:tcMar>[\s\S]*?<\/w:tcMar>/)[0];
    expect(tcMar).toMatch(/<w:left[^>]*w:w="270"/);
  });

  test('cell without padding → no w:tcMar, table default w:tblCellMar(160) kept (no regression)', async () => {
    const xml = await docxXml('<table><tr><td>x</td></tr></table>');
    expect(xml).not.toContain('<w:tcMar>');
    expect(xml).toContain('<w:tblCellMar>');
    expect(xml).toMatch(/<w:tblCellMar>[\s\S]*?w:w="160"/);
  });

  test('percentage / unsupported padding → no w:tcMar (absolute-unit guard)', async () => {
    const xml = await docxXml('<table><tr><td style="padding: 50%">x</td></tr></table>');
    expect(xml).not.toContain('<w:tcMar>');
  });

  test('F-01: tcMar sits after w:shd and before w:vAlign (CT_TcPr order)', async () => {
    const xml = await docxXml(
      '<table><tr><td style="background-color: #1a5276; vertical-align: middle; padding: 9px">x</td></tr></table>'
    );
    const tcPr = xml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/)[0];
    const posShd = tcPr.indexOf('<w:shd');
    const posMar = tcPr.indexOf('<w:tcMar>');
    const posVAlign = tcPr.indexOf('<w:vAlign');
    expect(posShd).toBeGreaterThanOrEqual(0);
    expect(posMar).toBeGreaterThan(posShd);
    expect(posVAlign).toBeGreaterThan(posMar);
  });

  test('F-02: padding on outer cell does NOT leak into nested-table inner cells', async () => {
    const html =
      '<table><tr><td style="padding: 9px"><table><tr><td>inner</td></tr></table></td></tr></table>';
    const xml = await docxXml(html);
    // exactly one tcMar (the outer padded cell); inner cell has none
    expect((xml.match(/<w:tcMar>/g) || []).length).toBe(1);
  });
});
