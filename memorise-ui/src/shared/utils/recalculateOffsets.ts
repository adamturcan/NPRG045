/**
 * Utility to recalculate span/segment offsets from text content
 * Used when undo/redo is detected to fix offset desynchronization
 */

type OffsetRange = {
  start: number;
  end: number;
  [key: string]: unknown; // Allow additional properties
};

/**
 * Recalculates offsets by finding the original text content in the new text
 * @param ranges - Array of ranges with start/end offsets
 * @param oldText - Previous text content
 * @param newText - Current text content
 * @returns Recalculated ranges with updated offsets
 */
export function recalculateOffsetsFromText<T extends OffsetRange>(
  ranges: T[],
  oldText: string,
  newText: string
): T[] {
  // If texts are identical, no recalculation needed
  if (oldText === newText) {
    return ranges;
  }

  const lengthDiff = Math.abs(newText.length - oldText.length);

  console.debug("[RecalculateOffsets] Large text change detected, recalculating", {
    oldLength: oldText.length,
    newLength: newText.length,
    diff: lengthDiff,
    rangeCount: ranges.length,
  });

  const recalculated: T[] = [];
  
  for (const range of ranges) {
    // Extract the text that this range should cover
    const rangeText = oldText.substring(range.start, range.end);
    if (!rangeText || rangeText.length === 0) {
      // Empty range or out of bounds - skip it
      continue;
    }

    // Find this text in the new document
    // Try near the original position first (for small edits)
    const searchRadius = Math.max(100, lengthDiff * 2); // Search radius based on change size
    const searchStart = Math.max(0, range.start - searchRadius);
    const searchEnd = Math.min(newText.length, range.end + searchRadius);
    const searchText = newText.substring(searchStart, searchEnd);
    
    // Try to find the exact text
    let foundIndex = searchText.indexOf(rangeText);
    
    // If not found, try a more lenient search (ignore whitespace differences)
    if (foundIndex === -1) {
      const normalizedRangeText = rangeText.trim();
      if (normalizedRangeText.length > 0) {
        // Search in a wider area
        const widerStart = Math.max(0, range.start - searchRadius * 2);
        const widerEnd = Math.min(newText.length, range.end + searchRadius * 2);
        const widerSearchText = newText.substring(widerStart, widerEnd);
        const normalizedSearchText = widerSearchText.replace(/\s+/g, ' ');
        const normalizedSearch = normalizedSearchText.indexOf(normalizedRangeText);
        
        if (normalizedSearch !== -1) {
          // Found in normalized text, approximate the position
          foundIndex = widerStart + normalizedSearch;
        }
      }
    }
    
    if (foundIndex !== -1) {
      const newStart = searchStart + foundIndex;
      const newEnd = newStart + rangeText.length;
      
      // Validate the new range
      if (newStart >= 0 && newEnd <= newText.length && newEnd > newStart) {
        recalculated.push({
          ...range,
          start: newStart,
          end: newEnd,
        });
      } else {
        console.debug("[RecalculateOffsets] Invalid calculated range, skipping", {
          range,
          newStart,
          newEnd,
          newTextLength: newText.length,
        });
      }
    } else {
      // Text not found - range might have been deleted, skip it
      console.debug("[RecalculateOffsets] Range text not found in new text, skipping", {
        range,
        rangeText: rangeText.substring(0, 50),
        searchStart,
        searchEnd,
      });
    }
  }

  console.debug("[RecalculateOffsets] Recalculation complete", {
    originalCount: ranges.length,
    recalculatedCount: recalculated.length,
    lost: ranges.length - recalculated.length,
  });

  return recalculated;
}

