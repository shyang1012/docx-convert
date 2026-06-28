// Pure-function tests for the page-setup resolver (hwp-convert 자매 정합).
// No docx build — exercises resolvePaperSize / cssLenToTwip / parseAtPage /
// parsePaddingSides / parseContainerWidthTwip / derivePageSetup.

import derivePageSetup, {
  PAPER_SIZES,
  resolvePaperSize,
  cssLenToTwip,
  parseAtPage,
  parsePaddingSides,
  parseContainerWidthTwip,
  findPageContainerStyle,
} from '../src/utils/page-setup.js';
import { mmToTWIP } from '../src/utils/unit-conversion.js';

// normalized stub mirroring the post-merge defaults DocxDocument would receive.
const norm = (over = {}) => ({
  orientation: 'portrait',
  pageSize: { width: 11906, height: 16838 },
  margins: {
    top: 1440,
    right: 1800,
    bottom: 1440,
    left: 1800,
    header: 720,
    footer: 720,
    gutter: 0,
  },
  ...over,
});

describe('PAPER_SIZES (TWIP, exact)', () => {
  test('core ISO/US sizes', () => {
    expect(PAPER_SIZES.a4).toEqual({ width: 11906, height: 16838 });
    expect(PAPER_SIZES.a3).toEqual({ width: 16838, height: 23811 });
    expect(PAPER_SIZES.a5).toEqual({ width: 8391, height: 11906 });
    expect(PAPER_SIZES.b4).toEqual({ width: 14570, height: 20636 }); // JIS
    expect(PAPER_SIZES.b5).toEqual({ width: 10318, height: 14570 }); // JIS
    expect(PAPER_SIZES.letter).toEqual({ width: 12240, height: 15840 });
    expect(PAPER_SIZES.legal).toEqual({ width: 12240, height: 20160 });
  });
  test('Word extras', () => {
    expect(PAPER_SIZES.tabloid).toEqual({ width: 15840, height: 24480 });
    expect(PAPER_SIZES.statement).toEqual({ width: 7920, height: 12240 });
    expect(PAPER_SIZES.executive).toEqual({ width: 10440, height: 15120 });
    expect(PAPER_SIZES['10x14']).toEqual({ width: 14400, height: 20160 });
  });
});

describe('resolvePaperSize', () => {
  test('paper name (case-insensitive)', () => {
    expect(resolvePaperSize('A4')).toEqual({ width: 11906, height: 16838 });
    expect(resolvePaperSize('letter')).toEqual({ width: 12240, height: 15840 });
  });
  test('custom mm (default unit) and twip', () => {
    expect(resolvePaperSize({ width: 200, height: 280 })).toEqual({
      width: mmToTWIP(200),
      height: mmToTWIP(280),
    });
    expect(resolvePaperSize({ width: 5000, height: 7000, unit: 'twip' })).toEqual({
      width: 5000,
      height: 7000,
    });
  });
  test('undefined → undefined; bad name / non-positive → throw', () => {
    expect(resolvePaperSize(undefined)).toBeUndefined();
    expect(() => resolvePaperSize('A99')).toThrow();
    expect(() => resolvePaperSize({ width: 0, height: 10 })).toThrow();
  });
});

describe('cssLenToTwip', () => {
  test('units + unitless zero', () => {
    expect(cssLenToTwip('20mm')).toBe(mmToTWIP(20));
    expect(cssLenToTwip('2cm')).toBe(mmToTWIP(20));
    expect(cssLenToTwip('1in')).toBe(1440);
    expect(cssLenToTwip('72pt')).toBe(1440);
    expect(cssLenToTwip('96px')).toBe(1440);
    expect(cssLenToTwip('0')).toBe(0);
    expect(cssLenToTwip('auto')).toBeUndefined();
    expect(cssLenToTwip('50%')).toBeUndefined();
  });
});

