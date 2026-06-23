# docx → markdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reverse `docx → markdown` conversion to docx-convert, exposed as `docxToMarkdown` (alias `extractMarkdown`), without breaking the existing HTML→docx path.

**Architecture:** docx(zip) → JSZip extracts `word/document.xml` (+ numbering/styles/rels) → htmlparser2 (`xmlMode:true`) parses to nodes → `build-ir` produces a format-neutral IR (block tree) → `markdown` serializer emits a string. A future docx→text/html serializer can reuse the same IR.

**Tech Stack:** JSZip (already a dep), htmlparser2 (already a dep, xmlMode), vitest. No new dependencies. Pure JS / browser-safe.

**Spec:** `docs/superpowers/specs/2026-06-22-docx-to-markdown-design.md`

**bd:** create a `feature` issue at start (`bd create --type feature --title "docx → markdown (1차)"`) and note progress per task.

---

## File Structure

- `src/reader/ooxml-parse.js` — XML string → parsed node tree (htmlparser2 wrapper). **Parser swap point.** One responsibility: XML→nodes.
- `src/reader/docx-reader.js` — normalize input (Buffer/ArrayBuffer/Uint8Array/Blob) → JSZip load → return needed parts (`{ documentXml, numberingXml, stylesXml, relsXml }`).
- `src/reader/build-ir.js` — parsed nodes + numbering/rels → IR block tree (the OOXML semantics live here).
- `src/serializers/markdown.js` — IR → markdown string (markdown knowledge lives only here).
- `index.js` — wire `docxToMarkdown` / `extractMarkdown` named exports (default `generateContainer` unchanged).
- Tests under `tests/` (vitest), fixtures generated via `generateContainer` where possible.

IR shape (from spec):
```
Block = {type:'heading',level,children} | {type:'paragraph',children}
      | {type:'list',ordered,items:[{children,sublist?}]} | {type:'table',rows:[[cellInlines]]}
Inline = {text,bold?,italic?,strike?,code?} | {type:'link',href,children} | {type:'image',alt}
```

---

## Task 1: ooxml-parse — XML → nodes (htmlparser2 xmlMode PoC gate)

**Files:**
- Create: `src/reader/ooxml-parse.js`
- Test: `tests/reader/ooxml-parse.test.js`

- [ ] **Step 1: Write the failing test** — namespaced tags + self-closing must survive.

```js
import { describe, test, expect } from 'vitest';
import { parseOoxml } from '../../src/reader/ooxml-parse.js';

test('parses namespaced tags, attributes, and self-closing', () => {
  const root = parseOoxml('<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>hi</w:t></w:r></w:p>');
  const p = root.children.find((n) => n.name === 'w:p');
  expect(p).toBeTruthy();
  const style = p.children[0].children[0]; // w:pPr > w:pStyle
  expect(style.name).toBe('w:pStyle');
  expect(style.attribs['w:val']).toBe('Heading1');
  const t = p.children[1].children[0]; // w:r > w:t
  expect(t.children[0].data).toBe('hi'); // text node
});

test('namespaced r:id attribute survives (used by Task 4 hyperlinks)', () => {
  const link = parseOoxml('<w:hyperlink r:id="rId5"/>').children[0];
  expect(link.attribs['r:id']).toBe('rId5'); // confirm at PoC gate, not later
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/reader/ooxml-parse.test.js` → FAIL (module not found). **This is the PoC gate: if htmlparser2 xmlMode cannot preserve `w:val`/namespaced names, switch this file to a `sax`-based impl — build-ir is unaffected.**

- [ ] **Step 3: Implement** with htmlparser2 `parseDocument` (xmlMode).

```js
import { parseDocument } from 'htmlparser2';

// Returns a lightweight tree: nodes have { name, attribs, children, data }.
// htmlparser2 Document is already this shape (Element/Text). We expose it directly.
export const parseOoxml = (xml) => parseDocument(xml, { xmlMode: true, decodeEntities: true });

// Helpers used by build-ir.
export const isEl = (n) => n && n.type === 'tag';
export const isText = (n) => n && n.type === 'text';
export const childrenOf = (n) => (n && n.children) || [];
export const findChild = (n, name) => childrenOf(n).find((c) => isEl(c) && c.name === name);
export const findAll = (n, name) =>
  childrenOf(n).filter((c) => isEl(c) && c.name === name);
export const attr = (n, a) => (n && n.attribs ? n.attribs[a] : undefined);
export const textOf = (n) =>
  childrenOf(n)
    .map((c) => (isText(c) ? c.data : isEl(c) ? textOf(c) : ''))
    .join('');
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run tests/reader/ooxml-parse.test.js` → PASS. If FAIL on namespace handling, implement the `sax` fallback (note in commit), keep the same exported API.

