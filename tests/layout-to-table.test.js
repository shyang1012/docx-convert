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

    test('grid container is preserved — NOT converted until T4', () => {
      const tree = node(
        'div',
        { attributes: {}, style: { display: 'grid', 'grid-template-columns': '1fr 1fr' } },
        [node('div', { attributes: {} }, [new VText('a')])]
      );
      const out = transformLayoutTree(tree);
      expect(out.tagName).toBe('div');
      expect(out.children[0].tagName).toBe('div');
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
});
