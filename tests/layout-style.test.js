// Unit tests for layout-style — pure CSS layout-style parsers (T1, docx-convert-xku.1)
// These parsers extract flex/grid layout meaning from a parsed inline-style object
// (the shape produced by html-parser.js `parseStyles`). No VTree/OOXML knowledge.

import {
  getDisplay,
  isFlexContainer,
  isGridContainer,
  getFlexDirection,
  parseGridTemplateColumns,
  getGap,
  getAlignItems,
  getJustifyContent,
} from '../src/utils/layout-style.js';

describe('layout-style parsers', () => {
  describe('getDisplay', () => {
    test('returns the display value trimmed', () => {
      expect(getDisplay({ display: 'flex' })).toBe('flex');
      expect(getDisplay({ display: '  grid ' })).toBe('grid');
    });
    test('returns empty string when absent or invalid input', () => {
      expect(getDisplay({})).toBe('');
      expect(getDisplay(undefined)).toBe('');
      expect(getDisplay(null)).toBe('');
    });
  });

  describe('isFlexContainer', () => {
    test('true for flex / inline-flex', () => {
      expect(isFlexContainer({ display: 'flex' })).toBe(true);
      expect(isFlexContainer({ display: 'inline-flex' })).toBe(true);
    });
    test('false otherwise', () => {
      expect(isFlexContainer({ display: 'grid' })).toBe(false);
      expect(isFlexContainer({ display: 'block' })).toBe(false);
      expect(isFlexContainer({})).toBe(false);
    });
  });

  describe('isGridContainer', () => {
    test('true for grid / inline-grid', () => {
      expect(isGridContainer({ display: 'grid' })).toBe(true);
      expect(isGridContainer({ display: 'inline-grid' })).toBe(true);
    });
    test('false otherwise', () => {
      expect(isGridContainer({ display: 'flex' })).toBe(false);
      expect(isGridContainer({})).toBe(false);
    });
  });

  describe('getFlexDirection', () => {
    test('returns explicit direction', () => {
      expect(getFlexDirection({ 'flex-direction': 'column' })).toBe('column');
      expect(getFlexDirection({ 'flex-direction': 'row' })).toBe('row');
    });
    test('defaults to row', () => {
      expect(getFlexDirection({})).toBe('row');
      expect(getFlexDirection(undefined)).toBe('row');
    });
  });

  describe('parseGridTemplateColumns', () => {
    test('splits track list on whitespace', () => {
      expect(parseGridTemplateColumns({ 'grid-template-columns': '350.5px 350.5px' })).toEqual([
        '350.5px',
        '350.5px',
      ]);
      expect(parseGridTemplateColumns({ 'grid-template-columns': '1fr  2fr   100px' })).toEqual([
        '1fr',
        '2fr',
        '100px',
      ]);
    });
    test('returns empty array when absent', () => {
      expect(parseGridTemplateColumns({})).toEqual([]);
      expect(parseGridTemplateColumns(undefined)).toEqual([]);
    });
    test('T1 does not expand repeat() — returns raw tokens', () => {
      // repeat() expansion is deferred to T4; T1 just tokenizes.
      expect(parseGridTemplateColumns({ 'grid-template-columns': 'repeat(2, 1fr)' })).toEqual([
        'repeat(2,',
        '1fr)',
      ]);
    });
  });

  describe('getGap', () => {
    test('gap shorthand applies to both axes', () => {
      expect(getGap({ gap: '9px' })).toEqual({ row: '9px', column: '9px' });
    });
    test('two-value gap is row then column', () => {
      expect(getGap({ gap: '9px 18px' })).toEqual({ row: '9px', column: '18px' });
    });
    test('row-gap / column-gap override', () => {
      expect(getGap({ 'row-gap': '4px', 'column-gap': '8px' })).toEqual({
        row: '4px',
        column: '8px',
      });
    });
    test('returns nulls when absent', () => {
      expect(getGap({})).toEqual({ row: null, column: null });
      expect(getGap(undefined)).toEqual({ row: null, column: null });
    });
  });

  describe('getAlignItems / getJustifyContent', () => {
    test('returns explicit values', () => {
      expect(getAlignItems({ 'align-items': 'flex-end' })).toBe('flex-end');
      expect(getJustifyContent({ 'justify-content': 'space-between' })).toBe('space-between');
    });
    test('returns null when absent', () => {
      expect(getAlignItems({})).toBeNull();
      expect(getJustifyContent(undefined)).toBeNull();
    });
  });
});
