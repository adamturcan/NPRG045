
import { useCallback } from "react";
import { Text, type NodeEntry, type BaseRange } from "slate";
import type { NerSpan, LeafInfo } from "../../../../types/NotationEditor";
import type { Segment } from "../../../../types/Segment";

type CustomRange = BaseRange & {
  underline?: boolean;
  entity?: string;
  spanStart?: number;
  spanEnd?: number;
  active?: boolean;
  segment?: boolean;
  segmentId?: string;
  segmentOrder?: number;
  segmentActive?: boolean;
  segmentBorder?: boolean;
};

export function useOptimizedDecorations(
  indexByPath: Map<string, LeafInfo>,
  spans: NerSpan[],
  segments: Segment[],
  activeSpan: NerSpan | null,
  highlightedCategories: string[],
  activeSegmentId?: string | null,
  selectedSegmentId?: string,
  activeTab: string = "original"
) {

  const decorate = useCallback(
    ([node, path]: NodeEntry) => {
      const ranges: CustomRange[] = [];
      if (!Text.isText(node)) return ranges;

      const pathKey = path.join(".");
      const info = indexByPath.get(pathKey);
      if (!info) return ranges;

      const { gStart, gEnd } = info;

      
      const shouldShowSpans = !activeSegmentId || selectedSegmentId;
      // binary search could fit as well
      if (shouldShowSpans) {      
        for (const s of spans) {
          if (s.end <= gStart) continue; 
          if (s.start >= gEnd) break;    

          const isActive =
            (activeSpan &&
              activeSpan.start === s.start &&
              activeSpan.end === s.end &&
              activeSpan.entity === s.entity) ||
            highlightedCategories.includes(s.entity);

          ranges.push({
            anchor: { path, offset: Math.max(s.start, gStart) - gStart },
            focus: { path, offset: Math.min(s.end, gEnd) - gStart },
            underline: true,
            entity: s.entity,
            spanStart: s.start,
            spanEnd: s.end,
            active: isActive,
          });
        }
      }

      for (const seg of segments) {
         if (seg.end <= gStart || seg.start >= gEnd) continue; 

         if (seg.id === activeSegmentId) {
             const start = Math.max(seg.start, gStart);
             const end = Math.min(seg.end, gEnd);
             if (end > start) {
                 ranges.push({
                     anchor: { path, offset: start - gStart },
                     focus: { path, offset: end - gStart },
                     segment: true,
                     segmentId: seg.id,
                     segmentOrder: seg.order,
                     segmentActive: true
                 });
             }
         }
  
         if (!selectedSegmentId && activeTab === "original") {
             const borderPos = seg.end;
             if (borderPos >= gStart && borderPos < gEnd) {
                 ranges.push({
                     anchor: { path, offset: borderPos - gStart },
                     focus: { path, offset: borderPos - gStart + 1 },
                     segmentBorder: true,
                     segmentId: seg.id,
                     segmentOrder: seg.order
                 });
             }
         }
      }

      return ranges;
    },
    [indexByPath, spans, segments, activeSpan, highlightedCategories, activeSegmentId, selectedSegmentId, activeTab]
  );

  return decorate;
}