/**
 * Segment type representing a text segment from the segmentation API
 * Each segment can have its own translations for different languages
 * 
 * Indices (start/end) are the source of truth. Text is derived from indices when needed.
 */
export type Segment = {
  id: string;           // Unique identifier: "seg-0", "seg-1", etc.
  start: number;        // Global offset start in text (includes border spaces)
  end: number;          // Global offset end in text (includes border spaces)
  text?: string;        // Segment text content (optional, derived from indices when needed)
  order: number;        // Display order (from API label)
  translations?: {      // Per-segment translations: language code → translated text
    [languageCode: string]: string;
  };
};

/**
 * Derives segment text from indices using the full text
 */
export function getSegmentText(segment: Segment, fullText: string): string {
  return fullText.substring(segment.start, segment.end);
}

