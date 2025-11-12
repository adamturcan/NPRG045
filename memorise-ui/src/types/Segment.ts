/**
 * Segment type representing a text segment from the segmentation API
 * Each segment can have its own translations for different languages
 */
export type Segment = {
  id: string;           // Unique identifier: "seg-0", "seg-1", etc.
  start: number;        // Global offset start in original text
  end: number;          // Global offset end in original text
  text: string;         // Segment text content
  order: number;        // Display order (from API label)
  translations?: {      // Per-segment translations: language code → translated text
    [languageCode: string]: string;
  };
};

