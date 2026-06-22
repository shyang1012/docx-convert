import { describe, test, expect } from 'vitest';
import { parseOoxml } from '../../src/reader/ooxml-parse';
import { buildIr } from '../../src/reader/build-ir';

const ir = (bodyXml, ctx = {}) =>
  buildIr(parseOoxml(`<w:document><w:body>${bodyXml}</w:body></w:document>`), ctx);

test('Heading2 paragraph → heading level 2', () => {
  const blocks = ir('<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Title</w:t></w:r></w:p>');
  expect(blocks[0]).toEqual({ type: 'heading', level: 2, children: [{ text: 'Title' }] });
});

test('hyperlink resolves href via rels ctx', () => {
  const blocks = ir(
    '<w:p><w:hyperlink r:id="rId5"><w:r><w:t>site</w:t></w:r></w:hyperlink></w:p>',
    { rels: { rId5: 'https://example.com' } }
  );
  expect(blocks[0].children[0]).toEqual({ type: 'link', href: 'https://example.com', children: [{ text: 'site' }] });
});
