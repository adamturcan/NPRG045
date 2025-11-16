import React, { useCallback } from "react";
import { Range } from "slate";
import { ReactEditor } from "slate-react";
import EntityLeaf from "../../components/editor/EntityLeaf";
import type { EntityLeafProps } from "../../../types/NotationEditor";
import type { SelectionBox } from "../../../types/NotationEditor";

type Span = { start: number; end: number; entity: string };

export function useRenderLeaf(params: {
  editor: ReactEditor;
  globalToPoint: (g: number) => { path: number[]; offset: number };
  posFromDomRange: (r: globalThis.Range, rect: DOMRect) => { left: number; top: number; width: number; height: number };
  containerRef: React.RefObject<HTMLDivElement>;
  activeSpan: Span | null;
  setActiveSpan: (s: Span | null) => void;
  setSelBox: (v: SelectionBox| null) => void;
  setSpanBox: (v: { top: number; left: number; span: Span } | null) => void;
}) {
  const { editor, globalToPoint, posFromDomRange, containerRef, activeSpan, setActiveSpan, setSelBox, setSpanBox } = params;
  return useCallback((props: import("slate-react").RenderLeafProps) => {
    const { attributes, children, leaf: leafData } = props;

    const handleSpanClick = (clicked: Span | null) => {
      if (clicked) {
        setActiveSpan(clicked);
        setSelBox(null);
        try {
          const range: Range = { anchor: globalToPoint(clicked.start), focus: globalToPoint(clicked.end) };
          const domRange = ReactEditor.toDOMRange(editor, range);
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const p = posFromDomRange(domRange, rect);
            if (p.width > 0 && p.height > 0) setSpanBox({ top: p.top, left: p.left, span: clicked });
            else setSpanBox(null);
          }
        } catch {
          setSpanBox(null);
        }
      } else {
        setActiveSpan(null);
        setSpanBox(null);
      }
    };

    return (
      <EntityLeaf
        attributes={attributes}
        children={children}
        leaf={leafData as unknown as EntityLeafProps["leaf"]}
        onSpanClick={handleSpanClick}
        activeSpan={activeSpan}
      />
    );
  }, [activeSpan, editor, globalToPoint, posFromDomRange, setActiveSpan, setSelBox, setSpanBox, containerRef]);
}

export const createRenderLeaf = useRenderLeaf;

