import React from "react";
import { EditorView } from "@codemirror/view";
import type { NerSpan } from "../../../../../../types/NotationEditor";

export const createSelectionObserver = (
  spans: NerSpan[],
  onSelectionChange?: (sel: { start: number; end: number; top: number; left: number } | null) => void,
  timeoutRef?: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
) => {
  return EditorView.updateListener.of((update) => {
    if (!onSelectionChange) return;
    
    if (update.selectionSet || update.docChanged) {
      if (timeoutRef?.current) clearTimeout(timeoutRef.current);

      const range = update.state.selection.main;

      if (range.empty) {
        onSelectionChange(null);
        return;
      }

      const overlapsSpan = spans.some(
        (s) => Math.max(Number(s.start), range.from) < Math.min(Number(s.end), range.to)
      );

      if (overlapsSpan) {
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
        }, 150);
      }
    }
  });
};