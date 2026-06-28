/**
 * <pre> block border color/width.
 *
 * The code-block paragraph emitted only the default invisible padding border
 * (<w:pBdr> size 0, color FFFFFF). A <pre> with an explicit CSS border should
 * render a visible paragraph border using that color/width so the code block
 * reads as a boxed block, not just a shaded run.
 */

import JSZip from 'jszip';
import HTMLtoDOCX from '../index.js';

async function documentXml(html) {
  const buf = await HTMLtoDOCX(html, null, {});
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml').async('string');
}

function paragraphPrContaining(xml, marker) {
  const i = xml.indexOf(`${marker}</w:t>`);
  const pStart = xml.lastIndexOf('<w:p>', i);
  const pprStart = xml.indexOf('<w:pPr>', pStart);
  const pprEnd = xml.indexOf('</w:pPr>', pStart);
  return xml.slice(pprStart, pprEnd);
}

// rgb(209, 213, 219) → D1D5DB
const GRAY = 'D1D5DB';

describe('<pre> block border', () => {
  test('longhand border-*-color/width render a visible paragraph border', async () => {
    const style = [
      'border-top-width: 1px',
      'border-right-width: 1px',
      'border-bottom-width: 1px',
      'border-left-width: 1px',
      'border-top-style: solid',
      'border-right-style: solid',
      'border-bottom-style: solid',
      'border-left-style: solid',
      'border-top-color: rgb(209, 213, 219)',
      'border-right-color: rgb(209, 213, 219)',
      'border-bottom-color: rgb(209, 213, 219)',
      'border-left-color: rgb(209, 213, 219)',
      'background-color: rgb(250, 250, 250)',
    ].join('; ');
    const xml = await documentXml(`<pre style="${style};">box</pre>`);
    const ppr = paragraphPrContaining(xml, 'box');

    // a top border with the gray color and a non-zero size
    expect(ppr).toMatch(new RegExp(`<w:top\\b[^>]*w:color="${GRAY}"`, 'i'));
    expect(ppr).toMatch(/<w:top\b[^>]*w:sz="(?!0")\d+"/i);
    // all four sides present
    ['top', 'right', 'bottom', 'left'].forEach((side) => {
      expect(ppr).toMatch(new RegExp(`<w:${side}\\b[^>]*w:color="${GRAY}"`, 'i'));
    });
  });

  test('shorthand border renders a visible paragraph border', async () => {
    const xml = await documentXml(
      '<pre style="border: 1px solid rgb(209, 213, 219); background-color: rgb(250, 250, 250);">sh</pre>'
    );
    const ppr = paragraphPrContaining(xml, 'sh');
    expect(ppr).toMatch(new RegExp(`<w:top\\b[^>]*w:color="${GRAY}"`, 'i'));
  });

  test('border renders even without a background-color', async () => {
    const xml = await documentXml(
      '<pre style="border: 1px solid rgb(209, 213, 219);">nobg</pre>'
    );
    const ppr = paragraphPrContaining(xml, 'nobg');
    // visible border present...
    expect(ppr).toMatch(new RegExp(`<w:top\\b[^>]*w:color="${GRAY}"`, 'i'));
    // ...and exactly one <w:pBdr> (no double emission)
    expect((ppr.match(/<w:pBdr\b/g) || []).length).toBe(1);
    // no shading since there is no background
    expect(ppr).not.toMatch(/<w:shd\b/);
  });
});
