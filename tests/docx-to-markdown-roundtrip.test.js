import { describe, test, expect } from 'vitest';
import HTMLtoDOCX, { docxToMarkdown } from '../index.js';

test('rich document round-trips headings, list, table, link', async () => {
  const html =
    '<h1>Doc</h1><ul><li>one</li><li>two</li></ul>' +
    '<p>see <a href="https://x.io">link</a></p>' +
    '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
  const md = await docxToMarkdown(await HTMLtoDOCX(html));
  expect(md).toContain('# Doc');
  expect(md).toMatch(/- one\n- two/);
  expect(md).toContain('[link](https://x.io)');
  expect(md).toContain('| A | B |');
});
