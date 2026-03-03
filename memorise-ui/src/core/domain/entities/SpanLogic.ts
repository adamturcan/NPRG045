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
  },

  syncLiveCoords: (
    spans: NerSpan[], 
    liveCoords: Map<string, { start: number; end: number }>, 
    shiftOffset: number, 
    shiftedSet: Set<string>
  ): NerSpan[] => {
    return spans.map((s) => {
      const id = s.id ?? `span-${s.start}-${s.end}-${s.entity}`;
      const coords = liveCoords.get(id);
      if (coords) {
        shiftedSet.add(id); 
        const globalStart = coords.start + shiftOffset;
        const globalEnd = coords.end + shiftOffset;
        if (s.start !== globalStart || s.end !== globalEnd) {
          return { ...s, start: globalStart, end: globalEnd, id };
        }
      }
      return { ...s, id };
    });
  },

  shiftSpansAfterEdit: (
    spans: NerSpan[], 
    editEndIndex: number, 
    lengthDiff: number, 
    shiftedSet: Set<string>
  ): NerSpan[] => {
    if (lengthDiff === 0) return spans;
    return spans.map(s => {
      const id = s.id ?? `span-${s.start}-${s.end}-${s.entity}`;
      if (shiftedSet.has(id)) return s; 
      
      let newStart = s.start; 
      let newEnd = s.end;
      if (s.start >= editEndIndex) newStart += lengthDiff;
      if (s.end >= editEndIndex) newEnd += lengthDiff;
      
      if (newStart !== s.start || newEnd !== s.end) return { ...s, start: newStart, end: newEnd };
      return s;
    });
  }
};