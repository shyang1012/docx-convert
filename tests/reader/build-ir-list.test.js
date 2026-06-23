import { describe, test, expect } from 'vitest';
import { parseOoxml } from '../../src/reader/ooxml-parse.js';
import { buildIr } from '../../src/reader/build-ir.js';

const makeBody = (...paragraphs) =>
  `<w:document><w:body>${paragraphs.join('')}</w:body></w:document>`;

const listP = (numId, ilvl, text) =>
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;

const plainP = (text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;

test('numbered paragraphs become one ordered list', () => {
  const numbering = { 1: { 0: 'decimal' } };
  const body =
    '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>a</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>b</w:t></w:r></w:p>';
  const blocks = buildIr(
    parseOoxml(`<w:document><w:body>${body}</w:body></w:document>`),
    { numbering },
  );
  expect(blocks).toEqual([
    {
      type: 'list',
      ordered: true,
      items: [{ children: [{ text: 'a' }] }, { children: [{ text: 'b' }] }],
    },
  ]);
});

test('bullet paragraphs become one unordered list', () => {
  const numbering = { 2: { 0: 'bullet' } };
  const xml = makeBody(listP(2, 0, 'x'), listP(2, 0, 'y'));
  const blocks = buildIr(parseOoxml(xml), { numbering });
  expect(blocks).toEqual([
    {
      type: 'list',
      ordered: false,
      items: [{ children: [{ text: 'x' }] }, { children: [{ text: 'y' }] }],
    },
  ]);
});

test('list surrounded by paragraphs does not merge', () => {
  const numbering = { 1: { 0: 'decimal' } };
  const xml = makeBody(plainP('before'), listP(1, 0, 'item'), plainP('after'));
  const blocks = buildIr(parseOoxml(xml), { numbering });
  expect(blocks).toEqual([
    { type: 'paragraph', children: [{ text: 'before' }] },
    {
      type: 'list',
      ordered: true,
      items: [{ children: [{ text: 'item' }] }],
    },
    { type: 'paragraph', children: [{ text: 'after' }] },
  ]);
});

test('nested list: ilvl 1 becomes sublist on previous ilvl-0 item', () => {
  const numbering = { 1: { 0: 'decimal', 1: 'decimal' } };
  // ilvl 0: "A", ilvl 1: "A1", ilvl 0: "B"
  const xml = makeBody(listP(1, 0, 'A'), listP(1, 1, 'A1'), listP(1, 0, 'B'));
  const blocks = buildIr(parseOoxml(xml), { numbering });
  expect(blocks).toEqual([
    {
      type: 'list',
      ordered: true,
      items: [
        {
          children: [{ text: 'A' }],
          sublist: {
            type: 'list',
            ordered: true,
            items: [{ children: [{ text: 'A1' }] }],
          },
        },
        { children: [{ text: 'B' }] },
      ],
    },
  ]);
});

test('mixed ordered then unordered starts separate lists', () => {
  const numbering = { 1: { 0: 'decimal' }, 2: { 0: 'bullet' } };
  const xml = makeBody(listP(1, 0, 'num'), listP(2, 0, 'bul'));
  const blocks = buildIr(parseOoxml(xml), { numbering });
  expect(blocks).toHaveLength(2);
  expect(blocks[0].ordered).toBe(true);
  expect(blocks[1].ordered).toBe(false);
});
