/* eslint-disable no-useless-escape */
import JSZip from 'jszip';
import { minify } from 'html-minifier-terser';

import createDocumentOptionsAndMergeWithDefaults from './src/utils/options-utils';
import addFilesToContainer from './src/html-to-docx';
import { readDocxParts } from './src/reader/docx-reader';
import { parseOoxml } from './src/reader/ooxml-parse';
import { buildIr } from './src/reader/build-ir';
import { irToMarkdown } from './src/serializers/markdown';
import { parseRels, parseNumbering } from './src/reader/parse-aux';

const minifyHTMLString = async (htmlString) => {
  try {
    if (typeof htmlString === 'string' || htmlString instanceof String) {
      const minifiedHTMLString = await minify(htmlString, {
        collapseWhitespace: true,
        removeComments: true,
      });
      return minifiedHTMLString;
    }

    throw new Error('invalid html string');
  } catch (error) {
    return null;
  }
};

async function generateContainer(
  htmlString,
  headerHTMLString,
  documentOptions = {},
  footerHTMLString
) {
  const zip = new JSZip();

  const normalizedDocumentOptions = createDocumentOptionsAndMergeWithDefaults(documentOptions);

  let contentHTML = htmlString;
  let headerHTML = headerHTMLString;
  let footerHTML = footerHTMLString;
  if (htmlString && !normalizedDocumentOptions['preprocessing']['skipHTMLMinify']) {
    contentHTML = await minifyHTMLString(contentHTML);
  }
  if (headerHTMLString && !normalizedDocumentOptions['preprocessing']['skipHTMLMinify']) {
    headerHTML = await minifyHTMLString(headerHTML);
  }
  if (footerHTMLString && !normalizedDocumentOptions['preprocessing']['skipHTMLMinify']) {
    footerHTML = await minifyHTMLString(footerHTML);
  }

  await addFilesToContainer(zip, contentHTML, normalizedDocumentOptions, headerHTML, footerHTML);

  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  if (Object.prototype.hasOwnProperty.call(global, 'Buffer')) {
    return Buffer.from(new Uint8Array(buffer));
  }
  if (Object.prototype.hasOwnProperty.call(global, 'Blob')) {
    // eslint-disable-next-line no-undef
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }
  throw new Error(
    'Add blob support using a polyfill eg https://github.com/bjornstar/blob-polyfill'
  );
}

async function docxToMarkdown(input) {
  const parts = await readDocxParts(input);
  const ctx = {
    rels: parts.relsXml ? parseRels(parts.relsXml) : {},
    numbering: parts.numberingXml ? parseNumbering(parts.numberingXml) : {},
  };
  return irToMarkdown(buildIr(parseOoxml(parts.documentXml), ctx));
}

// hwp-convert 자매 정합 별칭
const extractMarkdown = docxToMarkdown;

export default generateContainer;
export { docxToMarkdown, extractMarkdown };
