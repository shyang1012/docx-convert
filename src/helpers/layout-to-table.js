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
import { VNode, isVNode } from '../vdom/index';

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

  // ── T2~T4 extension point ──────────────────────────────────────────────
  // const style = (node.properties && node.properties.style) || {};
  // if (isFlexContainer(style)) return flexToTable(node, transformedChildren, style);
  // if (isGridContainer(style)) return gridToTable(node, transformedChildren, style);
  // ───────────────────────────────────────────────────────────────────────

  // T1 no-op: deep-clone with transformed children, no conversion.
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
