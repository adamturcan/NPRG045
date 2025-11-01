import type { NerSpan } from '../types/NotationEditor';

/**
 * Domain model for NER (Named Entity Recognition) annotations
 * 
 * Represents a text annotation span with validation and business logic.
 */
export class Annotation {
  start: number;
  end: number;
  entity: string;
  score?: number;

  constructor(start: number, end: number, entity: string, score?: number) {
    if (start < 0) {
      throw new Error('Annotation start position must be non-negative');
    }
    if (end <= start) {
      throw new Error('Annotation end position must be greater than start position');
    }
    if (!entity || entity.trim().length === 0) {
      throw new Error('Annotation entity type is required');
    }

    this.start = start;
    this.end = end;
    this.entity = entity;
    this.score = score;
  }

  /**
   * Create an Annotation from a NerSpan
   * @param span - The span to convert
   * @returns A new Annotation instance
   */
  static fromSpan(span: NerSpan): Annotation {
    return new Annotation(span.start, span.end, span.entity, span.score);
  }

  /**
   * Check if this annotation overlaps with another annotation
   * Two annotations overlap if their ranges intersect
   * @param other - The other annotation to check
   * @returns True if the annotations overlap
   */
  overlapsWith(other: Annotation): boolean {
    return !(this.end <= other.start || this.start >= other.end);
  }

  /**
   * Convert this annotation back to a NerSpan
   * @returns A NerSpan representation
   */
  toSpan(): NerSpan {
    return {
      start: this.start,
      end: this.end,
      entity: this.entity,
      score: this.score,
    };
  }
}

