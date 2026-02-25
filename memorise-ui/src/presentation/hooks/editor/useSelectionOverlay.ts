import { useCallback, useRef } from "react";
import { Range } from "slate";
import { ReactEditor } from "slate-react";
import { posFromDomRange } from "../../../shared/utils/editorDom"; 
import type { SelectionBox } from "../../../types/NotationEditor";

export function useSelectionOverlay(opts: {
  editor: ReactEditor;
  activeSegmentId?: string | null;
  pointToGlobal: (path: number[], offset: number) => number;
  selectionOverlapsExisting: (s: number, e: number) => boolean;
  updateBubblePosition: (box: SelectionBox | null) => void; 
  onSelectionChange?: (sel: { start: number; end: number } | null) => void;
  containerRef: React.RefObject<HTMLElement>;
  throttleMs?: number;
  debounceMs?: number;
}) {
  const { 
    editor, 
    activeSegmentId, 
    pointToGlobal, 
    selectionOverlapsExisting, 
    updateBubblePosition, 
    onSelectionChange, 
    containerRef,
    throttleMs = 100, 
    debounceMs = 150 
  } = opts;

  const lastProcessedSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const pendingSelectionUpdateRef = useRef<number | null>(null);
  const bubblePositionUpdateRef = useRef<number | null>(null);

  const cancelTimers = () => {
    if (pendingSelectionUpdateRef.current !== null) clearTimeout(pendingSelectionUpdateRef.current);
    if (bubblePositionUpdateRef.current !== null) clearTimeout(bubblePositionUpdateRef.current);
    pendingSelectionUpdateRef.current = null;
    bubblePositionUpdateRef.current = null;
  };

  const updateSelectionOverlay = useCallback(() => {
    
    if (!ReactEditor.isFocused(editor)) return;
    const sel = editor.selection;
    
    if (!sel || !Range.isRange(sel) || Range.isCollapsed(sel)) {
      cancelTimers();
      onSelectionChange?.(null);
      updateBubblePosition(null); 
      lastProcessedSelectionRef.current = null;
      return;
    }

    
    const [startPoint, endPoint] = Range.edges(sel);
    const gStart = pointToGlobal(startPoint.path, startPoint.offset);
    const gEnd = pointToGlobal(endPoint.path, endPoint.offset);
    const start = Math.min(gStart, gEnd);
    const end = Math.max(gStart, gEnd);

    
    const last = lastProcessedSelectionRef.current;
    if (last && last.start === start && last.end === end) return;

    lastProcessedSelectionRef.current = { start, end };
    onSelectionChange?.({ start, end });

    
    if (activeSegmentId || selectionOverlapsExisting(start, end)) {
      cancelTimers();
      updateBubblePosition(null); 
      return;
    }

    
    if (bubblePositionUpdateRef.current !== null) clearTimeout(bubblePositionUpdateRef.current);
    
    bubblePositionUpdateRef.current = window.setTimeout(() => {
      bubblePositionUpdateRef.current = null;

      
      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0) return;
      const domRange = domSelection.getRangeAt(0);

      
      const containerEl = containerRef.current;
      if (!containerEl) return;
      const containerRect = containerEl.getBoundingClientRect();

        
      const { top, left } = posFromDomRange(domRange, containerRect);

      
      updateBubblePosition({
        top,
        left,
        start,
        end
      });
    }, debounceMs);
  }, [editor, activeSegmentId, pointToGlobal, selectionOverlapsExisting, updateBubblePosition, onSelectionChange, debounceMs, containerRef]);

  const onSelectThrottled = useCallback(() => {
    const now = Date.now();
    const delta = now - lastUpdateTimeRef.current;
    if (pendingSelectionUpdateRef.current !== null) clearTimeout(pendingSelectionUpdateRef.current);

    if (delta >= throttleMs) {
      lastUpdateTimeRef.current = now;
      updateSelectionOverlay();
    } else {
      const remaining = throttleMs - delta;
      pendingSelectionUpdateRef.current = window.setTimeout(() => {
        pendingSelectionUpdateRef.current = null;
        lastUpdateTimeRef.current = Date.now();
        updateSelectionOverlay();
      }, remaining);
    }
  }, [throttleMs, updateSelectionOverlay]);

  return { onSelectThrottled, cancelTimers };
}