import { useSessionStore } from "../../presentation/stores/sessionStore";
import { useNotificationStore } from "../../presentation/stores/notificationStore";
import { SegmentLogic } from "../../core/domain/entities/SegmentLogic";
import { getApiService } from "../../infrastructure/providers/apiProvider";

export class SegmentWorkflowService {
  private apiService = getApiService();

  async runAutoSegmentation(): Promise<boolean> {
    const store = useSessionStore.getState();
    const notify = useNotificationStore.getState().enqueue;
    const { session, activeTab } = store;

    if (!session || !session.text?.trim()) {
      notify({ message: "No text to segment.", tone: "error" });
      return false;
    }

    if (activeTab !== "original") {
      notify({ message: "Segmentation can only be run on the original text.", tone: "error" });
      return false;
    }

    try {
      const newSegments = await this.apiService.segmentText(session.text);
      
      if (newSegments.length === 0) {
        notify({ message: "No segments found.", tone: "error" });
        return false;
      }

      store.updateSession({
        ...session,
        segments: newSegments,
        
        translations: (session.translations || []).map(t => ({
          ...t,
          segmentTranslations: {}, 
          text: "" 
        }))
      });

      notify({ message: `Auto-segmented into ${newSegments.length} segment(s).`, tone: "success" });
      return true;

    } catch (error) {
      notify({ message: "Segmentation analysis failed.", tone: "error" });
      return false;
    }
  }



  joinSegments(id1: string, id2: string): void {
    const store = useSessionStore.getState();
    const notify = useNotificationStore.getState().enqueue;
    const { session, activeTab } = store;

    if (!session || !session.segments) {
      notify({ message: "No segments available.", tone: "error" }); 
      return;
    }
    
    if (activeTab !== "original") {
      notify({ message: "Segments can only be joined in the original text.", tone: "error" });
      return; 
    }

    const nextSegments = SegmentLogic.joinMasterSegments(session.segments, id1, id2);
    if (!nextSegments) {
      notify({ message: "Segments must be consecutive to be joined.", tone: "error" });
      return;
    }

    const nextTranslations = (session.translations || []).map(translation => {
      const nextSegTrans = SegmentLogic.joinSegmentTranslations(
        translation.segmentTranslations, 
        id1, 
        id2
      );
      
      const nextFullText = nextSegments.map(s => nextSegTrans[s.id] || "").join("");

      return {
        ...translation,
        segmentTranslations: nextSegTrans,
        text: nextFullText
      };
    });

    store.updateSession({
      ...session,
      segments: nextSegments,
      translations: nextTranslations
    });

    notify({ message: "Segments joined successfully.", tone: "success" });
  }
  
  splitSegment(position: number): boolean {
    const store = useSessionStore.getState();
    const notify = useNotificationStore.getState().enqueue;
    const { session, activeSegmentId, activeTab } = store;

    if (!session?.segments || !activeSegmentId) {
      notify({ message: "No active segment to split.", tone: "error" });
      return false;
    }

    if (activeTab !== "original") {
      notify({ message: "Segments can only be split in the original document.", tone: "error" });
      return false;
    }

    const fullText = session.text || "";
    const updatedSegments = SegmentLogic.split(session.segments, activeSegmentId, position, fullText);
    
    if (!updatedSegments) {
      notify({ message: "Invalid split position.", tone: "error" });
      store.setActiveSegmentId(undefined);
      return false;
    }

    const updatedTranslations = (session.translations || []).map(translation => {
      const nextDict = { ...(translation.segmentTranslations || {}) };
      
      delete nextDict[activeSegmentId]; 
      
      const nextFullText = updatedSegments.map(s => nextDict[s.id] || "").join("");
      
      return { ...translation, segmentTranslations: nextDict, text: nextFullText };
    });
    
    store.updateSession({
      ...session,
      segments: updatedSegments,
      translations: updatedTranslations
    });
    
    notify({ message: "Segment split successfully.", tone: "success" });
    return true; 
  }
}

export const segmentWorkflowService = new SegmentWorkflowService();