import { errorHandlingService } from './ErrorHandlingService';
import type { SegmentationApiRequest, SegmentationApiResponse } from '../../types/SegmentationApi';
import type { Segment } from '../../types/Segment';

/**
 * Service for interacting with the segmentation API.
 * 
 * Segments text into sentences/paragraphs using the external segmentation API.
 */
export class SegmentationApiService {
  private readonly baseUrl = 'https://textseg-api.dev.memorise.sdu.dk/segment';

  /**
   * Segments text using the segmentation API.
   * 
   * @param text - The text to segment
   * @returns Array of segments with calculated offsets
   * @throws AppError if API call fails
   */
  async segmentText(text: string): Promise<Segment[]> {
    if (!text || text.trim().length === 0) {
      return [];
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text } as SegmentationApiRequest),
      });

      if (!response.ok) {
        throw errorHandlingService.handleApiError(response, {
          operation: 'segment text',
          service: 'SegmentationApiService',
          layer: 'api-service',
        });
      }

      const data = (await response.json()) as SegmentationApiResponse;
      return this.mapResponseToSegments(data, text);
    } catch (error) {
      throw errorHandlingService.handleApiError(error, {
        operation: 'segment text',
        service: 'SegmentationApiService',
        layer: 'api-service',
      });
    }
  }

  /**
   * Maps API response to Segment entities with calculated offsets.
   * 
   * Calculates start/end offsets by finding each segment text in the original text,
   * starting from the previous segment's end position. This handles whitespace
   * between segments and ensures segments are found in order.
   * 
   * @param response - API response containing segment results
   * @param originalText - The original text that was segmented
   * @returns Array of Segment entities with calculated offsets
   */
  private mapResponseToSegments(
    response: SegmentationApiResponse,
    originalText: string
  ): Segment[] {
    if (!response.results || response.results.length === 0) {
      return [];
    }

    const segments: Segment[] = [];
    let searchStart = 0; // Start searching from this position in original text

    for (let i = 0; i < response.results.length; i++) {
      const result = response.results[i];
      const segmentText = result.sentence_text;

      // Find the segment text in the original text, starting from searchStart
      const segmentStart = originalText.indexOf(segmentText, searchStart);

      if (segmentStart === -1) {
        // Segment text not found - this shouldn't happen, but handle gracefully
        // Try finding it anywhere in the text as fallback
        const fallbackStart = originalText.indexOf(segmentText);
        if (fallbackStart === -1) {
          // Still not found - skip this segment
          console.warn(
            `Segment ${i} text not found in original text. Skipping.`,
            { segmentText: segmentText.substring(0, 50) }
          );
          continue;
        }
        // Use fallback position
        const segmentEnd = fallbackStart + segmentText.length;
        segments.push({
          id: `seg-${i}`,
          start: fallbackStart,
          end: segmentEnd,
          order: result.label,
        });
        searchStart = segmentEnd;
      } else {
        // Found segment - calculate end position
        const segmentEnd = segmentStart + segmentText.length;
        segments.push({
          id: `seg-${i}`,
          start: segmentStart,
          end: segmentEnd,
          order: result.label,
        });
        // Next search starts after this segment
        searchStart = segmentEnd;
      }
    }

    return segments;
  }

  /**
   * Inserts border spaces between segments and adjusts segment indices.
   * 
   * Border spaces are inserted at segment.end positions (except for last segment).
   * After insertion, segment.end points to the end of the segment text,
   * and the border space is at position segment.end.
   * 
   * @param segments - Segments with original indices
   * @param text - Original text
   * @returns Object with modified text (with border spaces) and adjusted segments
   */
  insertBorderSpaces(segments: Segment[], text: string): { text: string; segments: Segment[] } {
    if (segments.length === 0) {
      return { text, segments: [] };
    }

    // Sort segments by start position
    const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
    
    // Build new text with border spaces between segments sequentially
    // Segments from API are consecutive (no gaps), so we build text in order
    let newText = '';
    const adjustedSegments: Segment[] = [];

    for (let i = 0; i < sortedSegments.length; i++) {
      const segment = sortedSegments[i];
      
      // Segment start is the current position in newText (after previous segments and border spaces)
      const segmentStart = newText.length;
      
      // Add segment text from original text
      const segmentText = text.substring(segment.start, segment.end);
      newText += segmentText;
      
      // Segment end is at the end of the segment text (before border space)
      const segmentEnd = newText.length;
      
      // Add border space after every segment EXCEPT the last one
      // This prevents a trailing space at the end of the document
      // Border space is at position segmentEnd in the new text
      if (i < sortedSegments.length - 1) {
        newText += ' ';
      }
      // Next segment will start at segmentEnd + 1 (after the border space)
      
      // Create adjusted segment with new indices
      // Note: segment.end points to the end of segment text, border space is at segment.end (if present)
      adjustedSegments.push({
        ...segment,
        start: segmentStart,
        end: segmentEnd,
      });
    }

    return { text: newText, segments: adjustedSegments };
  }
}

