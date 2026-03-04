import { EditorState, Transaction } from "@codemirror/state";
import { segmentsFacet } from "./segmentDecorations";
import { intentionalTextReplace } from "../spans/spanProtection";
import type { Segment } from "../../../../../../types/Segment";

export const createSegmentProtectionFilter = (onSegmentJoinRequest?: (id1: string, id2: string) => void) => {
  return EditorState.transactionFilter.of((tr) => {
    if (tr.annotation(intentionalTextReplace)) return tr;
    if (!tr.docChanged || tr.annotation(Transaction.remote)) return tr;
    if (tr.annotation(Transaction.userEvent) === undefined) return tr;

    let blockForJoin = false;
    let joinSeg1: Segment | null = null;
    let joinSeg2: Segment | null = null;

    const currentSegments = tr.state.facet(segmentsFacet);

    tr.changes.iterChanges((fromA, toA, fromB, toB) => {
      const isDeletion = toA > fromA;

      if (isDeletion && currentSegments.length > 1) {
        for (let i = 0; i < currentSegments.length - 1; i++) {
          const seg = currentSegments[i];
          const nextSeg = currentSegments[i + 1];
          if (seg.end < nextSeg.start) {
            if (Math.max(seg.end, fromA) < Math.min(nextSeg.start, toA)) {
              blockForJoin = true; joinSeg1 = seg; joinSeg2 = nextSeg; break;
            }
          } else {
            if (fromA <= seg.end && toA >= seg.end) {
              blockForJoin = true; joinSeg1 = seg; joinSeg2 = nextSeg; break;
            }
          }
        }
      }
    });

    if (blockForJoin && joinSeg1 && joinSeg2) {
      setTimeout(() => onSegmentJoinRequest?.(joinSeg1!.id, joinSeg2!.id), 0);
      return []; 
    }

    return tr;
  });
};