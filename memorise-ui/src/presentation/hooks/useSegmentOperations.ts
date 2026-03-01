import { useCallback, useState } from "react";
import type { Segment } from "../../types/Segment";
import { SegmentService } from "../../core/services/SegmentService";
import { useSessionStore } from "../stores/sessionStore";
import { useNotificationStore } from "../stores/notificationStore";

export function useSegmentOperations() {
  const viewMode = useSessionStore((state) => state.viewMode);
  const activeSegmentId = useSessionStore((state) => state.activeSegmentId);
  const setActiveSegmentId = useSessionStore((state) => state.setActiveSegmentId);
  const activeTab = useSessionStore((state) => state.activeTab);
  const enqueueNotification = useNotificationStore((state) => state.enqueue);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  
  const handleSegmentClick = useCallback((
    segment: Segment
  ) => {
    if (viewMode === "segments") {
      setActiveSegmentId(segment.id);
    } else {      
      setActiveSegmentId(activeSegmentId === segment.id ? undefined : segment.id);
    } 
  }, [viewMode, activeSegmentId, setActiveSegmentId]);

  const handleJoinSegments = useCallback((id1: string, id2: string) => {
    const session = useSessionStore.getState().session;
    if (!session?.segments){
      enqueueNotification({ message: "No segments.", tone: "error" }); 
      return;
    }

    const updated = SegmentService.joinSegments(session.segments, id1, id2);
    if (!updated) {
      enqueueNotification({ message: "Segments must be consecutive.", tone: "error" });
      return;
    }

    useSessionStore.getState().updateSegments(updated);    
    enqueueNotification({ message: "Joined.", tone: "success" });
  }, [enqueueNotification]);

  const handleSplitSegment = useCallback((segmentId: string) => {
    const session = useSessionStore.getState().session;
    if (!session?.segments) return enqueueNotification({ message: "No segments.", tone: "error" });

    const seg = session.segments.find(s => s.id === segmentId);
    if (!seg) return enqueueNotification({ message: "Segment not found.", tone: "error" });
    
    setActiveSegmentId(seg.id);
    setSplitDialogOpen(true);
  }, [setActiveSegmentId, enqueueNotification]);

  const handleConfirmSplit = useCallback((splitPosition: number) => {
    const session = useSessionStore.getState().session;
    if (!session?.segments) return enqueueNotification({ message: "No segments.", tone: "error" });
    if (!activeSegmentId) return enqueueNotification({ message: "No active segment.", tone: "error" });

    const fullText = session.text || "";
    const updated = SegmentService.splitSegment(session.segments, activeSegmentId, splitPosition, fullText);
    
    if (!updated) {
      enqueueNotification({ message: "Invalid split.", tone: "error" });
      setActiveSegmentId(undefined);
      return;
    }
    
    useSessionStore.getState().updateSegments(updated);
    setSplitDialogOpen(false);    
    enqueueNotification({ message: "Split.", tone: "success" });
  }, [activeSegmentId, setActiveSegmentId, enqueueNotification]);

  const handleTextChange = useCallback((newText: string, setText: (text: string) => void) => {
    if (viewMode === "segments" && activeSegmentId) {
      const store = useSessionStore.getState();
      const freshSession = store.session;
      
      if (!freshSession?.segments) return setText(newText);

      const seg = freshSession.segments.find(s => s.id === activeSegmentId);
      if (!seg) return setText(newText);

      if (activeTab !== "original") {
        store.updateSegments(freshSession.segments.map((s) =>
          s.id === activeSegmentId ? { ...s, translations: { ...(s.translations || {}), [activeTab]: newText } } : s));
        return setText(newText);
      }

      const fullText = freshSession.text || "";
      const lengthDiff = newText.length - (seg.end - seg.start);
      const updatedFull = fullText.substring(0, seg.start) + newText + fullText.substring(seg.end);      
      
      const updatedSegments = SegmentService.updateSegmentAndShift(
        freshSession.segments, 
        activeSegmentId, 
        seg.start + newText.length, 
        lengthDiff, 
        seg.end
      );

      store.updateSegments(updatedSegments);
      store.setDraftText(updatedFull);
      store.updateSession({ text: updatedFull });
      
      return;
    }
    setText(newText);
  }, [viewMode, activeSegmentId, activeTab]);

  return {
    handleSegmentClick,
    handleJoinSegments,
    handleSplitSegment,
    handleConfirmSplit,
    handleTextChange,
    splitDialogOpen,
    setSplitDialogOpen,
  };
}