import { useCallback } from "react";
import { Annotation } from "../../../core/entities/Annotation";
import type { NerSpan } from "../../../types/NotationEditor";

export function useAnnotationActions(params: {
  activeSegmentId?: string | null;
  localSpans: NerSpan[];
  setLocalSpans: React.Dispatch<React.SetStateAction<NerSpan[]>>;
  onAddSpan?: (s: NerSpan) => void;
  onDeleteSpan?: (s: NerSpan) => void;
  closeAllUI: () => void;
}) {
  const { activeSegmentId, localSpans, setLocalSpans, onAddSpan, onDeleteSpan, closeAllUI } = params;

  const selectionOverlapsExisting = useCallback((start: number, end: number) => {
    const candidate = Annotation.fromSpan({ start, end, entity: "TEMP" });
    return localSpans.some((s) => candidate.overlapsWith(Annotation.fromSpan(s)));
  }, [localSpans]);

  const findSpanAtCursor = useCallback((cursorOffset: number): NerSpan | null => {
    for (const span of localSpans) {
      if (cursorOffset >= span.start && cursorOffset < span.end) {
        return span;
      }
    }
    return null;
  }, [localSpans]);

  const findSpansInSelection = useCallback((start: number, end: number): NerSpan[] => {
    const selectionAnnotation = Annotation.fromSpan({ start, end, entity: "TEMP" });
    return localSpans.filter((span) => selectionAnnotation.overlapsWith(Annotation.fromSpan(span)));
  }, [localSpans]);

  const pickCategoryForRange =
    (start: number, end: number, currentEntity?: string) =>
    (entity: string) => {
      if (!onAddSpan) return;
      if (!currentEntity && activeSegmentId) { closeAllUI(); return; }
      if (!currentEntity && selectionOverlapsExisting(start, end)) { closeAllUI(); return; }
      if (currentEntity && entity === currentEntity) { closeAllUI(); return; }

      if (currentEntity && onDeleteSpan) onDeleteSpan({ start, end, entity: currentEntity });
      onAddSpan({ start, end, entity });

      setLocalSpans((prev) => {
        const withoutOld = currentEntity
          ? prev.filter(s => !(s.start === start && s.end === end && s.entity === currentEntity))
          : prev.slice();
        const exists = withoutOld.some(s => s.start === start && s.end === end && s.entity === entity);
        return exists ? withoutOld : [...withoutOld, { start, end, entity }];
      });

      closeAllUI();
    };

  return { selectionOverlapsExisting, findSpanAtCursor, findSpansInSelection, pickCategoryForRange };
}


