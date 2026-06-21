// Pure CSS layout-style parsers — extract flex/grid layout meaning from a parsed
// inline-style object (the shape produced by html-parser.js `parseStyles`, e.g.
// { display: 'flex', 'grid-template-columns': '350.5px 350.5px', gap: '9px' }).
//
// These functions are intentionally pure: no VTree, no OOXML, no side effects.
// They are consumed by src/helpers/layout-to-table.js (the div->table transform).
// Part of the div->table layout engine (epic docx-convert-xku, T1).
// [shyang 2026-06-21]

/**
 * Return the trimmed `display` value, or '' when absent / input is not an object.
 * @param {Object} style
 * @returns {string}
 */
export const getDisplay = (style) => {
  if (!style || typeof style !== 'object') return '';
  const value = style.display;
  return typeof value === 'string' ? value.trim() : '';
};

/**
 * True when the element is a flex container (`flex` or `inline-flex`).
 */
export const isFlexContainer = (style) => {
  const display = getDisplay(style);
  return display === 'flex' || display === 'inline-flex';
};

/**
 * True when the element is a grid container (`grid` or `inline-grid`).
 */
export const isGridContainer = (style) => {
  const display = getDisplay(style);
  return display === 'grid' || display === 'inline-grid';
};

/**
 * Flex main-axis direction. Defaults to `row` (CSS initial value).
 * @returns {'row'|'column'|string}
 */
export const getFlexDirection = (style) => {
  if (!style || typeof style !== 'object') return 'row';
  const value = style['flex-direction'];
  return typeof value === 'string' && value.trim() ? value.trim() : 'row';
};

/**
 * Tokenize `grid-template-columns` into a raw track list (split on whitespace).
 * NOTE: T1 does NOT expand `repeat()` — that is deferred to T4. Returns [] when absent.
 * @returns {string[]}
 */
export const parseGridTemplateColumns = (style) => {
  if (!style || typeof style !== 'object') return [];
  const value = style['grid-template-columns'];
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.trim().split(/\s+/);
};

/**
 * Resolve row/column gap. Honors `row-gap`/`column-gap` over the `gap` shorthand.
 * The `gap` shorthand is `<row> <column>` (single value applies to both).
 * Values are returned as raw CSS strings (unit conversion is the consumer's job).
 * @returns {{ row: string|null, column: string|null }}
 */
export const getGap = (style) => {
  const result = { row: null, column: null };
  if (!style || typeof style !== 'object') return result;

  const shorthand = typeof style.gap === 'string' ? style.gap.trim() : '';
  if (shorthand) {
    const [first, second] = shorthand.split(/\s+/);
    result.row = first;
    result.column = second !== undefined ? second : first;
  }

  const rowGap = style['row-gap'];
  const columnGap = style['column-gap'];
  if (typeof rowGap === 'string' && rowGap.trim()) result.row = rowGap.trim();
  if (typeof columnGap === 'string' && columnGap.trim()) result.column = columnGap.trim();

  return result;
};

/**
 * Cross-axis alignment (`align-items`), or null when absent.
 */
export const getAlignItems = (style) => {
  if (!style || typeof style !== 'object') return null;
  const value = style['align-items'];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

/**
 * Main-axis distribution (`justify-content`), or null when absent.
 */
export const getJustifyContent = (style) => {
  if (!style || typeof style !== 'object') return null;
  const value = style['justify-content'];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

// Real border properties (shorthand / per-side / width|style|color). Deliberately
// excludes border-collapse and border-spacing, which are not visible decoration.
export const BORDER_DECORATION_RE = /^border(-(top|right|bottom|left))?(-(width|style|color))?$/;

// Backgrounds that paint nothing visible — treated as "no decoration" so a plain
// white-background container (e.g. the outermost body div) is NOT wrapped in a table.
const INVISIBLE_BACKGROUNDS = new Set(['transparent', 'auto', 'white', '#fff', '#ffffff']);
const isVisibleBackground = (value) => {
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase().replace(/\s+/g, '');
  if (!v || INVISIBLE_BACKGROUNDS.has(v)) return false;
  return !/^rgba?\(255,255,255(,(1|1\.0+|255))?\)$/.test(v); // white rgb/rgba variants
};

// A length that resolves to zero (0, 0px, 0pt, ...). Note: a leading-zero decimal
// like 0.666667px is NOT zero — the fractional part must be all zeros to match.
const isZeroLength = (value) => /^0(\.0+)?(px|pt|cm|in|em|rem|%)?$/.test(value);

// Only borders that actually render. none / hidden / zero-width are dropped (F-H1).
const hasVisibleBorder = (style) =>
  Object.keys(style).some((key) => {
    if (!BORDER_DECORATION_RE.test(key)) return false;
    const v = (style[key] == null ? '' : String(style[key])).trim().toLowerCase();
    if (!v || v === 'none' || v === 'hidden' || isZeroLength(v)) return false;
    return true;
  });

/**
 * True when a (non-flex, non-grid) `<div>` carries visible block decoration —
 * a real background colour or a visible border — and therefore should be rendered
 * as a single-cell table so the decoration survives in the DOCX. (T5)
 * @param {Object} style
 * @returns {boolean}
 */
export const hasBlockDecoration = (style) => {
  if (!style || typeof style !== 'object') return false;
  if (isVisibleBackground(style['background-color'] || style.background)) return true;
  return hasVisibleBorder(style);
};
