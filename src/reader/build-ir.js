import { isEl, childrenOf, findChild, findAll, attr, textOf } from './ooxml-parse';

const bodyOf = (doc) => {
  const docEl = childrenOf(doc).find((n) => isEl(n) && n.name === 'w:document');
  return findChild(docEl, 'w:body');
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

// Replaces paragraphInlines: also handles <w:hyperlink>.
const collectInlines = (parent, ctx) => {
  const out = [];
  for (const c of childrenOf(parent)) {
    if (!isEl(c)) continue;
    if (c.name === 'w:r') {
      const inline = runToInline(c);
      if (inline.text.length) out.push(inline);
    } else if (c.name === 'w:hyperlink') {
      const href = (ctx.rels || {})[attr(c, 'r:id')] || '';
      out.push({ type: 'link', href, children: collectInlines(c, ctx) });
    }
  }
  return out;
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
  for (const node of childrenOf(body)) {
    if (!isEl(node)) continue;
    if (node.name === 'w:p') blocks.push(paragraphToBlock(node, ctx));
    // w:tbl handled in Task 6
  }
  return blocks;
};
