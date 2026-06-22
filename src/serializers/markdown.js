/**
 * IR → GitHub-Flavored Markdown serializer.
 *
 * Input: Block[] as defined in the docx-reader IR spec.
 * Output: a GFM markdown string.
 */

// ---------------------------------------------------------------------------
// Inline serialization
// ---------------------------------------------------------------------------

/**
 * Escape markdown-significant characters in a plain text run.
 * Minimal escaping: backslash first, then the characters that trigger emphasis,
 * links, or code in standard/GFM markdown.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeText(str) {
  return str
    .replace(/\\/g, '\\\\') // backslash first (must come before other replacements)
    .replace(/[*_`[\]]/g, (ch) => `\\${ch}`);
}

/**
 * Serialize a single inline node.
 *
 * @param {object} node
 * @returns {string}
 */
function inline(node) {
  // image
  if (node.type === 'image') {
    return `![${node.alt}]()`;
  }

  // link
  if (node.type === 'link') {
    return `[${inlines(node.children)}](${node.href})`;
  }

  // text run
  const { text, bold, italic, strike, code } = node;

  // code takes precedence — render as literal, no other marks
  if (code) {
    return `\`${text}\``;
  }

  // GFM emphasis delimiters must not have whitespace immediately inside them.
  // Pull leading/trailing spaces out of the marked span to avoid ambiguous
  // delimiter runs like `**a*** b*` (which should render as `**a** *b*`).
  const leadingSpace = text.match(/^(\s*)/)[1];
  const trailingSpace = text.match(/(\s*)$/)[1];
  const core = text.slice(leadingSpace.length, text.length - trailingSpace.length);

  let result = escapeText(core);

  // mark application order (innermost → outermost): italic, bold, strike
  if (italic) result = `*${result}*`;
  if (bold) result = `**${result}**`;
  if (strike) result = `~~${result}~~`;

  result = leadingSpace + result + trailingSpace;

  return result;
}

/**
 * Serialize an array of inline nodes.
 *
 * @param {object[]} arr
 * @returns {string}
 */
function inlines(arr) {
  return arr.map(inline).join('');
}

// ---------------------------------------------------------------------------
// Block serialization
// ---------------------------------------------------------------------------

/**
 * Render a list block into an array of lines (without joining yet, so that
 * callers can indent sub-lists).
 *
 * @param {{ type:'list', ordered:boolean, items:ListItem[] }} b
 * @returns {string[]}
 */
function listLines(b) {
  const lines = [];
  b.items.forEach((item, idx) => {
    const prefix = b.ordered ? `${idx + 1}. ` : '- ';
    lines.push(`${prefix}${inlines(item.children)}`);
    if (item.sublist) {
      const subLines = listLines(item.sublist);
      subLines.forEach((sl) => lines.push(`  ${sl}`));
    }
  });
  return lines;
}

/**
 * Render a single top-level block to a markdown string.
 *
 * @param {object} b
 * @returns {string}
 */
function block(b) {
  switch (b.type) {
    case 'heading':
      return `${'#'.repeat(b.level)} ${inlines(b.children)}`;

    case 'paragraph':
      return inlines(b.children);

    case 'list':
      return listLines(b).join('\n');

    case 'table': {
      const [headerRow, ...bodyRows] = b.rows;
      const colCount = headerRow.length;

      const renderRow = (cells) => `| ${cells.map((cell) => inlines(cell)).join(' | ')} |`;

      const separator = `| ${Array(colCount).fill('---').join(' | ')} |`;

      const tableLines = [renderRow(headerRow), separator, ...bodyRows.map(renderRow)];
      return tableLines.join('\n');
    }

    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert an IR block array to a GFM markdown string.
 *
 * @param {object[]} blocks  IR Block[]
 * @returns {string}
 */
export function irToMarkdown(blocks) {
  return blocks.map(block).join('\n\n');
}
