// Layout-to-table preprocessing pass.
//
// Web-oriented HTML lays out with <div> + display:flex/grid + inline styles. DOCX/OOXML
// has no flex/grid box model, but its table support is strong. So we translate flex/grid
// <div> layouts into virtual <table>/<tr>/<td> VNodes *before* rendering, letting the
// existing buildTable() path do the heavy lifting.
//
// T1 (this file, docx-convert-xku.1) builds only the scaffolding: a recursive traversal
// that deep-clones the VTree and DETECTS flex/grid containers (via ../utils/layout-style)
// but does NOT convert them yet. The actual flexRow/flexColumn/grid -> table conversions
// land in T2~T4, slotting into the marked extension point below. T1 must be a pure no-op:
// identical render output, original tree never mutated.
// [shyang 2026-06-21]

import { cloneDeep } from 'lodash';
import { VNode, isVNode, isVText } from '../vdom/index';
import {
  isFlexContainer,
  isGridContainer,
  getFlexDirection,
  getAlignItems,
  getJustifyContent,
  parseGridTemplateColumns,
  hasBlockDecoration,
} from '../utils/layout-style';
import { pixelRegex, pointRegex, cmRegex, inchRegex } from '../utils/unit-conversion';

/**
 * Clone a VNode preserving its FULL properties bag, key and namespace, replacing only
 * its children. Cloning only style/attributes would drop properties.src (images),
 * colSpan/rowSpan, key and namespace — forcing a rewrite in T2 (review finding F-01).
 * The properties bag is deep-cloned so downstream renderer mutations cannot leak back
 * into the original tree.
 *
 * @param {VNode} originalVNode
 * @param {Array} newChildren
 * @returns {VNode}
 */
export const cloneVNodeWithChildren = (originalVNode, newChildren) =>
  new VNode(
    originalVNode.tagName,
    cloneDeep(originalVNode.properties),
    newChildren,
    originalVNode.key,
    originalVNode.namespace
  );

/**
 * Build a brand-new virtual VNode (e.g. a synthesized table/tr/td). Used by T2~T4 to
 * emit the table structure that flex/grid containers map onto.
 *
 * @param {string} tagName
 * @param {Object} [style]      CSS style object (same shape as parsed inline styles)
 * @param {Array}  [children]
 * @param {Object} [attributes] HTML attributes (e.g. { colspan: '2' })
 * @returns {VNode}
 */
export const createElement = (tagName, style = {}, children = [], attributes = {}) =>
  new VNode(tagName, { attributes: { ...attributes }, style: { ...style } }, children);

// Absolute CSS length units that fixupColumnWidth() resolves without a parent width.
// % and unsupported units are NOT transferred to cells (review F-02): a percentage cell
// width is multiplied by the (possibly absent) table width → 0/NaN, corrupting w:tcW.
const ABSOLUTE_WIDTH_REGEXES = [pixelRegex, pointRegex, cmRegex, inchRegex];
const isAbsoluteWidth = (value) =>
  typeof value === 'string' && ABSOLUTE_WIDTH_REGEXES.some((re) => re.test(value));

// align-items (cross axis) → table-cell vertical alignment. Only builder-accepted values
// are emitted (review F-01): modifiedStyleAttributesBuilder takes top|middle|bottom and
// buildVerticalAlignment maps 'middle' → OOXML 'center'. stretch/baseline are dropped.
const ALIGN_ITEMS_TO_VALIGN = { 'flex-start': 'top', center: 'middle', 'flex-end': 'bottom' };

// justify-content (main axis) → table horizontal position. buildTableProperties defaults
// an unaligned table to 'center', so we always set align (default 'left') to match a
// left-flowing flex row. space-* has no table equivalent → falls back to left.
const JUSTIFY_TO_ALIGN = {
  'flex-start': 'left',
  start: 'left',
  left: 'left',
  center: 'center',
  'flex-end': 'right',
  end: 'right',
  right: 'right',
};

/**
 * Convert a `display:flex; flex-direction:row` <div> (including implicit row) into a
 * single-row table so its children sit side by side in the DOCX. Each child becomes a
 * <td>; the row is one <tr> inside a borderless <table>. The existing buildTable path
 * renders it. (epic docx-convert-xku, T2)
 *
 * @param {VNode} node     original flex container
 * @param {Array} children already-transformed children
 * @param {Object} style   the container's parsed style object
 * @returns {VNode} a synthesized <table>, or a no-op clone if there are no real children
 */
