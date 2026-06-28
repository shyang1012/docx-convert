// Robustness regression: convert real-world HTML fixtures (not hand-written
// snippets) end-to-end and assert the page-setup container heuristic fires
// sensibly on them. 06.preview.html is an arbitrary non-CodeWiz document;
// team-roster-inline.html is CodeWiz output. Both use a wide root container
// (max-width > A4 portrait usable) and padding, so both must auto-rotate to
// landscape with padding-derived margins.

import { readFileSync } from 'fs';
import HTMLtoDOCX from '../index.js';
import { parseDOCX } from './helpers/docx-assertions.js';

const fixture = (name) =>
  readFileSync(new URL(`../etc/test source/${name}`, import.meta.url), 'utf8');
const sectPr = async (html) => {
  const xml = (await parseDOCX(await HTMLtoDOCX(html))).xml;
  return {
    pgSz: xml.match(/<w:pgSz[^>]*\/>/)[0],
    pgMar: xml.match(/<w:pgMar[\s\S]*?\/>/)[0],
    tables: (xml.match(/<w:tbl>/g) || []).length,
  };
};

describe('robustness — real-world HTML fixtures', () => {
  test('06.preview.html (arbitrary 240KB doc): converts → A4 landscape + padding margins', async () => {
    const html = fixture('06.preview.html');
    const { pgSz, pgMar, tables } = await sectPr(html);
    expect(pgSz).toContain('w:orient="landscape"');
    expect(pgSz).toContain('w:w="16838"'); // A4 long edge horizontal
    expect(pgSz).toContain('w:h="11906"');
    expect(pgMar).toContain('w:top="480"'); // padding 32px
    expect(pgMar).toContain('w:left="600"'); // padding 40px
    expect(tables).toBeGreaterThan(0);
  });

  test('team-roster-inline.html (CodeWiz output): converts → A4 landscape + flex tables', async () => {
    const html = fixture('team-roster-inline.html');
    const { pgSz, pgMar, tables } = await sectPr(html);
    expect(pgSz).toContain('w:orient="landscape"');
    expect(pgSz).toContain('w:w="16838"');
    expect(pgMar).toContain('w:top="540"'); // padding-top 36px
    expect(tables).toBeGreaterThan(0); // flex-direction:row → layout tables
  });
});
