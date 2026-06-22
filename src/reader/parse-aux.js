import { parseOoxml, isEl, childrenOf, findChild, findAll, attr } from './ooxml-parse';

/**
 * Parse word/_rels/document.xml.rels into { [rId]: targetUrl }.
 *
 * Relationship elements are NOT namespace-prefixed — their attributes are
 * plain "Id" and "Target" (not "r:Id" etc).
 *
 * @param {string} relsXml
 * @returns {{ [rId: string]: string }}
 */
export const parseRels = (relsXml) => {
  const doc = parseOoxml(relsXml);
  const result = {};
  // Walk all descendants looking for <Relationship> elements.
  // The document root (type === 'root') is not an element, so we recurse
  // into its children directly instead of gating on isEl at the top level.
  const walk = (node) => {
    if (!isEl(node)) {
      // For root/document nodes, still recurse into children
      for (const child of childrenOf(node)) {
        walk(child);
      }
      return;
    }
    if (node.name === 'Relationship') {
      const id = attr(node, 'Id');
      const target = attr(node, 'Target');
      if (id && target !== undefined) {
        result[id] = target;
      }
    }
    for (const child of childrenOf(node)) {
      walk(child);
    }
  };
  walk(doc);
  return result;
};

/**
 * Parse word/numbering.xml into { [numId]: { [ilvl]: fmt } }.
 *
 * The indirection: <w:num w:numId="N"> → <w:abstractNumId w:val="A">
 * → <w:abstractNum w:abstractNumId="A"> → <w:lvl w:ilvl="L"> → <w:numFmt w:val="fmt">
 *
 * @param {string} numberingXml
 * @returns {{ [numId: string]: { [ilvl: string]: string } }}
 */
export const parseNumbering = (numberingXml) => {
  const doc = parseOoxml(numberingXml);

  // Collect all top-level elements (children of the document root or the
  // <w:numbering> wrapper element)
  const allEls = [];
  const collectTopLevel = (node) => {
    for (const child of childrenOf(node)) {
      if (isEl(child)) allEls.push(child);
    }
  };
  collectTopLevel(doc);
  // If the root is the document object, the first element child is <w:numbering>
  const numberingRoot = allEls.find((el) => el.name === 'w:numbering');
  const topEls = numberingRoot ? childrenOf(numberingRoot).filter(isEl) : allEls;

  // Build abstractNumId → { ilvl → fmt }
  const abstractMap = {};
  for (const el of topEls) {
    if (el.name !== 'w:abstractNum') continue;
    const abstractNumId = attr(el, 'w:abstractNumId');
    if (!abstractNumId) continue;
    const lvlMap = {};
    for (const lvl of findAll(el, 'w:lvl')) {
      const ilvl = attr(lvl, 'w:ilvl');
      const numFmt = findChild(lvl, 'w:numFmt');
      const fmt = numFmt ? attr(numFmt, 'w:val') : undefined;
      if (ilvl !== undefined && fmt !== undefined) {
        lvlMap[ilvl] = fmt;
      }
    }
    abstractMap[abstractNumId] = lvlMap;
  }

  // Build numId → { ilvl → fmt } by resolving through abstractNumId
  const result = {};
  for (const el of topEls) {
    if (el.name !== 'w:num') continue;
    const numId = attr(el, 'w:numId');
    if (!numId) continue;
    const abstractNumIdEl = findChild(el, 'w:abstractNumId');
    const abstractNumIdVal = abstractNumIdEl ? attr(abstractNumIdEl, 'w:val') : undefined;
    if (abstractNumIdVal === undefined) continue;
    result[numId] = abstractMap[abstractNumIdVal] || {};
  }

  return result;
};
