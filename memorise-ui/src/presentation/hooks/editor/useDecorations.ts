import { useCallback } from "react";
import { Text, Path } from "slate";
import type { LeafInfo, NerSpan } from "../../../types/NotationEditor";

export function useDecorations(params: {
  indexByPath: Map<string, LeafInfo>;
  localSpans: NerSpan[];
  activeSpan: NerSpan | null;
  highlightedCategories: string[];
  segments: Array<{ id: string; start: number; end: number; order: number }>;
  activeSegmentId?: string | null;
  selectedSegmentId?: string;
}) {
  const { indexByPath, localSpans, activeSpan, highlightedCategories, segments, activeSegmentId, selectedSegmentId } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decorate = useCallback((entry: [any, Path]) => {
    const [node, path] = entry;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ranges: any[] = [];
    if (!Text.isText(node)) return ranges;

    const info = indexByPath.get(path.join("."));
    if (!info) return ranges;

    // Show spans in document view (when no activeSegmentId) OR in segment view (when selectedSegmentId is set)
    // In segment view, spans are already adjusted to start from 0, so they align with the displayed segment text
    const shouldShowSpans = !activeSegmentId || selectedSegmentId;
    
    if (shouldShowSpans) {
      for (const s of localSpans) {
        const start = Math.max(s.start, info.gStart);
        const end = Math.min(s.end, info.gEnd);
        if (end <= start) continue;
        const isActive = (!!activeSpan && activeSpan.start === s.start && activeSpan.end === s.end && activeSpan.entity === s.entity)
          || (highlightedCategories.length > 0 && highlightedCategories.includes(s.entity));
        ranges.push({
          anchor: { path, offset: start - info.gStart },
          focus: { path, offset: end - info.gStart },
          underline: true,
          entity: s.entity,
          spanStart: s.start,
          spanEnd: s.end,
          active: isActive,
        });
      }
    }

    // Sort segments by start position to find border spaces
    const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
    
    for (const segment of sortedSegments) {
      const nodeStart = info.gStart, nodeEnd = info.gEnd;
      const isActive = segment.id === activeSegmentId;
      
      if (isActive) {
        // Highlight active segment content
        const start = Math.max(segment.start, nodeStart);
        const end = Math.min(segment.end, nodeEnd);
        if (end > start) {
          ranges.push({
            anchor: { path, offset: start - nodeStart },
            focus: { path, offset: end - nodeStart },
            segment: true,
            segmentId: segment.id,
            segmentOrder: segment.order,
            segmentActive: true,
          });
        }
      }
      
      // Mark border space after segment (space at segment.end position)
      // Border space is the character immediately after segment.end
      const borderSpacePos = segment.end;
      if (borderSpacePos >= nodeStart && borderSpacePos < nodeEnd) {
        const offset = borderSpacePos - nodeStart;
        ranges.push({
          anchor: { path, offset },
          focus: { path, offset: offset + 1 },
          segmentBorder: true,
          segmentId: segment.id,
          segmentOrder: segment.order,
        });
      }
    }
    return ranges;
  }, [indexByPath, localSpans, activeSpan, highlightedCategories, segments, activeSegmentId, selectedSegmentId]);

  return { decorate };
}