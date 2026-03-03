import type { Segment } from "../../../types/Segment";

export const SegmentLogic = {

  calculateGlobalOffset: (
    targetSegmentId: string,
    segments: Segment[],
    segmentTranslations?: Record<string, string>
  ): number => {
    let currentOffset = 0;

    for (const seg of segments) {
      if (seg.id === targetSegmentId) {
        return currentOffset;
      }
      
      if (segmentTranslations) {
        currentOffset += (segmentTranslations[seg.id] || "").length;
      } else {
        currentOffset = seg.start; 
      }
    }

    return 0; 
  }
};