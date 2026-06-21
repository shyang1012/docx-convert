# docx-convert

Convert an HTML string into a `.docx` (Office Open XML) document — pure JavaScript, no headless browser, LibreOffice, or native binaries. Output is a `Buffer` (Node) or `Blob` (browser).

> **Fork notice.** `docx-convert` is a fork of [@turbodocx/html-to-docx](https://github.com/TurboDocx/html-to-docx) (MIT), originally [privateOmega/html-to-docx](https://github.com/privateOmega/html-to-docx) (MIT). The original copyright is preserved in [`LICENSE`](./LICENSE) and the fork is recorded in [`NOTICE`](./NOTICE). This fork focuses on **inline-style fidelity** and **flex/grid `<div>` layout-to-table mapping**, plus general table fixes contributed back upstream (e.g. `<tfoot>` rendering).

## Install

```bash
npm install docx-convert
```

`sharp` is an optional dependency, used only for SVG→PNG rasterization — install it only if you need SVG support. The browser build stubs it out.

## Usage

```js
import HTMLtoDOCX from 'docx-convert';
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
- `documentOptions` — orientation, margins, fonts, page numbers, table defaults, etc. User-facing dimensions accept `px`/`cm`/`in`/`pt` strings.

## Build / test

```bash
npm install
npm run build       # esbuild → dist/ (library ESM + CJS + browser ESM)
npm run test:unit   # vitest
npm run lint        # eslint --fix
```

Node >= 20. esbuild handles `.ts` natively, so the codebase can migrate to TypeScript incrementally without a build change.

## License

MIT. See [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE) — original authorship (privateOmega 2020, TurboDocx 2023) is retained alongside this fork's copyright.
