import { getApiService } from "../../infrastructure/providers/apiProvider";
import { errorHandlingService } from "../../infrastructure/services/ErrorHandlingService";
import { useSessionStore } from "../../presentation/stores/sessionStore";
import { resolveApiSpanConflicts, type ConflictPrompt } from "../../core/services/annotation/resolveApiSpanConflicts";
import type { NerSpan } from "../../types/NotationEditor";
import { SegmentLogic } from "../../core/domain/entities/SegmentLogic";
import { v4 as uuidv4 } from "uuid";
import { useNotificationStore } from "../../presentation/stores/notificationStore";

export class AnnotationWorkflowService {
  private apiService = getApiService();
  private errorService = errorHandlingService;

  private getSpanId(s: NerSpan): string {
    return s.id ?? `span-${s.start}-${s.end}-${s.entity}`;
  }

  // Ensures the store's activeTab matches the layer we are operating on 
  // to prevent race conditions during async state updates.
  private ensureCorrectLayer(layerId?: string) {
    if (layerId && useSessionStore.getState().activeTab !== layerId) {
      useSessionStore.setState({ activeTab: layerId });
    }
    return useSessionStore.getState();
  }

  private getCurrentLayer(storeState: ReturnType<typeof useSessionStore.getState>) {
    const { session, activeTab } = storeState;
    if (!session) return null;
    return activeTab === "original"
      ? session
      : session.translations?.find((t) => t.language === activeTab) || null;
  }

  async runNer(onConflict: (prompt: ConflictPrompt) => Promise<"api" | "existing">, layerId?: string): Promise<boolean> {
    const store = this.ensureCorrectLayer(layerId);
    const notify = useNotificationStore.getState().enqueue;
    const { session, viewMode, activeSegmentId, activeTab } = store;

    const currentLayer = this.getCurrentLayer(store) as any; 
    if (!session || !currentLayer) return false;

    let textToProcess = "";
    let globalOffset = 0;

    if (viewMode === "segments" && activeSegmentId) {
      const translations = activeTab === "original" ? undefined : currentLayer.segmentTranslations;
      
      globalOffset = SegmentLogic.calculateGlobalOffset(
         activeSegmentId, 
         session.segments || [], 
         translations
      );
      
      const targetSeg = session.segments?.find(s => s.id === activeSegmentId);
      if (!targetSeg) return false;
      
      textToProcess = activeTab === "original" 
        ? targetSeg.text 
        : (currentLayer.segmentTranslations?.[activeSegmentId] || "");
        
    } else {
      textToProcess = currentLayer.text || "";
    }

    if (!textToProcess.trim()) {
      notify({ message: "No text to process.", tone: "error" });
      return false;
    }

    try {
      let incomingSpans = await this.apiService.ner(textToProcess);

      if (globalOffset > 0) {
        incomingSpans = incomingSpans.map((span) => ({ 
          ...span, 
          start: span.start + globalOffset, 
          end: span.end + globalOffset 
        }));
      }

      const userSpans = currentLayer.userSpans || [];
      const apiSpans = currentLayer.apiSpans || [];
      const deletedApiKeys = new Set(session.deletedApiKeys || []);

      const filteredApiSpans = apiSpans.filter((s) => !deletedApiKeys.has(`${s.start}:${s.end}:${s.entity}`));

      const { nextUserSpans, nextApiSpans, conflictsHandled } = await resolveApiSpanConflicts({
        text: currentLayer.text || "", 
        incomingSpans,
        userSpans,
        existingApiSpans: filteredApiSpans,
        onConflict,
      });
    
      store.updateActiveLayer({
        userSpans: nextUserSpans,
        apiSpans: nextApiSpans,
      });

      store.updateDeletedApiKeys([]);

      notify({ 
        message: conflictsHandled > 0 ? "NER completed with conflicts." : "NER completed.", 
        tone: "success" 
      });
      return true;

    } catch (error) {
      this.errorService.handleApiError(error, {
        operation: "run NER",
        payloadLength: textToProcess.length,
      });
      notify({ message: "Failed to run NER analysis.", tone: "error" });
      return false;
    }
  }

