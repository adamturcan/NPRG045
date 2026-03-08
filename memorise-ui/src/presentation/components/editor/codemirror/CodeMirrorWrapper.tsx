import React, { useMemo, useCallback, useRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { Transaction } from "@codemirror/state";

import type { NerSpan } from "../../../../types/NotationEditor";

import { editorTheme } from "./theme/theme";
import { spansFacet, spanDecorationField } from "./features/spans/spanDecorations";
import { createSpanProtectionFilter, intentionalTextReplace } from "./features/spans/spanProtection";
import { handleSpanClickEvent } from "./features/spans/spanInteractions";
import { createSelectionObserver } from "./features/core/selectionObserver";

interface Props {
  value: string;
  spans: NerSpan[];
  onChange: (value: string, liveCoords?: Map<string, { start: number; end: number }>) => void;
  onSpanClick?: (span: NerSpan, anchorElement: HTMLElement, replaceTextFn: (newText: string) => void) => void;
  onSelectionChange?: (selection: { start: number; end: number; top: number; left: number } | null) => void;
  onProtectSpans?: (affectedSpans: NerSpan[]) => void;
  placeholder?: string;
}

export const CodeMirrorWrapper: React.FC<Props> = ({
  value, spans, onChange, onSpanClick, onSelectionChange, onProtectSpans, placeholder,
}) => {
  const selectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const extensions = useMemo(() => [
    EditorView.lineWrapping,
    editorTheme,
    spansFacet.of(spans),
    spanDecorationField,
    createSpanProtectionFilter(onProtectSpans),
    createSelectionObserver(spans, [], onSelectionChange, selectionTimeoutRef)
  ], [spans, onSelectionChange, onProtectSpans]);

  const handleWrapperClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest(".cm-ner-span") as HTMLElement;
    const view = editorRef.current?.view;
    if (target && view && onSpanClick) {
      handleSpanClickEvent(target, view, spans, onSpanClick);
    }
  }, [spans, onSpanClick]);

  return (
    <div
      className="cm-editor-container"
      onClick={handleWrapperClick}
      style={{
        width: "100%", 
        display: "flex", 
        flexDirection: "column",
        backgroundColor: "transparent",
        // HEIGHT PROP REMOVED: Naturally expands with text!
      }}
    >
     <CodeMirror
        ref={editorRef}
        value={value}
        style={{ width: "100%" }}
        extensions={extensions}
        onChange={(val, viewUpdate) => {
          const isUserEvent = viewUpdate.transactions.some(
            (tr) => tr.annotation(Transaction.userEvent) !== undefined || tr.annotation(intentionalTextReplace)
          );
        
          if (!isUserEvent) return;
        
          // Get the LIVE coordinates from the state field directly
          const decorations = viewUpdate.state.field(spanDecorationField);
          const iter = decorations.iter();
          const liveCoords = new Map<string, { start: number; end: number }>();
        
          while (iter.value !== null) {
            const id = iter.value.spec.attributes["data-span-id"];
            if (id) {
              // iter.from and iter.to are the absolute latest positions in CM6
              liveCoords.set(id, { start: iter.from, end: iter.to });
            }
            iter.next();
          }
        
          // Pass these live positions up IMMEDIATELY with the text
          onChange(val, liveCoords);
        }}
        placeholder={placeholder}
        basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
      />
    </div>
  );
};