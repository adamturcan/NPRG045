// src/components/editor/NotationEditor.tsx
/**
 * NotationEditor - Main NER (Named Entity Recognition) annotation editor
 * 
 * This is a full-featured text annotation editor built on Slate.js that allows users to:
 * - Edit text content
 * - Select text and annotate it with entity categories (Person, Location, Organization, etc.)
 * - Click existing annotations to edit or delete them
 * - Prevent overlapping annotations
 * 
 * ARCHITECTURE:
 * 
 * 1. Coordinate System:
 *    - Slate uses Path/Offset for internal positioning (e.g., [0, 0], offset: 5)
 *    - We use "global offsets" for API communication (single integer positions)
 *    - leafIndex maps between these two coordinate systems
 * 
 * 2. Decorations:
 *    - Entity spans are rendered using Slate's decoration system
 *    - The decorate() function converts global offsets to Slate ranges
 *    - Each decoration adds underline/entity properties to leaf nodes
 * 
 * 3. UI Bubbles:
 *    - SelectionBubble: Appears when text is selected (for new annotations)
 *    - SpanBubble: Appears when an annotation is clicked (for editing)
 *    - Both position themselves relative to the EditorContainer
 * 
 * 4. Event Handling:
 *    - suppressCloseRef prevents bubbles from closing during interaction
 *    - Outside clicks, Escape key, and scroll events close all UI
 */
import { Box } from "@mui/material";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Descendant } from "slate";
import { createEditor, Range } from "slate";
import { withHistory } from "slate-history";
import { Editable, ReactEditor, Slate, withReact } from "slate-react";
import { posFromDomRange } from "../../../shared/utils/editorDom";
import { useGlobalCoordinates } from "../../hooks/editor/useGlobalCoordinates";

// Import types and constants
import { 
  COLORS, 
  toInitialValue, 
  toPlainTextWithNewlines 
} from "../../../shared/constants/notationEditor";
import type {
  NerSpan,
  NotationEditorProps,
  SelectionBox,
  SpanBox,
} from "../../../types/NotationEditor";

// Import subcomponents
import { useDecorations } from "../../hooks/editor/useDecorations";
import { useRenderLeaf } from "../../hooks/editor/useRenderLeaf";
import { useAnnotationActions } from "../../hooks/editor/useAnnotationActions";
import CategoryMenu from "./CategoryMenu";
import DeletionConfirmationDialog from "./DeletionConfirmationDialog";
import EditorContainer from "./EditorContainer";
import { EditorPlaceholder } from "./EditorPlaceholder";
import MultiDeletionDialog from "./MultiDeletionDialog";
import SelectionBubble from "./SelectionBubble";
import SpanBubble from "./SpanBubble";
import { useSelectionOverlay } from "../../hooks/editor/useSelectionOverlay";
import { useEditorUiClosers } from "../../hooks/editor/useEditorUiClosers";
import { useKeyboardHandlers } from "../../hooks/editor/useKeyboardHandlers";
import { useMenuHandlers } from "../../hooks/editor/useMenuHandlers";
import { useDeletionDialogs } from "../../hooks/editor/useDeletionDialogs";
import { useSpanAutoAdjust } from "../../hooks/editor/useSpanAutoAdjust";


