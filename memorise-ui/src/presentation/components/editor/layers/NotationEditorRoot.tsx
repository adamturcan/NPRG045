// src/presentation/components/editor/NotationEditorRoot.tsx
import React, { useMemo, useState, useCallback, useEffect, createContext, useContext} from "react";
import { createEditor, type Descendant, type BaseEditor } from "slate";
import { Slate, withReact, type ReactEditor } from "slate-react";
import { withHistory, type HistoryEditor } from "slate-history";
import { toInitialValue, toPlainTextWithNewlines } from "../../../../shared/constants/notationEditor";
import { useGlobalCoordinates } from "../../../hooks/editor/useGlobalCoordinates";
import { useSpanOperationTransform } from "../hooks/useSpanOperationTransform";
import type { NerSpan, LeafInfo } from "../../../../types/NotationEditor";
import type { Segment } from "../../../../types/Segment";

type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;

interface EditorContextType {
  editor: CustomEditor;
  localSpans: NerSpan[];
  setLocalSpans: React.Dispatch<React.SetStateAction<NerSpan[]>>;
  localSegments: Segment[];
  activeSpan: NerSpan | null;
  setActiveSpan: (s: NerSpan | null) => void;
  pointToGlobal: (path: number[], offset: number) => number;
  globalToPoint: (g: number) => { path: number[]; offset: number };
  indexByPath: Map<string, LeafInfo>;
}

const NotationEditorContext = createContext<EditorContextType | null>(null);

export function useNotationEditor() {
  const ctx = useContext(NotationEditorContext);
  if (!ctx) throw new Error("useNotationEditor must be used within NotationEditorRoot");
  return ctx;
}

interface RootProps {
  initialValue: string; 
  onChange: (val: string) => void;
  spans: NerSpan[];
  segments: Segment[];
  onSpansAdjusted?: (spans: NerSpan[]) => void;
  onSegmentsAdjusted?: (segments: Segment[]) => void;
  children: React.ReactNode;
  selectedSegmentId?: string;
}

export const NotationEditorRoot: React.FC<RootProps> = ({
  initialValue,
  onChange,
  spans,
  segments,
  onSpansAdjusted,
  onSegmentsAdjusted,
  children,
  selectedSegmentId,
}) => {
  const editor = useMemo(() => {
    const e = withHistory(withReact(createEditor()));
    return e as CustomEditor;
  }, []); 

  const initialSlateValue = useMemo(() => {
    return toInitialValue(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const getInitialSpans = useCallback(() => {
    const selectedSegment = segments.find(s => s.id === selectedSegmentId);
    let result: NerSpan[];
    if (selectedSegment && selectedSegmentId) {
      result = spans
        .filter(s => s.start >= selectedSegment.start && s.end <= selectedSegment.end)
        .map(s => ({ ...s, start: s.start - selectedSegment.start, end: s.end - selectedSegment.start }));
    } else {
      result = spans;
    }
    return [...result].sort((a, b) => a.start - b.start);
  }, [segments, selectedSegmentId, spans]);

  const [localSpans, setLocalSpans] = useState<NerSpan[]>(getInitialSpans);
  const [localSegments, setLocalSegments] = useState<Segment[]>(segments);
  const [activeSpan, setActiveSpan] = useState<NerSpan | null>(null);
  
  const [currentChildren, setCurrentChildren] = useState<Descendant[]>(initialSlateValue);

  useEffect(() => {
    setLocalSpans(getInitialSpans());
    setLocalSegments(segments);
  }, [getInitialSpans, segments]);

  const { indexByPath, pointToGlobal, globalToPoint ,leafIndex} = useGlobalCoordinates(currentChildren);
  
  const transformOps = useSpanOperationTransform(pointToGlobal,leafIndex);

  const handleSlateChange = useCallback((newValue: Descendant[]) => {
    const ops = editor.operations;
    
    const hasContentChange = ops.some(op => 
      op.type === 'insert_text' || op.type === 'remove_text' || 
      op.type === 'split_node' || op.type === 'merge_node' || op.type === 'remove_node'
    );

    if (!hasContentChange) {
      return; 
    }

    const { nextSpans, nextSegments } = transformOps(ops, localSpans, localSegments);
    
    setLocalSpans(nextSpans);
    setLocalSegments(nextSegments);
    
    setCurrentChildren(newValue);

    if (onSpansAdjusted) {
       onSpansAdjusted(nextSpans);
    }
    if (onSegmentsAdjusted) {
      onSegmentsAdjusted(nextSegments);
    }

    const plainText = toPlainTextWithNewlines(newValue);
    if (plainText !== initialValue) { 
        onChange(plainText);
    }
  }, [editor, localSpans, localSegments, transformOps, onSpansAdjusted, onSegmentsAdjusted, onChange, initialValue]);

  const contextValue = useMemo(() => ({
    editor,
    localSpans,
    setLocalSpans,
    localSegments,
    activeSpan,
    setActiveSpan,
    pointToGlobal,
    globalToPoint,
    indexByPath
  }), [editor, localSpans, localSegments, activeSpan, pointToGlobal, globalToPoint, indexByPath]);

  return (
    <Slate 
      editor={editor} 
      initialValue={initialSlateValue} 
      onChange={handleSlateChange}
    >
      <NotationEditorContext.Provider value={contextValue}>
        {children}
      </NotationEditorContext.Provider>
    </Slate>
  );
};