# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`docx-convert` is a pure-JavaScript library that converts an HTML string into a `.docx` (Office Open XML / OOXML) document — no headless browser, no LibreOffice, no native binaries required. Output is a `Buffer` (Node) or `Blob` (browser). The public entry is the default export in `index.js` (`generateContainer(htmlString, headerHTMLString, documentOptions, footerHTMLString)`).

It is a fork of `@turbodocx/html-to-docx` (MIT; original `privateOmega/html-to-docx`) — origin is preserved in `LICENSE`/`NOTICE`. Differentiation lives here: inline-style fidelity and flex/grid `<div>` layout-to-table mapping.

## Commands

```bash
# Build (esbuild → dist/: library ESM + CJS + browser ESM)
npm run build
npm run build:browser      # browser ESM bundle only (stubs out native `sharp`)

# Unit tests (vitest, globals mode, run against src/ — no build needed)
npm run test:unit
npx vitest run tests/xml-escape.test.js   # single file
npx vitest run -t "escapes font names"    # single test by name
npm run test:unit:coverage

# Integration / example tests (build first, then run a real generation)
npm run test:node          # build + example/example-node.js
npm run test:headings      # build + example/example-heading-styles.js
npm run test:ts            # build + run the TypeScript example via ts-node
npm run test:all           # unit + node + headings + ts

# Lint / format
npm run lint               # eslint --fix (airbnb-base + prettier)
npm run validate           # lint + prettier:check

# Inspect output: unzip two .docx and diff their XML parts
npm run diff:docx -- <a.docx> <b.docx>
```

Node >= 20. Unit tests live in `tests/` and run on **vitest** in globals mode (`describe`/`test`/`expect`/`vi` are global; see `vitest.config.js`). `example/` files are runnable scripts that write `.docx` files for manual inspection, not specs.

## Architecture: the conversion pipeline

A single document generation flows through four stages. To trace or modify behavior, follow this chain rather than searching by feature:

1. **`index.js`** — minifies the HTML (`html-minifier-terser`, skippable via `preprocessing.skipHTMLMinify`), creates a `JSZip`, normalizes options, then hands off to `addFilesToContainer`. At the end it serializes the zip to a `Buffer` or `Blob`.

2. **`src/html-to-docx.js` (`addFilesToContainer`)** — the OOXML package assembler. It instantiates one `DocxDocument`, triggers `document.xml` rendering, then writes every part of the `.docx` zip: `_rels/.rels`, `docProps/core.xml`, header/footer parts, `word/theme/theme1.xml`, `word/document.xml`, `styles.xml`, `numbering.xml`, `settings.xml`, `webSettings.xml`, `fontTable.xml`, relationship files, and `[Content_Types].xml`. Understanding `.docx` = "a zip of XML parts wired together by relationship IDs" is the key mental model here.

3. **`src/docx-document.js` (`DocxDocument` class)** — the central state object for one document. It holds all options, owns ID/relationship counters (`createDocumentRelationships`, `createMediaFile`, numbering instances), the per-document image cache (`_imageCache`, `_retryStats`), list/numbering state (`ListStyleBuilder`), and exposes the `generate*XML()` methods that produce each zip part from templates in `src/schemas/`. Anything cross-cutting (media, relationships, numbering) is threaded through this instance — it is passed as `this`/`docxDocumentInstance` into the renderer.

4. **`src/helpers/render-document-file.js` (`renderDocumentFile` / `convertVTreeToXML`)** — the recursive HTML→OOXML translator and the largest piece of logic alongside `xml-builder.js`. It walks the virtual DOM tree and emits `xmlbuilder2` fragments. Image fetching/decoding/caching (per-document LRU via `lru-cache`) and SVG handling are wired in here.

### HTML parsing → virtual DOM

HTML is parsed by `htmlparser2` and adapted into a virtual-DOM tree via `src/helpers/html-parser.js` → `src/vdom/index.js`. **`src/vdom/index.js` is a hand-maintained, API-compatible reimplementation of `virtual-dom@2.x`** (VNode/VText), written specifically to drop the vulnerable `min-document` transitive dependency (CVE-2025-57352). Keep its public shape (`VNode`, `VText`, `isVNode`, `isVText`) intact — the renderer depends on it.

### XML generation

`src/helpers/xml-builder.js` (~4300 lines) is the low-level OOXML element factory — run properties (`rPr`), paragraph properties (`pPr`), tables, borders, lists, hyperlinks, images, etc. `src/schemas/` holds the static/template XML strings for the boilerplate parts (`styles`, `numbering`, `theme`, `settings`, content-types, rels). Namespaces are centralized in `src/namespaces.js` and used with `xmlbuilder2`'s `namespaceAlias` (e.g. `@w`, `@r`).

### Options and unit handling

`src/utils/options-utils.js` merges user `documentOptions` with `defaultDocumentOptions` (from `src/constants.js`) via deep merge. OOXML uses TWIP (twentieths of a point) and HIP (half-points); user-facing dimensions accept `px`/`cm`/`in`/`pt` strings and are normalized through `src/utils/unit-conversion.js`. When adding an option, wire the default into `constants.js` so the merge and the tests stay consistent.

## Build specifics

`scripts/build.mjs` (esbuild) produces three targets: library ESM (`dist/docx-convert.esm.js`), library CJS (`dist/docx-convert.cjs.js`), and a browser ESM bundle (`dist/docx-convert.browser.esm.js`). The optional native dependency **`sharp`** (used only for SVG→PNG rasterization in `src/utils/image.js`) is `require`d inside a try/catch and kept `external` in the Node builds. The browser build bundles all deps, stubs `sharp` to `null` (see the `stubSharp` plugin in `scripts/build.mjs`), and polyfills Node built-ins via `esbuild-plugin-polyfill-node`, so bundlers like Next.js/webpack don't try to pull in sharp's Node-native deps. esbuild handles `.ts` natively, so a future TypeScript migration needs no build change. If you touch how `sharp` is loaded, re-check the `stubSharp` plugin and the browser build.

## Conventions

- Commits use Conventional Commits, enforced by commitlint + husky (`@commitlint/config-conventional`). Releases are cut with `standard-version`.
- `lint-staged` runs prettier + eslint on `src/**/*.js` pre-commit.
- The codebase is ES modules in `src/`; tests run through **vitest** (esbuild transform, no babel).
- Origin attribution must stay intact: `LICENSE` keeps the original copyright lines and `NOTICE` records the fork. Keep them when editing those files.
