import { Box } from "@mui/material";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";

import type { NerSpan } from "../../../types/NotationEditor";
import type { Notice, NoticeOptions } from "../../../types/Notice";
import type { Segment } from "../../../types/Segment";
import { getSegmentText } from "../../../types/Segment";

import RightPanel, { type TagRow } from "../right/RightPanel";
import { NotificationSnackbar } from "../shared/NotificationSnackbar";
import type { ThesaurusItem } from "../tags/TagThesaurusInput";
import BookmarkBar from "../workspace/BookmarkBar";
import EditorArea from "../workspace/EditorArea";
import ConflictResolutionDialog from "../editor/ConflictResolutionDialog";

import { useShallow } from "zustand/react/shallow";
import { COLORS } from "../../../shared/constants/ui";
import {
  useAnnotationManager,
  useAutoSave,
  useSemanticTags,
  useThesaurusDisplay,
  useThesaurusWorker,
  useTranslationManager,
  useWorkspaceHydration,
  useWorkspaceState,
  useWorkspaceSync,
} from "../../hooks";
import { useWorkspaceStore, type WorkspaceStore } from "../../stores/workspaceStore";
import { presentError } from "../../../application/errors/errorPresenter";
import { useErrorLogger } from "../../hooks/useErrorLogger";
import { SegmentationApiService } from "../../../infrastructure/services/SegmentationApiService";

/**
 * WorkspaceContainer - Container component that orchestrates workspace editing
 * 
 * Uses Zustand store directly instead of props (Phase 1/2 approach).
 * All workspace state management goes through Zustand store.
 * 
 * Architecture:
 * - Gets workspaces from Zustand store
 * - Uses custom hooks for business logic
 * - Coordinates between hooks
 * - Renders presentational components
 */

// Constants moved outside component to prevent recreation on every render
const EMPTY_HIGHLIGHTED_CATEGORIES: string[] = [];

