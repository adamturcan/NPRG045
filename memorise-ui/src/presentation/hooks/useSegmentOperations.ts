import { useCallback, useState } from "react";
import type { Segment } from "../../types/Segment";
import { SegmentService } from "../../core/services/SegmentService";
import { useSessionStore } from "../stores/sessionStore";
import { useNotificationStore } from "../stores/notificationStore";

export function useSegmentOperations(

) {
  const session = useSessionStore((state) => state.session);
  const updateSegments = useSessionStore((state) => state.updateSegments);
  const setDraftText = useSessionStore((state) => state.setDraftText);
  const viewMode = useSessionStore((state) => state.viewMode);
  const activeSegmentId = useSessionStore((state) => state.activeSegmentId);
  const setActiveSegmentId = useSessionStore((state) => state.setActiveSegmentId);
  const activeTab = useSessionStore((state) => state.activeTab);
  const enqueueNotification = useNotificationStore((state) => state.enqueue);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  
  //function called when clicked on a segment in the right panel
  const handleSegmentClick = useCallback((
    segment: Segment,
    setText: (text: string) => void,
    setEditorInstanceKey: (key: string) => void
  ) => {
    if (viewMode === "segments") {
      setActiveSegmentId(segment.id);
      setText(segment.text);
      setEditorInstanceKey(`${segment.id}:${activeTab}:${Date.now()}`);
    } else {      
      setActiveSegmentId(segment.id);
    } 
  }, [viewMode, activeTab, setActiveSegmentId]);




  //
  const handleJoinSegments = useCallback((id1: string, id2: string) => {

    if (!session?.segments){
      enqueueNotification({ message: "No segments.", tone: "error" }); 
      return;
    }

    const updated = SegmentService.joinSegments(session.segments, id1, id2 );
    if (!updated) {
      enqueueNotification({ message: "Segments must be consecutive.", tone: "error" });
      return;
    }

    updateSegments(updated);    
    enqueueNotification({ message: "Joined.", tone: "success" });
    

  }, [session, updateSegments, enqueueNotification]);





  const handleSplitSegment = useCallback((segmentId: string) => {
    if (!session?.segments) {
      enqueueNotification({ message: "No segments.", tone: "error" });
      return;
    }
    const seg = session.segments.find(s => s.id === segmentId);
    if (!seg) {
      enqueueNotification({ message: "Segment not found.", tone: "error" });
      return;
    }
    setActiveSegmentId(seg.id);
    setSplitDialogOpen(true);
  }, [session, setActiveSegmentId, enqueueNotification]);


  const handleConfirmSplit = useCallback((splitPosition: number) => {
    if (!session?.segments) {
      enqueueNotification({ message: "No segments.", tone: "error" });
      return;
    }

    if (!activeSegmentId) {
      enqueueNotification({ message: "No active segment.", tone: "error" });
      return;
    }


    const updated = SegmentService.splitSegment(session?.segments ?? [], activeSegmentId, splitPosition);
    if (!updated) {
      enqueueNotification({ message: "Invalid split.", tone: "error" });
      setActiveSegmentId(undefined);
      return;
    }
    
    updateSegments(updated);
    setSplitDialogOpen(false);    
    enqueueNotification({ message: "Split.", tone: "success" });
  }, [session, updateSegments, activeSegmentId, setActiveSegmentId, enqueueNotification]);





  const handleTextChange = useCallback((newText: string, setText: (text: string) => void) => {
    if (viewMode === "segments" && activeSegmentId  && session?.segments) {
      const seg = session.segments.find(s => s.id === activeSegmentId);
      if (!seg) return setText(newText);
      if (activeTab !== "original") {
        updateSegments(session.segments.map((s) =>
          s.id === activeSegmentId ? { ...s, translations: { ...(s.translations || {}), [activeTab]: newText } } : s));
        return setText(newText);
      }
      const fullText = session.text || "";
      const lengthDiff = newText.length - (seg.end - seg.start);
      const isLast = seg.order === session.segments.length - 1;
      const hasBorder = !isLast && seg.end < fullText.length && fullText[seg.end] === " ";
      const updatedFull = fullText.substring(0, seg.start) + newText + (hasBorder ? " " : "") + fullText.substring(hasBorder ? seg.end + 1 : seg.end);      
      updateSegments(SegmentService.updateSegmentAndShift(session.segments, activeSegmentId, seg.start + newText.length, lengthDiff, seg.end));
      setDraftText(updatedFull);
      return;
    }
    setText(newText);
  }, [viewMode, activeSegmentId, session, activeTab, updateSegments, setDraftText]);

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
