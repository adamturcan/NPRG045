// src/presentation/hooks/editor/useSpanAutoAdjust.ts
import type { ReactEditor } from "slate-react";
import type { NerSpan } from "../../../types/NotationEditor";
import { useRangeAutoAdjust } from "./useRangeAutoAdjust";

/**
 * Hook for auto-adjusting NER spans when text is inserted/deleted.
 * This is a convenience wrapper around useRangeAutoAdjust for spans.
 */
export function useSpanAutoAdjust({ 
  editor, 
  pointToGlobal, 
  getSpans, 
  setSpans, 
  onAdjusted 
}: {
  editor: ReactEditor;
  pointToGlobal: (path: number[], offset: number) => number;
  getSpans: () => NerSpan[];
  setSpans: (updater: (prev: NerSpan[]) => NerSpan[]) => void;
  onAdjusted?: (next: NerSpan[]) => void;
}) {
  return useRangeAutoAdjust({
    editor,
    pointToGlobal,
    getRanges: getSpans,
    setRanges: setSpans,
    onAdjusted,
    logPrefix: "[SpanAutoAdjust]",
    skipIfEmpty: false, // Spans can be empty, don't skip
  });
}