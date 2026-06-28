// End-to-end page setup: generateContainer → document.xml → w:pgSz / w:pgMar.
// Locks the new A4 default + page-option/@page/container behavior and the
// explicit-zero margin fix (F-01).

import HTMLtoDOCX from '../index.js';
import { parseDOCX } from './helpers/docx-assertions.js';

const docxXml = async (html, opts) => (await parseDOCX(await HTMLtoDOCX(html, null, opts))).xml;
const pgSz = (xml) => xml.match(/<w:pgSz[^>]*\/>/)[0];
const pgMar = (xml) => xml.match(/<w:pgMar[\s\S]*?\/>/)[0];

describe('page setup — baseline & default', () => {
  test('baseline lock: no signal → A4 portrait default', async () => {
    const xml = await docxXml('<p>Hello</p>');
    expect(pgSz(xml)).toContain('w:w="11906"');
    expect(pgSz(xml)).toContain('w:h="16838"');
    expect(pgSz(xml)).toContain('w:orient="portrait"');
  });

  test('legacy flat orientation alone still works (no resolver trigger)', async () => {
    const xml = await docxXml('<p>x</p>', { orientation: 'landscape' });
    // A4 swapped → landscape
    expect(pgSz(xml)).toContain('w:orient="landscape"');
    expect(pgSz(xml)).toContain('w:w="16838"');
    expect(pgSz(xml)).toContain('w:h="11906"');
  });
});

describe('page option', () => {
  test('A4 landscape via page option swaps dims', async () => {
    const xml = await docxXml('<p>x</p>', { page: { size: 'A4', orientation: 'landscape' } });
    expect(pgSz(xml)).toContain('w:w="16838"');
    expect(pgSz(xml)).toContain('w:h="11906"');
    expect(pgSz(xml)).toContain('w:orient="landscape"');
  });

  test('Letter via page option', async () => {
    const xml = await docxXml('<p>x</p>', { page: { size: 'Letter' } });
    expect(pgSz(xml)).toContain('w:w="12240"');
    expect(pgSz(xml)).toContain('w:h="15840"');
  });

  test('mm margins applied', async () => {
    const xml = await docxXml('<p>x</p>', { page: { margins: { top: 20, left: 25 } } });
    expect(pgMar(xml)).toContain('w:top="1134"'); // 20mm
    expect(pgMar(xml)).toContain('w:left="1417"'); // 25mm
  });
});

describe('@page CSS', () => {
  test('@page size + margin:0 → A4 + zero margins', async () => {
    const xml = await docxXml('<style>@page{size:A4;margin:0}</style><p>x</p>');
    expect(pgSz(xml)).toContain('w:w="11906"');
    expect(pgMar(xml)).toContain('w:top="0"');
    expect(pgMar(xml)).toContain('w:left="0"');
  });
});

describe('container heuristic', () => {
  test('wide container → auto landscape', async () => {
    const xml = await docxXml('<div style="max-width:1500px;padding:30px">x</div>');
    expect(pgSz(xml)).toContain('w:orient="landscape"');
  });

  test('autoDetectContainer:false → ignores container, A4 portrait + default margins', async () => {
    const xml = await docxXml('<div style="max-width:1500px;padding:30px">x</div>', {
      page: { autoDetectContainer: false },
    });
    expect(pgSz(xml)).toContain('w:orient="portrait"');
    expect(pgSz(xml)).toContain('w:w="11906"');
    expect(pgMar(xml)).toContain('w:top="1440"'); // default, not 30px-derived
  });
});

describe('F-01 explicit zero margin preserved', () => {
  test('legacy margins:{top:0} → w:top="0"', async () => {
    const xml = await docxXml('<p>x</p>', { margins: { top: 0 } });
    expect(pgMar(xml)).toContain('w:top="0"');
  });
});
