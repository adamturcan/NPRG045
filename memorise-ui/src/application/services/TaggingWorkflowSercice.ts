import { getApiService } from "../../infrastructure/providers/apiProvider";
import { errorHandlingService, type ErrorContext } from "../../infrastructure/services/ErrorHandlingService";
import { useNotificationStore } from "../../presentation/stores/notificationStore";
import { useSessionStore } from "../../presentation/stores/sessionStore";
import { loadThesaurusIndex } from "../../shared/utils/thesaurusHelpers";
import type { TagItem } from "../../types/Tag";

export class TaggingWorkflowService {
  private errorService = errorHandlingService;

  private apiService = getApiService();

  async runClassify(): Promise<boolean> {
    const store = useSessionStore.getState();
    const notify = useNotificationStore.getState().enqueue;
    const { session, viewMode, activeSegmentId, activeTab } = store;

    if (!session) return false;
   
    let textToProcess = "";
    let targetSegmentId: string | undefined = undefined;

    if (viewMode === "segments" && activeSegmentId) {
      targetSegmentId = activeSegmentId;
      const targetSeg = session.segments?.find(s => s.id === activeSegmentId);
      
      textToProcess = activeTab === "original" 
        ? targetSeg?.text || ""
        : session.translations?.find(t => t.language === activeTab)?.segmentTranslations?.[activeSegmentId] || "";
    } else {
      textToProcess = activeTab === "original"
        ? session.text || ""
        : session.translations?.find(t => t.language === activeTab)?.text || "";
    }

    if (!textToProcess.trim()) {
      notify({ message: "No text to classify.", tone: "error" });
      return false;
    }

    try {
      const apiResults = await this.apiService.classify(textToProcess);

      let thesaurusIndex: any[] = [];
      try {
        thesaurusIndex = await loadThesaurusIndex();
      } catch (e) {
        console.warn("Could not load thesaurus index", e);
      }

      const allTags = session.tags ?? [];
      const userTags = allTags.filter((t) => t.source === "user");
      const newTags: TagItem[] = [];

      for (const r of apiResults as { label?: number; name?: string; }[]) {
        if (!r.name) continue;

        if (userTags.some((t) => t.name.toLowerCase() === r.name!.toLowerCase())) continue;

        if (r.label && thesaurusIndex.length > 0) {
          const matches = thesaurusIndex.filter((item) => item.id === r.label);

          if (matches.length > 0) {
            for (const match of matches) {
              const exists = userTags.some((t) => 
                t.name.toLowerCase() === match.label.toLowerCase() && 
                t.label === match.id && 
                t.parentId === match.parentId
              );
              
              if (!exists) {
                newTags.push({ 
                  name: match.label, 
                  source: "api", 
                  label: match.id, 
                  parentId: match.parentId, 
                  segmentId: targetSegmentId 
                });
              }
            }
          } else {
             newTags.push({ name: r.name, source: "api", label: r.label, segmentId: targetSegmentId });
          }
        } else {
          newTags.push({ name: r.name, source: "api", label: r.label, segmentId: targetSegmentId });
        }
      }

      if (targetSegmentId) {
        const filteredTags = allTags.filter((t) => t.source !== "api" || t.segmentId !== targetSegmentId);
        store.updateSession({ tags: [...filteredTags, ...newTags] });
      } else {
        const userTagsOnly = allTags.filter((t) => t.source === "user");
        store.updateSession({ tags: [...userTagsOnly, ...newTags] });
      }

      notify({ message: "Classification completed.", tone: "success" });
      return true;

    } catch (error) {
      console.error("Classification crashed:", error);
      notify({ message: "Failed to classify text.", tone: "error" });
      return false;
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