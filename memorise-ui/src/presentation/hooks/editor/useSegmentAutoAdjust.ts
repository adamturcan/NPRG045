// src/presentation/hooks/editor/useSegmentAutoAdjust.ts
import { useCallback, useRef } from "react";
import type { ReactEditor } from "slate-react";
import type { Operation } from "slate";
import { NEWLINE } from "../../../shared/constants/notationEditor";
import { adjustForInsert, adjustForDelete } from "../../../shared/utils/offsetAdjustment";
import { recalculateOffsetsFromText } from "../../../shared/utils/recalculateOffsets";

// Type for segments with at least start/end (used in editor)
type SegmentLike = {
  id: string;
  start: number;
  end: number;
  order: number;
  [key: string]: unknown; // Allow additional properties like text, translations, etc.
};

type AdjustOpts<T extends SegmentLike = SegmentLike> = {
  editor: ReactEditor;
  pointToGlobal: (path: number[], offset: number) => number;
  getSegments: () => T[];                  // read current segments (e.g., from local state)
  setSegments: (updater: (prev: T[]) => T[]) => void; // update segments
  onAdjusted?: (next: T[]) => void; // notify caller when segments are adjusted by ops
};

export function useSegmentAutoAdjust<T extends SegmentLike = SegmentLike>({ editor, pointToGlobal, getSegments, setSegments, onAdjusted }: AdjustOpts<T>) {
  // Track previous text for undo/redo detection
  const previousTextRef = useRef<string>("");

  const applyOps = useCallback(
    (ops: Operation[]) => {
      if (ops.length === 0) return;

      const beforeSegments = getSegments();
      console.debug("[SegmentAutoAdjust] applying ops", {
        count: ops.length,
        types: ops.map((o) => o.type),
        beforeCount: beforeSegments.length,
        beforePreview: beforeSegments.slice(0, 5),
      });

      // Compute updated segments synchronously from the latest segments
      let working: T[] = beforeSegments.slice();
      
      // When Enter is pressed, Slate may emit both insert_text(\n) and split_node
      // We want to handle only split_node to avoid double-adjusting segments
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
            console.debug("[SegmentAutoAdjust] skipping insert_text newline (handled by split_node)", {
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
              console.debug("[SegmentAutoAdjust] skipping element split_node (structural only)", {
                path: splitOp.path,
                position: splitOp.position,
              });
              continue;
            }
            
            // Convert the split position to global offset
            const pos = pointToGlobal(splitOp.path, splitOp.position);
            // Insert a newline character (length 1)
            working = adjustForInsert(working, pos, NEWLINE.length);
            console.debug("[SegmentAutoAdjust] split_node handled (Enter key - text node split)", {
              path: splitOp.path,
              position: splitOp.position,
              globalPos: pos,
              newlineLength: NEWLINE.length,
            });
          } else {
            console.warn("[SegmentAutoAdjust] split_node missing path/position", raw);
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
              console.debug("[SegmentAutoAdjust] skipping element merge_node (structural only)", {
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
              
              console.debug("[SegmentAutoAdjust] merge_node using selection position", {
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
            console.debug("[SegmentAutoAdjust] merge_node handled (Backspace at block start - text node merge)", {
              path: mergeOp.path,
              position: mergeOp.position,
              globalPos: pos,
              newlineLength: NEWLINE.length,
            });
            } else {
              console.warn("[SegmentAutoAdjust] merge_node missing path/position", raw);
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
              console.debug("[SegmentAutoAdjust] remove_node handled (empty paragraph removal)", {
                path: removeOp.path,
                selectionPath: editor.selection.anchor.path,
                selectionOffset: editor.selection.anchor.offset,
                selectionPos: selPos,
                newlinePos: pos,
                newlineLength: NEWLINE.length,
              });
            } else {
              console.warn("[SegmentAutoAdjust] remove_node missing selection", raw);
            }
          } else {
            // Text node removal - this is handled by remove_text operations
            console.debug("[SegmentAutoAdjust] skipping text node remove_node (handled by remove_text)", {
              path: removeOp.path,
            });
          }
        }
      }

      const nextOut = working;
      console.debug("[SegmentAutoAdjust] after ops", {
        afterCount: nextOut.length,
        afterPreview: nextOut.slice(0, 5),
      });

      // Push the new segments into local state
      setSegments(() => nextOut);

      if (onAdjusted) {
        // Defer callback slightly to avoid setState-during-render warnings
        queueMicrotask(() => {
          console.debug("[SegmentAutoAdjust] onAdjusted fired", {
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
    [pointToGlobal, setSegments, onAdjusted, getSegments, editor]
  );

  // Expose a synchronous applier to run within Slate's onChange cycle
  const applyPendingOps = (currentText?: string) => {
    if (!editor.operations || editor.operations.length === 0) {
      // Update previous text even if no operations (for tracking)
      if (currentText !== undefined) {
        previousTextRef.current = currentText;
      }
      return;
    }
    
    // If currentText is provided, check for undo/redo
    if (currentText !== undefined && previousTextRef.current) {
      const oldText = previousTextRef.current;
      const lengthDiff = Math.abs(currentText.length - oldText.length);
      
      // Detect potential undo/redo: large text changes or operations that seem inverse
      const hasInsert = editor.operations.some(o => o.type === "insert_text");
      const hasRemove = editor.operations.some(o => o.type === "remove_text");
      const hasInverseOps = hasInsert && hasRemove;
      
      // If large change or inverse ops, recalculate from text
      // Threshold: more than 50 chars difference, or inverse ops with >10 char diff
      if (lengthDiff > 50 || (hasInverseOps && lengthDiff > 10)) {
        console.debug("[SegmentAutoAdjust] Potential undo/redo detected, recalculating", {
          oldLength: oldText.length,
          newLength: currentText.length,
          diff: lengthDiff,
          hasInverseOps,
          operationTypes: editor.operations.map(o => o.type),
        });
        
        const segments = getSegments();
        const recalculated = recalculateOffsetsFromText(segments, oldText, currentText);
        
        setSegments(() => recalculated);
        if (onAdjusted) {
          queueMicrotask(() => {
            try {
              onAdjusted(recalculated);
            } catch {
              // ignore
            }
          });
        }
        
        previousTextRef.current = currentText;
        return;
      }
    }
    
    // Log all operations for debugging
    console.debug("[SegmentAutoAdjust] all editor operations", {
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
    
    // Normal incremental adjustment
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
    
    // Update previous text
    if (currentText !== undefined) {
      previousTextRef.current = currentText;
    }
  };

  return { applyPendingOps };
}

