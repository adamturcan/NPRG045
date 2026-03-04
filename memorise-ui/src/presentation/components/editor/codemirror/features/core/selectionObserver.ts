import React from "react";
import { EditorView } from "@codemirror/view";
import type { NerSpan } from "../../../../../../types/NotationEditor";
import type { Segment } from "../../../../../../types/Segment";

export const createSelectionObserver = (
  spans: NerSpan[],
  segments: Segment[],
  onSelectionChange?: (sel: { start: number; end: number; top: number; left: number } | null) => void,
  timeoutRef?: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
) => {
  return EditorView.updateListener.of((update) => {
    if (!onSelectionChange) return;

    if (timeoutRef?.current) clearTimeout(timeoutRef.current);

    if (update.selectionSet || update.docChanged) {
      const range = update.state.selection.main;

      if (range.empty) {
        onSelectionChange(null);
        return;
      }

      const overlapsSpan = spans.some(
        (s) => Math.max(Number(s.start), range.from) < Math.min(Number(s.end), range.to)
      );

      const overlapsBoundary = segments.some((seg, i) => {
        if (i === segments.length - 1) return false;
        const nextSeg = segments[i + 1];
        return range.from < nextSeg.start && range.to > seg.end;
      });

      if (overlapsSpan || overlapsBoundary) {
        onSelectionChange(null);
        return;
      }

      if (timeoutRef) {
        timeoutRef.current = setTimeout(() => {
          const coords = update.view.coordsAtPos(range.from);
          if (coords) {
            onSelectionChange({
              start: range.from,
              end: range.to,
              top: coords.bottom,
              left: coords.left,
            });
          }
        }, 250);
      }
    }
  });
};