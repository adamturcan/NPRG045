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

const getSpanId = (s: NerSpan) => s.id ?? `span-${s.start}-${s.end}-${s.entity}`;

interface Props {
  value: string;
  spans: NerSpan[];
  isActive?: boolean;
  onChange: (value: string, liveCoords?: Map<string, { start: number; end: number }>, deadSpanIds?: string[]) => void; 
  onSpanClick?: (span: NerSpan, anchorElement: HTMLElement, replaceTextFn: (newText: string) => void) => void;
  onSelectionChange?: (selection: { start: number; end: number; top: number; left: number } | null) => void;
  placeholder?: string;
}

export const CodeMirrorWrapper: React.FC<Props> = ({
  value, spans, isActive = false,
  onChange, onSpanClick, onSelectionChange, placeholder,
}) => {
  const selectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const extensions = useMemo(() => [
    EditorView.lineWrapping,
    editorTheme,
    
    spansFacet.of(spans),
    spanDecorationField,
    createSpanProtectionFilter(),

    createSelectionObserver(spans, onSelectionChange, selectionTimeoutRef)
  ], [spans, onSelectionChange]);

  const handleWrapperClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      
    const target = (e.target as HTMLElement).closest(".cm-ner-span") as HTMLElement;
    const view = editorRef.current?.view;
    if (target && view && onSpanClick) {
      handleSpanClickEvent(target, view, spans, onSpanClick);
    }
  }, [spans, onSpanClick]);

  return (
    <div
      className={`cm-editor-container ${isActive ? "active-editor" : "inactive-editor"}`}
      onClick={handleWrapperClick}
      style={{
        flex: 1, height: "100%", width: "100%", display: "flex", flexDirection: "column",
        borderRadius: "8px", border: "1px solid #d1d5db", 
        backgroundColor: isActive ? "#ffffff" : "#f9fafb",
        overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        transition: "background-color 0.2s ease"
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

          const deadSpanIds = spans.map(getSpanId).filter(id => !liveCoords.has(id));

          onChange(val, liveCoords, deadSpanIds);
        }}
        placeholder={placeholder}
        basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
      />
    </div>
  );
};