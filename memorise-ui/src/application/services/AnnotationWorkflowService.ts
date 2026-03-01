import { getApiService } from "../../infrastructure/providers/apiProvider";
import { errorHandlingService, type ErrorContext } from "../../infrastructure/services/ErrorHandlingService";
import { useSessionStore } from "../../presentation/stores/sessionStore";
import { resolveApiSpanConflicts, type ConflictPrompt } from "../../core/services/annotation/resolveApiSpanConflicts";
import type { NerSpan } from "../../types/NotationEditor";

export class AnnotationWorkflowService {
  private apiService = getApiService();
  private errorService = errorHandlingService;

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

  addSpan(span: NerSpan): void {
    const store = useSessionStore.getState();
    const session = store.session;
    if (!session) return;

    const userSpans = session.userSpans ?? [];
    const deletedApiKeys = session.deletedApiKeys ?? [];
    const key = `${span.start}:${span.end}:${span.entity}`;

    const exists = userSpans.some(s => span.id && s.id ? span.id === s.id : `${s.start}:${s.end}:${s.entity}` === key);
    if (exists) return;

    const nextDeletedKeys = deletedApiKeys.filter((k) => k !== key);
    if (nextDeletedKeys.length !== deletedApiKeys.length) {
       store.updateDeletedApiKeys(nextDeletedKeys);
    }

    store.updateUserSpans([...userSpans, span]);
  }

  deleteSpan(span: NerSpan): void {
    const store = useSessionStore.getState();
    const session = store.session;
    if (!session) return;

    const userSpans = session.userSpans ?? [];
    const apiSpans = session.apiSpans ?? [];
    const deletedApiKeys = session.deletedApiKeys ?? [];
    
    const userSpanIndex = userSpans.findIndex(s => span.id && s.id ? span.id === s.id : s.start === span.start && s.end === span.end && s.entity === span.entity);

    if (userSpanIndex !== -1) {
      const nextUserSpans = [...userSpans];
      nextUserSpans.splice(userSpanIndex, 1);
      store.updateUserSpans(nextUserSpans);
      return; 
    } 

    let keyToBan = "";
    const originalApiSpan = apiSpans.find(s => span.id && s.id === span.id);

    if (originalApiSpan) {
        keyToBan = `${originalApiSpan.start}:${originalApiSpan.end}:${originalApiSpan.entity}`;
    } else {
        keyToBan = `${span.start}:${span.end}:${span.entity}`;
    }

    if (keyToBan && !deletedApiKeys.includes(keyToBan)) {
        store.updateDeletedApiKeys([...deletedApiKeys, keyToBan]);
    }
  }
}

export const annotationWorkflowService = new AnnotationWorkflowService();