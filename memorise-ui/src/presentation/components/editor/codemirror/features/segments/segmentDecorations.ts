import { Decoration, type DecorationSet, WidgetType, EditorView } from "@codemirror/view";
import { StateField, Facet } from "@codemirror/state";
import type { Segment } from "../../../../../../types/Segment";

class SegmentBoundaryWidget extends WidgetType {
    seg1Id: string;
    seg2Id: string;
  
    constructor(seg1Id: string, seg2Id: string) {
      super();
      this.seg1Id = seg1Id;
      this.seg2Id = seg2Id;
    }
  
    toDOM() {
      const span = document.createElement("span");
      span.className = "cm-segment-boundary-widget";      
      span.textContent = " "; 
      span.setAttribute("data-join-seg1", this.seg1Id);
      span.setAttribute("data-join-seg2", this.seg2Id);
      return span;
    }
  }

export const segmentsFacet = Facet.define<Segment[], Segment[]>({
  combine: (values) => values[values.length - 1] || [],
});
  
const buildSegmentDecorations = (segments: Segment[], docLength: number) => {
  if (!segments || segments.length === 0) return Decoration.none;

  const marks: any[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const nextSeg = segments[i + 1];

    if (seg.end < nextSeg.start && nextSeg.start <= docLength) {
      marks.push(
        Decoration.mark({
          class: "cm-segment-border-space",
          attributes: { "data-join-seg1": seg.id, "data-join-seg2": nextSeg.id },
          inclusive: false 
        }).range(seg.end, nextSeg.start)
      );
    } else if (seg.end === nextSeg.start && seg.end <= docLength) {
      marks.push(
        Decoration.widget({ widget: new SegmentBoundaryWidget(seg.id, nextSeg.id), side: 1 })
          .range(seg.end)
      );
    }
  }

  try { return Decoration.set(marks, true); } catch { return Decoration.none; }
};
  
export const segmentDecorationField = StateField.define<DecorationSet>({
  create(state) {
    return buildSegmentDecorations(state.facet(segmentsFacet), state.doc.length);
  },
  update(decorations, tr) {
    const currentSegments = tr.state.facet(segmentsFacet);
    if (currentSegments !== tr.startState.facet(segmentsFacet) || tr.docChanged) {
      return buildSegmentDecorations(currentSegments, tr.state.doc.length);
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});