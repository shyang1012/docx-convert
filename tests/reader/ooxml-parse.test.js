import { describe, test, expect } from 'vitest';
import { parseOoxml } from '../../src/reader/ooxml-parse.js';

test('parses namespaced tags, attributes, and self-closing', () => {
  const root = parseOoxml('<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>hi</w:t></w:r></w:p>');
  const p = root.children.find((n) => n.name === 'w:p');
  expect(p).toBeTruthy();
  const style = p.children[0].children[0]; // w:pPr > w:pStyle
  expect(style.name).toBe('w:pStyle');
  expect(style.attribs['w:val']).toBe('Heading1');
  const t = p.children[1].children[0]; // w:r > w:t
  expect(t.children[0].data).toBe('hi'); // text node
});

test('namespaced r:id attribute survives (used by Task 4 hyperlinks)', () => {
  const link = parseOoxml('<w:hyperlink r:id="rId5"/>').children[0];
  expect(link.attribs['r:id']).toBe('rId5'); // confirm at PoC gate, not later
});