- [ ] **Step 5: Commit**

```bash
git add src/reader/ooxml-parse.js tests/reader/ooxml-parse.test.js
git commit -m "feat(reader): OOXML XML→node parser (htmlparser2 xmlMode)"
```

---

## Task 2: docx-reader — input → JSZip → parts

**Files:**
- Create: `src/reader/docx-reader.js`
- Test: `tests/reader/docx-reader.test.js`

- [ ] **Step 1: Failing test** — a docx produced by `generateContainer` yields its `document.xml`.

```js
import { describe, test, expect } from 'vitest';
import HTMLtoDOCX from '../../index.js';
import { readDocxParts } from '../../src/reader/docx-reader.js';

test('extracts document.xml from a real docx', async () => {
  const buf = await HTMLtoDOCX('<p>hello world</p>');
  const parts = await readDocxParts(buf);
  expect(parts.documentXml).toContain('<w:document');
  expect(parts.documentXml).toContain('hello world');
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — normalize input then JSZip.

```js
import JSZip from 'jszip';

const toLoadable = (input) => {
  if (input == null) throw new TypeError('docxToMarkdown: input is required');
  if (typeof Blob !== 'undefined' && input instanceof Blob) return input.arrayBuffer();
  return input; // Buffer / Uint8Array / ArrayBuffer are accepted by JSZip.loadAsync
};

export const readDocxParts = async (input) => {
  const zip = await JSZip.loadAsync(await toLoadable(input));
  const read = async (path) => {
    const f = zip.file(path);
    return f ? f.async('string') : undefined;
  };
  const documentXml = await read('word/document.xml');
  if (!documentXml) throw new Error('docxToMarkdown: word/document.xml not found (not a .docx?)');
  return {
    documentXml,
    numberingXml: await read('word/numbering.xml'),
    stylesXml: await read('word/styles.xml'),
    relsXml: await read('word/_rels/document.xml.rels'),
  };
};
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(reader): docx-reader (input normalize + JSZip parts)`.

---

## Task 3: build-ir — paragraphs + run marks (bold/italic/strike/code)

**Files:**
- Create: `src/reader/build-ir.js`
- Test: `tests/reader/build-ir-runs.test.js`

- [ ] **Step 1: Failing test** — runs become inlines with marks.

```js
import { describe, test, expect } from 'vitest';
import { parseOoxml } from '../../src/reader/ooxml-parse.js';
import { buildIr } from '../../src/reader/build-ir.js';

const ir = (bodyXml) =>
  buildIr(parseOoxml(`<w:document><w:body>${bodyXml}</w:body></w:document>`), {});

