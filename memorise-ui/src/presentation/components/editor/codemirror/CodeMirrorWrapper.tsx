import React, { useMemo, useCallback, useRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { Transaction } from "@codemirror/state";

import type { NerSpan } from "../../../../types/NotationEditor";
import type { Segment } from "../../../../types/Segment";

// --- Feature Slices ---
import { editorTheme } from "./theme/theme";
import { segmentsFacet, segmentDecorationField } from "./features/segments/segmentDecorations";
import { activeSegmentFacet, activeSegmentDecorationField } from "./features/segments/activeSegmentHighlight";
import { createSegmentProtectionFilter } from "./features/segments/segmentProtection";
import { spansFacet, spanDecorationField } from "./features/spans/spanDecorations";
import { createSpanProtectionFilter, intentionalTextReplace } from "./features/spans/spanProtection";
import { handleSpanClickEvent } from "./features/spans/spanInteractions";
import { createSelectionObserver } from "./features/core/selectionObserver";

interface Props {
  value: string;
  spans: NerSpan[];
  segments?: Segment[];
  activeSegmentId?: string; 
  editorContext: string;    
  onChange: (value: string, liveCoords?: Map<string, { start: number; end: number }>, liveSegments?: Segment[], contextMode?: string, contextSegId?: string) => void;
  onSegmentJoinRequest?: (seg1Id: string, seg2Id: string) => void;
  onSpanClick?: (span: NerSpan, anchorElement: HTMLElement, replaceTextFn: (newText: string) => void) => void;
  onSelectionChange?: (selection: { start: number; end: number; top: number; left: number } | null) => void;
  onProtectSpans?: (affectedSpans: NerSpan[]) => void;
  placeholder?: string;
}

export const CodeMirrorWrapper: React.FC<Props> = ({
  value, spans, segments = [], activeSegmentId, editorContext,
  onChange, onSegmentJoinRequest, onSpanClick, onSelectionChange, onProtectSpans, placeholder,
}) => {
  const selectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const extensions = useMemo(() => [
    EditorView.lineWrapping,
    editorTheme,
    
    spansFacet.of(spans),
    spanDecorationField,
    createSpanProtectionFilter(onProtectSpans),

    segmentsFacet.of(segments),
    segmentDecorationField,
    activeSegmentFacet.of(activeSegmentId),
    activeSegmentDecorationField,
    createSegmentProtectionFilter(onSegmentJoinRequest),

    createSelectionObserver(spans, segments, onSelectionChange, selectionTimeoutRef)
  ], [spans, segments, activeSegmentId, onSelectionChange, onProtectSpans, onSegmentJoinRequest]);

  const handleWrapperClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const boundaryTarget = (e.target as HTMLElement).closest(".cm-segment-boundary-widget, .cm-segment-border-space");
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
    if (target && view && onSpanClick) {
      handleSpanClickEvent(target, view, spans, onSpanClick);
    }
  }, [spans, onSpanClick, onSegmentJoinRequest]);

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