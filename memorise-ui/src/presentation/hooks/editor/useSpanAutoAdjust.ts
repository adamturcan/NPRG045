// src/presentation/hooks/editor/useSpanAutoAdjust.ts
import { useCallback } from "react";
import type { ReactEditor } from "slate-react";
import type { Operation } from "slate";
import type { NerSpan } from "../../../types/NotationEditor";
import { NEWLINE } from "../../../shared/constants/notationEditor";

type AdjustOpts = {
  editor: ReactEditor;
  pointToGlobal: (path: number[], offset: number) => number;
  getSpans: () => NerSpan[];                  // read current spans (e.g., from local state)
  setSpans: (updater: (prev: NerSpan[]) => NerSpan[]) => void; // update spans
  // version?: unknown; // previously used to drive effect-based syncing
  onAdjusted?: (next: NerSpan[]) => void; // notify caller when spans are adjusted by ops
};

function adjustForInsert(spans: NerSpan[], pos: number, len: number): NerSpan[] {
  return spans.map(s => {
    if (pos <= s.start) {
      return { ...s, start: s.start + len, end: s.end + len };
    }
    if (pos > s.start && pos < s.end) {
      // insert inside span → span grows
      return { ...s, end: s.end + len };
    }
    return s;
  });
}

function adjustForDelete(spans: NerSpan[], delStart: number, delLen: number): NerSpan[] {
  const delEnd = delStart + delLen;

  const next: NerSpan[] = [];
  for (const s of spans) {
    // deletion entirely before span
    if (delEnd <= s.start) {
      next.push({ ...s, start: s.start - delLen, end: s.end - delLen });
      continue;
    }

    // deletion entirely after span
    if (delStart >= s.end) {
      next.push(s);
      continue;
    }

    // overlap cases
    const overlapStart = Math.max(s.start, delStart);
    const overlapEnd = Math.min(s.end, delEnd);
    const removedInside = Math.max(0, overlapEnd - overlapStart);

    let newStart = s.start;
    let newEnd = s.end - removedInside;

    // If deletion starts before span, left edge shifts left by remaining part
    if (delStart < s.start) {
      const shift = Math.min(delLen, s.start - delStart);
      newStart = s.start - shift;
      newEnd = newEnd - shift;
    }

    // If span is fully removed, drop it
    if (newEnd <= newStart) continue;

    next.push({ ...s, start: newStart, end: newEnd });
  }
  return next;
}

export function useSpanAutoAdjust({ editor, pointToGlobal, getSpans, setSpans, onAdjusted }: AdjustOpts) {
  const applyOps = useCallback(
    (ops: Operation[]) => {
      if (ops.length === 0) return;

      const beforeSpans = getSpans();
      console.debug("[SpanAutoAdjust] applying ops", {
        count: ops.length,
        types: ops.map((o) => o.type),
        beforeCount: beforeSpans.length,
        beforePreview: beforeSpans.slice(0, 5),
      });

      // Compute updated spans synchronously from the latest spans
      let working: NerSpan[] = beforeSpans.slice();
      for (const raw of ops) {
        if (raw.type === "insert_text") {
          const pos = pointToGlobal(raw.path, raw.offset);
          const len = raw.text.length;
          working = adjustForInsert(working, pos, len);
        } else if (raw.type === "remove_text") {
          const pos = pointToGlobal(raw.path, raw.offset);
          const len = raw.text.length;
          working = adjustForDelete(working, pos, len);
        } else if (raw.type === "split_node") {
          // Treat Enter (split) as inserting a newline at split position when available
          const splitOp = raw as unknown as { path?: number[]; position?: number };
          if (Array.isArray(splitOp.path) && typeof splitOp.position === "number") {
            const pos = pointToGlobal(splitOp.path, splitOp.position);
            working = adjustForInsert(working, pos, NEWLINE.length);
          }
        } else if (raw.type === "merge_node") {
          // Treat merge (backspace at block start) as deleting a newline at merge boundary
          const mergeOp = raw as unknown as { path?: number[]; position?: number };
          if (Array.isArray(mergeOp.path) && typeof mergeOp.position === "number") {
            const pos = pointToGlobal(mergeOp.path, mergeOp.position);
            working = adjustForDelete(working, pos, NEWLINE.length);
          }
        }
      }

      const nextOut = working;
      console.debug("[SpanAutoAdjust] after ops", {
        afterCount: nextOut.length,
        afterPreview: nextOut.slice(0, 5),
      });

      // Push the new spans into local state
      setSpans(() => nextOut);

      if (onAdjusted) {
        // Defer callback slightly to avoid setState-during-render warnings
        queueMicrotask(() => {
          console.debug("[SpanAutoAdjust] onAdjusted fired", {
            nextCount: nextOut.length,
            nextPreview: nextOut.slice(0, 5),
          });
          try {
            onAdjusted(nextOut);
          } catch {
            // ignore user callback errors
          }
        });
      }
    },
    [pointToGlobal, setSpans, onAdjusted, getSpans]
  );

  // Expose a synchronous applier to run within Slate's onChange cycle
  const applyPendingOps = () => {
    if (!editor.operations || editor.operations.length === 0) return;
    const ops = editor.operations.filter(
      (op) =>
        op.type === "insert_text" ||
        op.type === "remove_text" ||
        op.type === "split_node" ||
        op.type === "merge_node"
    ) as Operation[];
    applyOps(ops);
  };

  return { applyPendingOps };
}