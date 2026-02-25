// src/presentation/components/editor/NotationInteractionLayer.tsx
import React, { useRef, useState, useCallback, useEffect } from "react";
import { Editable } from "slate-react";
import { useNotationEditor } from "./NotationEditorRoot";
import { useOptimizedDecorations } from "../hooks/useOptimizedDecorations";
import { useRenderLeaf } from "../../../hooks/editor/useRenderLeaf";
import { useKeyboardHandlers } from "../../../hooks/editor/useKeyboardHandlers";
import { useAnnotationActions } from "../../../hooks/editor/useAnnotationActions";
import { useDeletionDialogs } from "../../../hooks/editor/useDeletionDialogs";
import { useMenuHandlers } from "../../../hooks/editor/useMenuHandlers";
import { useSelectionOverlay } from "../../../hooks/editor/useSelectionOverlay";
import EditorContainer from "../EditorContainer";
import { EditorPlaceholder } from "../EditorPlaceholder";
import { posFromDomRange } from "../../../../shared/utils/editorDom";
import type { NerSpan, SelectionBox, SpanBox } from "../../../../types/NotationEditor";

interface UIState {
  selBox: SelectionBox | null;
  spanBox: SpanBox | null;
  selMenuAnchor: HTMLElement | null;
  spanMenuAnchor: HTMLElement | null;
  setSelMenuAnchor: (el: HTMLElement | null) => void;
  setSpanMenuAnchor: (el: HTMLElement | null) => void;
  handleSelectionClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleSpanClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleSelectionMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  handleSpanMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  handleMenuMouseDown: (e: React.MouseEvent) => void;
  dialogs: ReturnType<typeof useDeletionDialogs>; 
  
  actions: ReturnType<typeof useAnnotationActions> & {
    onDeleteSpan?: (span: NerSpan) => void;
  };
}

interface InteractionProps {
  children: (props: UIState) => React.ReactNode;
  placeholder?: string;
  activeSegmentId?: string;
  selectedSegmentId?: string;
  highlightedCategories?: string[];
  activeTab?: string;
  onAddSpan?: (span: NerSpan) => void;
  onDeleteSpan?: (span: NerSpan) => void;
}

export const NotationInteractionLayer: React.FC<InteractionProps> = ({
  children,
  placeholder,
  activeSegmentId,
  selectedSegmentId,
  highlightedCategories = [],
  activeTab,
  onAddSpan,
  onDeleteSpan
}) => {
  const { 
    editor, localSpans, setLocalSpans, localSegments, 
    activeSpan, setActiveSpan, pointToGlobal, globalToPoint, indexByPath 
  } = useNotationEditor();

  const containerRef = useRef<HTMLDivElement>(null);
  const [selBox, setSelBox] = useState<SelectionBox | null>(null);
  const [spanBox, setSpanBox] = useState<SpanBox | null>(null);
  const [selMenuAnchor, setSelMenuAnchor] = useState<HTMLElement | null>(null);
  const [spanMenuAnchor, setSpanMenuAnchor] = useState<HTMLElement | null>(null);
  const suppressCloseRef = useRef(false);

  const closeAllUI = useCallback(() => {
     setSelBox(null); setSpanBox(null); setSelMenuAnchor(null); setSpanMenuAnchor(null); setActiveSpan(null);
  }, [setActiveSpan]);

  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (!selBox && !spanBox && !selMenuAnchor && !spanMenuAnchor) return;

      const target = event.target as HTMLElement;

      if (target.closest('.MuiPopover-root') || target.closest('.MuiMenu-list')) {
        return;
      }

      if (containerRef.current && containerRef.current.contains(target)) {
        return; 
      }
      
      closeAllUI();
    };

    document.addEventListener("mousedown", handleGlobalClick);
    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
    };
  }, [selBox, spanBox, selMenuAnchor, spanMenuAnchor, closeAllUI]);

  const actions = useAnnotationActions({
    activeSegmentId, localSpans, setLocalSpans, onAddSpan, onDeleteSpan, closeAllUI
  });

  const dialogs = useDeletionDialogs({
    editor, globalToPoint, onDeleteSpan, setLocalSpans, closeAllUI
  });

  const menuHandlers = useMenuHandlers({
    suppressCloseRef, setSelMenuAnchor, setSpanMenuAnchor
  });

  const keyboard = useKeyboardHandlers({
    editor, pointToGlobal, 
    findSpanAtCursor: actions.findSpanAtCursor,
    findSpansInSelection: actions.findSpansInSelection,
    requestMultiDeleteSpans: dialogs.requestMultiDeleteSpans,
    requestDeleteSpan: dialogs.requestDeleteSpan,
    closeAllUI, setSelBox, setSpanBox, setSelMenuAnchor, setSpanMenuAnchor, 
    segments: localSegments
  });

  const selectionOverlay = useSelectionOverlay({
    editor, 
    activeSegmentId, 
    pointToGlobal, 
    selectionOverlapsExisting: actions.selectionOverlapsExisting,
    
    updateBubblePosition: (box) => setSelBox(box), 
    
    onSelectionChange: () => {},
    
    containerRef, 
    
    throttleMs: 100, 
    debounceMs: 150
  });

  const decorate = useOptimizedDecorations(
    indexByPath, localSpans, localSegments, activeSpan, highlightedCategories, activeSegmentId, selectedSegmentId, activeTab
  );

  const renderLeaf = useRenderLeaf({
    editor, globalToPoint, posFromDomRange,
    containerRef: containerRef as React.RefObject<HTMLElement>, 
    activeSpan, setActiveSpan, setSelBox, setSpanBox
  });

  return (
    <EditorContainer containerRef={containerRef}>
      <Editable
        placeholder={placeholder}
        decorate={decorate}
        renderLeaf={renderLeaf}
        onKeyDown={keyboard.onKeyDown}
        onSelect={selectionOverlay.onSelectThrottled}
        renderPlaceholder={(props) => <EditorPlaceholder {...props} />}
        style={{ flex: 1, padding: "18px", whiteSpace: "pre-wrap", outline: "none" }}
        
        // Close bubbles when clicking inside the editor
        onMouseDown={(e) => {
          if (e.defaultPrevented) return;
          closeAllUI();
        }}
      />
      
      {children({
        selBox, spanBox, selMenuAnchor, spanMenuAnchor,
        setSelMenuAnchor, setSpanMenuAnchor,
        ...menuHandlers,
        dialogs,
        
        //Wrap onDeleteSpan to handle auto-closing
        actions: {
          ...actions,
          onDeleteSpan: (span) => {
             if (onDeleteSpan) {
               onDeleteSpan(span);
               closeAllUI(); 
             }
          }
        }
      })}
    </EditorContainer>
  );
};