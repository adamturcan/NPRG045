import { errorHandlingService, type ErrorContext } from "../../infrastructure/services/ErrorHandlingService";
import { useSessionStore } from "../../presentation/stores/sessionStore";
import { loadThesaurusIndex } from "../../shared/utils/thesaurusHelpers";
import type { TagItem } from "../../types/Tag";

export class TaggingWorkflowService {
  private errorService = errorHandlingService;

  async runClassify(text: string, segmentId?: string | null): Promise<TagItem[]> {
    if (!text.trim()) {
      throw this.errorService.handleValidationError("Text is empty", { operation: "classify text" });
    }

    const context: ErrorContext = { operation: "classify text", payloadLength: text.length };

    try {
      const { classify: apiClassify } = await import("../../shared/utils/api");
      const data = await apiClassify(text);

      interface ClassificationResult { label?: number; name?: string; }
      const apiResults: ClassificationResult[] = Array.isArray(data?.result) ? data.result : Array.isArray(data?.results) ? data.results : [];

      const session = useSessionStore.getState().session;
      const userTags = (session?.tags ?? []).filter((t) => t.source === "user");
      const newTags: TagItem[] = [];

      for (const r of apiResults) {
        if (!r.name) continue;

        if (userTags.some((t) => t.name.toLowerCase() === r.name!.toLowerCase())) continue;

        if (r.label) {
          try {
            const thesaurusIndex = await loadThesaurusIndex();
            const matches = thesaurusIndex.filter((item) => item.id === r.label);

            if (matches.length > 1) {
              for (const match of matches) {
                if (!userTags.some((t) => t.name.toLowerCase() === match.label.toLowerCase() && t.label === match.id && t.parentId === match.parentId)) {
                  newTags.push({ name: match.label, source: "api", label: match.id, parentId: match.parentId, segmentId: segmentId ?? undefined });
                }
              }
            } else if (matches.length === 1) {
              const match = matches[0];
              if (!userTags.some((t) => t.name.toLowerCase() === match.label.toLowerCase() && t.label === match.id && t.parentId === match.parentId)) {
                newTags.push({ name: match.label, source: "api", label: match.id, parentId: match.parentId, segmentId: segmentId ?? undefined });
              }
            } else {
              newTags.push({ name: r.name, source: "api", label: r.label, segmentId: segmentId ?? undefined });
            }
          } catch {
            newTags.push({ name: r.name, source: "api", label: r.label, segmentId: segmentId ?? undefined });
          }
        } else {
          newTags.push({ name: r.name, source: "api", segmentId: segmentId ?? undefined });
        }
      }

      const updateSession = useSessionStore.getState().updateSession;
      const allTags = session?.tags ?? [];

      if (segmentId) {
        const filteredTags = allTags.filter((t) => t.source !== "api" || !t.segmentId || t.segmentId !== segmentId);
        updateSession({ tags: [...filteredTags, ...newTags] });
      } else {
        const userTagsOnly = allTags.filter((t) => t.source === "user");
        updateSession({ tags: [...userTagsOnly, ...newTags] });
      }

      return newTags;
    } catch (error) {
      const appError = this.errorService.handleApiError(error, context);
      this.errorService.logError(appError, context);
      throw appError;
    }
  }

  async addCustomTag(name: string, options?: { keywordId?: number; parentId?: number; segmentId?: string | null }): Promise<void> {
    const tag = name.trim();
    if (!tag) {
      throw this.errorService.handleValidationError("Tag name is empty", { operation: "add custom tag" });
    }
  
    try {
      const session = useSessionStore.getState().session;
      const allTags = session?.tags ?? [];
  
      const exists = allTags.some((t) => {
        const nameMatch = t.name.toLowerCase() === tag.toLowerCase();
        const segmentMatch = (t.segmentId ?? undefined) === (options?.segmentId ?? undefined);
      
        if (!t.label && !options?.keywordId) return nameMatch && segmentMatch;
        if (t.label && options?.keywordId) return nameMatch && t.label === options.keywordId && t.parentId === options.parentId && segmentMatch;
        return false;
      });
  
      if (exists) {
        throw this.errorService.handleValidationError("This tag already exists", { operation: "add custom tag", code: "TAG_ALREADY_EXISTS" });
      }
  
      const newTag: TagItem = {
        name: tag,
        source: "user",
        label: options?.keywordId,
        parentId: options?.parentId,
        segmentId: options?.segmentId ?? undefined,
      };
  
      useSessionStore.getState().updateSession({ tags: [newTag, ...allTags] });
    } catch (error) {
      if (this.errorService.isAppError(error)) throw error;
      const appError = this.errorService.handleApiError(error, { operation: "add custom tag" });
      this.errorService.logError(appError);
      throw appError;
    }
  }

  deleteTag(name: string, keywordId?: number, parentId?: number): void {
    const session = useSessionStore.getState().session;
    if (!session) return;

    const allTags = session.tags ?? [];
    const filteredTags = allTags.filter((t) => {
      const nameMatch = t.name.toLowerCase() === name.toLowerCase();
      if (!t.label && !keywordId) return !nameMatch;
      if (t.label && keywordId) return !(nameMatch && t.label === keywordId && t.parentId === parentId);
      return true;
    });
    
    useSessionStore.getState().updateSession({ tags: filteredTags });
  }
}

export const taggingWorkflowService = new TaggingWorkflowService();