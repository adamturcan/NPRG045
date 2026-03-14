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
  onChange: (value: string, liveCoords?: Map<string, { start: number; end: number }>, deadIds?: string[]) => void;
  onSpanClick?: (span: NerSpan, anchorElement: HTMLElement, replaceTextFn: (newText: string) => void) => void;
  onSelectionChange?: (selection: { start: number; end: number; top: number; left: number } | null) => void;
  placeholder?: string;
}

const getSpanId = (s: NerSpan) => s.id ?? `span-${s.start}-${s.end}-${s.entity}`;

export const CodeMirrorWrapper: React.FC<Props> = ({
  value, spans, onChange, onSpanClick, onSelectionChange, placeholder,
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
      className="cm-editor-container"
      onClick={handleWrapperClick}
      style={{
        width: "100%", 
        display: "flex", 
        flexDirection: "column",
        backgroundColor: "transparent",
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
        
          const decorations = viewUpdate.state.field(spanDecorationField);
          const iter = decorations.iter();
          const liveCoords = new Map<string, { start: number; end: number }>();
        
          while (iter.value !== null) {
            const id = iter.value.spec.attributes["data-span-id"];
            if (id && iter.from < iter.to) {
              liveCoords.set(id, { start: iter.from, end: iter.to });
            }
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