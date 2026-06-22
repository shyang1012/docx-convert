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

const paragraphInlines = (p) =>
  findAll(p, 'w:r')
    .map(runToInline)
    .filter((i) => i.text.length > 0);

const paragraphToBlock = (p) => ({ type: 'paragraph', children: paragraphInlines(p) });

// ctx is accepted for future use (Task 4+: rels, numbering)
// eslint-disable-next-line no-unused-vars
export const buildIr = (doc, ctx = {}) => {
  const body = bodyOf(doc);
  const blocks = [];
  for (const node of childrenOf(body)) {
    if (!isEl(node)) continue;
    if (node.name === 'w:p') blocks.push(paragraphToBlock(node));
    // w:tbl handled in Task 6
  }
  return blocks;
};