describe('parseAtPage', () => {
  test('size name + orientation keyword', () => {
    expect(parseAtPage('<style>@page{size:A4 landscape}</style>')).toMatchObject({
      size: 'a4',
      orientation: 'landscape',
    });
  });
  test('custom two-length size (mm)', () => {
    expect(parseAtPage('<style>@page{size:210mm 297mm}</style>').size).toEqual({
      width: 210,
      height: 297,
      unit: 'mm',
    });
  });
  test('margin shorthand 1/2/4 + per-side + comments + cascade', () => {
    expect(parseAtPage('<style>@page{margin:20mm}</style>').margins).toEqual({
      top: mmToTWIP(20),
      right: mmToTWIP(20),
      bottom: mmToTWIP(20),
      left: mmToTWIP(20),
    });
    expect(parseAtPage('<style>@page{margin:10mm 20mm}</style>').margins).toMatchObject({
      top: mmToTWIP(10),
      left: mmToTWIP(20),
    });
    expect(parseAtPage('<style>@page{ /* c */ margin-top:0 }</style>').margins).toEqual({ top: 0 });
    // later @page wins
    expect(parseAtPage('<style>@page{size:A4}@page{size:Letter}</style>').size).toBe('letter');
  });
  test('selector variants (@page :first) ignored', () => {
    expect(parseAtPage('<style>@page :first{margin:5mm}</style>').margins).toBeUndefined();
  });
});

describe('container heuristics', () => {
  test('padding shorthand → sides; max-width preferred over width', () => {
    const style = 'max-width:1000px; width:500px; padding:9px 18px';
    expect(parsePaddingSides(style)).toMatchObject({
      top: 135,
      right: 270,
      bottom: 135,
      left: 270,
    });
    expect(parseContainerWidthTwip(style)).toBe(15000); // 1000px
  });
  test('non-length width ignored', () => {
    expect(parseContainerWidthTwip('width:auto')).toBeUndefined();
    expect(parseContainerWidthTwip('max-width:80%')).toBeUndefined();
  });
  test('first block container under body', () => {
    expect(
      findPageContainerStyle('<html><body><div style="padding:1px">x</div></body></html>')
    ).toBe('padding:1px');
    expect(findPageContainerStyle('<div style="padding:2px">x</div>')).toBe('padding:2px');
    expect(findPageContainerStyle('<p>no container</p>')).toBe('');
  });
});

describe('derivePageSetup — trigger + precedence', () => {
  test('no signal → null (legacy path intact)', () => {
    expect(derivePageSetup('<p>hi</p>', {}, norm())).toBeNull();
    expect(derivePageSetup('<div>bare</div>', {}, norm())).toBeNull();
    // legacy flat alone does NOT trigger
    expect(derivePageSetup('<p>hi</p>', { orientation: 'landscape' }, norm())).toBeNull();
  });

  test('page option size+orientation', () => {
    const r = derivePageSetup(
      '<p>x</p>',
      { page: { size: 'A4', orientation: 'landscape' } },
      norm()
    );
    expect(r).toMatchObject({
      orientation: 'landscape',
      pageSize: { width: 11906, height: 16838 },
    });
  });

  test('container auto-landscape (max-width > A4 usable)', () => {
    const r = derivePageSetup('<div style="max-width:1500px;padding:30px">x</div>', {}, norm());
    expect(r.orientation).toBe('landscape');
    expect(r.pageSize).toBeUndefined(); // no size signal → constants A4 default kept
    expect(r.margins.left).toBe(parsePaddingSides('padding:30px').left);
  });

  test('autoDetectContainer:false ignores container', () => {
    const r = derivePageSetup(
      '<div style="max-width:1500px;padding:30px">x</div>',
      { page: { autoDetectContainer: false } },
      norm()
    );
    expect(r).toEqual({ orientation: 'portrait' }); // container ignored; no margins/size
  });

  test('precedence page > legacy > @page', () => {
    // legacy orientation beats @page orientation
    const r1 = derivePageSetup(
      '<style>@page{size:Letter landscape}</style><p>x</p>',
      { orientation: 'portrait' },
      norm({ orientation: 'portrait' })
    );
    expect(r1.orientation).toBe('portrait');
    expect(r1.pageSize).toEqual({ width: 12240, height: 15840 }); // @page Letter (no legacy size)

    // page option size beats @page
    const r2 = derivePageSetup(
      '<style>@page{size:Letter}</style><p>x</p>',
      { page: { size: 'A4' } },
      norm()
    );
    expect(r2.pageSize).toEqual({ width: 11906, height: 16838 });
  });

  test('@page margin:0 preserved as 0', () => {
    const r = derivePageSetup('<style>@page{margin:0}</style><p>x</p>', {}, norm());
    expect(r.margins).toMatchObject({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});
