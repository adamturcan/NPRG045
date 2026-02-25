import { useCallback } from "react";
import { Annotation } from "../../../core/entities/Annotation";
import type { NerSpan } from "../../../types/NotationEditor";

const generateId = () => Math.random().toString(36).substring(2, 15);

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
      
      let spanToDelete: NerSpan | undefined;
      
      if (currentEntity && onDeleteSpan) {
        spanToDelete = localSpans.find(s => 
          s.start === start && s.end === end && s.entity === currentEntity
        );
        
        onDeleteSpan(spanToDelete || { start, end, entity: currentEntity });
      }

      const newSpan: NerSpan = {
        start,
        end,
        entity,
        origin: 'user', 
        id: generateId() 
      };

      onAddSpan(newSpan);

      setLocalSpans((prev) => {
        let withoutOld = prev;
        
        if (currentEntity) {
             withoutOld = prev.filter(s => {
                 if (spanToDelete?.id && s.id) return s.id !== spanToDelete.id;
                 return !(s.start === start && s.end === end && s.entity === currentEntity);
             });
        } else {
             withoutOld = prev.slice();
        }
        
        const exists = withoutOld.some(s => s.start === start && s.end === end && s.entity === entity);
        
        if (exists) 
          return withoutOld;

        return [...withoutOld, newSpan].sort((a, b) => a.start - b.start);
      });

      closeAllUI();
    };

  return { selectionOverlapsExisting, findSpanAtCursor, findSpansInSelection, pickCategoryForRange };
}