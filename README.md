# docx-convert

Convert an HTML string into a `.docx` (Office Open XML) document — pure JavaScript, no headless browser, no LibreOffice, no native binaries. Its focus is **fidelity to the source HTML**: inline CSS styles are honored, and web-style `<div>` layouts using **flex/grid** are mapped onto **native Word tables**. Output is a `Buffer` (Node) or `Blob` (browser).

[![npm](https://img.shields.io/npm/v/@shyang1012/docx-convert)](https://www.npmjs.com/package/@shyang1012/docx-convert)
[![license](https://img.shields.io/npm/l/@shyang1012/docx-convert)](./LICENSE)
![node](https://img.shields.io/node/v/@shyang1012/docx-convert)

## Highlights

- **Inline-style fidelity** — inline CSS (color, alignment, weight, background, borders, padding…) is carried through to the corresponding Word run/paragraph/cell properties.
- **flex/grid `<div>` → native Word table** — web layouts built with `display:flex` / `display:grid` on `<div>` containers are converted to real `.docx` tables:
  - `flex-direction:row` (or implicit row) → a single-row table laying children out horizontally
  - `flex-direction:column` → a one-column, N-row table laying children out vertically
  - `display:grid` with explicit `grid-template-columns` → a row-major multi-column table
  - `justify-content` controls the table's horizontal placement; `<div>` background / border / padding become cell shading, borders, and `w:tcMar`
- **Inline SVG** — embeds inline `<svg>` (rasterized via the optional `sharp` dependency).
- **RTL** — right-to-left scripts (Hebrew, Arabic) via the `direction` option.
- **`<tfoot>` rendering** — table footers (totals rows, etc.) render at the bottom of the table regardless of source position.
- **Pure JavaScript** — runs in Node and the browser; no headless browser, LibreOffice, or native toolchain required.

## Install

```bash
npm install @shyang1012/docx-convert
```

`sharp` is an optional dependency, used only for SVG→PNG rasterization — install it only if you need SVG support. The browser build stubs it out.

## Usage

```js
import HTMLtoDOCX from '@shyang1012/docx-convert';
import { writeFileSync } from 'node:fs';

const html = '<h1>Invoice</h1><table><tbody><tr><td>Item</td><td>1,000</td></tr></tbody>'
  + '<tfoot><tr><td>Total</td><td>1,000</td></tr></tfoot></table>';

const fileBuffer = await HTMLtoDOCX(html, null, {
  table: { row: { cantSplit: true } },
  footer: true,
  pageNumber: true,
});

writeFileSync('output.docx', fileBuffer);
```

In the browser the same call returns a `Blob`.

### Layout mapping (flex `<div>` → table)

A web-style two-column row built with flexbox becomes a real Word table — no manual table markup needed:

```js
const html = `
  <div style="display:flex; gap:16px">
    <div style="flex:1; background:#f5f5f5; padding:8px">Left column</div>
    <div style="flex:1; padding:8px">Right column</div>
  </div>`;

const buffer = await HTMLtoDOCX(html);
```

The two child `<div>`s land side by side in a single-row, two-cell table, with the left cell shaded and both cells padded.

### Signature

```
generateContainer(htmlString, headerHTMLString?, documentOptions?, footerHTMLString?)
  → Promise<Buffer | Blob>
```

- `htmlString` — the HTML to convert.
- `headerHTMLString` / `footerHTMLString` — optional header/footer HTML.
- `documentOptions` — document-level settings (below).

### Options

Common `documentOptions` keys (all optional):

| Key | Default | Notes |
|-----|---------|-------|
| `orientation` | `'portrait'` | `'portrait'` or `'landscape'` |
| `margins` | A4 portrait | `{ top, right, bottom, left, header, footer, gutter }` in TWIP |
| `font` / `fontSize` | Default font, 22 HIP | Base font family and size (half-points) |
| `header` / `footer` | `false` | Enable header/footer (pass HTML via the 2nd/4th argument) |
| `pageNumber` | `false` | Render page numbers in the footer |
| `table.row.cantSplit` | `false` | Keep table rows from splitting across pages |
| `direction` | `'ltr'` | `'rtl'` for right-to-left documents |
| `title` / `subject` / `creator` | `''` | Core document properties |

User-facing dimensions accept `px` / `cm` / `in` / `pt` strings and are normalized internally.

## Build / test

```bash
npm install
npm run build       # esbuild → dist/ (library ESM + CJS + browser ESM)
npm run test:unit   # vitest
npm run lint        # eslint --fix
```

Node >= 20. esbuild handles `.ts` natively, so the codebase can migrate to TypeScript incrementally without a build change.

## Roadmap

- Nested layouts (flex/grid inside flex/grid)
- Broader layout-fidelity validation and regression coverage

## License

MIT — see [`LICENSE`](./LICENSE). This project builds on prior MIT-licensed work (privateOmega 2020, TurboDocx 2023); that authorship and the list of changes are retained in [`NOTICE`](./NOTICE).
