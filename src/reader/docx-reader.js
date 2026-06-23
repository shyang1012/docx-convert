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
