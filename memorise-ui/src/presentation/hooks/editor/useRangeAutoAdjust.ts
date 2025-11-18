// src/presentation/hooks/editor/useRangeAutoAdjust.ts
import { useCallback } from "react";
import type { ReactEditor } from "slate-react";
import type { Operation } from "slate";
import { NEWLINE } from "../../../shared/constants/notationEditor";

/**
 * Generic range type that has start and end positions
 */
type Range = { start: number; end: number; [key: string]: unknown };

type AdjustOpts<T extends Range> = {
  editor: ReactEditor;
  pointToGlobal: (path: number[], offset: number) => number;
  getRanges: () => T[];                  // read current ranges (e.g., from local state)
  setRanges: (updater: (prev: T[]) => T[]) => void; // update ranges
  onAdjusted?: (next: T[]) => void; // notify caller when ranges are adjusted by ops
  checkChanged?: (next: T[], prev: T[]) => boolean; // custom change detection
  logPrefix?: string; // prefix for debug logs
  skipIfEmpty?: boolean; // skip processing if ranges array is empty (prevents infinite loops)
};

function adjustForInsert<T extends Range>(ranges: T[], pos: number, len: number): T[] {
  return ranges.map(r => {
    if (pos < r.start) {
      // Insert before range - shift range forward
      return { ...r, start: r.start + len, end: r.end + len };
    }
    if (pos >= r.start && pos <= r.end) {
      // Insert at range start, inside range, or at range end - range grows to include new text
      return { ...r, end: r.end + len };
    }
    // Insert after range - no change
    return r;
  });
}

function adjustForDelete<T extends Range>(ranges: T[], delStart: number, delLen: number): T[] {
  const delEnd = delStart + delLen;

  const next: T[] = [];
  for (const r of ranges) {
    // deletion entirely before range
    if (delEnd <= r.start) {
      next.push({ ...r, start: r.start - delLen, end: r.end - delLen });
      continue;
    }

    // deletion entirely after range
    if (delStart >= r.end) {
      next.push(r);
      continue;
    }

    // overlap cases
    const overlapStart = Math.max(r.start, delStart);
    const overlapEnd = Math.min(r.end, delEnd);
    const removedInside = Math.max(0, overlapEnd - overlapStart);

    let newStart = r.start;
    let newEnd = r.end - removedInside;

    // If deletion starts before range, left edge shifts left by remaining part
    if (delStart < r.start) {
      const shift = Math.min(delLen, r.start - delStart);
      newStart = r.start - shift;
      newEnd = newEnd - shift;
    }

    // If range is fully removed, drop it
    if (newEnd <= newStart) continue;

    next.push({ ...r, start: newStart, end: newEnd });
  }
  return next;
}

