import { describe, it, expect } from 'vitest';
import { Annotation } from '../Annotation';
import type { NerSpan } from '../../types/NotationEditor';

describe('Annotation Domain Model', () => {
  describe('Constructor', () => {
    it('should create an annotation with valid parameters', () => {
      const annotation = new Annotation(0, 10, 'PERSON');

      expect(annotation.start).toBe(0);
      expect(annotation.end).toBe(10);
      expect(annotation.entity).toBe('PERSON');
      expect(annotation.score).toBeUndefined();
    });

    it('should create an annotation with score', () => {
      const annotation = new Annotation(5, 15, 'LOCATION', 0.95);

      expect(annotation.start).toBe(5);
      expect(annotation.end).toBe(15);
      expect(annotation.entity).toBe('LOCATION');
      expect(annotation.score).toBe(0.95);
    });

    it('should throw error if start position is negative', () => {
      expect(() => new Annotation(-1, 10, 'PERSON')).toThrow(
        'Annotation start position must be non-negative'
      );
    });

    it('should throw error if end position equals start position', () => {
      expect(() => new Annotation(5, 5, 'PERSON')).toThrow(
        'Annotation end position must be greater than start position'
      );
    });

    it('should throw error if end position is less than start position', () => {
      expect(() => new Annotation(10, 5, 'PERSON')).toThrow(
        'Annotation end position must be greater than start position'
      );
    });

    it('should throw error if entity is empty string', () => {
      expect(() => new Annotation(0, 10, '')).toThrow(
        'Annotation entity type is required'
      );
    });

    it('should throw error if entity is only whitespace', () => {
      expect(() => new Annotation(0, 10, '   ')).toThrow(
        'Annotation entity type is required'
      );
    });

    it('should accept entity with leading/trailing whitespace (not trimmed)', () => {
      // The constructor doesn't trim, it just validates non-empty after trim
      // This test ensures it accepts strings that aren't purely whitespace
      const annotation = new Annotation(0, 10, ' PERSON ');
      expect(annotation.entity).toBe(' PERSON ');
    });
  });

  describe('fromSpan', () => {
    it('should create annotation from NerSpan with score', () => {
      const span: NerSpan = {
        start: 10,
        end: 20,
        entity: 'ORGANIZATION',
        score: 0.88,
      };

      const annotation = Annotation.fromSpan(span);

      expect(annotation.start).toBe(10);
      expect(annotation.end).toBe(20);
      expect(annotation.entity).toBe('ORGANIZATION');
      expect(annotation.score).toBe(0.88);
    });

    it('should create annotation from NerSpan without score', () => {
      const span: NerSpan = {
        start: 0,
        end: 5,
        entity: 'DATE',
      };

      const annotation = Annotation.fromSpan(span);

      expect(annotation.start).toBe(0);
      expect(annotation.end).toBe(5);
      expect(annotation.entity).toBe('DATE');
      expect(annotation.score).toBeUndefined();
    });

    it('should throw validation errors from constructor', () => {
      const invalidSpan: NerSpan = {
        start: 10,
        end: 5,
        entity: 'PERSON',
      };

      expect(() => Annotation.fromSpan(invalidSpan)).toThrow(
        'Annotation end position must be greater than start position'
      );
    });
  });

  describe('overlapsWith', () => {
    it('should detect overlapping annotations - partial overlap at start', () => {
      const ann1 = new Annotation(0, 10, 'PERSON');
      const ann2 = new Annotation(5, 15, 'LOCATION');

      expect(ann1.overlapsWith(ann2)).toBe(true);
      expect(ann2.overlapsWith(ann1)).toBe(true); // Symmetric
    });

    it('should detect overlapping annotations - one contains another', () => {
      const outer = new Annotation(0, 20, 'PERSON');
      const inner = new Annotation(5, 10, 'LOCATION');

      expect(outer.overlapsWith(inner)).toBe(true);
      expect(inner.overlapsWith(outer)).toBe(true);
    });

    it('should detect overlapping annotations - partial overlap at end', () => {
      const ann1 = new Annotation(10, 20, 'PERSON');
      const ann2 = new Annotation(5, 15, 'LOCATION');

      expect(ann1.overlapsWith(ann2)).toBe(true);
      expect(ann2.overlapsWith(ann1)).toBe(true);
    });

    it('should detect no overlap when annotations are adjacent', () => {
      const ann1 = new Annotation(0, 10, 'PERSON');
      const ann2 = new Annotation(10, 20, 'LOCATION');

      expect(ann1.overlapsWith(ann2)).toBe(false);
      expect(ann2.overlapsWith(ann1)).toBe(false);
    });

    it('should detect no overlap when annotations are separated', () => {
      const ann1 = new Annotation(0, 10, 'PERSON');
      const ann2 = new Annotation(15, 25, 'LOCATION');

      expect(ann1.overlapsWith(ann2)).toBe(false);
      expect(ann2.overlapsWith(ann1)).toBe(false);
    });

    it('should detect no overlap when second starts after first ends', () => {
      const ann1 = new Annotation(0, 5, 'PERSON');
      const ann2 = new Annotation(20, 25, 'LOCATION');

      expect(ann1.overlapsWith(ann2)).toBe(false);
    });

    it('should work with same position annotations', () => {
      const ann1 = new Annotation(5, 10, 'PERSON');
      const ann2 = new Annotation(5, 10, 'LOCATION');

      expect(ann1.overlapsWith(ann2)).toBe(true);
    });
  });

  describe('toSpan', () => {
    it('should convert annotation to NerSpan with score', () => {
      const annotation = new Annotation(15, 25, 'GPE', 0.92);
      const span = annotation.toSpan();

      expect(span).toEqual({
        start: 15,
        end: 25,
        entity: 'GPE',
        score: 0.92,
      });
    });

    it('should convert annotation to NerSpan without score', () => {
      const annotation = new Annotation(0, 8, 'PRODUCT');
      const span = annotation.toSpan();

      expect(span).toEqual({
        start: 0,
        end: 8,
        entity: 'PRODUCT',
        score: undefined,
      });
    });

    it('should create a round-trip conversion', () => {
      const originalSpan: NerSpan = {
        start: 100,
        end: 150,
        entity: 'EVENT',
        score: 0.75,
      };

      const annotation = Annotation.fromSpan(originalSpan);
      const resultSpan = annotation.toSpan();

      expect(resultSpan).toEqual(originalSpan);
    });
  });

  describe('Integration - fromSpan and toSpan', () => {
    it('should maintain data integrity through conversion cycle', () => {
      const spans: NerSpan[] = [
        { start: 0, end: 5, entity: 'PERSON', score: 0.99 },
        { start: 10, end: 15, entity: 'LOCATION' },
        { start: 20, end: 30, entity: 'ORG', score: 0.5 },
      ];

      spans.forEach(originalSpan => {
        const annotation = Annotation.fromSpan(originalSpan);
        const convertedSpan = annotation.toSpan();
        expect(convertedSpan).toEqual(originalSpan);
      });
    });
  });
});

