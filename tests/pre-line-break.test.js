/**
 * <pre> line-break preservation.
 *
 * Bug: multi-line code blocks (`<pre>` / `<pre><code>`) collapsed onto a single
 * line in the .docx because literal newline characters inside <pre> text nodes
 * were emitted as plain <w:t> text. OOXML does not treat a literal "\n" as a
 * line break — a run-level <w:br/> is required. Newlines inside a preformatted
 * block must therefore be converted to <w:br/>.
 */

import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import HTMLtoDOCX from '../index.js';

async function documentXml(html, options) {
  const buf = await HTMLtoDOCX(html, null, options);
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml').async('string');
}

const countBr = (xml) => (xml.match(/<w:br\b/g) || []).length;

describe('<pre> line break preservation', () => {
  test('plain multi-line <pre> emits a <w:br/> per newline', async () => {
    const xml = await documentXml('<pre>line1\nline2\nline3</pre>');
    expect(countBr(xml)).toBe(2); // 3 lines → 2 breaks
    expect(xml).toContain('line1');
    expect(xml).toContain('line2');
    expect(xml).toContain('line3');
  });

  test('<pre><code> with nested spans converts each newline to a break', async () => {
    const html =
      '<pre><code><span>const a</span>\n<span>const b</span>\n<span>const c</span></code></pre>';
    const xml = await documentXml(html);
    expect(countBr(xml)).toBe(2);
  });

  test('blank line inside <pre> is preserved as two breaks', async () => {
    const xml = await documentXml('<pre>a\n\nb</pre>');
    expect(countBr(xml)).toBe(2); // a, (blank), b → two newlines
  });

  test('normal paragraph newlines are NOT turned into breaks (pre-only)', async () => {
    const xml = await documentXml('<p>one\ntwo</p>');
    expect(countBr(xml)).toBe(0);
  });

  test('real CodeWiz code-block fixture preserves its code lines', async () => {
    const html = readFileSync(
      new URL('../etc/test source/code-block-inline.html', import.meta.url),
      'utf8'
    );
    const xml = await documentXml(html);
    // The <pre><code> block has 5 newlines (4 code lines + 1 blank separator line).
    expect(countBr(xml)).toBe(5);
  });
});