export function useRangeAutoAdjust<T extends Range>({ 
  editor, 
  pointToGlobal, 
  getRanges, 
  setRanges, 
  onAdjusted,
  checkChanged,
  logPrefix = "[RangeAutoAdjust]",
  skipIfEmpty = false,
}: AdjustOpts<T>) {
  const applyOps = useCallback(
    (ops: Operation[]) => {
      if (ops.length === 0) return;

      const beforeRanges = getRanges();
      
      // Early return if no ranges to adjust (prevents infinite loops with empty workspaces)
      if (skipIfEmpty && beforeRanges.length === 0) {
        return;
      }

      console.debug(`${logPrefix} applying ops`, {
        count: ops.length,
        types: ops.map((o) => o.type),
        beforeCount: beforeRanges.length,
        beforePreview: beforeRanges.slice(0, 5),
        beforeRanges: beforeRanges, // Full array for debugging
      });

      // Compute updated ranges synchronously from the latest ranges
      let working: T[] = beforeRanges.slice();
      
      // When Enter is pressed, Slate may emit both insert_text(\n) and split_node
      // We want to handle only split_node to avoid double-adjusting ranges
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
            console.debug(`${logPrefix} skipping insert_text newline (handled by split_node)`, {
              path: raw.path,
              offset: raw.offset,
              globalPos: pos,
            });
            continue;
          }
          
          const pos = pointToGlobal(raw.path, raw.offset);
          const len = raw.text.length;
          console.debug(`${logPrefix} insert_text`, {
            path: raw.path,
            offset: raw.offset,
            globalPos: pos,
            text: raw.text,
            textLength: len,
            rangesBefore: working.map(r => ({ start: r.start, end: r.end })),
          });
          working = adjustForInsert(working, pos, len);
          console.debug(`${logPrefix} insert_text after adjust`, {
            rangesAfter: working.map(r => ({ start: r.start, end: r.end })),
          });
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
              console.debug(`${logPrefix} skipping element split_node (structural only)`, {
                path: splitOp.path,
                position: splitOp.position,
              });
              continue;
            }
            
            // Convert the split position to global offset
            const pos = pointToGlobal(splitOp.path, splitOp.position);
            // Insert a newline character (length 1)
            working = adjustForInsert(working, pos, NEWLINE.length);
            console.debug(`${logPrefix} split_node handled (Enter key - text node split)`, {
              path: splitOp.path,
              position: splitOp.position,
              globalPos: pos,
              newlineLength: NEWLINE.length,
            });
          } else {
            console.warn(`${logPrefix} split_node missing path/position`, raw);
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
              console.debug(`${logPrefix} skipping element merge_node (structural only)`, {
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
            if ((computedPos === 0 || computedPos < 0) && editor.selection) {
              // Use the selection's anchor point
              const selPos = pointToGlobal(editor.selection.anchor.path, editor.selection.anchor.offset);
              
              // When merging, if the selection offset is 0, the cursor is at the start of the paragraph
              // being merged, so the newline is at selPos - 1.
              // Otherwise, the selection is likely at the end of the previous paragraph (where the newline is),
              // so use selPos directly.
              if (editor.selection.anchor.offset === 0 && selPos > 0) {
                pos = selPos - 1;
              } else {
                pos = selPos;
              }
              
              console.debug(`${logPrefix} merge_node using selection position`, {
                mergePath: mergeOp.path,
                mergePosition: mergeOp.position,
                computedPos,
                selectionPath: editor.selection.anchor.path,
                selectionOffset: editor.selection.anchor.offset,
                selectionPos: selPos,
                newlinePos: pos,
              });
            } else {
              pos = computedPos;
            }
            
            // Delete a newline character (length 1)
            working = adjustForDelete(working, pos, NEWLINE.length);
            console.debug(`${logPrefix} merge_node handled (Backspace at block start - text node merge)`, {
              path: mergeOp.path,
              position: mergeOp.position,
              globalPos: pos,
              newlineLength: NEWLINE.length,
            });
            } else {
              console.warn(`${logPrefix} merge_node missing path/position`, raw);
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
              console.debug(`${logPrefix} remove_node handled (empty paragraph removal)`, {
                path: removeOp.path,
                selectionPath: editor.selection.anchor.path,
                selectionOffset: editor.selection.anchor.offset,
                selectionPos: selPos,
                newlinePos: pos,
                newlineLength: NEWLINE.length,
              });
            } else {
              console.warn(`${logPrefix} remove_node missing selection`, raw);
            }
          } else {
            // Text node removal - this is handled by remove_text operations
            console.debug(`${logPrefix} skipping text node remove_node (handled by remove_text)`, {
              path: removeOp.path,
            });
          }
        }
      }

      const nextOut = working;
      console.debug(`${logPrefix} after ops`, {
        afterCount: nextOut.length,
        afterPreview: nextOut.slice(0, 5),
        afterRanges: nextOut, // Full array for debugging
        beforeRanges: beforeRanges,
      });

      // Only update if ranges actually changed (prevents infinite loops)
      const defaultCheckChanged = (next: T[], prev: T[]) => {
        if (next.length !== prev.length) return true;
        // Sort both arrays before comparing to ensure consistent comparison
        const sortedNext = [...next].sort((a, b) => a.start - b.start);
        const sortedPrev = [...prev].sort((a, b) => a.start - b.start);
        return sortedNext.some((r, i) => {
          const p = sortedPrev[i];
          return !p || r.start !== p.start || r.end !== p.end;
        });
      };

      const rangesChanged = checkChanged ? checkChanged(nextOut, beforeRanges) : defaultCheckChanged(nextOut, beforeRanges);

      console.debug(`${logPrefix} change detection`, {
        rangesChanged,
        nextCount: nextOut.length,
        prevCount: beforeRanges.length,
        nextRanges: nextOut.map(r => ({ start: r.start, end: r.end })),
        prevRanges: beforeRanges.map(r => ({ start: r.start, end: r.end })),
      });

      if (!rangesChanged) {
        console.debug(`${logPrefix} no changes, skipping update`);
        return;
      }

      // Push the new ranges into local state
      setRanges(() => nextOut);

      if (onAdjusted) {
        // Defer callback slightly to avoid setState-during-render warnings
        queueMicrotask(() => {
          console.debug(`${logPrefix} onAdjusted fired`, {
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
    [pointToGlobal, setRanges, onAdjusted, getRanges, editor, checkChanged, logPrefix, skipIfEmpty]
  );

  // Expose a synchronous applier to run within Slate's onChange cycle
  const applyPendingOps = () => {
    if (!editor.operations || editor.operations.length === 0) return;
    
    // Early return if no ranges (prevents infinite loops with empty workspaces)
    if (skipIfEmpty) {
      const currentRanges = getRanges();
      if (currentRanges.length === 0) {
        return;
      }
    }
    
    // Log all operations for debugging
    console.debug(`${logPrefix} all editor operations`, {
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

