// 행간(line spacing)·자간(letter spacing) 제어:
//  - inline CSS letter-spacing → run rPr <w:spacing w:val>
//  - global documentOptions.letterSpacing → styles.xml rPrDefault <w:spacing w:val>
//  - global documentOptions.lineHeight → styles.xml pPrDefault <w:spacing w:line>
//  - default line spacing restored to Word 365 Normal (1.08, after 8pt)

import JSZip from 'jszip';
import HTMLtoDOCX from '../index.js';
import { parseDOCX } from './helpers/docx-assertions.js';
import { fixupLetterSpacing } from '../src/helpers/xml-builder.js';

const documentXml = async (html, opts) => (await parseDOCX(await HTMLtoDOCX(html, null, opts))).xml;
const stylesXml = async (opts) => {
  const buf = await HTMLtoDOCX('<p>x</p>', null, opts);
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/styles.xml').async('string');
};

describe('fixupLetterSpacing (CSS length → TWIP, negatives allowed)', () => {
  test('units', () => {
    expect(fixupLetterSpacing('2px')).toBe(30); // 2px = 30 twip
    expect(fixupLetterSpacing('0.5pt')).toBe(10); // 0.5pt = 10 twip
    expect(fixupLetterSpacing('1pt')).toBe(20);
    expect(fixupLetterSpacing('-1px')).toBe(-15); // tighter
    expect(fixupLetterSpacing('0.1em', 22)).toBe(22); // 0.1 × 11pt
    expect(fixupLetterSpacing('normal')).toBe(0);
    expect(fixupLetterSpacing('0')).toBe(0);
    expect(fixupLetterSpacing(10)).toBe(10); // unitless number → twip
    expect(fixupLetterSpacing(undefined)).toBe(0);
  });
});

describe('inline letter-spacing → run rPr <w:spacing w:val>', () => {
  test('span letter-spacing emits character spacing', async () => {
    const xml = await documentXml('<p><span style="letter-spacing:2px">x</span></p>');
    expect(xml).toMatch(/<w:rPr>[\s\S]*?<w:spacing w:val="30"[\s\S]*?<\/w:rPr>/);
  });

  test('negative letter-spacing → negative val', async () => {
    const xml = await documentXml('<p><span style="letter-spacing:-1px">x</span></p>');
    expect(xml).toContain('<w:spacing w:val="-15"');
  });

  test('rPr order: spacing after color, before sz', async () => {
    const xml = await documentXml(
      '<p><span style="color:#ff0000; letter-spacing:1px; font-size:20px">x</span></p>'
    );
    const rPr = xml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)[0];
    const posColor = rPr.indexOf('<w:color');
    const posSpacing = rPr.indexOf('<w:spacing');
    const posSz = rPr.indexOf('<w:sz ');
    expect(posColor).toBeGreaterThanOrEqual(0);
    expect(posSpacing).toBeGreaterThan(posColor);
    expect(posSz).toBeGreaterThan(posSpacing);
  });
});

describe('global documentOptions', () => {
  test('letterSpacing → rPrDefault <w:spacing>, before <w:sz>', async () => {
    const xml = await stylesXml({ letterSpacing: '0.5pt' });
    expect(xml).toContain('<w:spacing w:val="10"');
    const rPrDefault = xml.match(/<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/)[0];
    expect(rPrDefault.indexOf('<w:spacing')).toBeLessThan(rPrDefault.indexOf('<w:sz '));
  });

  test('lineHeight multiplier → pPrDefault w:line (auto)', async () => {
    const xml = await stylesXml({ lineHeight: 1.5 });
    expect(xml).toMatch(/<w:spacing[^>]*w:line="360"[^>]*w:lineRule="auto"/);
  });

  test('lineHeight absolute unit → atLeast', async () => {
    const xml = await stylesXml({ lineHeight: '24pt' });
    expect(xml).toMatch(/<w:spacing[^>]*w:line="480"[^>]*w:lineRule="atLeast"/);
  });
});

describe('default line spacing = Word 365 Normal (1.08)', () => {
  test('no option → pPrDefault after=160 line=259 auto; no rPrDefault char-spacing', async () => {
    const xml = await stylesXml();
    const pPrDefault = xml.match(/<w:pPrDefault>[\s\S]*?<\/w:pPrDefault>/)[0];
    expect(pPrDefault).toMatch(/w:after="160"/);
    expect(pPrDefault).toMatch(/w:line="259"/);
    expect(pPrDefault).toMatch(/w:lineRule="auto"/);
    const rPrDefault = xml.match(/<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/)[0];
    expect(rPrDefault).not.toContain('<w:spacing');
  });
});
