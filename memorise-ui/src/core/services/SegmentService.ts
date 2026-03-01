import type { Segment } from "../../types/Segment";

/**
 * SegmentService - Pure TypeScript service for segment mathematics
 * * This service provides framework-agnostic, pure functions for manipulating
 * text segments. All operations preserve segment translations and handle
 * border spaces between segments correctly.
 * * Core responsibilities:
 * - Shift segment indices when text is inserted/deleted
 * - Join two consecutive segments (merging text and translations)
 * - Split a segment at a position
 * * @remarks
 * This is a Core layer service with no dependencies on React, Zustand, or any
 * presentation/infrastructure concerns. All methods are static and side-effect free.
 */
export class SegmentService {
  /**
   * Shifts segments that come after a text change position
   */
  static shiftSegments(
    segments: Segment[],
    changeIndex: number,
    lengthDiff: number
  ): Segment[] {
    if (lengthDiff === 0) {
      return segments;
    }

    return segments.map((segment) => {
      if (segment.start > changeIndex) {
        return {
          ...segment,
          start: segment.start + lengthDiff,
          end: segment.end + lengthDiff,
        };
      }
      return segment;
    });
  }

  /**
   * Updates segment indices when a specific segment's text is edited
   */
  static updateSegmentAndShift(
    segments: Segment[],
    editedSegmentId: string,
    newSegmentEnd: number,
    lengthDiff: number,
    oldSegmentEnd: number
  ): Segment[] {
    if (lengthDiff === 0) {
      return segments.map(s => 
        s.id === editedSegmentId ? { ...s, end: newSegmentEnd } : s
      );
    }

    return segments.map((segment) => {
      if (segment.id === editedSegmentId) {
        return { ...segment, end: newSegmentEnd };
      }

      if (segment.start > oldSegmentEnd) {
        return {
          ...segment,
          start: segment.start + lengthDiff,
          end: segment.end + lengthDiff,
        };
      }

      if (segment.start === oldSegmentEnd) {
        return {
          ...segment,
          start: newSegmentEnd + 1, 
          end: segment.end + lengthDiff,
        };
      }

      return segment;
    });
  }

  /**
   * Joins two consecutive segments into one
   */
  static joinSegments(
    segments: Segment[],
    id1: string,
    id2: string,    
  ): Segment[] | null {
    const segment1 = segments.find((s) => s.id === id1);
    const segment2 = segments.find((s) => s.id === id2);

    if (!segment1 || !segment2) {
      return null; 
    }

    const isConsecutive =
      segment1.end === segment2.start ||
      segment1.end + 1 === segment2.start ||
      (segment1.end < segment2.start && segment2.start - segment1.end <= 1);

    if (!isConsecutive) {
      return null; 
    }

    const mergedTranslations = this.mergeTranslations(
      segment1.translations,
      segment2.translations
    );

    const joinedSegment: Segment = {
      id: id1, 
      start: segment1.start,
      end: segment2.end,
      order: segment1.order, 
      text: segment1.text + (segment1.end < segment2.start ? " " : "") + segment2.text, // Add space back if gap existed
      translations: mergedTranslations,
    };

    const updatedSegments = segments
      .filter((s) => s.id !== id2)
      .map((s) => (s.id === id1 ? joinedSegment : s))
      .sort((a, b) => a.start - b.start)
      .map((s, index) => ({ ...s, order: index }));

    return updatedSegments;
  }

  
  static splitSegment(
    segments: Segment[],
    toSplitId: string,
    position: number, // Absolute index in the document
    fullText: string  // Required to check for the space character
  ): Segment[] | null {
    
    const segmentIndex = segments.findIndex(s => s.id === toSplitId);
    if (segmentIndex === -1) {
      throw new Error("Segment not found");
    }
    
    const toSplit = segments[segmentIndex];

    // Validate bounds
    if (position <= toSplit.start || position >= toSplit.end) {
      return null;
    }

    const isSpace = fullText[position] === " " || fullText[position] === "\n";

    // Convert absolute position to relative for substring slicing
    const relativePos = position - toSplit.start;

    const firstSegment: Segment = {
      id: toSplit.id, 
      start: toSplit.start,
      end: position,
      order: toSplit.order,
      text: toSplit.text.substring(0, relativePos),
      translations: undefined, 
    };

    const newStartPos = isSpace ? position + 1 : position;
    const secondRelativePos = isSpace ? relativePos + 1 : relativePos;

    const secondSegment: Segment = {
      id: `seg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 
      start: newStartPos,
      end: toSplit.end,
      order: toSplit.order + 1, 
      text: toSplit.text.substring(secondRelativePos),      
      translations: undefined,
    };

    // Replace the original segment with two new segments and recalculate order
    const updatedSegments = [
      ...segments.slice(0, segmentIndex),
      firstSegment,
      secondSegment,
      ...segments.slice(segmentIndex + 1),
    ].map((s, index) => ({
      ...s,
      order: index,
    }));

    return updatedSegments;
  }

  /**
   * Merges translation records from two segments
   */
  private static mergeTranslations(
    translations1: Record<string, string> | undefined,
    translations2: Record<string, string> | undefined
  ): Record<string, string> | undefined {
    if (!translations1 && !translations2) {
      return undefined;
    }

    const merged: Record<string, string> = {};
    const languages = new Set([
      ...Object.keys(translations1 || {}),
      ...Object.keys(translations2 || {}),
    ]);

    for (const lang of languages) {
      const trans1 = translations1?.[lang] || "";
      const trans2 = translations2?.[lang] || "";
      merged[lang] = trans1 + (trans1 && trans2 ? " " : "") + trans2;
    }

    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  /**
   * Validates that segments are properly ordered and non-overlapping
   */
  static validateSegments(segments: Segment[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!segments || segments.length === 0) {
      return { valid: true, errors: [] };
    }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.start >= seg.end) {
        errors.push(`Segment ${seg.id} has invalid range: start=${seg.start} >= end=${seg.end}`);
      }
      if (seg.order !== i) {
        errors.push(`Segment ${seg.id} has incorrect order: expected=${i}, actual=${seg.order}`);
      }
    }

    for (let i = 0; i < segments.length - 1; i++) {
      const current = segments[i];
      const next = segments[i + 1];

      if (current.start > next.start) {
        errors.push(`Segments not sorted: ${current.id} comes before ${next.id}`);
      }

      const expectedNextStart = current.end === next.start ? current.end : current.end + 1;
      if (next.start < current.end) {
        errors.push(`Segments overlap: ${current.id} overlaps ${next.id}`);
      } else if (next.start !== expectedNextStart) {
        errors.push(`Unexpected gap/overlap: ${current.id} ends at ${current.end}, ${next.id} starts at ${next.start} (expected ${expectedNextStart})`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}