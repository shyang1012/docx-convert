/**
 * Page setup resolver — hwp-convert 자매 정합. [shyang 2026-06-28]
 *
 * Mirrors hwp-convert's htmlReader page logic but targets TWIP (1/1440 in).
 * Resolves the final { orientation, pageSize?, margins? } for a document from,
 * in descending precedence per field:
 *
 *   page option (nested) > legacy flat option > @page CSS > container CSS > default
 *
 * Returns `null` when there is NO page signal at all (no `page` option, no
 * `@page`, no container padding/width) so the legacy default path stays
 * byte-identical. Legacy flat options alone never trigger resolution.
 *
 * Self-contained + browser-safe: imports only htmlparser2 (already a dep, used
 * in the browser build) and the unit helpers.
 */
import * as htmlparser2 from 'htmlparser2';
import { a4Width, a4Height, portraitMargins } from '../constants';
import { mmToTWIP, inchToTWIP, pixelToTWIP, pointToTWIP } from './unit-conversion';

// --- Paper size table (TWIP, physical-portrait short×long) ---------------------
// Computed from native units (ISO in mm, US in inches) so the arithmetic is
// single-sourced and exact — never transcribe magic numbers.
const mm = (w, h) => ({ width: mmToTWIP(w), height: mmToTWIP(h) });
const inch = (w, h) => ({ width: inchToTWIP(w), height: inchToTWIP(h) });

const PAPER_SIZES = {
  // ISO core (hwpx parity)
  a4: mm(210, 297), // 11906 × 16838
  a3: mm(297, 420), // 16838 × 23811
  a5: mm(148, 210), // 8391 × 11906
  b4: mm(257, 364), // JIS — 14570 × 20636
  b5: mm(182, 257), // JIS — 10318 × 14570
  // US core
  letter: inch(8.5, 11), // 12240 × 15840
  legal: inch(8.5, 14), // 12240 × 20160
  // Word-native extras
  'a4 small': mm(210, 297),
  'letter small': inch(8.5, 11),
  note: inch(8.5, 11),
  tabloid: inch(11, 17), // 15840 × 24480
  '11x17': inch(11, 17),
  statement: inch(5.5, 8.5), // 7920 × 12240
  executive: inch(7.25, 10.5), // 10440 × 15120
  folio: inch(8.5, 13), // 12240 × 18720
  quarto: mm(215, 275), // 12189 × 15591
  '10x14': inch(10, 14), // 14400 × 20160
};

const PAGE_CONTAINER_TAGS = new Set(['div', 'section', 'article', 'main', 'body']);
const MARGIN_SIDES = ['top', 'right', 'bottom', 'left', 'header', 'footer', 'gutter'];

// --- CSS length parsing --------------------------------------------------------
const LEN_RE = /^([\d.]+)(mm|cm|in|pt|px)$/i;
const ZERO_RE = /^0+(?:\.0+)?$/;

// CSS length → TWIP. Unitless 0 → 0. Unrecognized → undefined (ignored).
export const cssLenToTwip = (token) => {
  if (token === undefined || token === null) return undefined;
  const t = `${token}`.trim();
  if (ZERO_RE.test(t)) return 0;
  const m = LEN_RE.exec(t);
  if (!m) return undefined;
  const v = parseFloat(m[1]);
  switch (m[2].toLowerCase()) {
    case 'mm':
      return mmToTWIP(v);
    case 'cm':
      return mmToTWIP(v * 10);
    case 'in':
      return inchToTWIP(v);
    case 'pt':
      return pointToTWIP(v);
    case 'px':
      return pixelToTWIP(v);
    default:
      return undefined;
  }
};

// CSS length → mm (for custom @page size, kept in mm to match the option shape).
const cssLenToMm = (token) => {
  if (token === undefined || token === null) return undefined;
  const t = `${token}`.trim();
  if (ZERO_RE.test(t)) return 0;
  const m = LEN_RE.exec(t);
  if (!m) return undefined;
  const v = parseFloat(m[1]);
  switch (m[2].toLowerCase()) {
    case 'mm':
      return v;
    case 'cm':
      return v * 10;
    case 'in':
      return v * 25.4;
    case 'pt':
      return (v * 25.4) / 72;
    case 'px':
      return (v * 25.4) / 96;
    default:
      return undefined;
  }
};

// --- Paper size resolution -----------------------------------------------------
// name | { width, height, unit:'mm'(default)|'twip' } | undefined→undefined.
// Throws on explicit API misuse (unknown name / non-positive dims); callers that
// feed auto-detected CSS must guard with try/catch and never let it throw.
export const resolvePaperSize = (size) => {
  if (size === undefined || size === null) return undefined;
  if (typeof size === 'string') {
    const found = PAPER_SIZES[size.trim().toLowerCase()];
    if (!found) {
      throw new Error(
        `Unsupported paper size: "${size}". Use a paper name (A4/A3/A5/B4/B5/Letter/Legal/...) or { width, height, unit }.`
      );
    }
    return { ...found };
  }
  if (typeof size === 'object' && size.width != null && size.height != null) {
    const unit = size.unit || 'mm';
    const conv = unit === 'twip' ? (v) => Math.round(Number(v)) : (v) => mmToTWIP(v);
    const width = conv(size.width);
    const height = conv(size.height);
    if (!(width > 0) || !(height > 0)) {
      throw new Error('Paper custom dimensions must be positive numbers.');
    }
    return { width, height };
  }
  throw new Error('Invalid page.size — expected a paper name or { width, height, unit }.');
};

