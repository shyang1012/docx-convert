#!/usr/bin/env node
/**
 * esbuild-based build for docx-convert.
 *
 * Three targets:
 *   - dist/docx-convert.esm.js  (Node ESM, runtime deps kept external)
 *   - dist/docx-convert.cjs.js  (Node CJS, runtime deps kept external)
 *   - dist/docx-convert.browser.esm.js  (self-contained, deps bundled,
 *     `sharp` stubbed to null, Node built-ins polyfilled)
 *
 * esbuild handles `.ts` natively, so when the source is migrated to TypeScript
 * this script keeps working with only the entry path changed.
 */
import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const banner = {
  js: `// ${pkg.homepage} v${pkg.version} Copyright ${new Date().getFullYear()} ${pkg.author}`,
};

// Almost all runtime deps stay external for the Node library builds — consumers
// install them, and keeping them external avoids bundling packages that do
// dynamic `require()` of Node built-ins (e.g. html-minifier-terser → clean-css
// → require('http')), which esbuild cannot emit in ESM output.
//
// Exception: CJS-only packages imported by *name* (e.g. `import { cloneDeep }
// from 'lodash'`) must be bundled, otherwise the bare specifier survives into
// the ESM output and Node rejects the missing named export. `lodash` is the
// only such dependency here.
const bundledDeps = new Set(['lodash']);
const runtimeExternals = [
  ...Object.keys(pkg.dependencies || {}).filter((d) => !bundledDeps.has(d)),
  'sharp',
];

const browserOnly = process.argv.includes('--browser-only');

// Replace the optional native `sharp` dependency with a null stub in the
// browser bundle. SVG rasterization (the only sharp consumer) then throws its
// existing "Sharp is not installed" error if actually invoked, while basic
// generation works untouched.
const stubSharp = {
  name: 'stub-sharp',
  setup(b) {
    b.onResolve({ filter: /^sharp$/ }, () => ({ path: 'sharp', namespace: 'sharp-stub' }));
    b.onLoad({ filter: /.*/, namespace: 'sharp-stub' }, () => ({
      contents: 'export default null;',
      loader: 'js',
    }));
  },
};

async function buildLibrary() {
  for (const { format, outfile } of [
    { format: 'esm', outfile: 'dist/docx-convert.esm.js' },
    { format: 'cjs', outfile: 'dist/docx-convert.cjs.js' },
  ]) {
    // eslint-disable-next-line no-await-in-loop
    await build({
      entryPoints: ['index.js'],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format,
      outfile,
      external: runtimeExternals,
      sourcemap: true,
      banner,
      // esbuild emits the default export as `exports.default`. The public API is
      // the single default function, so for CJS we collapse it to `module.exports`
      // — `require('docx-convert')` then returns the function directly (matching
      // the previous UMD build).
      footer:
        format === 'cjs'
          ? {
              js: 'if (module.exports && module.exports.default) module.exports = module.exports.default;',
            }
          : undefined,
    });
    console.log(`✓ ${outfile}`);
  }
}

async function buildBrowser() {
  const { polyfillNode } = await import('esbuild-plugin-polyfill-node');
  await build({
    entryPoints: ['index.js'],
    bundle: true,
    platform: 'browser',
    target: 'es2020',
    format: 'esm',
    outfile: 'dist/docx-convert.browser.esm.js',
    external: ['sharp'],
    plugins: [stubSharp, polyfillNode({ polyfills: { fs: true } })],
    define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' },
    sourcemap: true,
    banner,
  });
  console.log('✓ dist/docx-convert.browser.esm.js');
}

await rm('dist', { recursive: true, force: true });
if (browserOnly) {
  await buildBrowser();
} else {
  await buildLibrary();
  await buildBrowser();
}
