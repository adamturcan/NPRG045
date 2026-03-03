import type { Segment } from "../../../types/Segment";

export const SegmentLogic = {

  calculateGlobalOffset: (
    segmentId: string, 
    segments: Segment[], 
    translations?: Record<string, string>
  ): number => {
    if (!translations) {
      const seg = segments.find(s => s.id === segmentId);
      return seg ? seg.start : 0;
    }

    let offset = 0;
    for (const s of segments) {
      if (s.id === segmentId) break;
      offset += (translations[s.id] || "").length;
    }
    return offset;
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