// --- style declaration helpers -------------------------------------------------
const parseStyleDecls = (style) => {
  const out = {};
  if (!style) return out;
  `${style}`.split(';').forEach((decl) => {
    const idx = decl.indexOf(':');
    if (idx === -1) return;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (prop) out[prop] = value;
  });
  return out;
};

// padding shorthand (1-4 values) + padding-{side} → { side: twip } (resolved sides only).
const sidesFromShorthand = (value) => {
  const tokens = `${value}`.trim().split(/\s+/);
  const v = tokens.map(cssLenToTwip);
  let top;
  let right;
  let bottom;
  let left;
  if (v.length === 1) {
    [top] = v;
    right = top;
    bottom = top;
    left = top;
  } else if (v.length === 2) {
    [top, right] = v;
    bottom = top;
    left = right;
  } else if (v.length === 3) {
    [top, right, bottom] = v;
    left = right;
  } else {
    [top, right, bottom, left] = v;
  }
  return { top, right, bottom, left };
};

export const parsePaddingSides = (style) => {
  const decls = parseStyleDecls(style);
  const out = {};
  if (decls.padding !== undefined) {
    const s = sidesFromShorthand(decls.padding);
    ['top', 'right', 'bottom', 'left'].forEach((side) => {
      if (s[side] !== undefined) out[side] = s[side];
    });
  }
  ['top', 'right', 'bottom', 'left'].forEach((side) => {
    const t = cssLenToTwip(decls[`padding-${side}`]);
    if (t !== undefined) out[side] = t;
  });
  return out;
};

// max-width (preferred) or width → TWIP body width. Non-length (auto/%/calc) → undefined.
export const parseContainerWidthTwip = (style) => {
  const decls = parseStyleDecls(style);
  const maxW = cssLenToTwip(decls['max-width']);
  if (maxW !== undefined) return maxW;
  return cssLenToTwip(decls.width);
};

// --- @page CSS parsing ---------------------------------------------------------
const STYLE_BLOCK_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const AT_PAGE_RE = /@page\s*\{([^{}]*)\}/gi;

// Returns { size?, orientation?, margins?(twip) }. Later @page blocks cascade.
export const parseAtPage = (html) => {
  const out = {};
  if (!html) return out;
  let css = '';
  let sm;
  STYLE_BLOCK_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((sm = STYLE_BLOCK_RE.exec(html)) !== null) {
    css += `\n${sm[1]}`;
  }
  if (!css) return out;
  css = css.replace(COMMENT_RE, '');

  let bm;
  AT_PAGE_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((bm = AT_PAGE_RE.exec(css)) !== null) {
    const decls = parseStyleDecls(bm[1]);

    if (decls.size !== undefined) {
      const tokens = decls.size.trim().split(/\s+/);
      const lengths = [];
      tokens.forEach((tok) => {
        const low = tok.toLowerCase();
        if (low === 'portrait' || low === 'landscape') {
          out.orientation = low;
        } else if (low === 'auto') {
          // ignore
        } else if (PAPER_SIZES[low]) {
          out.size = low;
        } else {
          const lenMm = cssLenToMm(tok);
          if (lenMm !== undefined) lengths.push(lenMm);
        }
      });
      if (lengths.length >= 2) {
        out.size = { width: lengths[0], height: lengths[1], unit: 'mm' };
      }
    }

    if (decls.margin !== undefined) {
      const s = sidesFromShorthand(decls.margin);
      out.margins = out.margins || {};
      ['top', 'right', 'bottom', 'left'].forEach((side) => {
        if (s[side] !== undefined) out.margins[side] = s[side];
      });
    }
    ['top', 'right', 'bottom', 'left'].forEach((side) => {
      const t = cssLenToTwip(decls[`margin-${side}`]);
      if (t !== undefined) {
        out.margins = out.margins || {};
        out.margins[side] = t;
      }
    });
  }
  return out;
};

// --- container lookup ----------------------------------------------------------
const findFirst = (nodes, pred) => {
  if (!nodes) return null;
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    if (pred(n)) return n;
    if (n.children) {
      const f = findFirst(n.children, pred);
      if (f) return f;
    }
  }
  return null;
};

