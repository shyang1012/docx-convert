// Robustness corpus — data-driven sweep over real-world HTML fixtures.
//
// Every `*.html` under `etc/test source/` is auto-discovered and run end-to-end
// through HTMLtoDOCX. Drop a new real document into that folder and it is
// covered automatically — no edit here needed. The generic sweep asserts the
// output is structurally valid OOXML (parseable, has a section with pgSz/pgMar,
// non-empty body) and converts within a generous robustness budget (catches
// pathological hangs, NOT a perf benchmark). A second block pins the page-setup
// container-heuristic result for fixtures whose expected geometry we know.

import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import HTMLtoDOCX from '../index.js';
import { parseDOCX } from './helpers/docx-assertions.js';

const FIXTURE_DIR = new URL('../etc/test source/', import.meta.url);
const FIXTURES = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.html'))
  .sort();

const readFixture = (name) => readFileSync(fileURLToPath(new URL(name, FIXTURE_DIR)), 'utf8');
const ROBUSTNESS_BUDGET_MS = 5000; // generous upper bound, not a benchmark

describe('robustness corpus — real-world HTML fixtures', () => {
  test('the corpus is non-empty (fixtures are tracked)', () => {
    expect(FIXTURES.length).toBeGreaterThan(0);
  });

  test.each(FIXTURES)('%s converts to structurally-valid OOXML', async (name) => {
    const html = readFixture(name);

    const started = Date.now();
    const buffer = await HTMLtoDOCX(html);
    const elapsed = Date.now() - started;

    // produced a non-empty document
    expect(buffer).toBeTruthy();
    expect(buffer.length).toBeGreaterThan(0);

    // parseable + has a section with page geometry + a non-empty body
    const parsed = await parseDOCX(buffer);
    expect(parsed.xml).toMatch(/<w:sectPr>/);
    expect(parsed.xml).toMatch(/<w:pgSz[^>]*w:w="\d+"[^>]*w:h="\d+"/);
    expect(parsed.xml).toMatch(/<w:pgMar[^>]*w:top="\d+"/);
    expect(parsed.paragraphs.length).toBeGreaterThan(0);

    // no pathological hang
    expect(elapsed).toBeLessThan(ROBUSTNESS_BUDGET_MS);
  });
});

// Known fixtures: lock the container-heuristic outcome (wide root container with
// max-width > A4 portrait usable + padding → auto-landscape with padding margins).
describe('robustness corpus — known page-setup outcomes', () => {
  test('06.preview.html (arbitrary 240KB doc) → A4 landscape + padding margins', async () => {
    const xml = (await parseDOCX(await HTMLtoDOCX(readFixture('06.preview.html')))).xml;
    expect(xml).toMatch(/<w:pgSz[^>]*w:w="16838"[^>]*w:h="11906"[^>]*w:orient="landscape"/);
    expect(xml).toMatch(/<w:pgMar[^>]*w:top="480"/); // padding 32px
    expect(xml).toMatch(/w:left="600"/); // padding 40px
  });

  test('team-roster-inline.html (CodeWiz output) → A4 landscape + flex tables', async () => {
    const xml = (await parseDOCX(await HTMLtoDOCX(readFixture('team-roster-inline.html')))).xml;
    expect(xml).toMatch(/<w:pgSz[^>]*w:orient="landscape"/);
    expect(xml).toMatch(/<w:pgMar[^>]*w:top="540"/); // padding-top 36px
    expect(xml).toMatch(/<w:tbl>/); // flex-direction:row → layout tables
  });
});
