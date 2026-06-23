import { parseDocument } from 'htmlparser2';

// Returns a lightweight tree: nodes have { name, attribs, children, data }.
// htmlparser2 Document is already this shape (Element/Text). We expose it directly.
export const parseOoxml = (xml) => parseDocument(xml, { xmlMode: true, decodeEntities: true });

// Helpers used by build-ir.
export const isEl = (n) => n && n.type === 'tag';
export const isText = (n) => n && n.type === 'text';
export const childrenOf = (n) => (n && n.children) || [];
export const findChild = (n, name) => childrenOf(n).find((c) => isEl(c) && c.name === name);
export const findAll = (n, name) => childrenOf(n).filter((c) => isEl(c) && c.name === name);
export const attr = (n, a) => (n && n.attribs ? n.attribs[a] : undefined);
export const textOf = (n) =>
  childrenOf(n)
    .map((c) => (isText(c) ? c.data : isEl(c) ? textOf(c) : ''))
    .join('');