const flexRowToTable = (node, children, style) => {
  const vAlign = ALIGN_ITEMS_TO_VALIGN[getAlignItems(style)];

  const cells = children
    .filter((child) => !(isVText(child) && child.text.trim() === ''))
    .map((child) => {
      const cellStyle = {};
      if (isVNode(child)) {
        const childWidth =
          child.properties && child.properties.style && child.properties.style.width;
        if (isAbsoluteWidth(childWidth)) cellStyle.width = childWidth;
      }
      if (vAlign) cellStyle['vertical-align'] = vAlign;
      return createElement('td', cellStyle, [child]);
    });

  // Only blank text (or nothing) → leave the node unchanged (no-op clone).
  if (cells.length === 0) return cloneVNodeWithChildren(node, children);

  const row = createElement('tr', {}, cells);

  const tableStyle = {};
  const nodeWidth = node.properties && node.properties.style && node.properties.style.width;
  if (nodeWidth) tableStyle.width = nodeWidth;

  // Default to left so the borderless layout table is not centered by the builder (F-7).
  const align = JUSTIFY_TO_ALIGN[getJustifyContent(style)] || 'left';

  return createElement('table', tableStyle, [row], { align });
};

// Read an absolute-length width off a VNode's inline style, or undefined.
const absoluteChildWidth = (child) => {
  const w =
    isVNode(child) && child.properties && child.properties.style && child.properties.style.width;
  return isAbsoluteWidth(w) ? w : undefined;
};

/**
 * Convert a `display:flex; flex-direction:column` <div> into a one-column table so its
 * children stack vertically in the DOCX. align-items is the *cross* (horizontal) axis
 * here, so it maps to the table's left/right position (not cell vAlign as in a row).
 * Mirror of flexRowToTable. (epic docx-convert-xku, T3)
 *
 * @param {VNode} node     original flex column container
 * @param {Array} children already-transformed children
 * @param {Object} style   the container's parsed style object
 * @returns {VNode} a synthesized <table>, or a no-op clone if there are no real children
 */
const flexColumnToTable = (node, children, style) => {
  const cellChildren = children.filter((child) => !(isVText(child) && child.text.trim() === ''));
  if (cellChildren.length === 0) return cloneVNodeWithChildren(node, children);

  const rows = cellChildren.map((child) => {
    const cellStyle = {};
    const w = absoluteChildWidth(child);
    if (w) cellStyle.width = w;
    return createElement('tr', {}, [createElement('td', cellStyle, [child])]);
  });

  // Cross-axis (horizontal) alignment of the whole table. Default left avoids the
  // builder's center default (FLAG-7).
  const align = JUSTIFY_TO_ALIGN[getAlignItems(style)] || 'left';

  // Right/center alignment is only meaningful when the table is content-width — a
  // page-wide table can't visibly shift (review F-H1). So for right/center use the
  // first child's absolute width; for left, prefer the container width.
  const containerWidth = node.properties && node.properties.style && node.properties.style.width;
  const firstChildWidth = cellChildren.map(absoluteChildWidth).find(Boolean);
  let tableWidth;
  if (align === 'right' || align === 'center') {
    tableWidth = firstChildWidth;
  } else {
    tableWidth = isAbsoluteWidth(containerWidth) ? containerWidth : firstChildWidth;
  }
  const tableStyle = tableWidth ? { width: tableWidth } : {};

  return createElement('table', tableStyle, rows, { align });
};

/**
 * Convert a non-flex/non-grid <div> that carries visible background or border into a
 * single-cell table so the decoration survives in the DOCX. The synthesized td goes
 * through buildTable→buildTableRow→buildTableCell, which applies cell shading (w:shd)
 * and borders (w:tcBorders) and renders nested tables + paragraphs safely. This avoids
 * the paragraph path, where background needs display==='block' and CSS borders have no
 * mapping at all. (epic docx-convert-xku, T5)
 *
 * @param {Array} children already-transformed children
 * @param {Object} style   the div's parsed style object (carries bg/border)
 * @returns {VNode} a synthesized single-cell <table>
 */
const blockDivToTable = (children, style) => {
  const cellStyle = { ...style };
  delete cellStyle.width; // width belongs on the table, not the cell
  delete cellStyle.display; // keep the cell's paragraph off the display==='block' gate
  const td = createElement('td', cellStyle, children);
  const row = createElement('tr', {}, [td]);
  const tableStyle = style.width ? { width: style.width } : {};
  return createElement('table', tableStyle, [row], { align: 'left' });
};

// A grid track only yields a fixed cell width when it is an absolute length; fr/auto and
// other non-absolute tracks get no width (review F-H2) — fixupColumnWidth can't size them.
const cellWidthStyle = (track) => (isAbsoluteWidth(track) ? { width: track } : {});

