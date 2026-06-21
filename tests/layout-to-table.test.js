// Unit tests for layout-to-table — the div->table preprocessing pass (T1 scaffolding).
// T1 is a NO-OP transform: it deep-clones the VTree and recurses, detecting flex/grid
// containers but NOT converting them yet (conversion lands in T2~T4).

import {
  transformLayoutTree,
  cloneVNodeWithChildren,
  createElement,
} from '../src/helpers/layout-to-table.js';
import { VNode, VText, isVNode, isVText } from '../src/vdom/index.js';

const node = (tag, properties, children) =>
  new VNode(tag, properties || { attributes: {} }, children || []);

describe('layout-to-table (T1 scaffolding)', () => {
  describe('transformLayoutTree — no-op', () => {
    test('non-layout tree is structurally identical (deep equal) but a new instance', () => {
      const tree = node('div', { attributes: {}, style: { color: 'red' } }, [
        node('p', { attributes: {}, style: {} }, [new VText('hi')]),
      ]);
      const out = transformLayoutTree(tree);
      expect(out).toEqual(tree); // deep equal (structure preserved)
      expect(out).not.toBe(tree); // new instance (deep clone, no mutation)
      expect(out.children).not.toBe(tree.children); // children array re-created
    });

    test('does not mutate the original tree', () => {
      const child = node('span', { attributes: {}, style: {} }, [new VText('a')]);
      const tree = node('div', { attributes: {}, style: { display: 'grid' } }, [child]);
      transformLayoutTree(tree);
      expect(tree.tagName).toBe('div');
      expect(tree.children[0]).toBe(child); // original child reference intact
      expect(tree.children[0].children[0].text).toBe('a');
    });

    test('handles array vTree (multiple top-level nodes)', () => {
      const arr = [
        node('p', { attributes: {} }, [new VText('1')]),
        node('p', { attributes: {} }, [new VText('2')]),
      ];
      const out = transformLayoutTree(arr);
      expect(Array.isArray(out)).toBe(true);
      expect(out).toEqual(arr);
      expect(out).not.toBe(arr);
    });

    test('VText / mixed children pass through safely', () => {
      const t = new VText('hello');
      expect(isVText(transformLayoutTree(t))).toBe(true);
      const mixed = node('div', { attributes: {} }, [
        new VText('a'),
        node('b', { attributes: {} }, [new VText('bold')]),
      ]);
      const out = transformLayoutTree(mixed);
      expect(out.children.length).toBe(2);
      expect(isVText(out.children[0])).toBe(true);
      expect(out.children[1].tagName).toBe('b');
    });
  });

  describe('cloneVNodeWithChildren — F-01 full property preservation', () => {
    test('preserves all properties, key and namespace', () => {
      const original = new VNode(
        'img',
        { attributes: { colspan: '2' }, style: { width: '5px' }, src: 'data:image/png;base64,AAA' },
        [],
        'k1',
        'http://example/ns'
      );
      const newChildren = [new VText('c')];
      const cloned = cloneVNodeWithChildren(original, newChildren);

      expect(cloned).not.toBe(original);
      expect(cloned.tagName).toBe('img');
      expect(cloned.properties.src).toBe('data:image/png;base64,AAA'); // would be lost by style/attrs-only clone
      expect(cloned.properties.attributes.colspan).toBe('2');
      expect(cloned.properties.style.width).toBe('5px');
      expect(cloned.key).toBe('k1');
      expect(cloned.namespace).toBe('http://example/ns');
      expect(cloned.children).toBe(newChildren);
    });

    test('deep-clones properties so mutating the clone does not affect the original', () => {
      const original = new VNode('div', { attributes: {}, style: { color: 'red' } }, []);
      const cloned = cloneVNodeWithChildren(original, []);
      cloned.properties.style.color = 'blue';
      expect(original.properties.style.color).toBe('red');
    });
  });

  describe('createElement — new virtual node builder (used by T2~T4)', () => {
    test('builds a VNode with style and attributes', () => {
      const el = createElement('td', { width: '100px' }, [new VText('x')], { colspan: '2' });
      expect(isVNode(el)).toBe(true);
      expect(el.tagName).toBe('td');
      expect(el.properties.style.width).toBe('100px');
      expect(el.properties.attributes.colspan).toBe('2');
      expect(el.children.length).toBe(1);
    });

    test('defaults style/attributes/children when omitted', () => {
      const el = createElement('tr');
      expect(el.tagName).toBe('tr');
      expect(el.properties.style).toEqual({});
      expect(el.properties.attributes).toEqual({});
      expect(el.children).toEqual([]);
    });
  });

  describe('flexRowToTable (T2) — flex row → table', () => {
    const span = (style, text) => node('span', { attributes: {}, style: style || {} }, [new VText(text)]);
    const flexRow = (containerStyle, children) =>
      node('div', { attributes: {}, style: { display: 'flex', ...containerStyle } }, children);

    test('flex row div → table > tr > td*N (cell count = child count)', () => {
      const out = transformLayoutTree(
        flexRow({}, [span({}, '상호'), span({}, ':'), span({}, '테스트')])
      );
      expect(out.tagName).toBe('table');
      const tr = out.children[0];
      expect(tr.tagName).toBe('tr');
      expect(tr.children.length).toBe(3);
      expect(tr.children.every((td) => td.tagName === 'td')).toBe(true);
    });

    test('absolute child width → td width; %/unsupported NOT transferred (F-02)', () => {
      const out = transformLayoutTree(
        flexRow({}, [span({ width: '108px' }, 'a'), span({ width: '50%' }, 'b'), span({}, 'c')])
      );
      const [td1, td2, td3] = out.children[0].children;
      expect(td1.properties.style.width).toBe('108px');
      expect(td2.properties.style.width).toBeUndefined();
      expect(td3.properties.style.width).toBeUndefined();
    });

    test('align-items:center → td vertical-align:middle; stretch not mapped (F-01)', () => {
      const center = transformLayoutTree(flexRow({ 'align-items': 'center' }, [span({}, 'a')]));
      expect(center.children[0].children[0].properties.style['vertical-align']).toBe('middle');
      const stretch = transformLayoutTree(flexRow({ 'align-items': 'stretch' }, [span({}, 'a')]));
      expect(stretch.children[0].children[0].properties.style['vertical-align']).toBeUndefined();
    });

    test('table align from justify-content (default left) (FLAG-7/CP6)', () => {
      expect(transformLayoutTree(flexRow({}, [span({}, 'a')])).properties.attributes.align).toBe('left');
      expect(
        transformLayoutTree(flexRow({ 'justify-content': 'flex-end' }, [span({}, 'a')])).properties
          .attributes.align
      ).toBe('right');
      expect(
        transformLayoutTree(flexRow({ 'justify-content': 'center' }, [span({}, 'a')])).properties
          .attributes.align
      ).toBe('center');
      // space-* unsupported → left
      expect(
        transformLayoutTree(flexRow({ 'justify-content': 'space-between' }, [span({}, 'a')]))
          .properties.attributes.align
      ).toBe('left');
    });

    test('table width inherited from container width', () => {
      const out = transformLayoutTree(flexRow({ width: '710px' }, [span({}, 'a')]));
      expect(out.properties.style.width).toBe('710px');
    });

    test('flex-direction column / row-reverse NOT converted (T3 / out-of-scope)', () => {
      expect(
        transformLayoutTree(flexRow({ 'flex-direction': 'column' }, [span({}, 'a')])).tagName
      ).toBe('div');
      expect(
        transformLayoutTree(flexRow({ 'flex-direction': 'row-reverse' }, [span({}, 'a')])).tagName
      ).toBe('div');
    });

    test('empty-text children skipped; no valid cells → no-op div (FLAG-3)', () => {
      const out = transformLayoutTree(flexRow({}, [new VText('   '), span({}, 'a')]));
      expect(out.tagName).toBe('table');
      expect(out.children[0].children.length).toBe(1); // blank text dropped
      const onlyBlank = transformLayoutTree(flexRow({}, [new VText('   ')]));
      expect(onlyBlank.tagName).toBe('div'); // no valid cells → unchanged
    });

    test('does not mutate the original flex tree', () => {
      const child = span({ width: '108px' }, 'a');
      const tree = flexRow({}, [child]);
      transformLayoutTree(tree);
      expect(tree.tagName).toBe('div');
      expect(tree.children[0]).toBe(child);
    });
  });

  describe('blockDivToTable (T5) — decorated div → single-cell table', () => {
    const divNode = (style, children) => node('div', { attributes: {}, style }, children);

    test('background div → table>tr>td, background preserved on cell', () => {
      const out = transformLayoutTree(
        divNode({ 'background-color': 'rgb(26, 82, 118)', 'text-align': 'center' }, [
          node('strong', { attributes: {}, style: {} }, [new VText('발주서')]),
        ])
      );
      expect(out.tagName).toBe('table');
      const td = out.children[0].children[0];
      expect(td.tagName).toBe('td');
      expect(td.properties.style['background-color']).toBe('rgb(26, 82, 118)');
      expect(td.properties.style['text-align']).toBe('center');
      expect(td.properties.style.display).toBeUndefined(); // display stripped (block gate)
    });

    test('border div → cell carries border-*', () => {
      const out = transformLayoutTree(
        divNode(
          {
            'border-top-width': '0.666667px',
            'border-top-style': 'solid',
            'border-top-color': 'rgb(209,213,220)',
          },
          [new VText('box')]
        )
      );
      const td = out.children[0].children[0];
      expect(out.tagName).toBe('table');
      expect(td.properties.style['border-top-width']).toBe('0.666667px');
    });

    test('decoration-less div → no-op (stays div)', () => {
      expect(transformLayoutTree(divNode({ 'border-collapse': 'separate' }, [new VText('x')])).tagName).toBe('div');
    });

    test('white-background div → no-op (outermost container not wrapped)', () => {
      expect(
        transformLayoutTree(divNode({ 'background-color': 'rgb(255, 255, 255)', width: '800px' }, [new VText('x')]))
          .tagName
      ).toBe('div');
    });

    test('div width → table width, not cell width; table align=left', () => {
      const out = transformLayoutTree(divNode({ 'background-color': '#1a5276', width: '710px' }, [new VText('x')]));
      expect(out.properties.style.width).toBe('710px');
      expect(out.children[0].children[0].properties.style.width).toBeUndefined();
      expect(out.properties.attributes.align).toBe('left');
    });

    test('flex/grid branch wins over blockDiv when both apply', () => {
      // flex row + background → flexRowToTable (cells per child), not a single wrapper cell
      const flexBg = transformLayoutTree(
        node('div', { attributes: {}, style: { display: 'flex', 'background-color': '#1a5276' } }, [
          node('span', { attributes: {}, style: {} }, [new VText('a')]),
          node('span', { attributes: {}, style: {} }, [new VText('b')]),
        ])
      );
      expect(flexBg.tagName).toBe('table');
      expect(flexBg.children[0].children.length).toBe(2);
      // grid + border → still no-op div until T4 (blockDiv must not hijack grid)
      const gridBd = transformLayoutTree(
        node('div', { attributes: {}, style: { display: 'grid', 'border-top-width': '1px', 'border-top-style': 'solid' } }, [
          node('div', { attributes: {}, style: {} }, [new VText('a')]),
        ])
      );
      expect(gridBd.tagName).toBe('div');
    });

    test('does not mutate original', () => {
      const child = node('strong', { attributes: {}, style: {} }, [new VText('t')]);
      const tree = divNode({ 'background-color': '#1a5276' }, [child]);
      transformLayoutTree(tree);
      expect(tree.tagName).toBe('div');
      expect(tree.children[0]).toBe(child);
    });
  });

  describe('gridToTable (T4) — grid → table', () => {
    const cell = (text) => node('div', { attributes: {}, style: {} }, [new VText(text)]);
    const gridNode = (cols, children, extra) =>
      node('div', { attributes: {}, style: { display: 'grid', 'grid-template-columns': cols, ...extra } }, children);

    test('2 cols, 2 children → 1 row of 2 cells; cell width = track', () => {
      const out = transformLayoutTree(gridNode('350.5px 350.5px', [cell('발주처'), cell('공급처')]));
      expect(out.tagName).toBe('table');
      expect(out.children.length).toBe(1);
      const tr = out.children[0];
      expect(tr.tagName).toBe('tr');
      expect(tr.children.length).toBe(2);
      expect(tr.children.every((td) => td.tagName === 'td')).toBe(true);
      expect(tr.children[0].properties.style.width).toBe('350.5px');
    });

    test('2 cols, 3 children → 2 rows; last row padded with empty td', () => {
      const out = transformLayoutTree(gridNode('100px 100px', [cell('a'), cell('b'), cell('c')]));
      expect(out.children.length).toBe(2);
      expect(out.children[0].children.length).toBe(2);
      expect(out.children[1].children.length).toBe(2); // padded to colCount
      expect(out.children[1].children[1].children.length).toBe(0); // empty td
    });

    test('blank VText between children ignored (F-H1)', () => {
      const out = transformLayoutTree(gridNode('100px 100px', [cell('a'), new VText('\n  '), cell('b')]));
      expect(out.children.length).toBe(1);
      expect(out.children[0].children.length).toBe(2);
    });

    test('1fr 1fr + 3 children → padded td and fr cells carry no width (F-H2)', () => {
      const out = transformLayoutTree(gridNode('1fr 1fr', [cell('a'), cell('b'), cell('c')]));
      expect(out.children.length).toBe(2);
      const padTd = out.children[1].children[1];
      expect(padTd.children.length).toBe(0);
      expect(padTd.properties.style.width).toBeUndefined(); // 1fr is not absolute
      expect(out.children[0].children[0].properties.style.width).toBeUndefined();
    });

    test('single column → one row per child', () => {
      const out = transformLayoutTree(gridNode('200px', [cell('a'), cell('b')]));
      expect(out.children.length).toBe(2);
      expect(out.children[0].children.length).toBe(1);
    });

    test('repeat() or missing tracks → no-op (stays div)', () => {
      expect(transformLayoutTree(gridNode('repeat(2, 1fr)', [cell('a'), cell('b')])).tagName).toBe('div');
      expect(
        transformLayoutTree(node('div', { attributes: {}, style: { display: 'grid' } }, [cell('a')])).tagName
      ).toBe('div');
    });

    test('grid child that becomes a table (T5 box) nests inside the cell', () => {
      const out = transformLayoutTree(
        gridNode('100px 100px', [
          node('div', { attributes: {}, style: { 'border-top-width': '1px', 'border-top-style': 'solid' } }, [new VText('box1')]),
          node('div', { attributes: {}, style: { 'border-top-width': '1px', 'border-top-style': 'solid' } }, [new VText('box2')]),
        ])
      );
      expect(out.tagName).toBe('table');
      expect(out.children[0].children[0].children[0].tagName).toBe('table'); // nested T5 box
    });

    test('non-grid div → no-op; td with display:grid NOT converted (whitelist guard)', () => {
      expect(transformLayoutTree(node('div', { attributes: {}, style: {} }, [cell('a')])).tagName).toBe('div');
      const tdGrid = transformLayoutTree(
        node('td', { attributes: {}, style: { display: 'grid', 'grid-template-columns': '100px 100px' } }, [cell('a'), cell('b')])
      );
      expect(tdGrid.tagName).toBe('td');
    });

    test('does not mutate the original grid tree', () => {
      const child = cell('a');
      const tree = gridNode('100px 100px', [child, cell('b')]);
      transformLayoutTree(tree);
      expect(tree.tagName).toBe('div');
      expect(tree.children[0]).toBe(child);
    });
  });
});
