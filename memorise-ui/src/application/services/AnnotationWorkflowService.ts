import { getApiService } from "../../infrastructure/providers/apiProvider";
import { errorHandlingService, type ErrorContext } from "../../infrastructure/services/ErrorHandlingService";
import { useSessionStore } from "../../presentation/stores/sessionStore";
import { resolveApiSpanConflicts, type ConflictPrompt } from "../../core/services/annotation/resolveApiSpanConflicts";
import type { NerSpan } from "../../types/NotationEditor";
import { SegmentLogic } from "../../core/domain/entities/SegmentLogic";
import { v4 as uuidv4 } from "uuid";


export class AnnotationWorkflowService {
  private apiService = getApiService();
  private errorService = errorHandlingService;

  private getSpanId(s: NerSpan): string {
    return s.id ?? `span-${s.start}-${s.end}-${s.entity}`;
  }

  private getCurrentLayer(storeState: ReturnType<typeof useSessionStore.getState>) {
    const { session, activeTab } = storeState;
    if (!session) return null;
    return activeTab === "original"
      ? session
      : session.translations?.find((t) => t.language === activeTab) || null;
  }


  async runNer(
    text: string,
    options?: {
      workspaceId?: string | null;
      segmentOffset?: number;
      fullDocumentText?: string;
      onConflict?: (prompt: ConflictPrompt) => Promise<"api" | "existing">;
    }
  ): Promise<{ conflictsHandled: number }> {
    if (!text.trim()) {
      throw this.errorService.handleValidationError("Text is empty", { operation: "run NER" });
    }

    const context: ErrorContext = { operation: "run NER", workspaceId: options?.workspaceId ?? undefined };

    try {
      let incomingSpans = await this.apiService.ner(text);

      if (options?.segmentOffset !== undefined) {
        const offset = options.segmentOffset;
        incomingSpans = incomingSpans.map((span) => ({ ...span, start: span.start + offset, end: span.end + offset }));
      }

      const session = useSessionStore.getState().session;
      const userSpans = session?.userSpans ?? [];
      const apiSpans = session?.apiSpans ?? [];
      const deletedApiKeys = new Set(session?.deletedApiKeys ?? []);

      const filteredApiSpans = apiSpans.filter((s) => !deletedApiKeys.has(`${s.start}:${s.end}:${s.entity}`));
      const conflictResolutionText = options?.fullDocumentText ?? text;

      const { nextUserSpans, nextApiSpans, conflictsHandled } = await resolveApiSpanConflicts({
        text: conflictResolutionText,
        incomingSpans,
        userSpans,
        existingApiSpans: filteredApiSpans,
        onConflict: options?.onConflict ?? (async () => "api"),
      });

      const store = useSessionStore.getState();
      store.updateUserSpans(nextUserSpans);
      store.updateApiSpans(nextApiSpans);
      store.updateDeletedApiKeys([]);

      return { conflictsHandled };
    } catch (error) {
      const appError = this.errorService.handleApiError(error, context);
      this.errorService.logError(appError, context);
      throw appError;
    }
  }


  deleteSpan(spanId: string): void {
    const store = useSessionStore.getState();
    const currentLayer = this.getCurrentLayer(store);
    
    if (!currentLayer) return;

    const userSpans = currentLayer.userSpans ?? [];
    const apiSpans = currentLayer.apiSpans ?? [];
    const deletedApiKeys = store.session?.deletedApiKeys ?? []; 
    
    const userSpanIndex = userSpans.findIndex(s => this.getSpanId(s) === spanId);

    if (userSpanIndex !== -1) {
      const nextUserSpans = [...userSpans];
      nextUserSpans.splice(userSpanIndex, 1);
      store.updateActiveLayer({ userSpans: nextUserSpans });
      return; 
    } 

    const apiSpan = apiSpans.find(s => this.getSpanId(s) === spanId);

    if (apiSpan) {
        const keyToBan = `${apiSpan.start}:${apiSpan.end}:${apiSpan.entity}`;
        if (!deletedApiKeys.includes(keyToBan)) {
            store.updateDeletedApiKeys([...deletedApiKeys, keyToBan]);
        }
    }
  }
  
  createSpan(category: string, localStart: number, localEnd: number): void {
    const store = useSessionStore.getState();
    const currentLayer = this.getCurrentLayer(store);
    
    if (!currentLayer || !store.session) return;

    let shiftOffset = 0;
    if (store.viewMode === "segments" && store.activeSegmentId && store.session.segments) {
      const translations = store.activeTab === "original" ? undefined : (currentLayer as any).segmentTranslations;
      shiftOffset = SegmentLogic.calculateGlobalOffset(
        store.activeSegmentId, 
        store.session.segments, 
        translations
      );
    }

    const newSpan: NerSpan = {
      id: uuidv4(),
      start: localStart + shiftOffset,
      end: localEnd + shiftOffset,
      entity: category,
      origin: "user"
    };

    const updatedSpans = [...(currentLayer.userSpans ?? []), newSpan];
    store.updateActiveLayer({ userSpans: updatedSpans });
  }


  updateSpanCategory(spanId: string, newCategory: string): void {
    const store = useSessionStore.getState();
    const currentLayer = this.getCurrentLayer(store);
    if (!currentLayer) return;

    const updateSpans = (spans: NerSpan[]) => 
      spans.map((s) => (this.getSpanId(s) === spanId ? { ...s, entity: newCategory, id: spanId } : s));

    store.updateActiveLayer({ 
      userSpans: updateSpans(currentLayer.userSpans ?? []), 
      apiSpans: updateSpans(currentLayer.apiSpans ?? []) 
    });
  }



  deleteMultipleSpans(spanIds: string[]): void {
    const store = useSessionStore.getState();
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
      const currentBanned = store.session?.deletedApiKeys ?? [];
      store.updateDeletedApiKeys([...new Set([...currentBanned, ...newBannedKeys])]);
    }
  }
}

export const annotationWorkflowService = new AnnotationWorkflowService();