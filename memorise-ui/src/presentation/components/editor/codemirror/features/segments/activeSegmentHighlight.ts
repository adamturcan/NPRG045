import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import { StateField, Facet } from "@codemirror/state";
import type { Segment } from "../../../../../../types/Segment";
import { segmentsFacet } from "./segmentDecorations";

export const activeSegmentFacet = Facet.define<string | undefined, string | undefined>({
  combine: (values) => values[values.length - 1],
});

const buildActiveSegmentDecoration = (
  segments: Segment[], 
  activeId: string | undefined, 
  docLength: number
) => {
  if (!activeId || !segments || segments.length === 0) return Decoration.none;
  
  const activeSeg = segments.find(s => s.id === activeId);
  if (!activeSeg) return Decoration.none;

  const start = Number(activeSeg.start);
  const end = Number(activeSeg.end);

  if (!isNaN(start) && !isNaN(end) && start < end && start <= docLength) {
    return Decoration.set([
      Decoration.mark({ class: "cm-active-segment-highlight" }).range(start, Math.min(end, docLength))
    ]);
  }
  
  return Decoration.none;
};

export const activeSegmentDecorationField = StateField.define<DecorationSet>({
  create(state) {
    return buildActiveSegmentDecoration(
      state.facet(segmentsFacet), 
      state.facet(activeSegmentFacet), 
      state.doc.length
    );
  },
  update(decorations, tr) {
    const currentSegments = tr.state.facet(segmentsFacet);
    const currentActiveId = tr.state.facet(activeSegmentFacet);

    if (
      currentSegments !== tr.startState.facet(segmentsFacet) || 
      currentActiveId !== tr.startState.facet(activeSegmentFacet) || 
      tr.docChanged
    ) {
      return buildActiveSegmentDecoration(currentSegments, currentActiveId, tr.state.doc.length);
    }

    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});