import { useCallback, useRef } from "react";
import { Range } from "slate";
import { ReactEditor } from "slate-react";

export function useSelectionOverlay(opts: {
  editor: ReactEditor;
  activeSegmentId?: string | null;
  pointToGlobal: (path: number[], offset: number) => number;
  selectionOverlapsExisting: (s: number, e: number) => boolean;
  updateBubblePosition: (s: number, e: number) => void;
  onSelectionChange?: (sel: { start: number; end: number } | null) => void;
  throttleMs?: number;
  debounceMs?: number;
}) {
  const { editor, activeSegmentId, pointToGlobal, selectionOverlapsExisting, updateBubblePosition, onSelectionChange, throttleMs = 100, debounceMs = 150 } = opts;

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
      return;
    }

    if (bubblePositionUpdateRef.current !== null) clearTimeout(bubblePositionUpdateRef.current);
    bubblePositionUpdateRef.current = window.setTimeout(() => {
      bubblePositionUpdateRef.current = null;
      updateBubblePosition(start, end);
    }, debounceMs);
  }, [editor, activeSegmentId, pointToGlobal, selectionOverlapsExisting, updateBubblePosition, onSelectionChange, debounceMs]);

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