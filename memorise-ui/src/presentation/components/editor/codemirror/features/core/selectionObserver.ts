import React from "react";
import { EditorView } from "@codemirror/view";
import type { NerSpan } from "../../../../../../types/NotationEditor";
import type { Segment } from "../../../../../../types/Segment";

export const createSelectionObserver = (
  spans: NerSpan[], // Keep for backwards compat, but we don't block anymore
  segments: Segment[],
  onSelectionChange?: (sel: { start: number; end: number; top: number; left: number } | null) => void,
  timeoutRef?: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
) => {
  return EditorView.updateListener.of((update) => {
    if (!onSelectionChange) return;

    if (timeoutRef?.current) clearTimeout(timeoutRef.current);

    if (update.selectionSet || update.docChanged) {
      const range = update.state.selection.main;

      // 1. If cursor is just blinking (not a highlight), close menu
      if (range.empty) {
        onSelectionChange(null);
        return;
      }

      // 2. ONLY block if they are trying to highlight across a segment boundary.
      // We still want to prevent splitting a highlight between two blocks.
      const overlapsBoundary = segments.some((seg, i) => {
        if (i === segments.length - 1) return false;
        const nextSeg = segments[i + 1];
        return range.from < nextSeg.start && range.to > seg.end;
      });

      if (overlapsBoundary) {
        onSelectionChange(null);
        return;
      }

      // 3. Trigger the menu!
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
        }, 150); // Slightly faster for a snappier feel
      }
    }
  });
};