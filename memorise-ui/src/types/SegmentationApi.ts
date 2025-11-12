/**
 * Types for the Segmentation API integration
 */

/**
 * Request format for segmentation API
 */
export type SegmentationApiRequest = {
  text: string;
};

/**
 * Response format from segmentation API
 */
export type SegmentationApiResponse = {
  results: Array<{
    label: number;        // Segment order/index (0-indexed)
    score: number;        // Confidence score (currently always 0)
    sentence_text: string; // The segment text
  }>;
};