/**
 * Convert a display:grid <div> into a table laid out row-major across grid-template-columns.
 * Each track is a column; children fill left-to-right and short final rows are padded with
 * empty cells so every row has the same column count — buildTableGridFromTableRow sizes the
 * grid from the first row, so uniform row lengths keep columns aligned. (epic docx-convert-xku, T4)
 *
 * Limits: grid-template-columns must be explicit tracks. repeat() is not expanded (T1 parser)
 * and is left as a no-op; grid-template-rows / explicit placement / span are out of scope.
 *
 * @param {VNode} node     original grid container
 * @param {Array} children already-transformed children
 * @param {Object} style   the container's parsed style object
 * @returns {VNode} a synthesized <table>, or a no-op clone if tracks are unparseable
 */
const gridToTable = (node, children, style) => {
  const columns = parseGridTemplateColumns(style);
  const colCount = columns.length;
  // Unparseable track list (none, or repeat() the T1 parser doesn't expand) → no-op.
  if (colCount < 1 || columns.some((track) => track.includes('repeat('))) {
    return cloneVNodeWithChildren(node, children);
  }

  // Drop blank text so pretty-printed whitespace doesn't leak into cells (review F-H1).
  const cells = children.filter((child) => !(isVText(child) && child.text.trim() === ''));
  if (cells.length === 0) return cloneVNodeWithChildren(node, children);

  const rows = [];
  for (let i = 0; i < cells.length; i += colCount) {
    const rowCells = [];
    for (let c = 0; c < colCount; c += 1) {
      const child = cells[i + c];
      const widthStyle = cellWidthStyle(columns[c]);
      rowCells.push(
        child === undefined
          ? createElement('td', widthStyle, []) // pad a short final row
          : createElement('td', widthStyle, [child])
      );
    }
    rows.push(createElement('tr', {}, rowCells));
  }

  const nodeWidth = node.properties && node.properties.style && node.properties.style.width;
  const tableStyle = nodeWidth ? { width: nodeWidth } : {};
  return createElement('table', tableStyle, rows, { align: 'left' });
};

// Layout conversion targets block-level CONTAINERS only. Table parts (td/th/tr/table),
// paragraphs and inline elements must never be re-wrapped — they have their own
// background/border handling, and wrapping them corrupts the table structure.
const BLOCK_CONTAINER_TAGS = new Set([
  'div',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'aside',
]);

/**
 * Recursively transform a single VTree node. Non-VNode values (VText, etc.) pass through
 * unchanged. VNodes are deep-cloned with their children recursively transformed.
 *
 * T1: detection-only. flex/grid containers are recognized but returned structurally
 * unchanged. T2~T4 will branch here on isFlexContainer/isGridContainer to synthesize
 * tables — that is the single extension point.
 */
const transformNode = (node) => {
  if (!isVNode(node)) {
    // VText and other leaf nodes are immutable for our purposes — pass through.
    return node;
  }

  const transformedChildren = (node.children || []).map(transformNode);
  const style = (node.properties && node.properties.style) || {};

  // Only block containers are eligible for layout conversion (never td/th/tr/table/p/inline).
  if (BLOCK_CONTAINER_TAGS.has(node.tagName)) {
    // T2: flex-direction:row (including implicit row) → single-row table.
    if (isFlexContainer(style) && getFlexDirection(style) === 'row') {
      return flexRowToTable(node, transformedChildren, style);
    }
    // T3: flex-direction:column → one-column (N-row) table.
    if (isFlexContainer(style) && getFlexDirection(style) === 'column') {
      return flexColumnToTable(node, transformedChildren, style);
    }
    // T4: grid → multi-column table. Checked before blockDiv so a decorated grid
    // container becomes a grid (not a single wrapper cell).
    if (isGridContainer(style)) {
      return gridToTable(node, transformedChildren, style);
    }
    // T5: visible background/border, non-flex/non-grid → single-cell table.
    if (hasBlockDecoration(style) && !isFlexContainer(style) && !isGridContainer(style)) {
      return blockDivToTable(transformedChildren, style);
    }
  }

  // No-op: deep-clone with transformed children.
  return cloneVNodeWithChildren(node, transformedChildren);
};

/**
 * Entry point for the layout preprocessing pass. Accepts a single VNode or an array of
 * top-level nodes (matching convertHTML's output shape) and returns a transformed copy.
 * The original tree is never mutated.
 *
 * @param {VNode|VText|Array} vTree
 * @returns {VNode|VText|Array}
 */
export const transformLayoutTree = (vTree) => {
  if (Array.isArray(vTree)) {
    return vTree.map(transformNode);
  }
  return transformNode(vTree);
};
