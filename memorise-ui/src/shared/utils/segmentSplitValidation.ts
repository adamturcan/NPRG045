/**
 * Utilities for validating segment split positions based on punctuation proximity
 */

/**
 * Punctuation characters that are valid split points
 */
export const VALID_SPLIT_PUNCTUATION = ['.', '!', '?', ',', ';', ':', '—', '–'];

/**
 * Check if a character is punctuation
 */
export function isPunctuation(char: string): boolean {
  return VALID_SPLIT_PUNCTUATION.includes(char);
}

/**
 * Maximum distance from punctuation to allow a split (in characters)
 */
const MAX_PUNCTUATION_DISTANCE = 5;

/**
 * Finds all punctuation positions in a text string
 * @param text - The text to search
 * @param startOffset - Optional offset to add to all positions (for segment-relative positions)
 * @returns Array of positions where punctuation occurs
 */
export function findPunctuationPositions(
  text: string,
  startOffset: number = 0
): number[] {
  const positions: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (VALID_SPLIT_PUNCTUATION.includes(text[i])) {
      positions.push(i + startOffset);
    }
  }
  return positions;
}

/**
 * Validates if a split position is near punctuation
 * @param position - The position to validate
 * @param text - The text containing the position
 * @param segmentStart - The start offset of the segment (for document-relative positions)
 * @returns Object with validation result and nearest punctuation info
 */
export function validateSplitPosition(
  position: number,
  text: string,
  segmentStart: number = 0
): {
  isValid: boolean;
  distance: number;
  nearestPunctuation?: number;
  punctuationChar?: string;
} {
  // Convert document position to segment-relative position
  const segmentRelativePos = position - segmentStart;
  
  // Check if position is within segment bounds
  if (segmentRelativePos < 0 || segmentRelativePos > text.length) {
    return {
      isValid: false,
      distance: Infinity,
    };
  }
  
  // Find all punctuation positions in the segment
  const punctuationPositions = findPunctuationPositions(text);
  
  if (punctuationPositions.length === 0) {
    // No punctuation in segment - allow split anywhere (edge case)
    return {
      isValid: true,
      distance: 0,
    };
  }
  
  // Find nearest punctuation
  let nearestPos = punctuationPositions[0];
  let minDistance = Math.abs(segmentRelativePos - nearestPos);
  
  for (const pos of punctuationPositions) {
    const distance = Math.abs(segmentRelativePos - pos);
    if (distance < minDistance) {
      minDistance = distance;
      nearestPos = pos;
    }
  }
  
  const isValid = minDistance <= MAX_PUNCTUATION_DISTANCE;
  const punctuationChar = text[nearestPos];
  
  return {
    isValid,
    distance: minDistance,
    nearestPunctuation: nearestPos + segmentStart, // Convert back to document position
    punctuationChar,
  };
}

/**
 * Gets all valid split positions (punctuation positions) in a segment
 * @param text - The segment text
 * @param segmentStart - The start offset of the segment in the document
 * @returns Array of valid split positions (document-relative)
 */
export function getValidSplitPositions(
  text: string,
  segmentStart: number = 0
): Array<{ position: number; char: string }> {
  const positions = findPunctuationPositions(text);
  return positions.map((pos) => ({
    position: pos + segmentStart,
    char: text[pos],
  }));
}

