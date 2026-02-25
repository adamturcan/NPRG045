import { useCallback, useRef, useState } from "react";
import type { Segment } from "../../types/Segment";
import { getSegmentText } from "../../types/Segment";
import { SegmentService } from "../../core/services/SegmentService";
import { useSessionStore } from "../stores/sessionStore";

/**
 * Hook for segment manipulation operations
 * Extracted from WorkspaceContainer to reduce complexity
 */
export function useSegmentOperations(
  currentId: string | null,
  session: { text?: string; segments?: Segment[] } | null,
  showNotice: (msg: string, opts?: { tone?: "success" | "error" }) => void
) {
  const updateSegments = useSessionStore((state) => state.updateSegments);
  const setDraftText = useSessionStore((state) => state.setDraftText);
  const translationViewMode = useSessionStore((state) => state.translationViewMode);
  const selectedSegmentId = useSessionStore((state) => state.selectedSegmentId);
  const setSelectedSegmentId = useSessionStore((state) => state.setSelectedSegmentId);
  const setActiveSegmentId = useSessionStore((state) => state.setActiveSegmentId);
  const activeTab = useSessionStore((state) => state.activeTab);
  
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [segmentToSplit, setSegmentToSplit] = useState<Segment | null>(null);
  const fullDocumentTextRef = useRef("");

  const handleSegmentClick = useCallback((
    segment: Segment,
    setText: (text: string) => void,
    setEditorInstanceKey: (key: string) => void
  ) => {
    if (translationViewMode === "segments") {
      setSelectedSegmentId(segment.id);
      const docText = fullDocumentTextRef.current || session?.text || "";
      fullDocumentTextRef.current = docText;
      setText(segment.text ?? getSegmentText(segment, docText));
      setEditorInstanceKey(`${currentId ?? "new"}:${activeTab}:${Date.now()}`);
    } else {
      const currentActiveId = useSessionStore.getState().activeSegmentId;
      setActiveSegmentId(currentActiveId === segment.id ? undefined : segment.id);
    }
  }, [translationViewMode, session?.text, currentId, activeTab, setSelectedSegmentId, setActiveSegmentId]);

  const handleJoinSegments = useCallback((id1: string, id2: string) => {
    if (!currentId || !session?.segments) return showNotice("No segments.", { tone: "error" });
    const updated = SegmentService.joinSegments(session.segments, id1, id2, fullDocumentTextRef.current || session.text || "");
    if (!updated) return showNotice("Segments must be consecutive.", { tone: "error" });
    updateSegments(updated);
    showNotice("Joined.", { tone: "success" });
  }, [currentId, session, updateSegments, showNotice]);

  const handleSplitSegment = useCallback((segmentId: string) => {
    if (!currentId || !session?.segments) return showNotice("No segments.", { tone: "error" });
    const seg = session.segments.find(s => s.id === segmentId);
    if (!seg) return showNotice("Segment not found.", { tone: "error" });
    setSegmentToSplit(seg);
    setSplitDialogOpen(true);
  }, [currentId, session, showNotice]);

  const handleConfirmSplit = useCallback((splitPosition: number) => {
    if (!currentId || !segmentToSplit || !session?.segments) return;
    const updated = SegmentService.splitSegment(session.segments, segmentToSplit.id, splitPosition, fullDocumentTextRef.current || session.text || "");
    if (!updated) {
      showNotice("Invalid split.", { tone: "error" });
      setSplitDialogOpen(false);
      setSegmentToSplit(null);
      return;
    }
    updateSegments(updated);
    setSplitDialogOpen(false);
    setSegmentToSplit(null);
    showNotice("Split.", { tone: "success" });
  }, [currentId, segmentToSplit, session, updateSegments, showNotice]);

  const handleTextChange = useCallback((newText: string, setText: (text: string) => void) => {
    if (translationViewMode === "segments" && selectedSegmentId && currentId && session?.segments) {
      const seg = session.segments.find(s => s.id === selectedSegmentId);
      if (!seg) return setText(newText);
      if (activeTab !== "original") {
        updateSegments(session.segments.map((s) =>
          s.id === selectedSegmentId ? { ...s, translations: { ...(s.translations || {}), [activeTab]: newText } } : s));
        return setText(newText);
      }
      const fullText = fullDocumentTextRef.current || session.text || "";
      const lengthDiff = newText.length - (seg.end - seg.start);
      const isLast = seg.order === session.segments.length - 1;
      const hasBorder = !isLast && seg.end < fullText.length && fullText[seg.end] === " ";
      const updatedFull = fullText.substring(0, seg.start) + newText + (hasBorder ? " " : "") + fullText.substring(hasBorder ? seg.end + 1 : seg.end);
      fullDocumentTextRef.current = updatedFull;
      updateSegments(SegmentService.updateSegmentAndShift(session.segments, selectedSegmentId, seg.start + newText.length, lengthDiff, seg.end));
      setDraftText(updatedFull);
      return;
    }
    setText(newText);
  }, [translationViewMode, selectedSegmentId, currentId, session, activeTab, updateSegments, setDraftText]);

  return {
    handleSegmentClick,
    handleJoinSegments,
    handleSplitSegment,
    handleConfirmSplit,
    handleTextChange,
    splitDialogOpen,
    segmentToSplit,
    setSplitDialogOpen,
    setSegmentToSplit,
    fullDocumentTextRef,
  };
}
