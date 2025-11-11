import { describe, it, expect } from 'vitest';
import { Annotation } from '../Annotation';
import type { NerSpan } from '../../../types/NotationEditor';

describe('Annotation entity', () => {
  it('creates annotation via factory', () => {
    const annotation = Annotation.create({ start: 0, end: 10, entity: 'PERSON' });
    expect(annotation.start).toBe(0);
    expect(annotation.end).toBe(10);
    expect(annotation.entity).toBe('PERSON');
    expect(annotation.score).toBeUndefined();
  });

  it('trims entity value', () => {
    const annotation = Annotation.create({ start: 0, end: 1, entity: ' PERSON ' });
    expect(annotation.entity).toBe('PERSON');
  });

  it('validates boundaries', () => {
    expect(() => Annotation.create({ start: -1, end: 1, entity: 'PERSON' })).toThrow(
      'Annotation start position must be non-negative'
    );
    expect(() => Annotation.create({ start: 1, end: 1, entity: 'PERSON' })).toThrow(
      'Annotation end position must be greater than start position'
    );
    expect(() => Annotation.create({ start: 1, end: 2, entity: '' })).toThrow(
      'Annotation entity type is required'
    );
  });

  it('supports spans with scores', () => {
    const annotation = Annotation.create({ start: 2, end: 5, entity: 'ORG', score: 0.8 });
    expect(annotation.score).toBe(0.8);
  });

  it('converts to and from NerSpan', () => {
    const span: NerSpan = { start: 4, end: 6, entity: 'DATE', score: 0.5 };
    const entity = Annotation.fromSpan(span);
    expect(entity.toSpan()).toEqual(span);
  });

  it('detects overlaps', () => {
    const a = Annotation.create({ start: 0, end: 3, entity: 'A' });
    const b = Annotation.create({ start: 2, end: 5, entity: 'B' });
    const c = Annotation.create({ start: 5, end: 7, entity: 'C' });

    expect(a.overlapsWith(b)).toBe(true);
    expect(a.overlapsWith(c)).toBe(false);
  });
});


