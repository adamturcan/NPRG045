import { useSessionStore } from "../../presentation/stores/sessionStore";
import { SegmentService } from "../../core/services/SegmentService"; 

export class SegmentWorkflowService {
  
  joinSegments(id1: string, id2: string): void {
    const store = useSessionStore.getState();
    const { session, activeTab } = store;

    if (!session || !session.segments) return;
    
    if (activeTab !== "original") return; 


    // move this to the domain entity object - later
    const updatedSegments = SegmentService.joinSegments(session.segments, id1, id2);
    
    if (updatedSegments) {
      store.updateActiveLayer({ segments: updatedSegments }); 
    }
  }
}

export const segmentWorkflowService = new SegmentWorkflowService();