  deleteSpan(spanId: string, layerId?: string): void {
    console.log("deleteSpan", spanId, layerId);
    const store = this.ensureCorrectLayer(layerId);
    const currentLayer = this.getCurrentLayer(store);
    
    if (!currentLayer) return;

    const userSpans = currentLayer.userSpans ?? [];
    const apiSpans = currentLayer.apiSpans ?? [];
    
    const userSpanIndex = userSpans.findIndex(s => this.getSpanId(s) === spanId);

    // If it's a User Span, simply remove it from the layer
    if (userSpanIndex !== -1) {
      const nextUserSpans = [...userSpans];
      nextUserSpans.splice(userSpanIndex, 1);
      store.updateActiveLayer({ userSpans: nextUserSpans });
      return; 
    } 

    // If it's an API span, we must add its coordinates to the global "banned" list
    // so it doesn't come back on the next NER run.
    const apiSpan = apiSpans.find(s => this.getSpanId(s) === spanId);

    if (apiSpan) {
        const keyToBan = `${apiSpan.start}:${apiSpan.end}:${apiSpan.entity}`;
        
        // Always fetch the freshest state right before updating to prevent array overwrites!
        const freshestDeletedKeys = useSessionStore.getState().session?.deletedApiKeys ?? [];
        
        if (!freshestDeletedKeys.includes(keyToBan)) {
            store.updateDeletedApiKeys([...freshestDeletedKeys, keyToBan]);
        }
    }
  }
  
  createSpan(category: string, globalStart: number, globalEnd: number, layerId?: string): void {
    // 1. Force the layer sync
    this.ensureCorrectLayer(layerId);
    
    // 2. Get the FRESH store state
    const freshStore = useSessionStore.getState();
    const currentLayer = this.getCurrentLayer(freshStore);
    
    if (!currentLayer || !freshStore.session) return;
  
    // 3. Create the span using the global coordinates directly from the UI
    const newSpan: NerSpan = {
      id: uuidv4(),
      start: globalStart, // Trust the coordinates passed by the EditorContainer
      end: globalEnd,
      entity: category,
      origin: "user"
    };
  
    // 4. Spread the spans from the FRESH currentLayer 
    // (which now safely contains the shifted coords from EditorWorkflowService!)
    const updatedSpans = [...(currentLayer.userSpans ?? []), newSpan];
    
    freshStore.updateActiveLayer({ 
      userSpans: updatedSpans 
    });
  }

  updateSpanCategory(spanId: string, newCategory: string, layerId?: string): void {
    const store = this.ensureCorrectLayer(layerId);
    const currentLayer = this.getCurrentLayer(store);
    if (!currentLayer) return;

    const updateSpans = (spans: NerSpan[]) => 
      spans.map((s) => (this.getSpanId(s) === spanId ? { ...s, entity: newCategory, id: spanId } : s));

    store.updateActiveLayer({ 
      userSpans: updateSpans(currentLayer.userSpans ?? []), 
      apiSpans: updateSpans(currentLayer.apiSpans ?? []) 
    });
  }

  deleteMultipleSpans(spanIds: string[], layerId?: string): void {
    const store = this.ensureCorrectLayer(layerId);
    const currentLayer = this.getCurrentLayer(store);
    if (!currentLayer) return;

    const idsToRemove = new Set(spanIds);

    const nextUserSpans = (currentLayer.userSpans ?? []).filter(
      s => !idsToRemove.has(this.getSpanId(s))
    );

    const newBannedKeys = (currentLayer.apiSpans ?? [])
      .filter(s => idsToRemove.has(this.getSpanId(s)))
      .map(s => `${s.start}:${s.end}:${s.entity}`);

    store.updateActiveLayer({ userSpans: nextUserSpans });
    
    if (newBannedKeys.length > 0) {
      // Again, grab the freshest state right before merging!
      const freshestDeletedKeys = useSessionStore.getState().session?.deletedApiKeys ?? [];
      store.updateDeletedApiKeys([...new Set([...freshestDeletedKeys, ...newBannedKeys])]);
    }
  }
}

export const annotationWorkflowService = new AnnotationWorkflowService();