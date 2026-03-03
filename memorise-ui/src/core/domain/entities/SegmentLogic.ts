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
  },

  calculateVirtualBoundaries: (
    masterSegments: Segment[], 
    segmentTranslations: Record<string, string>
  ): Segment[] => {
    let currentOffset = 0;
    
    return masterSegments.map(seg => {
       const translatedText = segmentTranslations[seg.id] || "";
       const start = currentOffset;
       const end = start + translatedText.length;
       currentOffset = end; 
       return { ...seg, start, end, text: translatedText };
    });
  }

};