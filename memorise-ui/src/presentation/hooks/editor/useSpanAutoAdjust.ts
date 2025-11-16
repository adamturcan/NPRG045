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
      
      // When Enter is pressed, Slate may emit both insert_text(\n) and split_node
      // We want to handle only split_node to avoid double-adjusting spans
      // Check if we have any text node split_node operations in this batch (path length > 1)
      const hasTextNodeSplit = ops.some(op => {
        if (op.type !== "split_node") return false;
        const splitOp = op as Operation & { path?: number[] };
        return Array.isArray(splitOp.path) && splitOp.path.length > 1;
      });
      
      // Process operations, skipping insert_text newlines if text node split_node is present
      for (const raw of ops) {
        if (raw.type === "insert_text") {
          // If we have a text node split_node in this batch, skip insert_text operations that are just newlines
          // The split_node will handle the newline insertion
          if (hasTextNodeSplit && raw.text === NEWLINE) {
            const pos = pointToGlobal(raw.path, raw.offset);
            console.debug("[SpanAutoAdjust] skipping insert_text newline (handled by split_node)", {
              path: raw.path,
              offset: raw.offset,
              globalPos: pos,
            });
            continue;
          }
          
          const pos = pointToGlobal(raw.path, raw.offset);
          const len = raw.text.length;
          working = adjustForInsert(working, pos, len);
        } else if (raw.type === "remove_text") {
          const pos = pointToGlobal(raw.path, raw.offset);
          const len = raw.text.length;
          working = adjustForDelete(working, pos, len);
        } else if (raw.type === "split_node") {
          // Enter key: split_node operation can split either:
          // 1. Text nodes (path like [0, 0]) - this inserts a newline, we should handle it
          // 2. Element/paragraph nodes (path like [0]) - this is structural, we should skip it
          // Only process text node splits (path length > 1)
          const splitOp = raw as Operation & { path: number[]; position: number };
          if (Array.isArray(splitOp.path) && typeof splitOp.position === "number") {
            // Only handle splits of text nodes (path length > 1), not element nodes (path length 1)
            if (splitOp.path.length <= 1) {
              console.debug("[SpanAutoAdjust] skipping element split_node (structural only)", {
                path: splitOp.path,
                position: splitOp.position,
              });
              continue;
            }
            
            // Convert the split position to global offset
            const pos = pointToGlobal(splitOp.path, splitOp.position);
            // Insert a newline character (length 1)
            working = adjustForInsert(working, pos, NEWLINE.length);
            console.debug("[SpanAutoAdjust] split_node handled (Enter key - text node split)", {
              path: splitOp.path,
              position: splitOp.position,
              globalPos: pos,
              newlineLength: NEWLINE.length,
            });
          } else {
            console.warn("[SpanAutoAdjust] split_node missing path/position", raw);
          }
        } else if (raw.type === "merge_node") {
          // Backspace at block start: merge_node can merge either:
          // 1. Text nodes (path like [0, 0]) - this deletes a newline, we should handle it
          // 2. Element/paragraph nodes (path like [0]) - this is structural, we should skip it
          // Only process text node merges (path length > 1)
          const mergeOp = raw as Operation & { path: number[]; position: number };
          if (Array.isArray(mergeOp.path) && typeof mergeOp.position === "number") {
            // Only handle merges of text nodes (path length > 1), not element nodes (path length 1)
            if (mergeOp.path.length <= 1) {
              console.debug("[SpanAutoAdjust] skipping element merge_node (structural only)", {
                path: mergeOp.path,
                position: mergeOp.position,
              });
              continue;
            }
            
            // For merge_node, the path/position might not resolve correctly with pointToGlobal
            // because the merge happens before the coordinate system is updated.
            // The newline being deleted is at the end of the previous paragraph.
            let pos: number;
            
            // Try using pointToGlobal first
            const computedPos = pointToGlobal(mergeOp.path, mergeOp.position);
            
            // If pointToGlobal returns 0 or seems wrong (likely for merge operations),
            // use the editor's selection to find the newline position.
            // When merging paragraphs, the selection is typically at the end of the first paragraph
            // (where the newline is), or right after it. The newline is at the end of the previous paragraph.
            if ((computedPos === 0 || computedPos < 0) && editor.selection) {
              // Use the selection's anchor point
              const selPos = pointToGlobal(editor.selection.anchor.path, editor.selection.anchor.offset);
              
              // When merging, if the selection offset is 0, the cursor is at the start of the paragraph
              // being merged, so the newline is at selPos - 1.
              // Otherwise, the selection is likely at the end of the previous paragraph (where the newline is),
              // so use selPos directly.
              // However, based on logs, when offset is non-zero, selPos already points to the newline position.
              if (editor.selection.anchor.offset === 0 && selPos > 0) {
                // Cursor is at start of paragraph being merged, newline is right before it
                pos = selPos - 1;
              } else {
                // Selection is at or near the newline position (end of previous paragraph)
                // Use selPos directly - this is where the newline is
                pos = selPos;
              }
              
              console.debug("[SpanAutoAdjust] merge_node using selection position", {
                mergePath: mergeOp.path,
                mergePosition: mergeOp.position,
                computedPos,
                selectionPath: editor.selection.anchor.path,
                selectionOffset: editor.selection.anchor.offset,
                selectionPos: selPos,
                newlinePos: pos,
                reasoning: editor.selection.anchor.offset === 0 && selPos > 0 ? "cursor at paragraph start, newline before" : "selection at newline position",
              });
            } else {
              pos = computedPos;
            }
            
            // Delete a newline character (length 1)
            working = adjustForDelete(working, pos, NEWLINE.length);
            console.debug("[SpanAutoAdjust] merge_node handled (Backspace at block start - text node merge)", {
              path: mergeOp.path,
              position: mergeOp.position,
              globalPos: pos,
              newlineLength: NEWLINE.length,
            });
            } else {
              console.warn("[SpanAutoAdjust] merge_node missing path/position", raw);
            }
        } else if (raw.type === "remove_node") {
          // remove_node can remove empty paragraphs (when backspace deletes an empty line)
          // This effectively deletes a newline character
          // Only handle element/paragraph removals (path length 1), not text node removals
          const removeOp = raw as Operation & { path: number[] };
          if (Array.isArray(removeOp.path) && removeOp.path.length === 1) {
            // This is removing a paragraph element
            // The newline that was after the previous paragraph is being removed
            // Use the editor's selection to find where the newline is
            if (editor.selection) {
              const selPos = pointToGlobal(editor.selection.anchor.path, editor.selection.anchor.offset);
              // When an empty paragraph is removed, the cursor is at the start of the paragraph being removed
              // The newline that separates this paragraph from the previous one is right before the cursor
              // So the newline is at selPos - 1
              const pos = Math.max(0, selPos - 1);
              working = adjustForDelete(working, pos, NEWLINE.length);
              console.debug("[SpanAutoAdjust] remove_node handled (empty paragraph removal)", {
                path: removeOp.path,
                selectionPath: editor.selection.anchor.path,
                selectionOffset: editor.selection.anchor.offset,
                selectionPos: selPos,
                newlinePos: pos,
                newlineLength: NEWLINE.length,
              });
            } else {
              console.warn("[SpanAutoAdjust] remove_node missing selection", raw);
            }
          } else {
            // Text node removal - this is handled by remove_text operations
            console.debug("[SpanAutoAdjust] skipping text node remove_node (handled by remove_text)", {
              path: removeOp.path,
            });
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
    [pointToGlobal, setSpans, onAdjusted, getSpans, editor]
  );

  // Expose a synchronous applier to run within Slate's onChange cycle
  const applyPendingOps = () => {
    if (!editor.operations || editor.operations.length === 0) return;
    
    // Log all operations for debugging
    console.debug("[SpanAutoAdjust] all editor operations", {
      count: editor.operations.length,
      types: editor.operations.map((o) => o.type),
      operations: editor.operations.map((o) => ({
        type: o.type,
        path: (o as Operation & { path?: number[] }).path,
        offset: (o as Operation & { offset?: number }).offset,
        position: (o as Operation & { position?: number }).position,
        text: (o as Operation & { text?: string }).text,
      })),
    });
    
    const ops = editor.operations.filter(
      (op) =>
        op.type === "insert_text" ||
        op.type === "remove_text" ||
        op.type === "split_node" ||
        op.type === "merge_node" ||
        op.type === "remove_node"
    ) as Operation[];
    
    if (ops.length > 0) {
      applyOps(ops);
    }
  };

  return { applyPendingOps };
}