import type { NerSpan } from "../../../types/NotationEditor";
import type { Segment } from "../../../types/Segment";

export const SpanLogic = {
 
  projectSpansForView: (
    allSpans: NerSpan[],
    viewMode: string,
    activeTab: string,
    activeSegmentId?: string,
    activeSegment?: Segment | null,
    displaySegments: Segment[] = []
  ): NerSpan[] => {
    
    if (viewMode === "document") {
      if (activeSegmentId) return [];
      return allSpans;
    }

    if (!activeSegment || !activeSegmentId) return [];
    
    const segStart = activeTab === "original" 
      ? activeSegment.start 
      : (displaySegments.find(s => s.id === activeSegmentId)?.start || 0);
      
    const segEnd = activeTab === "original"
      ? activeSegment.end
      : (displaySegments.find(s => s.id === activeSegmentId)?.end || 0);

    return allSpans
      .filter((s) => s.start >= segStart && s.end <= segEnd)
      .map((s) => ({ 
        ...s, 
        start: s.start - segStart, 
        end: s.end - segStart 
      }));
  }
};