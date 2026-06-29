// A container <div> must cascade its inheritable text styles (line-height,
// color, font-size, text-align, font-*) onto the paragraphs built from its
// children — mirroring CSS inheritance and the root-level property merge in
// renderDocumentFile. CodeWiz wraps section bodies in styled <div>s (e.g.
// `text-sm leading-relaxed`), so without this their line-height/etc. is lost.

import HTMLtoDOCX from '../index.js';
import { parseDOCX } from './helpers/docx-assertions.js';

const xmlOf = async (html) => (await parseDOCX(await HTMLtoDOCX(html))).xml;
const firstP = (xml) => xml.match(/<w:p\b[\s\S]*?<\/w:p>/)[0];

describe('container div → child paragraph style inheritance', () => {
  test('line-height / color / text-align cascade into a wrapped paragraph', async () => {
    const xml = await xmlOf(
      '<div style="line-height:1.625; color:rgb(255,0,0); text-align:center"><p>본문</p></div>'
    );
    const p = firstP(xml);
    expect(p).toMatch(/<w:spacing[^>]*w:line="390"/); // 1.625 × 240
    expect(p).toMatch(/<w:jc w:val="center"/);
    expect(p).toMatch(/<w:color w:val="ff0000"/i);
  });

  test('child explicit style wins over inherited', async () => {
    const xml = await xmlOf(
      '<div style="line-height:1.625"><p style="line-height:1.0">x</p></div>'
    );
    expect(firstP(xml)).toMatch(/<w:spacing[^>]*w:line="240"/); // child 1.0, not 390
  });

  test('nested div cascades color down', async () => {
    const xml = await xmlOf('<div style="color:rgb(0,128,0)"><div><p>중첩</p></div></div>');
    expect(xml).toMatch(/<w:color w:val="008000"/);
  });

  test('box-only styles (padding/background/width) do NOT cascade as text styles', async () => {
    // padding/background on a wrapper must not turn child paragraphs into shaded/padded runs
    const xml = await xmlOf(
      '<div style="padding:20px; background-color:rgb(255,0,0)"><p>x</p></div>'
    );
    const p = firstP(xml);
    expect(p).not.toMatch(/<w:shd[^>]*w:fill="FF0000"/);
  });
});
