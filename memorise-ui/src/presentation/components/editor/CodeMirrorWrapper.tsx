// CodeMirrorWrapper.tsx
import React, { useMemo, useCallback, useRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView, Decoration, type DecorationSet, WidgetType } from "@codemirror/view";
import { StateField, Facet, EditorState, Transaction, Annotation } from "@codemirror/state";
import type { NerSpan } from "../../../types/NotationEditor";
import { ENTITY_COLORS, hexToRgba } from "../../../shared/constants/notationEditor";
import type { Segment } from "../../../types/Segment";

interface Props {
  value: string;
  spans: NerSpan[];
  segments?: Segment[];
  activeSegmentId?: string; 
  editorContext: string;    
  onChange: (
    value: string, 
    liveCoords?: Map<string, { start: number; end: number }>, 
    liveSegments?: Segment[],
    contextMode?: string,
    contextSegId?: string
  ) => void;
  onSegmentJoinRequest?: (seg1Id: string, seg2Id: string) => void;
  onSpanClick?: (
    span: NerSpan,
    anchorElement: HTMLElement,
    replaceTextFn: (newText: string) => void
  ) => void;
  onSelectionChange?: (
    selection: { start: number; end: number; top: number; left: number } | null
  ) => void;
  onProtectSpans?: (affectedSpans: NerSpan[]) => void;
  placeholder?: string;
}

const getSpanId = (s: NerSpan) => s.id ?? `span-${s.start}-${s.end}-${s.entity}`;

const intentionalTextReplace = Annotation.define<boolean>();

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

