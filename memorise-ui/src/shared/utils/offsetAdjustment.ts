/**
 * Generic offset adjustment utilities for objects with start/end properties
 * Used by both nerSpan and segment adjustment logic
 */

type OffsetRange = {
  start: number;
  end: number;
};

/**
 * Adjusts ranges when text is inserted at a given position
 * @param ranges - Array of ranges to adjust
 * @param pos - Position where text is inserted
 * @param len - Length of inserted text
 * @returns New array with adjusted ranges
 */
export function adjustForInsert<T extends OffsetRange>(
  ranges: T[],
  pos: number,
  len: number
): T[] {
  return ranges.map((r) => {
    if (pos <= r.start) {
      // Insert before range → shift right
      return { ...r, start: r.start + len, end: r.end + len };
    }
    if (pos > r.start && pos < r.end) {
      // Insert inside range → range grows
      return { ...r, end: r.end + len };
    }
    // Insert after range → no change
    return r;
  });
}

/**
 * Adjusts ranges when text is deleted
 * @param ranges - Array of ranges to adjust
 * @param delStart - Start position of deletion
 * @param delLen - Length of deleted text
 * @returns New array with adjusted ranges (removes ranges that are fully deleted)
 */
export function adjustForDelete<T extends OffsetRange>(
  ranges: T[],
  delStart: number,
  delLen: number
): T[] {
  const delEnd = delStart + delLen;

  const next: T[] = [];
  for (const r of ranges) {
    // Deletion entirely before range
    if (delEnd <= r.start) {
      next.push({ ...r, start: r.start - delLen, end: r.end - delLen });
      continue;
    }

    // Deletion entirely after range
    if (delStart >= r.end) {
      next.push(r);
      continue;
    }

    // Overlap cases
    const overlapStart = Math.max(r.start, delStart);
    const overlapEnd = Math.min(r.end, delEnd);
    const removedInside = Math.max(0, overlapEnd - overlapStart);

    let newStart = r.start;
    let newEnd = r.end - removedInside;

    // If deletion starts before range, left edge shifts left by remaining part
    if (delStart < r.start) {
      const shift = Math.min(delLen, r.start - delStart);
      newStart = r.start - shift;
      newEnd = newEnd - shift;
    }

    // If range is fully removed, drop it
    if (newEnd <= newStart) continue;

    next.push({ ...r, start: newStart, end: newEnd });
  }
  return next;
}

