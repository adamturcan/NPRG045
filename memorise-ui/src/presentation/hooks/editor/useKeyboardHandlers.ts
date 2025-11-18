import { useCallback } from "react";
import { Range, Editor, Text } from "slate";
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
  segments?: Array<{ id: string; start: number; end: number }>;
}) {
  const {
    editor,
    pointToGlobal,
    findSpanAtCursor,
    findSpansInSelection,
    requestMultiDeleteSpans,
    requestDeleteSpan,
    closeAllUI,
    segments = [],
  } = params;

  /**
   * Check if a position is a border space (non-deletable space between segments)
   * Border spaces are at segment.end positions (except for the last segment)
   */
  const isBorderSpace = useCallback((offset: number): boolean => {
    if (segments.length === 0) return false;
    
    // Sort segments by start position
    const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
    
    // Check if offset is at any segment.end position (except last segment)
    for (let i = 0; i < sortedSegments.length - 1; i++) {
      if (offset === sortedSegments[i].end) {
        return true;
      }
    }
    
    return false;
  }, [segments]);

  /**
   * Get the total text length in the editor
   */
  const getTextLength = useCallback((): number => {
    try {
      // Get all text nodes and sum their lengths
      let totalLength = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const [node] of Editor.nodes(editor as any, { at: [], match: Text.isText })) {
        totalLength += (node as Text).text.length;
      }
      return totalLength;
    } catch {
      return 0;
    }
  }, [editor]);

  /**
   * Check if selection covers the entire text
   */
  const coversEntireText = useCallback((start: number, end: number): boolean => {
    const textLength = getTextLength();
    return start === 0 && end >= textLength;
  }, [getTextLength]);

  /**
   * Check if selection covers an entire segment (including its border space)
   * A segment is covered if selection starts at segment.start and ends at or after segment.end + 1
   */
  const coversEntireSegment = useCallback((start: number, end: number): boolean => {
    if (segments.length === 0) return false;
    
    const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
    
    for (const segment of sortedSegments) {
      // Check if selection starts at segment start
      if (start === segment.start) {
        // Check if selection ends at or after segment.end (which includes the border space)
        // Border space is at segment.end, so selection should cover up to segment.end + 1
        if (end >= segment.end + 1) {
          return true;
        }
      }
    }
    
    return false;
  }, [segments]);

  /**
   * Check if a selection range would delete a border space
   * Returns false if the selection covers entire text or an entire segment
   */
  const wouldDeleteBorderSpace = useCallback((start: number, end: number): boolean => {
    // Allow deletion if covering entire text
    if (coversEntireText(start, end)) {
      return false;
    }
    
    // Allow deletion if covering entire segment
    if (coversEntireSegment(start, end)) {
      return false;
    }
    
    // Otherwise, check if any border space would be deleted
    for (let offset = start; offset < end; offset++) {
      if (isBorderSpace(offset)) {
        return true;
      }
    }
    return false;
  }, [isBorderSpace, coversEntireText, coversEntireSegment]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Block undo (Ctrl+Z / Cmd+Z)
      if (event.key === "z" && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

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
        // Check if deletion would affect a border space
        if (Range.isCollapsed(sel)) {
          // Backspace checks position before cursor; Delete checks at cursor
          const checkOffset =
            event.key === "Backspace" ? Math.max(0, start - 1) : start;
          
          // Prevent deletion of border spaces
          if (isBorderSpace(checkOffset)) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          
          const intersectingSpan = findSpanAtCursor(checkOffset);
          if (intersectingSpan) {
            event.preventDefault();
            event.stopPropagation();
            requestDeleteSpan(intersectingSpan); 
            return;
          }
        } else {
          // Multi-select deletion - check if selection includes border space
          if (wouldDeleteBorderSpace(start, end)) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          
          // Multi-select deletion
          const intersectingSpans = findSpansInSelection(start, end);
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
          // Prevent replacing text that includes border spaces
          if (wouldDeleteBorderSpace(start, end)) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          
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
        // Prevent paste/cut that would affect border spaces
        if (wouldDeleteBorderSpace(start, end)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        
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
      requestDeleteSpan,
      closeAllUI,
      isBorderSpace,
      wouldDeleteBorderSpace,
    ]
  );

  return { onKeyDown };
}


