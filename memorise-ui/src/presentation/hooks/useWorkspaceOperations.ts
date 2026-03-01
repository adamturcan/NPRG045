import { useCallback, useRef } from "react";
import type { NerSpan } from "../../types/NotationEditor";
import { taggingWorkflowService } from "../../application/services/TaggingWorkflowSercice";
import { annotationWorkflowService } from "../../application/services/AnnotationWorkflowService";
import { SegmentationApiService } from "../../infrastructure/services/SegmentationApiService";
import { useSessionStore } from "../stores/sessionStore";
import { type ConflictPrompt } from "../../core/services/annotation/resolveApiSpanConflicts";
import type { Segment } from "../../types/Segment";



export function useWorkspaceOperations(
  currentId: string | null,
  session: { text?: string; segments?: any[]; userSpans?: NerSpan[]; apiSpans?: NerSpan[]; deletedApiKeys?: string[]; tags?: any[] } | null,
  text: string,
  showNotice: (msg: string, opts?: { tone?: "success" | "error" }) => void,
  handleError: (err: unknown) => void,
  segmentationService: SegmentationApiService,
  requestConflictResolution: (prompt: ConflictPrompt) => Promise<"api" | "existing">,
  fullDocumentTextRef: { current: string }
) {
  const editorViewMode = useSessionStore((state) => state.viewMode);
  const activeSegmentId = useSessionStore((state) => state.activeSegmentId);
  const updateSegments = useSessionStore((state) => state.updateSegments);
  const setDraftText = useSessionStore((state) => state.setDraftText);
  
  const segments = session?.segments ?? [];
  
  const latestAdjustedSpansRef = useRef<{ userSpans: NerSpan[]; apiSpans: NerSpan[] } | null>(null);

  const currentSegmentId = editorViewMode === "segments" ? activeSegmentId : undefined;

  const handleRunClassify = useCallback(async () => {
    if (!text.trim()) return showNotice("Paste text first.");
    try {
      await taggingWorkflowService.runClassify(text, currentSegmentId ?? undefined);
      showNotice("Classification completed.");
    } catch (err) {
      handleError(err);
    }
  }, [text, currentSegmentId, handleError, showNotice]);

  const handleRunNer = useCallback(async () => {
    if (!text.trim()) return showNotice("Paste text first.");
    const seg = editorViewMode === "segments" && activeSegmentId 
      ? segments.find((s: Segment) => s.id === activeSegmentId) : null;
    try {
      const { conflictsHandled } = await annotationWorkflowService.runNer(text, {
        workspaceId: currentId ?? undefined,
        segmentOffset: seg?.start,
        fullDocumentText: fullDocumentTextRef.current || session?.text,
        onConflict: requestConflictResolution,
      });
      showNotice(conflictsHandled > 0 ? "NER completed with conflicts." : "NER completed.");
    } catch (err) {
      handleError(err);
    }
  }, [text, currentId, requestConflictResolution, handleError, showNotice, editorViewMode, activeSegmentId, segments, session?.text, fullDocumentTextRef]);

  const handleRunSegment = useCallback(async (
    setText: (text: string) => void,
    setEditorInstanceKey: (key: string) => void
  ) => {
    if (!text.trim() || !currentId) return showNotice("Paste text first.");
    try {
      const segs = await segmentationService.segmentText(text);
      if (segs.length === 0) return showNotice("No segments found.");
      const { text: textWithBorders, segments: adjusted } = segmentationService.insertBorderSpaces(segs, text);
      setText(textWithBorders);
      setEditorInstanceKey(`${currentId}:segmented:${Date.now()}`);
      updateSegments(adjusted);
      setDraftText(textWithBorders);
      showNotice(`Segmented into ${adjusted.length} segment(s).`, { tone: "success" });
    } catch (err) {
      handleError(err);
    }
  }, [text, currentId, segmentationService, updateSegments, setDraftText, handleError, showNotice]);

  const handleSave = useCallback(() => {
    if (!currentId) return showNotice("No workspace selected.");
    showNotice("Changes tracked in session (persistence pending).", { tone: "success" });
  }, [currentId, showNotice]);

  return {
    handleRunClassify,
    handleRunNer,
    handleRunSegment,
    handleSave,
    latestAdjustedSpansRef,
  };
}