test('bold + italic runs map to inline marks', () => {
  const blocks = ir('<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r><w:r><w:t> plain</w:t></w:r></w:p>');
  expect(blocks).toEqual([
    { type: 'paragraph', children: [
      { text: 'bold', bold: true },
      { text: ' plain' },
    ] },
  ]);
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** the body walk + paragraph/run mapping (heading/list/table/hyperlink/image come in later tasks — leave seams).

```js
import { isEl, childrenOf, findChild, findAll, attr, textOf } from './ooxml-parse.js';

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
  findAll(p, 'w:r').map(runToInline).filter((i) => i.text.length > 0);

const paragraphToBlock = (p) => ({ type: 'paragraph', children: paragraphInlines(p) });

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
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(reader): build-ir paragraphs + run marks`.

---

## Task 4: build-ir — headings + hyperlinks

**Files:**
- Modify: `src/reader/build-ir.js`
- Test: `tests/reader/build-ir-heading-link.test.js`

- [ ] **Step 1: Failing tests** — `pStyle=Heading2` → heading level 2; `w:hyperlink` + rels → link inline.

```js
test('Heading2 paragraph → heading level 2', () => {
  const blocks = ir('<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Title</w:t></w:r></w:p>');
  expect(blocks[0]).toEqual({ type: 'heading', level: 2, children: [{ text: 'Title' }] });
});

test('hyperlink resolves href via rels ctx', () => {
  const ctxBlocks = buildIr(
    parseOoxml('<w:document><w:body><w:p><w:hyperlink r:id="rId5"><w:r><w:t>site</w:t></w:r></w:hyperlink></w:p></w:body></w:document>'),
    { rels: { rId5: 'https://example.com' } }
  );
  expect(ctxBlocks[0].children[0]).toEqual({ type: 'link', href: 'https://example.com', children: [{ text: 'site' }] });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — heading detection from pStyle, hyperlink walk; thread `ctx.rels`.

```js
const headingLevel = (p) => {
  const pPr = findChild(p, 'w:pPr');
  const pStyle = pPr && findChild(pPr, 'w:pStyle');
  const m = /^Heading([1-6])$/.exec(attr(pStyle, 'w:val') || '');
  return m ? Number(m[1]) : null;
};

// Replace paragraph inline collection to also handle <w:hyperlink>:
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
```
Update `paragraphToBlock` to: if `headingLevel(p)` → `{type:'heading',level,children:collectInlines(p,ctx)}` else `{type:'paragraph',children:collectInlines(p,ctx)}`. Thread `ctx` from `buildIr`.

- [ ] **Step 4: Run → PASS** (re-run Task 3 test too — no regression).
- [ ] **Step 5: Commit** — `feat(reader): headings + hyperlinks`.

> Note: `ctx.rels` is parsed from `relsXml` in Task 8 (index wiring). Until then tests pass `rels` directly.

---

## Task 5: build-ir — lists (numbering numId/ilvl, nesting)

**Files:**
- Modify: `src/reader/build-ir.js`
- Test: `tests/reader/build-ir-list.test.js`

- [ ] **Step 1: Failing test** — consecutive numbered paragraphs group into one ordered list; ilvl drives nesting; numbering map says ordered vs unordered.

```js
test('numbered paragraphs become one ordered list', () => {
  const numbering = { '1': { '0': 'decimal' } }; // numId 1, ilvl 0 → ordered
  const body =
    '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>a</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>b</w:t></w:r></w:p>';
  const blocks = buildIr(parseOoxml(`<w:document><w:body>${body}</w:body></w:document>`), { numbering });
  expect(blocks).toEqual([
    { type: 'list', ordered: true, items: [
      { children: [{ text: 'a' }] },
      { children: [{ text: 'b' }] },
    ] },
  ]);
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — detect `w:numPr` (numId/ilvl); buffer consecutive list paragraphs; close list on a non-list block. `ordered` from `ctx.numbering[numId][ilvl]` (`decimal`/etc → ordered; `bullet`/`none` → unordered). Nesting by ilvl (ilvl>0 → push into previous item's `sublist`). Keep 1st-level + simple nesting; exotic number formats deferred (spec).

- [ ] **Step 4: Run → PASS** (Tasks 3–4 still green).
- [ ] **Step 5: Commit** — `feat(reader): numbered/bulleted lists with nesting`.

---

## Task 6: build-ir — tables (+ image placeholder)

**Files:**
- Modify: `src/reader/build-ir.js`
- Test: `tests/reader/build-ir-table.test.js`

- [ ] **Step 1: Failing tests** — `w:tbl` → `{type:'table',rows}` with cell inlines; merged cells (`w:gridSpan`/`w:vMerge`) flattened (ignored, content kept); `w:drawing` → `{type:'image',alt}` placeholder.

```js
test('table → rows of cell inlines', () => {
  const body = '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc>' +
    '<w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
  const blocks = ir(body);
  expect(blocks[0]).toEqual({ type: 'table', rows: [[[{ text: 'A' }], [{ text: 'B' }]]] });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — in the body loop handle `w:tbl`: map `w:tr`→row, `w:tc`→cell, cell inlines = concat of its `w:p` collectInlines. Ignore `w:gridSpan`/`w:vMerge` (flatten). Add image: a run containing `w:drawing` → push `{type:'image',alt:''}` (alt from `wp:docPr@descr` if present).

- [ ] **Step 4: Run → PASS** (all prior green).
- [ ] **Step 5: Commit** — `feat(reader): tables (flatten merges) + image placeholder`.

---

## Task 7: markdown serializer (IR → markdown)

**Files:**
- Create: `src/serializers/markdown.js`
- Test: `tests/serializers/markdown.test.js`

- [ ] **Step 1: Failing tests** — each block/inline renders to GFM.

```js
import { irToMarkdown } from '../../src/serializers/markdown.js';

test('heading + marked inlines', () => {
  const md = irToMarkdown([
    { type: 'heading', level: 2, children: [{ text: 'Title' }] },
    { type: 'paragraph', children: [{ text: 'a', bold: true }, { text: ' b', italic: true }] },
  ]);
  expect(md).toBe('## Title\n\n**a** *b*');
});

test('ordered list + table', () => {
  const md = irToMarkdown([
    { type: 'list', ordered: true, items: [{ children: [{ text: 'x' }] }, { children: [{ text: 'y' }] }] },
    { type: 'table', rows: [[[{ text: 'H1' }], [{ text: 'H2' }]], [[{ text: 'a' }], [{ text: 'b' }]]] },
  ]);
  expect(md).toContain('1. x\n2. y');
  expect(md).toContain('| H1 | H2 |');
  expect(md).toContain('| --- | --- |');
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — `inline()` (escape + marks order: code > link > bold/italic/strike), `block()` per type, join blocks with `\n\n`. List items: ordered `N.`, unordered `-`, nested sublist indented 2 spaces. Table: first row = header, separator `| --- |` per column.

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(serializer): IR → markdown (GFM)`.

---

## Task 8: index wiring — docxToMarkdown + extractMarkdown + rels/numbering parse

**Files:**
- Modify: `index.js`
- Create: `src/reader/parse-aux.js` (rels + numbering maps from their XML)
- Test: `tests/docx-to-markdown.test.js`

- [ ] **Step 1: Failing test** — end-to-end public API.

```js
import HTMLtoDOCX, { docxToMarkdown, extractMarkdown } from '../index.js';

test('docxToMarkdown round-trips a heading + bold', async () => {
  const docx = await HTMLtoDOCX('<h2>Title</h2><p><strong>bold</strong> text</p>');
  const md = await docxToMarkdown(docx);
  expect(md).toContain('## Title');
  expect(md).toContain('**bold** text');
});

test('extractMarkdown is an alias', () => {
  expect(extractMarkdown).toBe(docxToMarkdown);
});
```

- [ ] **Step 2: Run → FAIL.**
> Before implementing `parseNumbering`, unzip a real docx (`npm run diff:docx` or extract `word/numbering.xml`) to see the actual `w:numFmt` values and the `w:num`→`w:abstractNum` indirection. `parseNumbering` must: read each `<w:num w:numId>`→`<w:abstractNumId>`, then that `<w:abstractNum>`'s `<w:lvl w:ilvl>`→`<w:numFmt w:val>` (`decimal`/`bullet`/…). Map fmt → `ordered` (decimal/lowerLetter/… = ordered; bullet/none = unordered).

- [ ] **Step 3: Implement** — `parse-aux.js`: `parseRels(relsXml)` → `{rId: target}`, `parseNumbering(numberingXml)` → `{numId:{ilvl:'decimal'|'bullet'}}` (resolve `w:num`→`w:abstractNum`→`w:lvl`/`w:numFmt`). In `index.js`:

```js
import { readDocxParts } from './src/reader/docx-reader.js';
import { parseOoxml } from './src/reader/ooxml-parse.js';
import { buildIr } from './src/reader/build-ir.js';
import { irToMarkdown } from './src/serializers/markdown.js';
import { parseRels, parseNumbering } from './src/reader/parse-aux.js';

async function docxToMarkdown(input) {
  const parts = await readDocxParts(input);
  const ctx = {
    rels: parts.relsXml ? parseRels(parts.relsXml) : {},
    numbering: parts.numberingXml ? parseNumbering(parts.numberingXml) : {},
  };
  return irToMarkdown(buildIr(parseOoxml(parts.documentXml), ctx));
}
const extractMarkdown = docxToMarkdown; // hwp-convert 자매 정합 별칭
export { generateContainer as default, docxToMarkdown, extractMarkdown };
```
(Adjust the existing default export line accordingly — keep `generateContainer` default intact.)

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat: docxToMarkdown / extractMarkdown public API`.

---

## Task 9: round-trip integration + build/browser check

**Files:**
- Create: `tests/docx-to-markdown-roundtrip.test.js`
- Test: full suite + build

- [ ] **Step 1: Failing test** — a rich HTML round-trips structure.

```js
import HTMLtoDOCX, { docxToMarkdown } from '../index.js';

test('rich document round-trips headings, list, table, link', async () => {
  const html = '<h1>Doc</h1><ul><li>one</li><li>two</li></ul>' +
    '<p>see <a href="https://x.io">link</a></p>' +
    '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
  const md = await docxToMarkdown(await HTMLtoDOCX(html));
  expect(md).toContain('# Doc');
  expect(md).toMatch(/- one\n- two/);
  expect(md).toContain('[link](https://x.io)');
  expect(md).toContain('| A | B |');
});
```

- [ ] **Step 2: Run → FAIL or partial** — fix any IR/serializer gaps surfaced by real generateContainer output (e.g. list numbering ids, link rels). Iterate until green.
- [ ] **Step 3: Full gate** — `npm run test:unit` (all pass), `npm run build` (3 targets incl. browser ESM — confirms JSZip/htmlparser2 bundle browser-safe).
- [ ] **Step 4: Docs** — add a short "docx → markdown" usage block to `README.md` (`docxToMarkdown(buffer)`), note `extractMarkdown` alias.
- [ ] **Step 5: Commit** — `test: docx→markdown round-trip + docs`.

---

## Done criteria
- `docxToMarkdown` / `extractMarkdown` exported; default `generateContainer` unchanged.
- Round-trip preserves headings, paragraphs, run marks, links, lists, tables; images = `![alt]()`.
- Full unit suite green; build 3 targets succeed.
- bd feature issue closed with a summary note.