// Theme styles
const baseThemeStyles: Record<string, any> = {
  "&": {
    height: "100%",
    fontSize: "15px",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  ".cm-scroller": { overflow: "auto", height: "100%", backgroundColor: "#ffffff" },
  ".cm-content": { padding: "24px 32px", color: "#1a1a1a", lineHeight: "1.6" },
  "& .cm-ner-span": {
    borderRadius: "3px",
    padding: "2px 0px",
    transition: "background-color 0.2s ease, filter 0.2s ease",
  },
  "& .cm-ner-span:hover": { cursor: "pointer", filter: "brightness(0.85)" },
  
  // The highlight color for the active segment
  "& .cm-active-segment-highlight": {
    backgroundColor: "rgba(253, 224, 71, 0.4)", // Light yellow
    borderRadius: "2px",
    transition: "background-color 0.2s ease",
  },

  // Styles the ACTUAL space character between segments
  "& .cm-segment-border-space": {
    backgroundColor: "#cbd5e1",
    borderRadius: "2px",
    transition: "background-color 0.2s ease",
  },
  "& .cm-segment-border-space:hover": {
    backgroundColor: "#3b82f6",
    cursor: "pointer",
  },
  
  // Fallback widget styling
  "& .cm-segment-boundary-widget": {
    display: "inline-block",
    width: "4px",
    height: "1.2em",
    backgroundColor: "#cbd5e1", 
    margin: "0 2px",
    verticalAlign: "middle",
    borderRadius: "2px",
  }
};

Object.entries(ENTITY_COLORS).forEach(([entity, hexColor]) => {
  const className = `& .entity-${entity.toLowerCase()}`;
  baseThemeStyles[className] = {
    backgroundColor: hexToRgba(hexColor, 0.2),
    borderBottom: `2px solid ${hexColor}`,
  };
});

const editorTheme = EditorView.baseTheme(baseThemeStyles);

const activeSegmentFacet = Facet.define<string | undefined, string | undefined>({
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

const activeSegmentDecorationField = StateField.define<DecorationSet>({
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
    const oldSegments = tr.startState.facet(segmentsFacet);
    const oldActiveId = tr.startState.facet(activeSegmentFacet);

    if (currentSegments !== oldSegments || currentActiveId !== oldActiveId || tr.docChanged) {
      return buildActiveSegmentDecoration(currentSegments, currentActiveId, tr.state.doc.length);
    }

    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const segmentsFacet = Facet.define<Segment[], Segment[]>({
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
          attributes: {
            "data-join-seg1": seg.id,
            "data-join-seg2": nextSeg.id,
          },
          inclusive: false 
        }).range(seg.end, nextSeg.start)
      );
    } else if (seg.end === nextSeg.start && seg.end <= docLength) {
      marks.push(
        Decoration.widget({
          widget: new SegmentBoundaryWidget(seg.id, nextSeg.id),
          side: 1, 
        }).range(seg.end)
      );
    }
  }

  try {
    return Decoration.set(marks, true); 
  } catch {
    return Decoration.none;
  }
};
  
const segmentDecorationField = StateField.define<DecorationSet>({
  create(state) {
    return buildSegmentDecorations(state.facet(segmentsFacet), state.doc.length);
  },
  update(decorations, tr) {
    const currentSegments = tr.state.facet(segmentsFacet);
    const oldSegments = tr.startState.facet(segmentsFacet);

    if (currentSegments !== oldSegments || tr.docChanged) {
      return buildSegmentDecorations(currentSegments, tr.state.doc.length);
    }

    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const spansFacet = Facet.define<NerSpan[], NerSpan[]>({
  combine: (values) => values[values.length - 1] || [],
});

const buildDecorations = (spans: NerSpan[], docLength: number) => {
  if (!spans || spans.length === 0) return Decoration.none;

  const marks: any[] = [];

  for (const span of spans) {
    const start = Number(span.start);
    const end = Number(span.end);
    const id = getSpanId(span);

    if (!isNaN(start) && !isNaN(end) && start < end && start < docLength) {
      const safeEnd = Math.min(end, docLength);
      if (start < safeEnd) {
        marks.push(
          Decoration.mark({
            class: `cm-ner-span entity-${(span.entity || "").toLowerCase()}`,
            attributes: { "data-span-id": id },
          }).range(start, safeEnd)
        );
      }
    }
  }

  try {
    return Decoration.set(marks, true);
  } catch {
    return Decoration.none;
  }
};

const spanDecorationField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state.facet(spansFacet), state.doc.length);
  },
  update(decorations, tr) {
    const currentSpans = tr.state.facet(spansFacet);
    const oldSpans = tr.startState.facet(spansFacet);

    if (currentSpans !== oldSpans) return buildDecorations(currentSpans, tr.state.doc.length);

    let nextDecorations = decorations.map(tr.changes);
    const size = (nextDecorations as any).size || 0;

    if (tr.docChanged && size === 0 && currentSpans.length > 0) {
      nextDecorations = buildDecorations(currentSpans, tr.state.doc.length);
    }

    return nextDecorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// --- COMPONENT ---
export const CodeMirrorWrapper: React.FC<Props> = ({
  value,
  spans,
  segments = [],
  activeSegmentId,
  editorContext,
  onChange,
  onSegmentJoinRequest,
  onSpanClick,
  onSelectionChange,
  onProtectSpans,
  placeholder,
}) => {

  const selectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const extensions = useMemo(
    () => [
      EditorView.lineWrapping,
      editorTheme,
      
      spansFacet.of(spans),
      spanDecorationField,

      segmentsFacet.of(segments),
      segmentDecorationField,

      activeSegmentFacet.of(activeSegmentId),
      activeSegmentDecorationField,

      EditorState.transactionFilter.of((tr) => {
        if (tr.annotation(intentionalTextReplace)) return tr;
        if (!tr.docChanged || tr.annotation(Transaction.remote)) return tr;
        if (tr.annotation(Transaction.userEvent) === undefined) return tr;

        let blockForJoin = false;
        let joinSeg1: Segment | null = null;
        let joinSeg2: Segment | null = null;
        
        const affectedSpanIds = new Set<string>();

        const currentSegments = tr.state.facet(segmentsFacet);

        tr.changes.iterChanges((fromA, toA, fromB, toB) => {
          const isDeletion = toA > fromA;
          const isInsertion = toB > fromB;

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

          tr.startState.field(spanDecorationField).between(fromA, toA, (from, to, value) => {
            const spanId = value.spec.attributes["data-span-id"];
            if (!spanId) return;

            if (isDeletion) {
              if (Math.max(from, fromA) < Math.min(to, toA)) {
                affectedSpanIds.add(spanId);
              }
            } else if (isInsertion) {
              if (fromA > from && fromA < to) {
                affectedSpanIds.add(spanId);
              }
            }
          });
        });

        if (blockForJoin && joinSeg1 && joinSeg2) {
          setTimeout(() => onSegmentJoinRequest?.(joinSeg1!.id, joinSeg2!.id), 0);
          return []; 
        }

        if (affectedSpanIds.size > 0) {
          const currentSpans = tr.state.facet(spansFacet);
          const affectedSpans = Array.from(affectedSpanIds)
            .map(id => currentSpans.find(s => getSpanId(s) === id))
            .filter(Boolean) as NerSpan[];
            
          setTimeout(() => onProtectSpans?.(affectedSpans), 0);
          return []; 
        }

        return tr;
      }),

      EditorView.updateListener.of((update) => {
        if (!onSelectionChange) return;

        if (selectionTimeoutRef.current) clearTimeout(selectionTimeoutRef.current);

        if (update.selectionSet || update.docChanged) {
          const range = update.state.selection.main;

          if (range.empty) {
            onSelectionChange(null);
            return;
          }

          const overlapsSpan = spans.some(
            (s) => Math.max(Number(s.start), range.from) < Math.min(Number(s.end), range.to)
          );

          const overlapsBoundary = segments.some((seg, i) => {
            if (i === segments.length - 1) return false;
            const nextSeg = segments[i + 1];
            return range.from < nextSeg.start && range.to > seg.end;
          });

          if (overlapsSpan || overlapsBoundary) {
            onSelectionChange(null);
            return;
          }

          selectionTimeoutRef.current = setTimeout(() => {
            const coords = update.view.coordsAtPos(range.from);
            if (coords) {
              onSelectionChange({
                start: range.from,
                end: range.to,
                top: coords.bottom,
                left: coords.left,
              });
            }
          }, 250);
        }
      }),
    ],
    [spans, segments, activeSegmentId, onSelectionChange, onProtectSpans, onSegmentJoinRequest] 
  );

  const handleWrapperClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const boundaryTarget = (e.target as HTMLElement).closest(
        ".cm-segment-boundary-widget, .cm-segment-border-space"
      );
          
      if (boundaryTarget && onSegmentJoinRequest) {
        const id1 = boundaryTarget.getAttribute("data-join-seg1");
        const id2 = boundaryTarget.getAttribute("data-join-seg2");
        if (id1 && id2) {
          e.preventDefault(); 
          onSegmentJoinRequest(id1, id2);
          return;
        }
      }
        
      const target = (e.target as HTMLElement).closest(".cm-ner-span") as HTMLElement;
      const view = editorRef.current?.view;
      if (!target || !view) return;

      const spanId = target.getAttribute("data-span-id");
      if (!spanId || !onSpanClick) return;

      const decorations = view.state.field(spanDecorationField);
      const iter = decorations.iter();

      let currentStart = -1;
      let currentEnd = -1;

      while (iter.value !== null) {
        if (iter.value.spec.attributes["data-span-id"] === spanId) {
          currentStart = iter.from;
          currentEnd = iter.to;
          break;
        }
        iter.next();
      }

      const clickedSpan = spans.find((s) => getSpanId(s) === spanId);
      if (!clickedSpan || currentStart === -1) return;

      const replaceTextFn = (newText: string) => {
        const v = editorRef.current?.view;
        if (!v) return;

        const liveIter = v.state.field(spanDecorationField).iter();
        let liveStart = currentStart;
        let liveEnd = currentEnd;

        while (liveIter.value !== null) {
          if (liveIter.value.spec.attributes["data-span-id"] === spanId) {
            liveStart = liveIter.from;
            liveEnd = liveIter.to;
            break;
          }
          liveIter.next();
        }

        v.dispatch({
          annotations: intentionalTextReplace.of(true),
          changes: { from: liveStart, to: liveEnd, insert: newText },
        });
      };

      onSpanClick(
        { ...clickedSpan, id: spanId, start: currentStart, end: currentEnd },
        target,
        replaceTextFn
      );
    },
    [spans, onSpanClick]
  );

  return (
    <div
      className="cm-editor-container"
      onClick={handleWrapperClick}
      style={{
        flex: 1, height: "100%", width: "100%", display: "flex", flexDirection: "column",
        borderRadius: "8px", border: "1px solid #d1d5db", backgroundColor: "#ffffff",
        overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
     <CodeMirror
        ref={editorRef}
        value={value}
        height="100%"
        style={{ flexGrow: 1, height: "100%" }}
        extensions={extensions}
        onChange={(val, viewUpdate) => {
          const isUserEvent = viewUpdate.transactions.some(
            (tr) => tr.annotation(Transaction.userEvent) !== undefined || tr.annotation(intentionalTextReplace)
          );

          if (!isUserEvent) return;

          const decorations = viewUpdate.state.field(spanDecorationField);
          const iter = decorations.iter();
          const liveCoords = new Map<string, { start: number; end: number }>();

          while (iter.value !== null) {
            const id = iter.value.spec.attributes["data-span-id"];
            if (id) liveCoords.set(id, { start: iter.from, end: iter.to });
            iter.next();
          }

          let liveSegments = segments;
          if (viewUpdate.docChanged && segments.length > 0) {
            liveSegments = segments.map((seg) => ({
              ...seg,
              start: viewUpdate.changes.mapPos(seg.start, -1),
              end: viewUpdate.changes.mapPos(seg.end, 1),
            }));
          }

          onChange(val, liveCoords, liveSegments, editorContext, activeSegmentId);
        }}
        placeholder={placeholder}
        basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
      />
    </div>
  );
};