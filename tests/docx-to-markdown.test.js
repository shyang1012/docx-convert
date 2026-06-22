import { describe, test, expect } from 'vitest';
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
