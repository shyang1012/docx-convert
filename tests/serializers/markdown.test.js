import { describe, test, expect } from 'vitest';
import { irToMarkdown } from '../../src/serializers/markdown.js';

// ---------------------------------------------------------------------------
// Task-spec required tests
// ---------------------------------------------------------------------------

test('heading + marked inlines', () => {
  const md = irToMarkdown([
    { type: 'heading', level: 2, children: [{ text: 'Title' }] },
    { type: 'paragraph', children: [{ text: 'a', bold: true }, { text: ' b', italic: true }] },
  ]);
  expect(md).toBe('## Title\n\n**a** *b*');
});

test('ordered list + table', () => {
  const md = irToMarkdown([
    {
      type: 'list',
      ordered: true,
      items: [{ children: [{ text: 'x' }] }, { children: [{ text: 'y' }] }],
    },
    {
      type: 'table',
      rows: [
        [[{ text: 'H1' }], [{ text: 'H2' }]],
        [[{ text: 'a' }], [{ text: 'b' }]],
      ],
    },
  ]);
  expect(md).toContain('1. x\n2. y');
  expect(md).toContain('| H1 | H2 |');
  expect(md).toContain('| --- | --- |');
});

// ---------------------------------------------------------------------------
// Additional coverage tests
// ---------------------------------------------------------------------------

describe('inline: link', () => {
  test('renders [text](url)', () => {
    const md = irToMarkdown([
      {
        type: 'paragraph',
        children: [{ type: 'link', href: 'https://example.com', children: [{ text: 'click' }] }],
      },
    ]);
    expect(md).toBe('[click](https://example.com)');
  });
});

describe('inline: image', () => {
  test('renders ![alt]()', () => {
    const md = irToMarkdown([
      { type: 'paragraph', children: [{ type: 'image', alt: 'diagram' }] },
    ]);
    expect(md).toBe('![diagram]()');
  });
});

describe('inline: code', () => {
  test('wraps in backticks and ignores bold/italic', () => {
    const md = irToMarkdown([
      { type: 'paragraph', children: [{ text: 'snippet', code: true, bold: true }] },
    ]);
    expect(md).toBe('`snippet`');
  });

  test('plain inline code without other marks', () => {
    const md = irToMarkdown([
      { type: 'paragraph', children: [{ text: 'c', code: true }] },
    ]);
    expect(md).toBe('`c`');
  });
});

describe('inline: marks combined', () => {
  test('bold + italic + strike nesting', () => {
    const md = irToMarkdown([
      { type: 'paragraph', children: [{ text: 'x', bold: true, italic: true, strike: true }] },
    ]);
    // strike wraps bold wraps italic (outermost to innermost order can vary — just verify all marks present)
    expect(md).toContain('x');
    expect(md).toContain('**');
    expect(md).toContain('*');
    expect(md).toContain('~~');
  });
});

describe('inline: plain text escaping', () => {
  test('escapes backslash', () => {
    const md = irToMarkdown([{ type: 'paragraph', children: [{ text: 'a\\b' }] }]);
    expect(md).toBe('a\\\\b');
  });

  test('escapes leading asterisk', () => {
    const md = irToMarkdown([{ type: 'paragraph', children: [{ text: '*star*' }] }]);
    expect(md).toContain('\\*');
  });
});

describe('unordered list', () => {
  test('uses dash prefix', () => {
    const md = irToMarkdown([
      {
        type: 'list',
        ordered: false,
        items: [{ children: [{ text: 'apple' }] }, { children: [{ text: 'banana' }] }],
      },
    ]);
    expect(md).toBe('- apple\n- banana');
  });
});

describe('nested list', () => {
  test('sublist lines indented 2 spaces', () => {
    const md = irToMarkdown([
      {
        type: 'list',
        ordered: false,
        items: [
          {
            children: [{ text: 'parent' }],
            sublist: {
              type: 'list',
              ordered: false,
              items: [
                { children: [{ text: 'child1' }] },
                { children: [{ text: 'child2' }] },
              ],
            },
          },
          { children: [{ text: 'sibling' }] },
        ],
      },
    ]);
    expect(md).toContain('- parent\n  - child1\n  - child2\n- sibling');
  });

  test('ordered nested list', () => {
    const md = irToMarkdown([
      {
        type: 'list',
        ordered: true,
        items: [
          {
            children: [{ text: 'first' }],
            sublist: {
              type: 'list',
              ordered: true,
              items: [{ children: [{ text: 'nested' }] }],
            },
          },
        ],
      },
    ]);
    expect(md).toContain('1. first\n  1. nested');
  });
});

describe('table', () => {
  test('single-row table has no data rows after separator', () => {
    const md = irToMarkdown([
      {
        type: 'table',
        rows: [[[{ text: 'Only' }], [{ text: 'Header' }]]],
      },
    ]);
    expect(md).toContain('| Only | Header |');
    expect(md).toContain('| --- | --- |');
  });

  test('multi-row table renders header + separator + body rows', () => {
    const md = irToMarkdown([
      {
        type: 'table',
        rows: [
          [[{ text: 'Name' }], [{ text: 'Age' }]],
          [[{ text: 'Alice' }], [{ text: '30' }]],
          [[{ text: 'Bob' }], [{ text: '25' }]],
        ],
      },
    ]);
    const lines = md.split('\n');
    expect(lines[0]).toBe('| Name | Age |');
    expect(lines[1]).toBe('| --- | --- |');
    expect(lines[2]).toBe('| Alice | 30 |');
    expect(lines[3]).toBe('| Bob | 25 |');
  });

  test('cell with inline marks', () => {
    const md = irToMarkdown([
      {
        type: 'table',
        rows: [[[{ text: 'Bold', bold: true }], [{ text: 'plain' }]]],
      },
    ]);
    expect(md).toContain('| **Bold** | plain |');
  });
});

describe('multiple top-level blocks joined with double newline', () => {
  test('three paragraphs separated by blank lines', () => {
    const md = irToMarkdown([
      { type: 'paragraph', children: [{ text: 'one' }] },
      { type: 'paragraph', children: [{ text: 'two' }] },
      { type: 'paragraph', children: [{ text: 'three' }] },
    ]);
    expect(md).toBe('one\n\ntwo\n\nthree');
  });
});

describe('headings all levels', () => {
  test.each([1, 2, 3, 4, 5, 6])('level %i heading', (level) => {
    const md = irToMarkdown([{ type: 'heading', level, children: [{ text: 'H' }] }]);
    expect(md).toBe(`${'#'.repeat(level)} H`);
  });
});
