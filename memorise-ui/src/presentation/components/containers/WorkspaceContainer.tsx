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
import { validateSplitPosition, isPunctuation } from "../../../shared/utils/segmentSplitValidation";
import SegmentSplitDialog from "../segmentation/SegmentSplitDialog";

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
  // Track current editor selection for split operations
  const [currentSelection, setCurrentSelection] = useState<{ start: number; end: number } | null>(null);
  // Track split dialog state
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [segmentToSplit, setSegmentToSplit] = useState<Segment | null>(null);
  // Track if segment click handler is currently processing (to prevent effect from interfering)
  const isSegmentClickProcessingRef = useRef<boolean>(false);
  // Track the last selected segment ID to avoid unnecessary updates
  const lastSelectedSegmentIdRef = useRef<string | null>(null);
  
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
  
  // Determine current segment for tag scoping
  // Only filter by segment in segment view mode, not in document view
  // In document view, always show document-level tags regardless of highlighting
  const currentSegmentId = translationViewMode === "segments" 
    ? selectedSegmentId 
    : undefined; // In document view, don't filter by segment

  // Tags: user-added + API-generated semantic tags
  const tags = useSemanticTags({
    initialTags: currentWs?.tags,
    hydrateKey: currentId,
    segmentId: currentSegmentId ?? undefined,
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
    viewMode: translationViewMode,
    selectedSegmentId: selectedSegmentId,
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

  // Reset to "original" tab when switching segments in segment view if current tab doesn't have translation
  // Also load the segment text when switching (only if not already handled by handleSegmentClick)
  useEffect(() => {
    // Skip if segment click handler is currently processing
    if (isSegmentClickProcessingRef.current) {
      return;
    }
    
    // Only run if the selected segment actually changed (not just workspace update)
    if (selectedSegmentId === lastSelectedSegmentIdRef.current) {
      return;
    }
    
    if (translationViewMode === "segments" && selectedSegmentId && currentWs) {
      const segment = currentWs.segments?.find(s => s.id === selectedSegmentId);
      if (segment) {
        // Update the ref to track this segment
        lastSelectedSegmentIdRef.current = selectedSegmentId;
        
        const currentTab = translations.activeTab;
        let targetTab = currentTab;
        
        // Check if current tab has translation for this segment
        if (currentTab !== "original") {
          const hasTranslation = segment.translations?.[currentTab];
          if (!hasTranslation) {
            // Switch to original tab if current tab doesn't have translation for this segment
            targetTab = "original";
            translations.setActiveTab("original");
          }
        }
        
        // Load the appropriate text for the segment
        const fullDocText = currentWs.text || "";
        let segmentText: string;
        if (targetTab === "original") {
          segmentText = segment.text ?? getSegmentText(segment, fullDocText);
        } else {
          segmentText = segment.translations?.[targetTab] || "";
        }
        
        // Only update if we have text to show
        if (segmentText) {
          setText(segmentText);
          setEditorInstanceKey(`${currentId ?? "new"}:${targetTab}:${Date.now()}`);
        }
      }
    } else if (!selectedSegmentId) {
      // Clear the ref when no segment is selected
      lastSelectedSegmentIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSegmentId, translationViewMode]);

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
    // In segment view, use the segment text; in document view, use the full text
    let textToClassify = text;
    
    if (translationViewMode === "segments" && selectedSegmentId && currentWs?.segments) {
      const selectedSegment = currentWs.segments.find((s) => s.id === selectedSegmentId);
      if (selectedSegment) {
        // Get the full document text to derive segment text
        const fullDocText = fullDocumentTextRef.current || 
          (translations.activeTab === "original"
            ? currentWs?.text || ""
            : currentWs?.translations?.find((t) => t.language === translations.activeTab)?.text || "");
        // Use segment text, not the full document text
        textToClassify = selectedSegment.text ?? getSegmentText(selectedSegment, fullDocText);
      }
    }
    
    if (!textToClassify.trim()) {
      showNotice("Paste some text before running classify.");
      return;
    }
    
    try {
      // Pass segment context when running classification
      await tags.runClassify(textToClassify, currentSegmentId ?? undefined);
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
  }, [logError, showNotice, tags, text, currentSegmentId, translationViewMode, selectedSegmentId, currentWs?.segments, currentWs?.text, currentWs?.translations, translations.activeTab]);

  const handleRunNer = useCallback(async () => {
    // In segment view, we need to adjust NER spans by segment offset
    // and use full document text for conflict resolution
    let segmentOffset: number | undefined = undefined;
    let fullDocumentTextForNer: string | undefined = undefined;

    if (translationViewMode === "segments" && selectedSegmentId && currentWs?.segments) {
      const selectedSegment = currentWs.segments.find((s) => s.id === selectedSegmentId);
      if (selectedSegment) {
        segmentOffset = selectedSegment.start;
        // Use fullDocumentText for conflict resolution (prefer ref if available for latest edits)
        // Compute full document text inline to avoid dependency on variable defined later
        const fullDocText = fullDocumentTextRef.current || 
          (translations.activeTab === "original"
            ? currentWs?.text || ""
            : currentWs?.translations?.find((t) => t.language === translations.activeTab)?.text || "");
        fullDocumentTextForNer = fullDocText;
      }
    }

    await annotations.runNer(text, currentId ?? null, segmentOffset, fullDocumentTextForNer);
  }, [text, currentId, annotations, translationViewMode, selectedSegmentId, currentWs?.segments, currentWs?.text, currentWs?.translations, translations.activeTab]);

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
      
      // Check if current tab exists in document translations, if not switch to "original"
      const currentTab = translations.activeTab;
      let targetTab = currentTab;
      if (currentTab !== "original") {
        const hasTranslation = currentWs?.translations?.some(t => t.language === currentTab);
        if (!hasTranslation) {
          // Switch to original tab if current tab doesn't exist in document translations
          targetTab = "original";
          translations.setActiveTab("original");
        }
      }
      
      // Load text - prefer fullDocumentTextRef (has latest edits) over workspace (may be stale)
      // The fullDocumentTextRef is updated by handleTextChange when editing in segment view
      let textToLoad: string;
      
      // First try the ref (has the most recent edits from segment view)
      if (fullDocumentTextRef.current) {
        textToLoad = fullDocumentTextRef.current;
      } else {
        // Fall back to workspace (for cases like page reload)
        if (targetTab === "original") {
          textToLoad = currentWs?.text || "";
        } else {
          const translation = currentWs?.translations?.find(
            (t) => t.language === targetTab
          );
          textToLoad = translation?.text || "";
        }
      }
      
      // Restore text
      if (textToLoad) {
        setText(textToLoad);
        // Force editor remount to show restored content
        setEditorInstanceKey(`${currentId ?? "new"}:${targetTab}:${Date.now()}`);
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
        
        if (latestWs && latestWs.segments) {
          // Load the segment text into editor immediately
          const segment = latestWs.segments.find((s) => s.id === activeSegmentId);
          if (segment) {
            // Check if current tab has a translation for this segment, if not switch to "original"
            const currentTab = translations.activeTab;
            let targetTab = currentTab;
            if (currentTab !== "original") {
              const hasTranslation = segment.translations?.[currentTab];
              if (!hasTranslation) {
                // Switch to original tab if current tab doesn't have translation for this segment
                targetTab = "original";
                translations.setActiveTab("original");
              }
            }
            
            // Get full document text for deriving segment text
            // Prefer ref if available (has latest edits), otherwise use workspace
            let docText = fullDocumentTextRef.current;
            if (!docText) {
              docText = targetTab === "original"
                ? latestWs.text || ""
                : latestWs.translations?.find((t) => t.language === targetTab)?.text || "";
            }
            // Store the full document text for syncing edits back
            fullDocumentTextRef.current = docText;
            
            // Load the appropriate text based on target tab
            let segmentText: string;
            if (targetTab === "original") {
              segmentText = segment.text ?? getSegmentText(segment, docText);
            } else {
              segmentText = segment.translations?.[targetTab] || "";
            }
            
            setText(segmentText);
            setEditorInstanceKey(`${currentId ?? "new"}:${targetTab}:${Date.now()}`);
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

  // Join two consecutive segments into one
  const handleJoinSegments = useCallback((segment1: Segment, segment2: Segment) => {
    if (!currentId) return;
    
    // Get latest workspace state
    const latestWorkspaces = useWorkspaceStore.getState().workspaces;
    const latestWs = latestWorkspaces.find(ws => ws.id === currentId);
    if (!latestWs || !latestWs.segments) return;
    
    // Find the segments in the current array (they might have been updated)
    const seg1 = latestWs.segments.find(s => s.id === segment1.id);
    const seg2 = latestWs.segments.find(s => s.id === segment2.id);
    if (!seg1 || !seg2) return;
    
    // Verify segments are consecutive (seg2 should start right after seg1 ends, possibly with a border space)
    // Border space is at seg1.end, so seg2.start should be seg1.end + 1 (or seg1.end if no border space)
    const areConsecutive = seg2.start === seg1.end || seg2.start === seg1.end + 1;
    if (!areConsecutive) {
      console.warn("[WorkspaceContainer] Cannot join non-consecutive segments", {
        seg1: { id: seg1.id, start: seg1.start, end: seg1.end },
        seg2: { id: seg2.id, start: seg2.start, end: seg2.end },
      });
      return;
    }
    
    // Get full document text for merging
    const docTextForMerge = translations.activeTab === "original"
      ? latestWs?.text || ""
      : latestWs?.translations?.find((t) => t.language === translations.activeTab)?.text || "";
    
    // Get segment texts
    const seg1Text = seg1.text ?? getSegmentText(seg1, docTextForMerge);
    const seg2Text = seg2.text ?? getSegmentText(seg2, docTextForMerge);
    
    // Merge segments: combine indices
    const mergedSegment: Segment = {
      id: seg1.id, // Keep first segment's ID
      start: seg1.start,
      end: seg2.end,
      order: seg1.order, // Keep first segment's order
      text: `${seg1Text} ${seg2Text}`.trim(), // Merge text with space
      // Merge translations if they exist (concatenate with space)
      translations: seg1.translations || seg2.translations 
        ? (() => {
            const merged: Record<string, string> = {};
            const allLanguages = new Set([
              ...Object.keys(seg1.translations || {}),
              ...Object.keys(seg2.translations || {}),
            ]);
            for (const lang of allLanguages) {
              const trans1 = seg1.translations?.[lang] || "";
              const trans2 = seg2.translations?.[lang] || "";
              // Concatenate translations with space (or just use the one that exists)
              merged[lang] = trans1 && trans2 
                ? `${trans1} ${trans2}`.trim()
                : trans1 || trans2;
            }
            return Object.keys(merged).length > 0 ? merged : undefined;
          })()
        : undefined,
    };
    
    // Create updated segments array: remove seg2, replace seg1 with merged segment
    const updatedSegments = latestWs.segments
      .filter(s => s.id !== seg1.id && s.id !== seg2.id);
    
    // Add merged segment
    updatedSegments.push(mergedSegment);
    
    // Sort by start position (same as how SegmentNavBar displays them)
    updatedSegments.sort((a, b) => {
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      // Fallback to order if start positions are equal
      return a.order - b.order;
    });
    
    // Update workspace
    setWorkspaces((prev) =>
      prev.map((ws) =>
        ws.id === currentId
          ? { ...ws, segments: updatedSegments, updatedAt: Date.now() }
          : ws
      )
    );
    
    // If the joined segment was selected, keep it selected
    // If seg2 was selected, switch to the merged segment
    const wasSeg1Selected = selectedSegmentId === seg1.id;
    const wasSeg2Selected = selectedSegmentId === seg2.id;
    const wasEitherSelected = wasSeg1Selected || wasSeg2Selected;
    
    if (wasSeg2Selected) {
      setSelectedSegmentId(seg1.id);
    }
    // If seg1 was selected, it remains selected (same ID)
    
    // Clear activeSegmentId if it was one of the joined segments
    if (activeSegmentId === seg1.id || activeSegmentId === seg2.id) {
      setActiveSegmentId(seg1.id);
    }
    
    // If we're in segment view mode and either segment was selected, refresh editor with merged segment text
    if (translationViewMode === "segments" && wasEitherSelected) {
      // Use the mergedSegment we just created (don't need to read from workspace)
      // Determine which text to load based on active tab
      let segmentTextToLoad: string;
      if (translations.activeTab === "original") {
        // Get full document text to derive segment text
        const docText = latestWs.text || "";
        segmentTextToLoad = mergedSegment.text ?? getSegmentText(mergedSegment, docText);
      } else {
        // Load translation from segment.translations[languageCode]
        segmentTextToLoad = mergedSegment.translations?.[translations.activeTab] || "";
      }
      
      setText(segmentTextToLoad);
      // Force editor remount to show new content
      setEditorInstanceKey(`${currentId ?? "new"}:${translations.activeTab}:${Date.now()}`);
    }
    
    console.debug("[WorkspaceContainer] Segments joined", {
      seg1Id: seg1.id,
      seg2Id: seg2.id,
      mergedId: mergedSegment.id,
      mergedStart: mergedSegment.start,
      mergedEnd: mergedSegment.end,
      remainingSegments: updatedSegments.length,
    });
  }, [currentId, setWorkspaces, selectedSegmentId, activeSegmentId, translationViewMode, translations.activeTab]);

  // Split a segment at cursor position (with validation)
  const handleSplitSegment = useCallback((segment: Segment) => {
    if (!currentId) return;
    
    // Get latest workspace state
    const latestWorkspaces = useWorkspaceStore.getState().workspaces;
    const latestWs = latestWorkspaces.find(ws => ws.id === currentId);
    if (!latestWs || !latestWs.segments) return;
    
    // Find the segment in the current array
    const seg = latestWs.segments.find(s => s.id === segment.id);
    if (!seg) return;
    
    // Get full document text for this operation
    const docText = translations.activeTab === "original"
      ? latestWs?.text || ""
      : latestWs?.translations?.find((t) => t.language === translations.activeTab)?.text || "";
    
    // Get segment text
    const segmentText = seg.text ?? getSegmentText(seg, docText);
    
    // Get current cursor/selection position
    // In segment view mode, the editor shows only the segment text, so selection is segment-relative
    // In document view, selection is document-relative
    const selection = currentSelection;
    let splitPosition: number;
    
    if (selection) {
      if (translationViewMode === "segments") {
        // In segment view, selection is relative to the segment (0-based within segment)
        // Convert to document coordinates
        splitPosition = seg.start + selection.start;
      } else {
        // Document view - selection is document-relative
        splitPosition = selection.start;
      }
    } else {
      // No selection - show dialog with valid options
      setSegmentToSplit(seg);
      setSplitDialogOpen(true);
      return;
    }
    
    // Ensure split position is within segment bounds
    if (splitPosition < seg.start || splitPosition >= seg.end) {
      // Position is outside segment - show dialog with valid options
      setSegmentToSplit(seg);
      setSplitDialogOpen(true);
      return;
    }
    
    // Validate split position
    const validation = validateSplitPosition(splitPosition, segmentText, seg.start);
    
    if (validation.isValid) {
      // Split at validated position (refresh editor if in segment view mode)
      performSplit(seg, splitPosition, latestWs, docText, true);
    } else {
      // Position is not near punctuation - show dialog with options
      setSegmentToSplit(seg);
      setSplitDialogOpen(true);
    }
  }, [currentId, currentSelection, translationViewMode, translations.activeTab]);

  // Perform the actual split operation
  const performSplit = useCallback((
    segment: Segment,
    splitPosition: number,
    workspace: typeof currentWs,
    docText?: string,
    refreshEditor: boolean = false
  ) => {
    if (!currentId || !workspace) return;
    
    // Use provided docText or get it from workspace/ref
    let textToUse = docText;
    if (!textToUse) {
      // Fall back to workspace text if docText not provided
      textToUse = translations.activeTab === "original"
        ? workspace.text || ""
        : workspace.translations?.find((t) => t.language === translations.activeTab)?.text || "";
    }
    
    // Get segment text
    const segmentText = segment.text ?? getSegmentText(segment, textToUse);
    
    // Ensure split position is within segment bounds
    if (splitPosition < segment.start || splitPosition >= segment.end) {
      console.warn("[WorkspaceContainer] Split position outside segment bounds", {
        segmentId: segment.id,
        splitPosition,
        segmentStart: segment.start,
        segmentEnd: segment.end,
      });
      return;
    }
    
    // Calculate segment-relative split position
    const segmentRelativePos = splitPosition - segment.start;
    
    // Check if split position is at punctuation - if so, keep punctuation in first segment
    // After splitting, the punctuation should end the first segment, and second segment starts after it
    const charAtSplit = segmentText[segmentRelativePos];
    const isAtPunctuation = charAtSplit && isPunctuation(charAtSplit);
    
    // If splitting at punctuation, include it in first segment (end after punctuation)
    // Otherwise, split exactly at the position
    const firstSegmentEnd = isAtPunctuation 
      ? splitPosition + 1  // Include the punctuation character
      : splitPosition;      // Split exactly at position
    
    const firstSegmentEndRelative = isAtPunctuation
      ? segmentRelativePos + 1  // Include the punctuation character
      : segmentRelativePos;      // Split exactly at position
    
    const secondSegmentStart = firstSegmentEnd;
    const secondSegmentStartRelative = firstSegmentEndRelative;
    
    // Create two new segments
    const firstSegment: Segment = {
      id: segment.id, // Keep original ID for first segment
      start: segment.start,
      end: firstSegmentEnd,
      order: segment.order,
      text: segmentText.substring(0, firstSegmentEndRelative),
      translations: segment.translations ? (() => {
        // Split translations proportionally (simple approach: split at same position)
        const splitTranslations: Record<string, string> = {};
        for (const [lang, trans] of Object.entries(segment.translations)) {
          // Calculate split point based on the first segment end (which includes punctuation if applicable)
          const transLength = trans.length;
          const splitPoint = Math.floor((firstSegmentEndRelative / segmentText.length) * transLength);
          splitTranslations[lang] = trans.substring(0, splitPoint);
        }
        return Object.keys(splitTranslations).length > 0 ? splitTranslations : undefined;
      })() : undefined,
    };
    
    const secondSegment: Segment = {
      id: `seg-${Date.now()}`, // Generate new ID for second segment
      start: secondSegmentStart,
      end: segment.end,
      order: segment.order + 1, // Increment order
      text: segmentText.substring(secondSegmentStartRelative),
      translations: segment.translations ? (() => {
        // Split translations proportionally
        const splitTranslations: Record<string, string> = {};
        for (const [lang, trans] of Object.entries(segment.translations)) {
          // Calculate split point based on the second segment start (after punctuation if applicable)
          const transLength = trans.length;
          const splitPoint = Math.floor((secondSegmentStartRelative / segmentText.length) * transLength);
          splitTranslations[lang] = trans.substring(splitPoint);
        }
        return Object.keys(splitTranslations).length > 0 ? splitTranslations : undefined;
      })() : undefined,
    };
    
    // Update segments array: remove old segment, add two new segments
    const updatedSegments = workspace.segments
      .filter(s => s.id !== segment.id);
    
    updatedSegments.push(firstSegment, secondSegment);
    
    // Sort by start position
    updatedSegments.sort((a, b) => {
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      return a.order - b.order;
    });
    
    // Adjust order for segments that came after the original segment
    updatedSegments.forEach(s => {
      if (s.order > segment.order && s.id !== firstSegment.id && s.id !== secondSegment.id) {
        s.order += 1;
      }
    });
    
    // Update workspace
    setWorkspaces((prev) =>
      prev.map((ws) =>
        ws.id === currentId
          ? { ...ws, segments: updatedSegments, updatedAt: Date.now() }
          : ws
      )
    );
    
    // Update selected segment to the first part
    const wasSelected = selectedSegmentId === segment.id;
    if (wasSelected) {
      setSelectedSegmentId(firstSegment.id);
    }
    
    // If we're in segment view mode and this segment was selected, refresh editor with first segment text
    if (refreshEditor && wasSelected && translationViewMode === "segments") {
      // Use the firstSegment we just created (don't need to read from workspace)
      // Determine which text to load based on active tab
      let segmentTextToLoad: string;
      if (translations.activeTab === "original") {
        // Use the text we already calculated for firstSegment
        segmentTextToLoad = firstSegment.text || "";
      } else {
        // Load translation from segment.translations[languageCode]
        segmentTextToLoad = firstSegment.translations?.[translations.activeTab] || "";
      }
      
      setText(segmentTextToLoad);
      // Force editor remount to show new content
      setEditorInstanceKey(`${currentId ?? "new"}:${translations.activeTab}:${Date.now()}`);
    }
    
    console.debug("[WorkspaceContainer] Segment split", {
      originalId: segment.id,
      splitPosition,
      firstSegmentId: firstSegment.id,
      secondSegmentId: secondSegment.id,
      totalSegments: updatedSegments.length,
    });
  }, [currentId, setWorkspaces, selectedSegmentId, translationViewMode, translations.activeTab]);

  // Handle split at specific position (from dialog)
  const handleSplitAtPosition = useCallback((position: number) => {
    if (!segmentToSplit || !currentId) return;
    
    const latestWorkspaces = useWorkspaceStore.getState().workspaces;
    const latestWs = latestWorkspaces.find(ws => ws.id === currentId);
    if (!latestWs) return;
    
    // Find the segment again (in case it was updated)
    const seg = latestWs.segments?.find(s => s.id === segmentToSplit.id);
    if (!seg) return;
    
    // Get full document text
    const docText = translations.activeTab === "original"
      ? latestWs?.text || ""
      : latestWs?.translations?.find((t) => t.language === translations.activeTab)?.text || "";
    
    // Refresh editor after split (true flag)
    performSplit(seg, position, latestWs, docText, true);
  }, [segmentToSplit, currentId, performSplit, translations.activeTab]);

  // Segment navigation: load segment into editor (segment mode) or highlight/scroll (document mode)
  const handleSegmentClick = useCallback((segment: Segment) => {
    // If in segment mode, load segment text into editor (no highlighting in editor)
    if (translationViewMode === "segments") {
      // Mark that we're processing a segment click to prevent effect from interfering
      isSegmentClickProcessingRef.current = true;
      
      // Set selectedSegmentId for list highlighting
      setSelectedSegmentId(segment.id);
      // Don't set activeSegmentId in segment mode - we don't want editor highlighting
      
      // Get the latest workspace state to ensure we have the most recent segments and text
      const latestWorkspaces = useWorkspaceStore.getState().workspaces;
      const latestWs = latestWorkspaces.find(ws => ws.id === currentId);
      
      if (!latestWs) {
        isSegmentClickProcessingRef.current = false;
        return;
      }
      
      // Find the segment with the latest indices (in case it was updated by previous edits)
      const latestSegment = latestWs.segments?.find(s => s.id === segment.id);
      if (!latestSegment) {
        isSegmentClickProcessingRef.current = false;
        return;
      }
      
      // Determine which tab to use: keep current if it has translation, otherwise switch to "original"
      const currentTab = translations.activeTab;
      let targetTab = currentTab;
      if (currentTab !== "original") {
        const hasTranslation = latestSegment.translations?.[currentTab];
        if (!hasTranslation) {
          // Switch to original tab
          targetTab = "original";
          translations.setActiveTab("original");
        }
      }
      
      // Get the full document text - prefer ref (has latest edits) over workspace (may be stale)
      let docText = fullDocumentTextRef.current;
      if (!docText) {
        // Fall back to workspace text if ref is empty
        docText = targetTab === "original"
          ? latestWs?.text || ""
          : latestWs?.translations?.find((t) => t.language === targetTab)?.text || "";
      }
      
      // Store it in the ref for future edits
      fullDocumentTextRef.current = docText;
      
      // Determine which text to load based on target tab (not activeTab, which might not have updated yet)
      let segmentText: string;
      if (targetTab === "original") {
        // Load original segment text
        segmentText = latestSegment.text ?? getSegmentText(latestSegment, docText);
      } else {
        // Load translation from segment.translations[languageCode]
        segmentText = latestSegment.translations?.[targetTab] || "";
      }
      
      setText(segmentText);
      // Force editor remount to show new content
      setEditorInstanceKey(`${currentId ?? "new"}:${targetTab}:${Date.now()}`);
      
      // Reset the flag after a short delay to allow state updates to complete
      setTimeout(() => {
        isSegmentClickProcessingRef.current = false;
      }, 100);
      
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

  // Wrapper for setText that handles segment view mode - syncs edits back to full document or segment translations
  const handleTextChange = useCallback((newText: string) => {
    // If we're in segment view and have a selected segment, handle the edit appropriately
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
      
      // If we're on a translation tab (not "original"), save to segment.translations[languageCode]
      if (translations.activeTab !== "original") {
        // Save translation text to segment.translations[languageCode]
        setWorkspaces((prev) =>
          prev.map((ws) =>
            ws.id === currentId
              ? {
                  ...ws,
                  segments: (ws.segments || []).map((seg) =>
                    seg.id === selectedSegmentId
                      ? {
                          ...seg,
                          translations: {
                            ...(seg.translations || {}),
                            [translations.activeTab]: newText,
                          },
                        }
                      : seg
                  ),
                  updatedAt: Date.now(),
                }
              : ws
          )
        );
        // Don't sync back to full document - translations are stored separately
        // But we still need to update the editor with the new text
        setText(newText);
        return;
      }
      
      // Process the segment update for original text (sync back to full document)
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
              oldStart: latestWs.segments?.find(orig => orig.id === s.id)?.start,
              oldEnd: latestWs.segments?.find(orig => orig.id === s.id)?.end,
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
            const textForTab = translations.activeTab === "original" 
              ? updatedWs.text 
              : updatedWs.translations?.find(t => t.language === translations.activeTab)?.text;
            console.debug("[WorkspaceContainer] workspace updated", {
              workspaceId: currentId,
              textLength: textForTab?.length ?? 0,
              segmentsCount: updatedWs.segments?.length ?? 0,
              segmentsPreview: updatedWs.segments?.slice(0, 5).map(s => ({
                id: s.id,
                order: s.order,
                start: s.start,
                end: s.end,
              })) ?? [],
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
      // Pass current segment context when adding tags
      tags.addCustomTag(name, keywordId, parentId, currentSegmentId ?? undefined);
    },
    [tags, currentSegmentId]
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
          activeTab={translations.activeTab}
          highlightedCategories={EMPTY_HIGHLIGHTED_CATEGORIES}
          deletableKeys={annotations.deletableKeys}
          onDeleteSpan={annotations.deleteSpan}
          onAddSpan={annotations.addSpan}
          onSave={handleSave}
          onSelectionChange={setCurrentSelection}
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
          onJoinSegments={handleJoinSegments}
          onSplitSegment={handleSplitSegment}
          viewMode={translationViewMode}
          onViewModeChange={setTranslationViewMode}
          text={fullDocumentText}
          activeTab={translations.activeTab}
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

      {/* Split dialog */}
      <SegmentSplitDialog
        open={splitDialogOpen}
        segment={segmentToSplit}
        text={fullDocumentText}
        onClose={() => {
          setSplitDialogOpen(false);
          setSegmentToSplit(null);
        }}
        onSplitAtPosition={handleSplitAtPosition}
      />
    </Box>
  );
};

export default WorkspaceContainer;