// Inline style of the root page container (first div/section/article/main under
// body, else body itself). '' when none.
export const findPageContainerStyle = (html) => {
  if (!html) return '';
  const handler = new htmlparser2.DomHandler();
  const parser = new htmlparser2.Parser(handler, {
    lowerCaseTags: true,
    lowerCaseAttributeNames: true,
    decodeEntities: false,
  });
  parser.parseComplete(html);
  const { dom } = handler;
  const bodyEl = findFirst(dom, (n) => n.type === 'tag' && n.name === 'body');
  const roots = bodyEl ? bodyEl.children : dom;
  let container = findFirst(roots, (n) => n.type === 'tag' && PAGE_CONTAINER_TAGS.has(n.name));
  if (!container && bodyEl) container = bodyEl;
  return container && container.attribs ? container.attribs.style || '' : '';
};

// --- top-level resolver --------------------------------------------------------
/**
 * @param {string} html - raw HTML (parse BEFORE minify).
 * @param {Object} rawDocumentOptions - user options (presence-sensitive).
 * @param {Object} normalizedOptions - post-merge options (TWIP values).
 * @returns {{orientation:string, pageSize?:{width,height}, margins?:Object}|null}
 */
const derivePageSetup = (html, rawDocumentOptions, normalizedOptions) => {
  const raw = rawDocumentOptions || {};
  const normalized = normalizedOptions || {};
  const pageOpt = raw.page || null;
  const autoContainer = !pageOpt || pageOpt.autoDetectContainer !== false; // default ON

  const atPage = parseAtPage(html);
  const containerStyle = autoContainer ? findPageContainerStyle(html) : '';
  const padding = autoContainer ? parsePaddingSides(containerStyle) : {};
  const bodyWidth = autoContainer ? parseContainerWidthTwip(containerStyle) : undefined;

  const hasAtPageMargins = atPage.margins && Object.keys(atPage.margins).length > 0;
  const hasPadding = Object.keys(padding).length > 0;
  const triggered =
    !!pageOpt ||
    atPage.size !== undefined ||
    atPage.orientation !== undefined ||
    hasAtPageMargins ||
    hasPadding ||
    bodyWidth !== undefined;
  if (!triggered) return null;

  // Legacy flat options participate as the layer below the new `page` option,
  // detected by presence on the RAW object (post-merge defaults are
  // indistinguishable). Values come from the already-normalized TWIP options.
  const hasLegacyOri = 'orientation' in raw;
  const hasLegacySize = 'pageSize' in raw;
  const hasLegacyMar = 'margins' in raw;
  const legacyOri = hasLegacyOri ? normalized.orientation : undefined;
  const legacySize = hasLegacySize ? normalized.pageSize : undefined;
  const legacyMar = hasLegacyMar && normalized.margins ? normalized.margins : {};

  // pageSize (physical-portrait TWIP). undefined → constants A4 default kept.
  let pageSize;
  if (pageOpt && pageOpt.size !== undefined) {
    pageSize = resolvePaperSize(pageOpt.size); // explicit → may throw (fail-fast)
  } else if (legacySize) {
    pageSize = legacySize;
  } else if (atPage.size !== undefined) {
    try {
      pageSize = resolvePaperSize(atPage.size);
    } catch (e) {
      pageSize = undefined; // never throw on auto-detected CSS
    }
  }
  const refPaper = pageSize || { width: a4Width, height: a4Height };

  // margins (per-side TWIP, partial). page(mm) > legacy > @page > padding.
  const optMm = (v) => (v == null ? undefined : mmToTWIP(v));
  const margins = {};
  MARGIN_SIDES.forEach((side) => {
    let v;
    if (pageOpt && pageOpt.margins && pageOpt.margins[side] != null) {
      v = optMm(pageOpt.margins[side]);
    } else if (hasLegacyMar && legacyMar[side] !== undefined) {
      v = legacyMar[side];
    } else if (atPage.margins && atPage.margins[side] != null) {
      v = atPage.margins[side];
    } else if (padding[side] != null) {
      v = padding[side];
    }
    if (v !== undefined) margins[side] = v;
  });

  // orientation. page > legacy > @page > auto(container width vs usable).
  const computeAuto = () => {
    const left = margins.left != null ? margins.left : portraitMargins.left;
    const right = margins.right != null ? margins.right : portraitMargins.right;
    const usable = refPaper.width - left - right;
    return bodyWidth !== undefined && bodyWidth > usable ? 'landscape' : 'portrait';
  };
  const optOri = pageOpt && pageOpt.orientation;
  let orientation;
  if (optOri === 'portrait' || optOri === 'landscape') {
    orientation = optOri;
  } else if (optOri === 'auto') {
    orientation = computeAuto();
  } else if (legacyOri === 'portrait' || legacyOri === 'landscape') {
    orientation = legacyOri;
  } else if (atPage.orientation === 'portrait' || atPage.orientation === 'landscape') {
    orientation = atPage.orientation;
  } else {
    orientation = computeAuto();
  }

  const result = { orientation };
  if (pageSize) result.pageSize = pageSize;
  if (Object.keys(margins).length > 0) result.margins = margins;
  return result;
};

export { PAPER_SIZES };
export default derivePageSetup;