const NotationEditor: React.FC<NotationEditorProps> = ({
  value,
  onChange,
  placeholder,
  spans = [],
  onDeleteSpan,
  highlightedCategories = [],
  onSelectionChange,
  onAddSpan,
  segments = [],
  activeSegmentId,
  onSpansAdjusted,
}) => {
  // Initialize Slate editor with React and History plugins
  const editor = useMemo(() => {
    const baseEditor = createEditor();
    return withHistory(withReact(baseEditor));
  }, []);

  // Internal Slate document state
  const [slateValue, setSlateValue] = useState<Descendant[]>(() =>
    toInitialValue(value)
  );

  // Track the currently clicked/active annotation span
  const [activeSpan, setActiveSpan] = useState<NerSpan | null>(null);
  
  // Local copy of spans for optimistic UI updates
  const [localSpans, setLocalSpans] = useState<NerSpan[]>(spans);
  useEffect(() => {
    setLocalSpans(spans);
  }, [spans]);

 

  // Sync internal state when external value prop changes
  useEffect(() => {
    setSlateValue(toInitialValue(value));
    setActiveSpan(null);
  }, [value]);

  // Span adjustments are reported synchronously from useSpanAutoAdjust's onAdjusted

  // Container ref used to calculate bubble positions
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Selection bubble state (for new annotations)
  const [selBox, setSelBox] = useState<SelectionBox | null>(null);
  const [selMenuAnchor, setSelMenuAnchor] = useState<HTMLElement | null>(null);

  // Span bubble state (for editing existing annotations)
  const [spanBox, setSpanBox] = useState<SpanBox | null>(null);
  const [spanMenuAnchor, setSpanMenuAnchor] = useState<HTMLElement | null>(
    null
  );

  /**
   * Close all bubbles and menus
   */
  const closeAllUI = useCallback(() => {
    setSelBox(null);
    setSpanBox(null);
    setSelMenuAnchor(null);
    setSpanMenuAnchor(null);
    setActiveSpan(null);
    ReactEditor.blur(editor);
  }, [editor]);

 

  // Flag to prevent bubbles from closing during interaction
  const suppressCloseRef = useRef(false);
  

  /**
   * ============================================================================
   * COORDINATE SYSTEM: Converting between Slate paths and global offsets
   * ============================================================================
   * 
   * Slate uses [path, offset] (e.g., [0, 0], 5) to identify positions.
   * The API uses global integer offsets (e.g., 42).
   * 
   * leafIndex: Array of all text leaves with their global start/end positions
   * indexByPath: Map for quick lookup of leaf info by path
   */
  const {  indexByPath, pointToGlobal, globalToPoint } =
  useGlobalCoordinates(editor, slateValue);
  const { applyPendingOps } = useSpanAutoAdjust({
    editor: editor as unknown as ReactEditor,
    pointToGlobal,
    getSpans: () => localSpans,
    setSpans: setLocalSpans,
    version: slateValue,
    onAdjusted: onSpansAdjusted,
  });

  // Deletion dialogs and flows
  const {
    pendingDeletion,
    pendingMultiDeletion,
    getSpanText,
    getSpanTexts,
    requestDeleteSpan,
    confirmDeleteSpan,
    cancelDeleteSpan,
    requestMultiDeleteSpans,
    confirmMultiDeleteSpans,
    cancelMultiDeleteSpans,
  } = useDeletionDialogs({
    editor,
    globalToPoint,
    onDeleteSpan,
    setLocalSpans,
    closeAllUI,
  });

  const deleteCurrentSpanImmediately = React.useCallback(() => {
    if (!spanBox) return;
    const span = spanBox.span;
  
    // 1) call external delete if provided
    onDeleteSpan?.(span);
  
    // 2) update local spans
    setLocalSpans(prev =>
      prev.filter(s => !(s.start === span.start && s.end === span.end && s.entity === span.entity))
    );
  
    // 3) close UI
    setSpanBox(null);
    setSpanMenuAnchor(null);
    setActiveSpan(null);
  }, [spanBox, onDeleteSpan]);
  /**
   * ============================================================================
   * DECORATIONS: Apply visual styling to annotated spans and segments
   * ============================================================================
   * 
   * Slate's decorate function is called for each text node to determine what
   * visual properties (decorations) should be applied. We use this to add:
   * - Underline/entity properties to text that falls within annotation spans
   * - Segment markers to show segment boundaries
   */
 
  const { decorate } = useDecorations({
    indexByPath,
    localSpans,
    activeSpan,
    highlightedCategories,
    segments,
    activeSegmentId,
  });

  /**
   * Custom leaf renderer that delegates to EntityLeaf component
   * Handles span click events to show/hide the SpanBubble
   */
  const renderLeaf = useRenderLeaf({
    editor: editor as unknown as ReactEditor,
    globalToPoint,
    posFromDomRange,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    activeSpan,
    setActiveSpan,
    setSelBox,
    setSpanBox,
  });

  const {
    selectionOverlapsExisting,
    findSpanAtCursor,
    findSpansInSelection,
    pickCategoryForRange,
  } = useAnnotationActions({
    activeSegmentId,
    localSpans,
    setLocalSpans,
    onAddSpan,
    onDeleteSpan,
    closeAllUI,
  });

  /**
   * ============================================================================
   * SELECTION HANDLING: Show/hide the SelectionBubble
   * ============================================================================
   * 
   * Called whenever the editor selection changes. Determines whether to show
   * the SelectionBubble based on:
   * - Is there a non-collapsed selection?
   * - Does it overlap with existing annotations?
   * 
   * Split into two parts for performance:
   * 1. Quick selection state update (throttled)
   * 2. Expensive bubble position calculation (debounced)
   */
  const updateBubblePosition = useCallback((start: number, end: number) => {
    // Verify editor is still focused
    if (!ReactEditor.isFocused(editor)) {
      return;
    }

    const sel = editor.selection;
    if (!sel || !Range.isRange(sel) || Range.isCollapsed(sel)) {
      return;
    }

    // Hide bubble if a segment is active (disable adding spans when segment is highlighted)
    if (activeSegmentId) {
      setSelBox(null);
      return;
    }

    // Hide bubble if selection overlaps any existing span
    if (selectionOverlapsExisting(start, end)) {
      setSelBox(null);
      return;
    }

    // Calculate bubble position (expensive DOM operations)
    try {
      const domRange = ReactEditor.toDOMRange(editor, sel);
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        const p = posFromDomRange(domRange, containerRect);
        if (p.width > 0 && p.height > 0) {
          const s0 = Math.max(0, start);
          const e0 = Math.max(s0, end);
          setSelBox({ top: p.top, left: p.left, start: s0, end: e0 });
        } else {
          setSelBox(null);
        }
      } else {
        setSelBox(null);
      }
    } catch {
      setSelBox(null);
    }
  }, [editor, posFromDomRange, selectionOverlapsExisting, activeSegmentId]);

  const { onSelectThrottled, cancelTimers } = useSelectionOverlay({
    editor: editor as unknown as ReactEditor,
    activeSegmentId,
    pointToGlobal,
    selectionOverlapsExisting,
    updateBubblePosition,
    onSelectionChange,
    throttleMs: 100,
    debounceMs: 150,
  });

 

  /**
   * Delete the currently active annotation span
   */
 
  /**
   * Cleanup: Cancel any pending selection overlay update on unmount
   */
  useEffect(() => {
    return () => {
      cancelTimers();
    };
  }, [cancelTimers]);

  /**
   * Bubble event handlers that prevent accidental closing
   */
  const {
    handleSelectionMouseDown,
    handleSelectionClick,
    handleSpanMouseDown,
    handleSpanClick,
    handleMenuMouseDown,
  } = useMenuHandlers({
    suppressCloseRef,
    setSelMenuAnchor,
    setSpanMenuAnchor,
  });

  // Close-span-only helper for clicks inside editable area
  const closeSpanUI = useCallback(() => {
    setSpanBox(null);
    setSpanMenuAnchor(null);
    setActiveSpan(null);
  }, []);

  // Attach global closers (outside click, Escape) and scroll-closer
  useEditorUiClosers({
    containerRef: containerRef as React.RefObject<HTMLDivElement | null>,
    closeAllUI,
    closeSpanUI,
    suppressCloseRef,
  });

  /**
   * ============================================================================
   * RENDER
   * ============================================================================
   */
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Slate
        editor={editor}
        initialValue={slateValue}
        onChange={(val) => {
          // Apply pending operation-based span adjustments synchronously within onChange,
          // before Slate clears operations, so highlights update in the same tick.
          applyPendingOps();
          setSlateValue(val);
          onChange(toPlainTextWithNewlines(val));
          // Don't update selection overlay here - let onSelect handle it
          // This prevents interference with Shift+Arrow selection
        }}
      >
        <EditorContainer containerRef={containerRef}>
          <Editable
            placeholder={placeholder ?? "Paste text here or upload file"}
            decorate={decorate}
            renderLeaf={renderLeaf}
            spellCheck={false}
            onKeyDown={useKeyboardHandlers({
              editor: editor as unknown as ReactEditor,
              pointToGlobal,
              findSpanAtCursor,
              findSpansInSelection,
              requestMultiDeleteSpans,
              requestDeleteSpan,
              closeAllUI,
              setSelBox,
              setSpanBox,
              setSelMenuAnchor,
              setSpanMenuAnchor,
              segments,
            }).onKeyDown}
            onSelect={onSelectThrottled}
            style={{
              flex: 1,
              padding: "18px 18px 22px 18px",
              minHeight: 0,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              caretColor: COLORS.text,
              position: "relative",
            }}
            renderPlaceholder={(props) => <EditorPlaceholder {...props} />}
          />

          {/* Floating selection "..." button for new annotations */}
          {selBox && (
            <SelectionBubble
              selectionBox={selBox}
              onMenuClick={handleSelectionClick}
              onMouseDown={handleSelectionMouseDown}
            />
          )}

          {/* Category menu for new annotations */}
          <CategoryMenu
            anchorEl={selMenuAnchor}
            onClose={() => setSelMenuAnchor(null)}
            onCategorySelect={(category) =>
              selBox && pickCategoryForRange(selBox.start, selBox.end)(category)
            }
            onMouseDown={handleMenuMouseDown}
          />

          {/* Floating "..." button for editing existing annotations */}
          {spanBox && (
            <SpanBubble
              spanBox={spanBox}
              onMenuClick={handleSpanClick}
              onMouseDown={handleSpanMouseDown}
            />
          )}

          {/* Category menu for editing (includes Delete option) */}
          <CategoryMenu
            anchorEl={spanMenuAnchor}
            onClose={() => setSpanMenuAnchor(null)}
            onCategorySelect={(category) =>
              spanBox &&
              pickCategoryForRange(
                spanBox.span.start,
                spanBox.span.end,
                spanBox.span.entity
              )(category)
            }
            onMouseDown={handleMenuMouseDown}
            showDelete={true}
            onDelete={deleteCurrentSpanImmediately}
          />
        </EditorContainer>

        {/* Deletion confirmation dialog */}
        <DeletionConfirmationDialog
          open={pendingDeletion !== null}
          span={pendingDeletion}
          spanText={pendingDeletion ? getSpanText(pendingDeletion) : undefined}
          onConfirm={confirmDeleteSpan}
          onCancel={cancelDeleteSpan}
        />

        {/* Multi-deletion dialog */}
        <MultiDeletionDialog
          open={pendingMultiDeletion.length > 0}
          spans={pendingMultiDeletion}
          spanTexts={pendingMultiDeletion.length > 0 ? getSpanTexts(pendingMultiDeletion) : new Map()}
          onConfirm={confirmMultiDeleteSpans}
          onCancel={cancelMultiDeleteSpans}
        />
      </Slate>
    </Box>
  );
};

export default NotationEditor;
