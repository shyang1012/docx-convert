import { describe, test, expect } from 'vitest';
import HTMLtoDOCX from '../../index.js';
import { readDocxParts } from '../../src/reader/docx-reader.js';

test('extracts document.xml from a real docx', async () => {
  const buf = await HTMLtoDOCX('<p>hello world</p>');
  const parts = await readDocxParts(buf);
  expect(parts.documentXml).toContain('<w:document');
  expect(parts.documentXml).toContain('hello world');
});
