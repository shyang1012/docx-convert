# docx-convert

Convert an HTML string into a `.docx` (Office Open XML) document — pure JavaScript, no headless browser, no LibreOffice, no native binaries. Its focus is **fidelity to the source HTML**: inline CSS styles and CSS-based layout are carried through to the Word document. Output is a `Buffer` (Node) or `Blob` (browser).

[![npm](https://img.shields.io/npm/v/@shyang1012/docx-convert)](https://www.npmjs.com/package/@shyang1012/docx-convert)
[![license](https://img.shields.io/npm/l/@shyang1012/docx-convert)](./LICENSE)
![node](https://img.shields.io/node/v/@shyang1012/docx-convert)

## Highlights

- **Style & layout fidelity** — inline CSS (color, alignment, weight, background, borders, padding…) and CSS-based layout are carried into the corresponding Word table / paragraph / run structure.
- **Page setup** — paper size (A4/Letter/…), orientation, and margins via a `page` option, auto-detected from `@page` CSS and the root container's `max-width`/`padding` when not given. Defaults to A4.
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
| `page` | A4, `auto` | Paper size, orientation & margins (mm) — see [Page setup](#page-setup) |
| `orientation` | `'portrait'` | Legacy flat option; `'portrait'` or `'landscape'` |
| `pageSize` | A4 | Legacy flat option; `{ width, height }` in TWIP |
| `margins` | A4 portrait | Legacy flat option; `{ top, right, bottom, left, header, footer, gutter }` in TWIP |
| `font` / `fontSize` | Default font, 22 HIP | Base font family and size (half-points) |
| `header` / `footer` | `false` | Enable header/footer (pass HTML via the 2nd/4th argument) |
| `pageNumber` | `false` | Render page numbers in the footer |
| `table.row.cantSplit` | `false` | Keep table rows from splitting across pages |
| `direction` | `'ltr'` | `'rtl'` for right-to-left documents |
| `title` / `subject` / `creator` | `''` | Core document properties |

User-facing dimensions accept `px` / `cm` / `in` / `pt` strings and are normalized internally. The default paper is **A4 portrait**.

### Page setup

The nested `page` option controls paper size, orientation, and margins; the library also auto-detects them from the HTML when `page` is omitted.

| Field | Values | Default |
|-------|--------|---------|
| `size` | `'A4'` `'A3'` `'A5'` `'B4'` `'B5'` `'Letter'` `'Legal'` (and common Word sizes), or `{ width, height, unit: 'mm' \| 'twip' }` | `A4` |
| `orientation` | `'auto'` / `'portrait'` / `'landscape'` | `'auto'` |
| `margins` | `{ top, right, bottom, left, header, footer, gutter }` in **mm** | Word defaults |
| `autoDetectContainer` | `true` / `false` | `true` |

```js
await HTMLtoDOCX(html, null, {
  page: { size: 'A4', orientation: 'landscape', margins: { top: 20, left: 25 } },
});
```

With no `page` option, the library reads `@page { size; margin }` from a `<style>` block and the root container's `max-width` / `padding` (set `page.autoDetectContainer: false` to disable the container heuristic). `orientation: 'auto'` rotates to landscape when the content is wider than the portrait page. Resolution precedence per field: `page` › legacy flat options › `@page` CSS › container CSS › A4 default.

### docx → markdown

```js
import { docxToMarkdown } from '@shyang1012/docx-convert';
import { readFileSync } from 'node:fs';

const md = await docxToMarkdown(readFileSync('input.docx'));
```

Accepts a `Buffer` / `ArrayBuffer` / `Uint8Array` / `Blob`. Converts headings, paragraphs, inline styles (bold/italic/strike/code), links, lists, and tables; images become `![alt]()` placeholders. `extractMarkdown` is an alias.

## Build / test

```bash
npm install
npm run build       # esbuild → dist/ (library ESM + CJS + browser ESM)
npm run test:unit   # vitest
npm run lint        # eslint --fix
```

Node >= 20. esbuild handles `.ts` natively, so the codebase can migrate to TypeScript incrementally without a build change.

Git hooks (lint-staged + commitlint) live in `.githooks`. After cloning, enable them once with `npm run prepare`.

## Roadmap

- Nested layout containers
- Broader layout-fidelity validation and regression coverage

## License

MIT — see [`LICENSE`](./LICENSE). This project builds on prior MIT-licensed work (privateOmega 2020, TurboDocx 2023); that authorship and the list of changes are retained in [`NOTICE`](./NOTICE).
