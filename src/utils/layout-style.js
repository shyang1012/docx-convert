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