const WorkspaceContainer: React.FC = () => {
  const logError = useErrorLogger({ component: "WorkspaceContainer" });
  const { id: routeId } = useParams();
  
  // Segmentation service instance
  const segmentationService = useMemo(() => new SegmentationApiService(), []);
  
  // ============================================================================
  // STEP 1: WORKSPACE STATE & SELECTION
  // ============================================================================
  // Get workspaces from Zustand store with shallow comparison to prevent re-renders
  const { workspaces } = useWorkspaceStore(
    useShallow((state: WorkspaceStore) => ({ workspaces: state.workspaces }))
  );
  
  // Create setWorkspaces-compatible function for hooks
  const setWorkspaces = useWorkspaceSync();
  
  // Find current workspace based on route ID (fallback to first workspace)
  const { currentWorkspace: currentWs, currentId } = useWorkspaceState(
    workspaces,
    routeId
  );

  // ============================================================================
  // STEP 2: LOCAL UI STATE
  // ============================================================================
  const [editorInstanceKey, setEditorInstanceKey] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | undefined>(undefined);
  const [translationViewMode, setTranslationViewMode] = useState<"document" | "segments">("document");
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  
  // Notification handlers
  const showNotice = useCallback(
    (msg: string, options?: NoticeOptions) => {
      setNotice({
        message: msg,
        tone: options?.tone,
        persistent: options?.persistent,
      });
    },
    []
  );
  const handleCloseNotice = useCallback(() => setNotice(null), []);

  // ============================================================================
  // STEP 3: HOOKS FOR BUSINESS LOGIC
  // ============================================================================
  
  // Tags: user-added + API-generated semantic tags
  const tags = useSemanticTags({
    initialTags: currentWs?.tags,
    hydrateKey: currentId,
  });

  // Thesaurus: 750k keyword lookup with Web Worker for performance
  const thesaurusWorker = useThesaurusWorker();
  const thesaurusIndexForDisplay = useThesaurusDisplay(thesaurusWorker);

  // Ref to share annotations with translations hook (avoids stale closures)
  const annotationsRef = useRef<{
    userSpans: NerSpan[];
    apiSpans: NerSpan[];
    deletedApiKeys: Set<string>;
  } | null>(null);

  // Translations: multi-language tab management (original + translations)
  const getCurrentText = useCallback(() => text, [text]);
  const translations = useTranslationManager({
    workspaceId: currentId ?? null,
    workspace: currentWs,
    getCurrentText,
    annotationsRef,
    setText,
    setEditorInstanceKey,
    setWorkspaces,
    onNotice: showNotice,
  });

  // Annotations: NER spans (user-created + API-generated)
  const annotations = useAnnotationManager({
    initialUserSpans: currentWs?.userSpans as NerSpan[],
    initialApiSpans: currentWs?.apiSpans as NerSpan[],
    initialDeletedKeys: currentWs?.deletedApiKeys ?? [],
    hydrateKey: currentId,
    activeTab: translations.activeTab,
    workspace: currentWs,
    onNotice: showNotice,
    setWorkspaces,
  });
  
  // Keep annotationsRef in sync with annotations state
  useEffect(() => {
    annotationsRef.current = {
      userSpans: annotations.userSpans,
      apiSpans: annotations.apiSpans,
      deletedApiKeys: annotations.deletedApiKeys,
    };
  }, [annotations.userSpans, annotations.apiSpans, annotations.deletedApiKeys]);

  // Track latest editor-adjusted spans for precise manual save overrides
  const latestAdjustedSpansRef = useRef<{
    userSpans: NerSpan[];
    apiSpans: NerSpan[];
  } | null>(null);

  // Auto-save: debounced saving of workspace changes
  // Disable auto-save in segment mode to prevent segment text from overwriting document text
  const autosave = useAutoSave(
    currentId ?? null,
    {
      text,
      userSpans: annotations.userSpans,
      apiSpans: annotations.apiSpans,
      deletedApiKeys: annotations.deletedApiKeys,
      tags: tags.combinedTags,
    },
    setWorkspaces,
    {
      delay: 350,
      enabled: translationViewMode === "document", // Only enable in document mode
      activeTab: translations.activeTab,
    }
  );

  // Hydration: load workspace data when switching workspaces
  // Don't hydrate text if we're in segment mode (we'll load segments individually)
  const onHydrate = useCallback(({ text: newText, editorKey }: { text: string; editorKey: string }) => {
    // Only hydrate text if we're in document mode
    if (translationViewMode === "document") {
      setText(newText);
      setEditorInstanceKey(editorKey);
    }
  }, [translationViewMode]);

  const onHydrationStart = useCallback(() => {
    autosave.setHydrated(null);
    translations.setActiveTab("original");
  }, [autosave, translations]);

  const onHydrationComplete = useCallback((id: string) => {
    autosave.setHydrated(id);
  }, [autosave]);

  useWorkspaceHydration({
    workspaceId: currentId ?? null,
    workspace: currentWs,
    onHydrate,
    onHydrationStart,
    onHydrationComplete,
  });

  // Prevent text restoration when in segment mode
  useEffect(() => {
    if (translationViewMode === "segments" && text && !selectedSegmentId) {
      // If we're in segment mode and have text but no selected segment, clear it
      setText("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translationViewMode, selectedSegmentId]);

  // Reset active segment when workspace changes
  useEffect(() => {
    setActiveSegmentId(undefined);
  }, [currentId]);

  // ============================================================================
  // STEP 4: EVENT HANDLERS FOR USER ACTIONS
  // ============================================================================
  
  // Editor actions: save, classify, NER, upload
  const handleSave = useCallback(() => {
    // Defer to the next macrotask so the queueMicrotask in useSpanAutoAdjust
    // has already run and updated latestAdjustedSpansRef / annotations state.
    setTimeout(() => {
      const overrideFromEditor = latestAdjustedSpansRef.current;
      const override = overrideFromEditor ?? {
        userSpans: annotations.userSpans,
        apiSpans: annotations.apiSpans,
      };

      console.debug("[WorkspaceContainer] save requested", {
        workspaceId: currentId,
        textLength: text?.length ?? 0,
        userSpans: override.userSpans?.length ?? 0,
        apiSpans: override.apiSpans?.length ?? 0,
        hasOverride: !!overrideFromEditor,
        timestamp: Date.now(),
      });

      // Always pass spans override so manual save uses the freshest indices
      autosave.saveNow(showNotice, override);
    }, 0);
  }, [autosave, showNotice, currentId, text, annotations.userSpans, annotations.apiSpans]);

  const handleRunClassify = useCallback(async () => {
    if (!text.trim()) {
      showNotice("Paste some text before running classify.");
      return;
    }
    try {
      await tags.runClassify(text);
      showNotice("Classification completed.");
    } catch (error) {
      const appError = logError(error, {
        operation: "classify text",
      });
      const notice = presentError(appError);
      showNotice(notice.message, {
        tone: notice.tone,
        persistent: notice.persistent,
      });
    }
  }, [logError, showNotice, tags, text]);

  const handleRunNer = useCallback(async () => {
    await annotations.runNer(text, currentId ?? null);
  }, [text, currentId, annotations]);

  const handleRunSegment = useCallback(async () => {
    if (!text.trim()) {
      showNotice("Paste some text before running segmentation.");
      return;
    }
    if (!currentId) {
      showNotice("No workspace selected.");
      return;
    }
    
    try {
      showNotice("Segmenting text...", { tone: "info" });
      const segments = await segmentationService.segmentText(text);
      
      if (segments.length === 0) {
        showNotice("No segments found in text.");
        return;
      }
      
      // Insert border spaces between segments and adjust indices
      const { text: textWithBorders, segments: adjustedSegments } = 
        segmentationService.insertBorderSpaces(segments, text);
      
      // Update text with border spaces
      setText(textWithBorders);
      
      // Update workspace with adjusted segments
      const updatedWorkspaces = workspaces.map((ws) =>
        ws.id === currentId
          ? { ...ws, segments: adjustedSegments, updatedAt: Date.now() }
          : ws
      );
      setWorkspaces(updatedWorkspaces);
      
      showNotice(`Text segmented into ${adjustedSegments.length} segment${adjustedSegments.length !== 1 ? 's' : ''}.`, { tone: "success" });
    } catch (error) {
      const appError = logError(error, {
        operation: "segment text",
      });
      const notice = presentError(appError);
      showNotice(notice.message, {
        tone: notice.tone,
        persistent: notice.persistent,
      });
    }
  }, [text, currentId, segmentationService, workspaces, setWorkspaces, showNotice, logError]);

  // Handle segment button click: only run segmentation
  const handleSegmentButtonClick = useCallback(async () => {
    await handleRunSegment();
  }, [handleRunSegment]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
  }, []); // setText is stable, no deps needed

  // Store text before switching to segment mode (for immediate restore)
  const documentTextRef = useRef<string>("");
  
  // Store the full document text when in segment view (for syncing edits back)
  const fullDocumentTextRef = useRef<string>("");
  
  // Handle view mode change - save text before switching to segment mode, restore when switching back
  useEffect(() => {
    if (translationViewMode === "document") {
      // When switching back to document mode, preserve selected segment as active
      // If there was a selected segment in segment view, make it active in document view
      if (selectedSegmentId) {
        setActiveSegmentId(selectedSegmentId);
      }
      setSelectedSegmentId(null);
      
      // Load text - prefer fullDocumentTextRef (has latest edits) over workspace (may be stale)
      // The fullDocumentTextRef is updated by handleTextChange when editing in segment view
      let textToLoad: string;
      
      // First try the ref (has the most recent edits from segment view)
      if (fullDocumentTextRef.current) {
        textToLoad = fullDocumentTextRef.current;
      } else {
        // Fall back to workspace (for cases like page reload)
        if (translations.activeTab === "original") {
          textToLoad = currentWs?.text || "";
        } else {
          const translation = currentWs?.translations?.find(
            (t) => t.language === translations.activeTab
          );
          textToLoad = translation?.text || "";
        }
      }
      
      // Restore text
      if (textToLoad) {
        setText(textToLoad);
        // Force editor remount to show restored content
        setEditorInstanceKey(`${currentId ?? "new"}:${translations.activeTab}:${Date.now()}`);
      }
      
      // Clear refs after restore
      documentTextRef.current = "";
      fullDocumentTextRef.current = "";
    } else if (translationViewMode === "segments") {
      // Save current text before switching to segment mode
      if (text && text.trim()) {
        documentTextRef.current = text;
        
        // Also save to workspace immediately (don't wait for auto-save)
        if (currentId && currentWs) {
          if (translations.activeTab === "original") {
            setWorkspaces((prev) =>
              prev.map((w) =>
                w.id === currentId
                  ? { ...w, text, updatedAt: Date.now() }
                  : w
              )
            );
          } else {
            setWorkspaces((prev) =>
              prev.map((w) =>
                w.id === currentId
                  ? {
                      ...w,
                      translations: (w.translations || []).map((t) =>
                        t.language === translations.activeTab
                          ? { ...t, text, updatedAt: Date.now() }
                          : t
                      ),
                      updatedAt: Date.now(),
                    }
                  : w
              )
            );
          }
        }
      }
      
      // When switching to segment mode, preserve active segment as selected
      // If there's an active segment in document view, select it in segment view
      if (activeSegmentId) {
        setSelectedSegmentId(activeSegmentId);
        // Get the latest workspace state to ensure we have the most recent segments and text
        const latestWorkspaces = useWorkspaceStore.getState().workspaces;
        const latestWs = latestWorkspaces.find(ws => ws.id === currentId);
        
        if (latestWs) {
          // Load the segment text into editor immediately
          const segment = latestWs.segments?.find((s) => s.id === activeSegmentId);
          if (segment) {
            // Get full document text for deriving segment text
            // Prefer ref if available (has latest edits), otherwise use workspace
            let docText = fullDocumentTextRef.current;
            if (!docText) {
              docText = translations.activeTab === "original"
                ? latestWs?.text || ""
                : latestWs?.translations?.find((t) => t.language === translations.activeTab)?.text || "";
            }
            // Store the full document text for syncing edits back
            fullDocumentTextRef.current = docText;
            const segmentText = segment.text ?? getSegmentText(segment, docText);
            setText(segmentText);
            setEditorInstanceKey(`${currentId ?? "new"}:${translations.activeTab}:${Date.now()}`);
          }
        }
      } else {
        // No active segment - clear editor when switching to segment mode
        setSelectedSegmentId(null);
        // Get the latest workspace state
        const latestWorkspaces = useWorkspaceStore.getState().workspaces;
        const latestWs = latestWorkspaces.find(ws => ws.id === currentId);
        
        // Store the full document text even when no segment is selected
        // Prefer ref if available (has latest edits), otherwise use workspace
        let docText = fullDocumentTextRef.current;
        if (!docText && latestWs) {
          docText = translations.activeTab === "original"
            ? latestWs?.text || ""
            : latestWs?.translations?.find((t) => t.language === translations.activeTab)?.text || "";
        }
        fullDocumentTextRef.current = docText;
        // Use setTimeout to ensure this happens after any other effects
        setTimeout(() => {
          setText("");
          setEditorInstanceKey(`${currentId ?? "new"}:${translations.activeTab}:${Date.now()}`);
        }, 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translationViewMode]);

  // Segment navigation: load segment into editor (segment mode) or highlight/scroll (document mode)
  const handleSegmentClick = useCallback((segment: Segment) => {
    // If in segment mode, load segment text into editor (no highlighting in editor)
    if (translationViewMode === "segments") {
      // Set selectedSegmentId for list highlighting
      setSelectedSegmentId(segment.id);
      // Don't set activeSegmentId in segment mode - we don't want editor highlighting
      
      // Get the latest workspace state to ensure we have the most recent segments and text
      const latestWorkspaces = useWorkspaceStore.getState().workspaces;
      const latestWs = latestWorkspaces.find(ws => ws.id === currentId);
      
      if (!latestWs) {
        return;
      }
      
      // Find the segment with the latest indices (in case it was updated by previous edits)
      const latestSegment = latestWs.segments?.find(s => s.id === segment.id);
      if (!latestSegment) {
        return;
      }
      
      // Get the full document text - prefer ref (has latest edits) over workspace (may be stale)
      let docText = fullDocumentTextRef.current;
      if (!docText) {
        // Fall back to workspace text if ref is empty
        docText = translations.activeTab === "original"
          ? latestWs?.text || ""
          : latestWs?.translations?.find((t) => t.language === translations.activeTab)?.text || "";
      }
      
      // Store it in the ref for future edits
      fullDocumentTextRef.current = docText;
      
      // Load the segment text into editor using the latest segment indices and text
      const segmentText = latestSegment.text ?? getSegmentText(latestSegment, docText);
      setText(segmentText);
      // Force editor remount to show new content
      setEditorInstanceKey(`${currentId ?? "new"}:${translations.activeTab}:${Date.now()}`);
      return;
    }
    
    // Document mode: only highlight segment and scroll to it (don't load text)
    // Clear selectedSegmentId in document mode
    setSelectedSegmentId(null);
    // Toggle activeSegmentId for highlighting
    setActiveSegmentId((prev) => prev === segment.id ? undefined : segment.id);
    
    // Scroll to segment by finding the DOM element at the segment's start offset
    const editorContainer = document.querySelector('[data-slate-editor]');
    if (!editorContainer) return;

    // Find the text node at the segment start offset
    const walker = document.createTreeWalker(
      editorContainer,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let targetNode: Node | null = null;
    let targetOffset = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeLength = node.textContent?.length ?? 0;
      
      if (currentOffset + nodeLength >= segment.start) {
        targetNode = node;
        targetOffset = segment.start - currentOffset;
        break;
      }
      
      currentOffset += nodeLength;
    }

    if (targetNode && targetNode.parentElement) {
      // Create a range and scroll it into view
      const range = document.createRange();
      range.setStart(targetNode, Math.max(0, targetOffset));
      range.setEnd(targetNode, Math.min(targetNode.textContent?.length ?? 0, targetOffset + 1));
      
      // Scroll the range into view with smooth behavior
      range.getBoundingClientRect(); // Force layout calculation
      targetNode.parentElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }, [translationViewMode, currentId, translations.activeTab]);

  // Wrapper for setText that handles segment view mode - syncs edits back to full document
  const handleTextChange = useCallback((newText: string) => {
    // If we're in segment view and have a selected segment, sync the edit back to the full document
    if (translationViewMode === "segments" && selectedSegmentId && currentId) {
      // Get the latest workspace state to ensure we have the most recent segments
      // This is important because currentWs might be stale if there were rapid edits
      const latestWorkspaces = useWorkspaceStore.getState().workspaces;
      const latestWs = latestWorkspaces.find(ws => ws.id === currentId);
      
      if (!latestWs?.segments) {
        // Fall back to document view behavior if no segments
        setText(newText);
        return;
      }
      
      // Find the segment with the latest indices (in case it was updated by previous edits)
      const segment = latestWs.segments.find(s => s.id === selectedSegmentId);
      if (!segment) {
        console.warn("[WorkspaceContainer] handleTextChange - segment not found", {
          selectedSegmentId,
          availableSegments: latestWs.segments.map(s => s.id),
        });
        setText(newText);
        return;
      }
      
      // Process the segment update
      {
        // Get the current full document text (from ref or workspace)
        // Prefer ref as it has the most recent edits from previous keystrokes
        let fullText = fullDocumentTextRef.current;
        if (!fullText) {
          // Fall back to workspace text if ref is empty
          fullText = translations.activeTab === "original"
            ? latestWs?.text || ""
            : latestWs?.translations?.find((t) => t.language === translations.activeTab)?.text || "";
          fullDocumentTextRef.current = fullText;
        }
        
        // IMPORTANT: Use the segment's current indices from the latest workspace
        // These may have been updated by previous edits, so we need the most recent values
        const currentSegmentStart = segment.start;
        const currentSegmentEnd = segment.end;
        
        // Verify the segment indices are valid for the current text
        if (currentSegmentStart < 0 || currentSegmentEnd > fullText.length || currentSegmentEnd <= currentSegmentStart) {
          console.error("[WorkspaceContainer] invalid segment indices", {
            segmentId: segment.id,
            start: currentSegmentStart,
            end: currentSegmentEnd,
            fullTextLength: fullText.length,
          });
          setText(newText);
          return;
        }
        
        // Calculate the old segment text length
        const oldSegmentLength = currentSegmentEnd - currentSegmentStart;
        
        // Check if this is the last segment
        const isLastSegment = segment.order === (latestWs.segments.length - 1);
        
        // The border space is at segment.end (if not last segment)
        // We need to check if there's a border space after the segment
        const hasBorderSpace = !isLastSegment && currentSegmentEnd < fullText.length && fullText[currentSegmentEnd] === " ";
        
        // The new segment text from editor - this is what the user typed
        let newSegmentText = newText;
        
        // Replace the segment portion in the full document text
        // The segment text is from segment.start to segment.end
        // If there's a border space, it's at segment.end (one character after segment text)
        const beforeSegment = fullText.substring(0, currentSegmentStart);
        const afterSegmentStart = hasBorderSpace ? currentSegmentEnd + 1 : currentSegmentEnd;
        const afterSegment = fullText.substring(afterSegmentStart);
        
        // Verify the text extraction matches what we expect
        const actualSegmentText = fullText.substring(currentSegmentStart, currentSegmentEnd);
        if (actualSegmentText !== (segment.text ?? actualSegmentText)) {
          console.warn("[WorkspaceContainer] segment text mismatch", {
            segmentId: segment.id,
            expectedText: segment.text,
            actualText: actualSegmentText,
            start: currentSegmentStart,
            end: currentSegmentEnd,
          });
        }
        
        // Build the updated full text - this replaces the segment text and preserves everything after
        // All subsequent segments' text is preserved in afterSegment, they just need their indices shifted
        const updatedFullText = beforeSegment + newSegmentText + (hasBorderSpace ? " " : "") + afterSegment;
        
        // Calculate the new segment length and the difference
        const newSegmentLength = newSegmentText.length;
        const lengthDiff = newSegmentLength - oldSegmentLength;
        
        // Update the edited segment's end index
        // The new end is at: start + newLength (border space will be at this position if not last)
        const updatedSegment = {
          ...segment,
          start: currentSegmentStart, // Keep the start the same
          end: currentSegmentStart + newSegmentLength, // Update end based on new length
        };
        
        // Update all subsequent segments' indices using the same logic as adjustSegmentForInsert
        // In document view, when text is inserted/deleted, segments after the position shift
        // Here we're replacing segment text, which is equivalent to:
        // - Deleting oldSegmentLength chars at currentSegmentStart
        // - Inserting newSegmentLength chars at currentSegmentStart
        // - Net effect: text length changes by lengthDiff at currentSegmentStart
        // - All segments with start > currentSegmentEnd should shift by lengthDiff
        // But since we're replacing, segments with start >= currentSegmentEnd should shift
        const updatedSegments = latestWs.segments.map(s => {
          if (s.id === segment.id) {
            // Update the edited segment
            return updatedSegment;
          }
          
          // Use position-based logic like adjustSegmentForInsert, not just order-based
          // Segments that start after the edited segment's end should shift
          if (s.start > currentSegmentEnd) {
            // Segment is entirely after the edited segment - shift by lengthDiff
            const shifted = {
              ...s, // Preserve all properties (id, order, text, translations, etc.)
              start: s.start + lengthDiff,
              end: s.end + lengthDiff,
            };
            
            // Verify the shifted segment indices are valid
            if (shifted.start < 0 || shifted.end > updatedFullText.length || shifted.end <= shifted.start) {
              console.error("[WorkspaceContainer] invalid shifted segment indices", {
                segmentId: s.id,
                order: s.order,
                originalStart: s.start,
                originalEnd: s.end,
                shiftedStart: shifted.start,
                shiftedEnd: shifted.end,
                lengthDiff,
                updatedFullTextLength: updatedFullText.length,
                editedSegmentEnd: currentSegmentEnd,
              });
            }
            
            return shifted;
          } else if (s.start === currentSegmentEnd && !isLastSegment) {
            // Segment starts right at the border space - this should be the next segment
            // It should shift by lengthDiff (the border space position shifts)
            const shifted = {
              ...s,
              start: updatedSegment.end + (hasBorderSpace ? 1 : 0), // New border space position
              end: s.end + lengthDiff,
            };
            return shifted;
          }
          
          // Segments before or overlapping with edited segment - shouldn't happen, but preserve
          console.warn("[WorkspaceContainer] segment before edited segment - unexpected", {
            segmentId: s.id,
            order: s.order,
            start: s.start,
            end: s.end,
            editedSegmentStart: currentSegmentStart,
            editedSegmentEnd: currentSegmentEnd,
          });
          return s;
        });
        
        // Verify the updated segments don't overlap
        const sortedUpdated = [...updatedSegments].sort((a, b) => a.order - b.order);
        for (let i = 0; i < sortedUpdated.length - 1; i++) {
          const current = sortedUpdated[i];
          const next = sortedUpdated[i + 1];
          const isLastCurrent = current.order === (sortedUpdated.length - 1);
          const expectedNextStart = isLastCurrent 
            ? current.end 
            : current.end + 1; // +1 for border space
          
          if (next.start !== expectedNextStart) {
            console.error("[WorkspaceContainer] segment overlap detected", {
              currentSegment: {
                id: current.id,
                order: current.order,
                start: current.start,
                end: current.end,
              },
              nextSegment: {
                id: next.id,
                order: next.order,
                start: next.start,
                end: next.end,
              },
              expectedNextStart,
              actualNextStart: next.start,
              difference: next.start - expectedNextStart,
            });
          }
        }
        
        // Verify the update is correct
        console.debug("[WorkspaceContainer] segment update", {
          segmentId: segment.id,
          segmentOrder: segment.order,
          currentStart: currentSegmentStart,
          currentEnd: currentSegmentEnd,
          oldLength: oldSegmentLength,
          newLength: newSegmentLength,
          lengthDiff,
          hasBorderSpace,
          updatedSegment: {
            start: updatedSegment.start,
            end: updatedSegment.end,
          },
          subsequentSegments: updatedSegments
            .filter(s => s.order > segment.order)
            .slice(0, 3)
            .map(s => ({
              id: s.id,
              order: s.order,
              oldStart: latestWs.segments.find(orig => orig.id === s.id)?.start,
              oldEnd: latestWs.segments.find(orig => orig.id === s.id)?.end,
              newStart: s.start,
              newEnd: s.end,
            })),
        });
        
        // Update the full document text ref
        fullDocumentTextRef.current = updatedFullText;
        
        // Log the update for debugging
        console.debug("[WorkspaceContainer] handleTextChange - updating workspace", {
          segmentId: segment.id,
          segmentOrder: segment.order,
          oldLength: oldSegmentLength,
          newLength: newSegmentLength,
          lengthDiff,
          updatedFullTextLength: updatedFullText.length,
          originalFullTextLength: fullText.length,
          updatedSegmentsCount: updatedSegments.length,
          originalSegmentsCount: latestWs.segments.length,
          allUpdatedSegments: updatedSegments.map(s => ({
            id: s.id,
            order: s.order,
            start: s.start,
            end: s.end,
            textPreview: updatedFullText.substring(s.start, Math.min(s.end, updatedFullText.length)).substring(0, 20),
          })),
        });
        
        // Update workspace with new text and segments (use function updater to avoid race conditions)
        setWorkspaces((prev) => {
          const updated = prev.map((ws) =>
            ws.id === currentId
              ? {
                  ...ws,
                  text: translations.activeTab === "original" ? updatedFullText : ws.text,
                  translations: translations.activeTab === "original"
                    ? ws.translations
                    : ws.translations?.map(t =>
                        t.language === translations.activeTab
                          ? { ...t, text: updatedFullText, updatedAt: Date.now() }
                          : t
                      ),
                  segments: updatedSegments,
                  updatedAt: Date.now(),
                }
              : ws
          );
          
          // Verify the update
          const updatedWs = updated.find(ws => ws.id === currentId);
          if (updatedWs) {
            console.debug("[WorkspaceContainer] workspace updated", {
              workspaceId: currentId,
              textLength: translations.activeTab === "original" ? updatedWs.text.length : updatedWs.translations?.find(t => t.language === translations.activeTab)?.text.length,
              segmentsCount: updatedWs.segments.length,
              segmentsPreview: updatedWs.segments.slice(0, 5).map(s => ({
                id: s.id,
                order: s.order,
                start: s.start,
                end: s.end,
              })),
            });
          }
          
          return updated;
        });
        
        // Don't call setText with the full text - keep showing just the segment in the editor
        // The editor already has the new segment text, so we don't need to update it
        return;
      }
    }
    
    // Document view: normal text update
    setText(newText);
  }, [translationViewMode, selectedSegmentId, currentId, translations.activeTab, setWorkspaces]);

  // Tag actions: add, delete
  const addCustomTag = useCallback(
    (name: string, keywordId?: number, parentId?: number) => {
      tags.addCustomTag(name, keywordId, parentId);
    },
    [tags]
  );

  const deleteTag = useCallback(
    (name: string, keywordId?: number, parentId?: number) => {
      tags.deleteTag(name, keywordId, parentId);
    },
    [tags]
  );

  // ============================================================================
  // STEP 5: COMPUTED VALUES & DATA TRANSFORMATION
  // ============================================================================
  
  // Thesaurus search handler
  const fetchThesaurus = useCallback(
    async (q: string): Promise<ThesaurusItem[]> => {
      if (!q.trim()) return [];
      if (!thesaurusWorker.ready) return [];
      
      try {
        const results = await thesaurusWorker.search(q, 20);
        return results.map(item => ({
          name: item.label,
          path: item.path,
          keywordId: item.id,
          parentId: item.parentId,
          isPreferred: item.isPreferred,
          depth: item.depth,
        }));
      } catch (error) {
        console.error('Thesaurus search error:', error);
        return [];
      }
    },
    [thesaurusWorker]
  );

  // Memoized config objects for child components
  const thesaurusConfig = useMemo(
    () => ({
      onAdd: addCustomTag,
      fetchSuggestions: fetchThesaurus,
      defaultRestrictToThesaurus: false,
      isThesaurusLoading: !thesaurusWorker.ready,
      resetKey: currentId,
    }),
    [addCustomTag, fetchThesaurus, thesaurusWorker.ready, currentId]
  );

  const tagRows: TagRow[] = useMemo(
    () => tags.combinedTags.map((t) => ({ 
      name: t.name, 
      source: t.source,
      keywordId: t.label !== undefined ? Number(t.label) : undefined,
      parentId: t.parentId,
    })),
    [tags.combinedTags]
  );

  // Get the full document text for segment previews (based on active tab)
  // This ensures previews work even when editor text is empty in segment mode
  const fullDocumentText = useMemo(() => {
    if (translations.activeTab === "original") {
      return currentWs?.text || "";
    } else {
      const translation = currentWs?.translations?.find(
        (t) => t.language === translations.activeTab
      );
      return translation?.text || "";
    }
  }, [currentWs?.text, currentWs?.translations, translations.activeTab]);

  // Keep fullDocumentTextRef in sync with workspace text when in segment view
  // But be careful not to overwrite local edits - only sync if ref is empty
  useEffect(() => {
    if (translationViewMode === "segments" && selectedSegmentId) {
      // Only update ref if it's empty (initial load) - don't overwrite local edits
      if (!fullDocumentTextRef.current) {
        const latestWorkspaces = useWorkspaceStore.getState().workspaces;
        const latestWs = latestWorkspaces.find(ws => ws.id === currentId);
        if (latestWs) {
          const docText = translations.activeTab === "original"
            ? latestWs?.text || ""
            : latestWs?.translations?.find((t) => t.language === translations.activeTab)?.text || "";
          if (docText) {
            fullDocumentTextRef.current = docText;
          }
        }
      }
    }
  }, [translationViewMode, selectedSegmentId, currentId, translations.activeTab]);

  // ============================================================================
  // STEP 6: RENDER
  // ============================================================================
  
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        height: "100vh",
        overflow: "visible",
        position: "relative",
        px: 4,
        color: COLORS.text,
      }}
    >
      {/* LEFT PANEL: Editor and bookmark bar */}
      <Box
        sx={{
          flex: 1,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          height: "88.5vh",
          pl: 4,
          minHeight: 0,
        }}
      >
        {/* Translation tabs (original + translations) */}
        <BookmarkBar
          translationLanguages={translations.translationLanguages}
          activeTab={translations.activeTab}
          onTabClick={translations.onTabSwitch}
          onAddClick={translations.openMenu}
          anchorEl={translations.menuAnchor}
          onClose={translations.closeMenu}
          onSelectLanguage={translations.onAddTranslation}
          onDeleteTranslation={translations.onDeleteTranslation}
          onUpdateTranslation={translations.onUpdateTranslation}
          isUpdating={translations.isUpdating}
          languageOptions={translations.languageOptions}
          isLanguageListLoading={translations.isLanguageListLoading}
        />

        {/* Main text editor - shows segment when in segment mode */}
        <EditorArea
          editorInstanceKey={editorInstanceKey}
          text={text}
          setText={handleTextChange}
          onUpload={handleUpload}
          onClassify={handleRunClassify}
          onNer={handleRunNer}
          onSegment={handleSegmentButtonClick}
          spans={annotations.combinedSpans}
          segments={currentWs?.segments}
          activeSegmentId={activeSegmentId}
          selectedSegmentId={selectedSegmentId}
          viewMode={translationViewMode}
          highlightedCategories={EMPTY_HIGHLIGHTED_CATEGORIES}
          deletableKeys={annotations.deletableKeys}
          onDeleteSpan={annotations.deleteSpan}
          onAddSpan={annotations.addSpan}
          onSave={handleSave}
          onSpansAdjusted={(next) => {
            // Preserve provenance by using the known combined ordering:
            // combinedSpans = filteredApiSpans + userSpans
            const combined = annotations.combinedSpans;
            if (!Array.isArray(combined) || combined.length !== next.length) {
              // If counts differ, avoid destructive overwrite.
              return;
            }

            // API spans are always the first N items in combinedSpans
            const apiCount = combined.length - annotations.userSpans.length;
            if (apiCount < 0 || apiCount > combined.length) {
              return;
            }

            const apiNext: NerSpan[] = next.slice(0, apiCount);
            const userNext: NerSpan[] = next.slice(apiCount);

            // Log editor-adjusted spans vs current annotation state
            // to track where indices may diverge.
            // eslint-disable-next-line no-console
            console.debug("[WorkspaceContainer] onSpansAdjusted", {
              workspaceId: currentId,
              combinedCount: combined.length,
              nextCount: next.length,
              apiCount,
              userCount: annotations.userSpans.length,
              nextPreview: next.slice(0, 5),
              apiNextPreview: apiNext.slice(0, 5),
              userNextPreview: userNext.slice(0, 5),
              timestamp: Date.now(),
            });

            annotations.setUserSpans(userNext);
            annotations.setApiSpans(apiNext);
            latestAdjustedSpansRef.current = { userSpans: userNext, apiSpans: apiNext };

            // Let debounced autosave handle persistence once typing stops
            // eslint-disable-next-line no-console
            console.debug("[WorkspaceContainer] spans adjusted (autosave queued)", {
              workspaceId: currentId,
              userSpans: userNext.length,
              apiSpans: apiNext.length,
              timestamp: Date.now(),
            });
          }}
          onSegmentsAdjusted={(next) => {
            if (!currentId) return;
            
            // In segment view, we handle segment adjustments manually in handleTextChange
            // to avoid conflicts with operations that are relative to the segment, not the full document
            // So we ignore auto-adjustments from useSpanAutoAdjust in segment view
            if (translationViewMode === "segments") {
              console.debug("[WorkspaceContainer] ignoring onSegmentsAdjusted in segment view (handled manually)");
              return;
            }
            
            // Log segment adjustments
            // eslint-disable-next-line no-console
            console.debug("[WorkspaceContainer] onSegmentsAdjusted", {
              workspaceId: currentId,
              beforeCount: currentWs?.segments?.length ?? 0,
              nextCount: next.length,
              nextPreview: next.slice(0, 5),
              timestamp: Date.now(),
            });

            // Update workspace with adjusted segments
            setWorkspaces((prev) =>
              prev.map((ws) =>
                ws.id === currentId
                  ? { ...ws, segments: next, updatedAt: Date.now() }
                  : ws
              )
            );

            // Let debounced autosave handle persistence once typing stops
            // eslint-disable-next-line no-console
            console.debug("[WorkspaceContainer] segments adjusted (autosave queued)", {
              workspaceId: currentId,
            });
          }}
          placeholder={
            translationViewMode === "segments" && !selectedSegmentId
              ? "Select a segment from the right panel"
              : undefined
          }
        />
      </Box>

      {/* RIGHT PANEL: Tags and thesaurus */}
      <Box
        sx={{
          width: "300px",
          boxSizing: "border-box",
          height: "86vh",
          display: "flex",
          flexDirection: "column",
          mt: 4,
          minHeight: 0,
          overflow: "visible",
          ml: 2,
          pr: 1,
        }}
      >
        <RightPanel
          tags={tagRows}
          onDeleteTag={deleteTag}
          thesaurus={thesaurusConfig}
          thesaurusIndex={thesaurusIndexForDisplay}
          segments={currentWs?.segments}
          activeSegmentId={activeSegmentId}
          selectedSegmentId={selectedSegmentId}
          onSegmentClick={handleSegmentClick}
          viewMode={translationViewMode}
          onViewModeChange={setTranslationViewMode}
          text={fullDocumentText}
        />
      </Box>

      {/* GLOBAL: Conflict resolution dialog */}
      {annotations.conflictPrompt && (
        <ConflictResolutionDialog
          prompt={annotations.conflictPrompt}
          onKeepExisting={() => annotations.resolveConflictPrompt("existing")}
          onKeepApi={() => annotations.resolveConflictPrompt("api")}
        />
      )}

      {/* GLOBAL: Notification snackbar */}
      <NotificationSnackbar
        message={notice?.message ?? null}
        tone={notice?.tone}
        persistent={notice?.persistent}
        onClose={handleCloseNotice}
      />
    </Box>
  );
};

export default WorkspaceContainer;
