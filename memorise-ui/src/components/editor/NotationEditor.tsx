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
import React, {
  useEffect,
  useMemo,
  useCallback,
  useState,
  useRef,
} from "react";
import { createEditor, Path, Editor, Text, Range, Point } from "slate";
import type { Descendant } from "slate";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import { withHistory } from "slate-history";
import { Box } from "@mui/material";

// Import types and constants
import type { 
  NotationEditorProps, 
  NerSpan, 
  SelectionBox, 
  SpanBox, 
  LeafInfo 
} from "../../types/NotationEditor";
import { 
  NEWLINE, 
  COLORS, 
  toInitialValue, 
  toPlainTextWithNewlines 
} from "../../constants/notationEditor";

// Import subcomponents
import EntityLeaf from "./EntityLeaf";
import SelectionBubble from "./SelectionBubble";
import SpanBubble from "./SpanBubble";
import CategoryMenu from "./CategoryMenu";
import EditorContainer from "./EditorContainer";

const NotationEditor: React.FC<NotationEditorProps> = ({
  value,
  onChange,
  placeholder,
  spans = [],
  onDeleteSpan,
  highlightedCategories = [],
  onSelectionChange,
  onAddSpan,
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
  
  // Serialize spans for stable dependency comparison to prevent infinite loops
  // Compare content, not array reference
  const spansSerialized = useMemo(
    () => JSON.stringify(spans),
    [spans]
  );
  
  // Track previous serialized value to prevent unnecessary updates
  const prevSpansSerializedRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Only update if spans content actually changed (not just reference)
    // Skip on initial mount (prevSpansSerializedRef.current is null)
    if (prevSpansSerializedRef.current !== null && spansSerialized !== prevSpansSerializedRef.current) {
      setLocalSpans(spans);
    }
    // Always update the ref to track current value
    prevSpansSerializedRef.current = spansSerialized;
  }, [spansSerialized, spans]);

  // Sync internal state when external value prop changes
  useEffect(() => {
    setSlateValue(toInitialValue(value));
    setActiveSpan(null);
  }, [value]);

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
  const leafIndex = useMemo<LeafInfo[]>(() => {
    const leaves: LeafInfo[] = [];
    let g = 0; // Global offset counter
    let prevBlock: Path | null = null;

    // Walk through all text nodes in the document
    for (const [node, path] of Editor.nodes(editor, {
      at: [],
      match: Text.isText,
    })) {
      const parent = Path.parent(path);
      // Add newline length when crossing block boundaries
      if (prevBlock && !Path.equals(parent, prevBlock)) g += NEWLINE.length;
      const len = (node as Text).text.length;
      leaves.push({ path, gStart: g, gEnd: g + len, len });
      g += len;
      prevBlock = parent;
    }
    return leaves;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, slateValue]);

  // Helper to create map keys from paths
  const keyFromPath = (p: number[]) => p.join(".");
  
  // Index for quick path-to-info lookups
  const indexByPath = useMemo(() => {
    const m = new Map<string, LeafInfo>();
    for (const info of leafIndex) m.set(keyFromPath(info.path), info);
    return m;
  }, [leafIndex]);

  /**
   * Convert Slate point (path + offset) to global offset
   */
  const pointToGlobal = useCallback(
    (path: Path, offset: number): number => {
      const info = indexByPath.get(keyFromPath(path));
      if (!info) return 0;
      return info.gStart + offset;
    },
    [indexByPath]
  );

  /**
   * Convert global offset to Slate point (path + offset)
   */
  const globalToPoint = useCallback(
    (g: number): Point => {
      const info = leafIndex.find((lf) => g >= lf.gStart && g <= lf.gEnd);
      if (!info) {
        // Fallback to end of document
        const last = leafIndex[leafIndex.length - 1];
        return {
          path: last?.path ?? [0, 0],
          offset: Math.max(0, (last?.len ?? 1) - 1),
        };
      }
      const offset = Math.max(0, Math.min(info.len, g - info.gStart));
      return { path: info.path, offset };
    },
    [leafIndex]
  );

  /**
   * Calculate bubble position from a DOM range
   * Positions the bubble at the end of the last line of the selection/span
   */
  const posFromDomRange = useCallback(
    (domRange: globalThis.Range, containerRect: DOMRect) => {
      const rects = Array.from(domRange.getClientRects());
      // Use the last rect (end of selection)
      const r =
        rects.length > 0
          ? rects[rects.length - 1]
          : domRange.getBoundingClientRect();
      const leftRaw = r.right - containerRect.left + 6;
      const topRaw = r.top - containerRect.top - 32;
      // Clamp position to stay within container
      const left = Math.max(6, Math.min(leftRaw, containerRect.width - 36));
      const top = Math.max(6, topRaw);
      return { left, top, width: r.width, height: r.height };
    },
    []
  );

  /**
   * ============================================================================
   * DECORATIONS: Apply visual styling to annotated spans
   * ============================================================================
   * 
   * Slate's decorate function is called for each text node to determine what
   * visual properties (decorations) should be applied. We use this to add
   * underline/entity properties to text that falls within annotation spans.
   */
  const decorate = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (entry: [any, Path]) => {
      const [node, path] = entry;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ranges: any[] = [];
      if (!Text.isText(node)) return ranges;

      // Get the global offset range for this text node
      const info = indexByPath.get(keyFromPath(path));
      if (!info) return ranges;

      // Check each span to see if it overlaps this text node
      for (const s of localSpans) {
        const start = Math.max(s.start, info.gStart);
        const end = Math.min(s.end, info.gEnd);
        if (end <= start) continue; // No overlap

        // Determine if this span should be highlighted
        const isActive =
          (!!activeSpan &&
            activeSpan.start === s.start &&
            activeSpan.end === s.end &&
            activeSpan.entity === s.entity) ||
          (highlightedCategories.length > 0 &&
            highlightedCategories.includes(s.entity));

        // Add decoration range for this span
        ranges.push({
          anchor: { path, offset: start - info.gStart },
          focus: { path, offset: end - info.gStart },
          underline: true,
          entity: s.entity,
          spanStart: s.start,
          spanEnd: s.end,
          active: isActive,
        });
      }
      return ranges;
    },
    [indexByPath, localSpans, activeSpan, highlightedCategories]
  );

  /**
   * Custom leaf renderer that delegates to EntityLeaf component
   * Handles span click events to show/hide the SpanBubble
   */
  const renderLeaf = useCallback( 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      const { attributes, children, leaf } = props;

      /**
       * Handle when user clicks on an annotated span
       */
      const handleSpanClick = (clicked: NerSpan | null) => {
        if (clicked) {
          // Show the SpanBubble for editing
          setActiveSpan(clicked);
          setSelBox(null); // Hide selection bubble if visible

          try {
            // Calculate bubble position
            const range: Range = {
              anchor: globalToPoint(clicked.start),
              focus: globalToPoint(clicked.end),
            };
            const domRange = ReactEditor.toDOMRange(editor, range);
            const containerRect = containerRef.current?.getBoundingClientRect();
            if (containerRect) {
              const p = posFromDomRange(domRange, containerRect);
              if (p.width > 0 && p.height > 0) {
                setSpanBox({ top: p.top, left: p.left, span: clicked });
              } else {
                setSpanBox(null);
              }
            }
          } catch {
            setSpanBox(null);
          }
        } else {
          // Deselect
          setActiveSpan(null);
          setSpanBox(null);
        }
      };

      return (
        <EntityLeaf
          attributes={attributes}
          children={children}
          leaf={leaf}
          onSpanClick={handleSpanClick}
          activeSpan={activeSpan}
        />
      );
    },
    [activeSpan, editor, globalToPoint, posFromDomRange]
  );

  /**
   * Check if a selection overlaps with any existing annotation
   * Returns true if there's any intersection
   */
  const selectionOverlapsExisting = useCallback(
    (start: number, end: number) =>
      localSpans.some((s) => !(end <= s.start || start >= s.end)),
    [localSpans]
  );

  /**
   * ============================================================================
   * SELECTION HANDLING: Show/hide the SelectionBubble
   * ============================================================================
   * 
   * Called whenever the editor selection changes. Determines whether to show
   * the SelectionBubble based on:
   * - Is there a non-collapsed selection?
   * - Does it overlap with existing annotations?
   */
  const updateSelectionOverlay = useCallback(() => {
    const sel = editor.selection;
    // No selection or cursor only (collapsed)
    if (!sel || !Range.isRange(sel) || Range.isCollapsed(sel)) {
      setSelBox(null);
      onSelectionChange?.(null);
      return;
    }

    // Convert selection to global offsets
    const [startPoint, endPoint] = Range.edges(sel);
    const gStart = pointToGlobal(startPoint.path, startPoint.offset);
    const gEnd = pointToGlobal(endPoint.path, endPoint.offset);
    const start = Math.min(gStart, gEnd);
    const end = Math.max(gStart, gEnd);

    // Hide bubble if selection overlaps any existing span
    if (selectionOverlapsExisting(start, end)) {
      setSelBox(null);
      onSelectionChange?.({ start, end });
      return;
    }

    // Calculate bubble position
    try {
      const domRange = ReactEditor.toDOMRange(editor, sel);
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        const p = posFromDomRange(domRange, containerRect);
        if (p.width > 0 && p.height > 0) {
          setSelBox({ top: p.top, left: p.left, start, end });
        } else {
          setSelBox(null);
        }
      } else {
        setSelBox(null);
      }
    } catch {
      setSelBox(null);
    }

    onSelectionChange?.({ start, end });
  }, [
    editor,
    pointToGlobal,
    onSelectionChange,
    posFromDomRange,
    selectionOverlapsExisting,
  ]);

  /**
   * ============================================================================
   * ANNOTATION ACTIONS: Add, edit, delete
   * ============================================================================
   */

  /**
   * Create a category picker function for a specific text range
   * Used by both SelectionBubble (new annotation) and SpanBubble (edit)
   */
  const pickCategoryForRange =
    (start: number, end: number, currentEntity?: string) =>
    (entity: string) => {
      if (!onAddSpan) return;

      // Block adding if selection overlaps an existing span
      // but allow when we're editing an existing span (currentEntity defined)
      if (!currentEntity && selectionOverlapsExisting(start, end)) {
        closeAllUI();
        return;
      }

      // No change - same entity selected
      if (currentEntity && entity === currentEntity) {
        closeAllUI();
        return;
      }

      // If editing, delete the old annotation first
      if (currentEntity && onDeleteSpan)
        onDeleteSpan({ start, end, entity: currentEntity });
      
      // Add the new annotation
      onAddSpan({ start, end, entity });

      // Optimistic local update for instant visual feedback
      setLocalSpans((prev) => {
        const withoutOld = currentEntity
          ? prev.filter(
              (s) =>
                !(
                  s.start === start &&
                  s.end === end &&
                  s.entity === currentEntity
                )
            )
          : prev.slice();
        const exists = withoutOld.some(
          (s) => s.start === start && s.end === end && s.entity === entity
        );
        return exists
          ? withoutOld
          : [...withoutOld, { start, end, entity } as NerSpan];
      });

      closeAllUI();
    };

  /**
   * Delete the currently active annotation span
   */
  const deleteCurrentSpan = () => {
    if (spanBox && onDeleteSpan) onDeleteSpan(spanBox.span);
    
    // Remove from local state
    setLocalSpans((prev) =>
      prev.filter(
        (s) =>
          !(
            s.start === spanBox?.span.start &&
            s.end === spanBox?.span.end &&
            s.entity === spanBox?.span.entity
          )
      )
    );
    closeAllUI();
  };

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

  /**
   * ============================================================================
   * EVENT HANDLERS: Close UI on outside clicks, Escape, scroll
   * ============================================================================
   */

  /**
   * Close bubbles on outside clicks and Escape key
   * suppressCloseRef prevents closing during bubble/menu interaction
   */
  useEffect(() => {
    const onGlobalDown = () => {
      if (suppressCloseRef.current) {
        suppressCloseRef.current = false;
        return;
      }
      closeAllUI();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAllUI();
    };

    document.addEventListener("mousedown", onGlobalDown, false);
    document.addEventListener("keydown", onKey, false);
    return () => {
      document.removeEventListener("mousedown", onGlobalDown, false);
      document.removeEventListener("keydown", onKey, false);
    };
  }, [closeAllUI]);

  /**
   * Close bubbles when scrolling the editor
   * (otherwise bubble positions become incorrect)
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => closeAllUI();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [closeAllUI]);

  /**
   * Bubble event handlers that prevent accidental closing
   */
  const handleSelectionMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    suppressCloseRef.current = true;
  };

  const handleSelectionClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setSelMenuAnchor(e.currentTarget);
  };

  const handleSpanMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    suppressCloseRef.current = true;
  };

  const handleSpanClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setSpanMenuAnchor(e.currentTarget);
  };

  const handleMenuMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    suppressCloseRef.current = true;
  };

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
          setSlateValue(val);
          onChange(toPlainTextWithNewlines(val));
          updateSelectionOverlay();
        }}
      >
        <EditorContainer containerRef={containerRef}>
          <Editable
            placeholder={placeholder ?? "Paste text here or upload file"}
            decorate={decorate}
            renderLeaf={renderLeaf}
            spellCheck={false}
            onKeyDown={(event) => {
              // Only clear UI state for specific keys that should close the bubble
              if (event.key === "Escape") {
                event.preventDefault();
                closeAllUI();
              } else if (event.key === "Enter" || event.key === " ") {
                // Clear selection bubble on Enter or Space
                setSelBox(null);
                setSpanBox(null);
                setSelMenuAnchor(null);
                setSpanMenuAnchor(null);
              }
              // For other keys (typing, arrow keys, backspace), don't clear the bubble
              // Let the selection change naturally trigger updateSelectionOverlay
            }}
            onSelect={() => {
              // Update selection overlay when selection changes
              updateSelectionOverlay();
            }}
            style={{
              flex: 1,
              padding: "18px 18px 22px 18px",
              minHeight: 0,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              caretColor: COLORS.text,
              position: "relative",
            }}
            renderPlaceholder={(props) => (
              <span
                {...props.attributes}
                style={{
                  position: "absolute",
                  pointerEvents: "none",
                  opacity: 0.55,
                  color: "#5A6A7A",
                  fontFamily: "DM Mono, monospace",
                }}
              >
                {props.children}
              </span>
            )}
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
            onDelete={deleteCurrentSpan}
          />
        </EditorContainer>
      </Slate>
    </Box>
  );
};

export default NotationEditor;
