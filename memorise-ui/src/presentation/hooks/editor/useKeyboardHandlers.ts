import { useCallback } from "react";
import { Range } from "slate";
import { ReactEditor } from "slate-react";
import type { NerSpan, SelectionBox, SpanBox } from "../../../types/NotationEditor";

export function useKeyboardHandlers(params: {
  editor: ReactEditor;
  pointToGlobal: (path: number[], offset: number) => number;
  findSpanAtCursor: (offset: number) => NerSpan | null;
  findSpansInSelection: (start: number, end: number) => NerSpan[];
  requestMultiDeleteSpans: (
    spans: NerSpan[],
    charInsert?:
      | { char: string; selection: { start: number; end: number } }
      | undefined,
    pasteOp?:
      | { type: "paste" | "cut"; selection: { start: number; end: number } }
      | undefined
  ) => void;
  requestDeleteSpan: (span: NerSpan) => void;
  closeAllUI: () => void;
  setSelBox: (v: SelectionBox | null) => void;
  setSpanBox: (v: SpanBox | null) => void;
  setSelMenuAnchor: (v: HTMLElement | null) => void;
  setSpanMenuAnchor: (v: HTMLElement | null) => void;
}) {
  const {
    editor,
    pointToGlobal,
    findSpanAtCursor,
    findSpansInSelection,
    requestMultiDeleteSpans,
    requestDeleteSpan,
    closeAllUI,
    setSelBox,
    setSpanBox,
    setSelMenuAnchor,
    setSpanMenuAnchor,
  } = params;

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAllUI();
        return;
      }
     

      const sel = editor.selection;
      if (!sel || !Range.isRange(sel)) return;

      // Convert selection to global offsets immediately
      const [startPoint, endPoint] = Range.edges(sel);
const gStart = pointToGlobal(startPoint.path, startPoint.offset);
const gEnd = pointToGlobal(endPoint.path, endPoint.offset);
const sRaw = Math.min(gStart, gEnd);
const eRaw = Math.max(gStart, gEnd);
const start = Math.max(0, sRaw);
const end = Math.max(start, eRaw);


      if (event.key === "Enter"   && !Range.isCollapsed(sel)) {

          const intersectingSpans = findSpansInSelection(start, end);
          if (intersectingSpans.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            requestMultiDeleteSpans(intersectingSpans);
            return;
          }
        return;
        
       }
      
    
      if (event.key === "Delete" || event.key === "Backspace") {
        console.log("Delete or Backspace");
        console.log(sel);
        console.log(start, end);

        if (Range.isCollapsed(sel)) {
          console.log("Collapsed");
          // Backspace checks position before cursor; Delete checks at cursor
          const checkOffset =
            event.key === "Backspace" ? Math.max(0, start - 1) : start;
          
            console.log(checkOffset);
          const intersectingSpan = findSpanAtCursor(checkOffset);
          if (intersectingSpan) {
            event.preventDefault();
            event.stopPropagation();
            requestDeleteSpan(intersectingSpan); 
            return;
          }
        } else { 
          console.log("Not Collapsed");
          // Multi-select deletion
          const intersectingSpans = findSpansInSelection(start, end);
          console.log("Intersecting Spans", intersectingSpans);
          if (intersectingSpans.length === 1) {
            event.preventDefault();
            event.stopPropagation();
            requestDeleteSpan(intersectingSpans[0]);
            return;
          }
          if (intersectingSpans.length > 1) {
            event.preventDefault();
            event.stopPropagation();
            requestMultiDeleteSpans(intersectingSpans);
          }
        }
        return;
      }

      // Character key that replaces selected text
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        if (!Range.isCollapsed(sel)) {
          const intersectingSpans = findSpansInSelection(start, end);
          if (intersectingSpans.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            requestMultiDeleteSpans(intersectingSpans, {
              char: event.key,
              selection: { start, end },
            });
            return;
          }
        }
        return;
      }

      // Paste / Cut with selection
      if (
        (event.key === "v" || event.key === "x") &&
        (event.ctrlKey || event.metaKey) &&
        !Range.isCollapsed(sel)
      ) {
        const intersectingSpans = findSpansInSelection(start, end);
        if (intersectingSpans.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          requestMultiDeleteSpans(intersectingSpans, undefined, {
            type: event.key === "v" ? "paste" : "cut",
            selection: { start, end },
          });
          return;
        }
      }
    },
    [
      editor,
      pointToGlobal,
      findSpanAtCursor,
      findSpansInSelection,
      requestMultiDeleteSpans,
      closeAllUI,
      setSelBox,
      setSpanBox,
      setSelMenuAnchor,
      setSpanMenuAnchor,
    ]
  );

  return { onKeyDown };
}


