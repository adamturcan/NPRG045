import { EditorState, Transaction, Annotation } from "@codemirror/state";
import { spansFacet, spanDecorationField, getSpanId } from "./spanDecorations";
import type { NerSpan } from "../../../../../../types/NotationEditor";

export const intentionalTextReplace = Annotation.define<boolean>();

export const createSpanProtectionFilter = (onProtectSpans?: (spans: NerSpan[]) => void) => {
  return EditorState.transactionFilter.of((tr) => {
    if (tr.annotation(intentionalTextReplace)) return tr;
    if (!tr.docChanged || tr.annotation(Transaction.remote)) return tr;
    if (tr.annotation(Transaction.userEvent) === undefined) return tr;

    const affectedSpanIds = new Set<string>();

    tr.changes.iterChanges((fromA, toA, fromB, toB) => {
      const isDeletion = toA > fromA;
      const isInsertion = toB > fromB;

      tr.startState.field(spanDecorationField).between(fromA, toA, (from, to, value) => {
        const spanId = value.spec.attributes["data-span-id"];
        if (!spanId) return;

        if (isDeletion && Math.max(from, fromA) < Math.min(to, toA)) {
          affectedSpanIds.add(spanId);
        } else if (isInsertion && fromA > from && fromA < to) {
          affectedSpanIds.add(spanId);
        }
      });
    });

    if (affectedSpanIds.size > 0) {
      const currentSpans = tr.state.facet(spansFacet);
      const affectedSpans = Array.from(affectedSpanIds)
        .map(id => currentSpans.find(s => getSpanId(s) === id))
        .filter(Boolean) as NerSpan[];
        
      setTimeout(() => onProtectSpans?.(affectedSpans), 0);
      return []; 
    }

    return tr;
  });
};