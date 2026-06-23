/**
 * <pre> block background rendering.
 *
 * Bug: a <pre> with `background-color` rendered the shading only at the run
 * level (<w:rPr><w:shd>), i.e. behind each glyph — so it looked like text
 * highlighting, not a code-block box. Paragraph-level shading
 * (<w:pPr><w:shd>) is gated on `display === 'block'` in
 * buildParagraphProperties, and <pre> carried no explicit `display`. Since a
 * <pre> is block by default, it must get block-level shading.
 */

import JSZip from 'jszip';
import HTMLtoDOCX from '../index.js';

async function documentXml(html) {
  const buf = await HTMLtoDOCX(html, null, {});
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml').async('string');
}

// Extract the <w:pPr> of the paragraph whose run text contains `marker`.
function paragraphPrContaining(xml, marker) {
  const i = xml.indexOf(`${marker}</w:t>`);
  const pStart = xml.lastIndexOf('<w:p>', i);
  const pprStart = xml.indexOf('<w:pPr>', pStart);
  const pprEnd = xml.indexOf('</w:pPr>', pStart);
  return xml.slice(pprStart, pprEnd);
}

describe('<pre> block background', () => {
  test('<pre> background-color is emitted as paragraph-level shading', async () => {
    const xml = await documentXml(
      '<pre style="background-color: rgb(250, 250, 250);">code</pre>'
    );
    const ppr = paragraphPrContaining(xml, 'code');
    expect(ppr).toMatch(/<w:shd\b[^>]*w:fill="fafafa"/i);
  });

  test('<pre> with no background has no spurious paragraph shading', async () => {
    const xml = await documentXml('<pre>plain</pre>');
    const ppr = paragraphPrContaining(xml, 'plain');
    expect(ppr).not.toMatch(/<w:shd\b/);
  });
});
