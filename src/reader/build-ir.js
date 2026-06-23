import { isEl, childrenOf, findChild, findAll, attr, textOf } from './ooxml-parse';

const bodyOf = (doc) => {
  const docEl = childrenOf(doc).find((n) => isEl(n) && n.name === 'w:document');
  return findChild(docEl, 'w:body');
};

// Recursively find the first descendant element with the given name (depth-first).
const findDescendant = (node, name) => {
  for (const c of childrenOf(node)) {
    if (!isEl(c)) continue;
    if (c.name === name) return c;
    const found = findDescendant(c, name);
    if (found) return found;
  }
  return null;
};

const runToInline = (r) => {
  const rPr = findChild(r, 'w:rPr');
  const has = (name) => !!(rPr && findChild(rPr, name));
  const text = findAll(r, 'w:t').map(textOf).join('');
  const inline = { text };
  if (has('w:b')) inline.bold = true;
  if (has('w:i')) inline.italic = true;
  if (has('w:strike')) inline.strike = true;
  // inline code: rStyle Code/monospace family (best-effort)
  const rStyle = rPr && findChild(rPr, 'w:rStyle');
  if (rStyle && /code/i.test(attr(rStyle, 'w:val') || '')) inline.code = true;
  return inline;
};

const headingLevel = (p) => {
  const pPr = findChild(p, 'w:pPr');
  const pStyle = pPr && findChild(pPr, 'w:pStyle');
  const m = /^Heading([1-6])$/.exec(attr(pStyle, 'w:val') || '');
  return m ? Number(m[1]) : null;
};

// Replaces paragraphInlines: also handles <w:hyperlink> and image runs.
const collectInlines = (parent, ctx) => {
  const out = [];
  for (const c of childrenOf(parent)) {
    if (!isEl(c)) continue;
    if (c.name === 'w:r') {
      // Image: a run containing w:drawing emits an image inline instead of text.
      const drawing = findChild(c, 'w:drawing');
      if (drawing) {
        const docPr = findDescendant(drawing, 'wp:docPr');
        const alt = (docPr && attr(docPr, 'descr')) || '';
        out.push({ type: 'image', alt });
      } else {
        const inline = runToInline(c);
        if (inline.text.length) out.push(inline);
      }
    } else if (c.name === 'w:hyperlink') {
      const href = (ctx.rels || {})[attr(c, 'r:id')] || '';
      out.push({ type: 'link', href, children: collectInlines(c, ctx) });
    }
  }
  return out;
};

// Returns the ordered format strings that map to ordered:true
const ORDERED_FMTS = new Set([
  'decimal',
  'lowerLetter',
  'upperLetter',
  'lowerRoman',
  'upperRoman',
  'ordinal',
]);

const isOrderedFmt = (fmt) => ORDERED_FMTS.has(fmt);

// Extract list info from a paragraph. Returns null if not a list paragraph.
const listInfoOf = (p, ctx) => {
  const pPr = findChild(p, 'w:pPr');
  if (!pPr) return null;
  const numPr = findChild(pPr, 'w:numPr');
  if (!numPr) return null;
  const numIdEl = findChild(numPr, 'w:numId');
  if (!numIdEl) return null;
  const numId = String(attr(numIdEl, 'w:val') || '');
  // numId=0 means "remove inherited list numbering" → a normal paragraph, not a list item.
  if (!numId || numId === '0') return null;
  const ilvlEl = findChild(numPr, 'w:ilvl');
  const ilvl = Number(attr(ilvlEl, 'w:val') || '0');

  const numbering = ctx.numbering || {};
  const numDef = numbering[numId] || numbering[Number(numId)] || {};
  const fmt = numDef[ilvl] || numDef[String(ilvl)];
  const ordered = isOrderedFmt(fmt);
  return { numId, ilvl, ordered };
};

// Build a list block from an array of raw list paragraphs (each with {ilvl, ordered, inlines}).
// Groups contiguous ilvl-0 items and attaches ilvl>0 as sublists on the preceding parent.
const buildListBlock = (rawItems) => {
  // Determine the ordered flag from the first ilvl-0 item (or fallback to first item)
  const topItem = rawItems.find((r) => r.ilvl === 0) || rawItems[0];
  const { ordered } = topItem;

  const items = [];
  let currentItem = null; // the last ilvl-0 item
  let subBuffer = []; // pending ilvl>0 items for current parent

  const flushSub = () => {
    if (subBuffer.length === 0 || !currentItem) return;
    // Build sublist from subBuffer (currently only one level deep — ilvl 1)
    const subOrdered = subBuffer[0].ordered;
    currentItem.sublist = {
      type: 'list',
      ordered: subOrdered,
      items: subBuffer.map((s) => ({ children: s.inlines })),
    };
    subBuffer = [];
  };

  for (const raw of rawItems) {
    if (raw.ilvl === 0) {
      flushSub();
      currentItem = { children: raw.inlines };
      items.push(currentItem);
    } else {
      // ilvl > 0 — attach to most recent ilvl-0 parent
      if (!currentItem) {
        // No parent yet — promote as a top-level item (best-effort)
        currentItem = { children: raw.inlines };
        items.push(currentItem);
      } else {
        subBuffer.push(raw);
      }
    }
  }
  flushSub();

  return { type: 'list', ordered, items };
};

const paragraphToBlock = (p, ctx) => {
  const level = headingLevel(p);
  if (level !== null) {
    return { type: 'heading', level, children: collectInlines(p, ctx) };
  }
  return { type: 'paragraph', children: collectInlines(p, ctx) };
};

export const buildIr = (doc, ctx = {}) => {
  const body = bodyOf(doc);
  const blocks = [];

  // Buffer for consecutive list paragraphs belonging to one logical list group.
  // A new group starts when: numId changes at ilvl 0, or ordered flag flips at ilvl 0.
  let listBuffer = []; // array of { ilvl, ordered, numId, inlines }
  let bufNumId = null; // numId of current top-level list
  let bufOrdered = null; // ordered flag of current top-level list

  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(buildListBlock(listBuffer));
    listBuffer = [];
    bufNumId = null;
    bufOrdered = null;
  };

  for (const node of childrenOf(body)) {
    if (!isEl(node)) continue;

    if (node.name === 'w:p') {
      const info = listInfoOf(node, ctx);
      if (info) {
        const inlines = collectInlines(node, ctx);
        // Decide whether to start a new group (only matters at ilvl 0)
        if (info.ilvl === 0) {
          if (bufNumId !== null && (info.numId !== bufNumId || info.ordered !== bufOrdered)) {
            // Different numId or ordered type at root level → flush and start fresh
            flushList();
          }
          if (bufNumId === null) {
            bufNumId = info.numId;
            bufOrdered = info.ordered;
          }
        }
        listBuffer.push({ ilvl: info.ilvl, ordered: info.ordered, numId: info.numId, inlines });
      } else {
        flushList();
        blocks.push(paragraphToBlock(node, ctx));
      }
    } else if (node.name === 'w:tbl') {
      flushList();
      const rows = findAll(node, 'w:tr').map((tr) =>
        findAll(tr, 'w:tc').map((tc) => findAll(tc, 'w:p').flatMap((p) => collectInlines(p, ctx)))
      );
      blocks.push({ type: 'table', rows });
    }
  }

  flushList();
  return blocks;
};
