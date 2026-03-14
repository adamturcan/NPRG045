import { getApiService } from "../../infrastructure/providers/apiProvider";
import { errorHandlingService } from "../../infrastructure/services/ErrorHandlingService";
import { useNotificationStore } from "../../presentation/stores/notificationStore";
import { useSessionStore } from "../../presentation/stores/sessionStore";
import { loadThesaurusIndex } from "../../shared/utils/thesaurusHelpers";
import type { TagItem } from "../../types/Tag";

export class TaggingWorkflowService {
  private errorService = errorHandlingService;
  private apiService = getApiService();

  private getContextId(id?: string | null): string | undefined {
    return (!id || id === "root") ? undefined : id;
  }
  
  async runClassify(forceGlobal: boolean = false): Promise<boolean> {
    const store = useSessionStore.getState();
    const notify = useNotificationStore.getState().enqueue;
    const { session, activeTab } = store;

    if (!session) return false;  

    const targetSegmentId = forceGlobal ? undefined : this.getContextId(store.activeSegmentId);
    let textToProcess = "";

    if (targetSegmentId) {      
      const targetSeg = session.segments?.find(s => s.id === targetSegmentId);
      textToProcess = activeTab === "original" 
        ? targetSeg?.text || ""
        : session.translations?.find(t => t.language === activeTab)?.segmentTranslations?.[targetSegmentId] || "";
    } else {
      
      const hasSegments = session.segments && session.segments.length > 0;
      
      if (activeTab === "original") {
        textToProcess = hasSegments 
          ? session.segments!.map(s => s.text).join("\n\n") 
          : session.text || store.draftText || "";
      } else {
        const tLayer = session.translations?.find(t => t.language === activeTab);
        textToProcess = hasSegments && tLayer?.segmentTranslations
          ? session.segments!.map(s => tLayer.segmentTranslations![s.id] || "").join("\n\n")
          : tLayer?.text || "";
      }
    }

    if (!textToProcess.trim()) {
      notify({ message: "No text to classify.", tone: "error" });
      return false;
    }

    try {
      const apiResults = await this.apiService.classify(textToProcess);

      let thesaurusIndex: any[] = [];
      try { thesaurusIndex = await loadThesaurusIndex(); } 
      catch (e) { console.warn("Could not load thesaurus index", e); }

      const allTags = session.tags ?? [];
      const contextUserTags = allTags.filter((t) => t.source === "user" && t.segmentId === targetSegmentId);
      const newTags: TagItem[] = [];

      for (const r of apiResults as { label?: number; name?: string; }[]) {
        if (!r.name) continue;
        if (contextUserTags.some((t) => t.name.toLowerCase() === r.name!.toLowerCase())) continue;

        if (r.label && thesaurusIndex.length > 0) {
          const matches = thesaurusIndex.filter((item) => item.id === r.label);
          if (matches.length > 0) {
            for (const match of matches) {
              const exists = contextUserTags.some((t) => 
                t.name.toLowerCase() === match.label.toLowerCase() && t.label === match.id && t.parentId === match.parentId
              );
              if (!exists) newTags.push({ name: match.label, source: "api", label: match.id, parentId: match.parentId, segmentId: targetSegmentId });
            }
          } else {
             newTags.push({ name: r.name, source: "api", label: r.label, segmentId: targetSegmentId });
          }
        } else {
          newTags.push({ name: r.name, source: "api", label: r.label, segmentId: targetSegmentId });
        }
      }
     
      const filteredTags = allTags.filter((t) => {
        const isApi = t.source === "api";
        const belongsToCurrentContext = t.segmentId === targetSegmentId;
        if (isApi && belongsToCurrentContext) return false; 
        return true; 
      });

      store.updateSession({ tags: [...filteredTags, ...newTags] });
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
    if (!tag) throw this.errorService.handleValidationError("Tag name is empty", { operation: "add custom tag" });
  
    try {
      const session = useSessionStore.getState().session;
      const allTags = session?.tags ?? [];
      const targetSegId = this.getContextId(options?.segmentId);
  
      const exists = allTags.some((t) => {
        const nameMatch = t.name.toLowerCase() === tag.toLowerCase();
        const segmentMatch = t.segmentId === targetSegId;
      
        if (!t.label && !options?.keywordId) return nameMatch && segmentMatch;
        if (t.label && options?.keywordId) return nameMatch && t.label === options.keywordId && t.parentId === options.parentId && segmentMatch;
        return false;
      });
  
      if (exists) throw this.errorService.handleValidationError("This tag already exists in this segment", { operation: "add custom tag", code: "TAG_ALREADY_EXISTS" });
  
      const newTag: TagItem = {
        name: tag,
        source: "user",
        label: options?.keywordId,
        parentId: options?.parentId,
        segmentId: targetSegId,
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
    const store = useSessionStore.getState();
    const session = store.session;
    if (!session) return;

    const targetSegId = this.getContextId(store.activeSegmentId);
    const allTags = session.tags ?? [];

    const filteredTags = allTags.filter((t) => {
      const belongsToCurrentContext = t.segmentId === targetSegId;
      if (!belongsToCurrentContext) return true;

      const nameMatch = t.name.toLowerCase() === name.toLowerCase();
      if (!t.label && !keywordId) return !nameMatch;
      if (t.label && keywordId) return !(nameMatch && t.label === keywordId && t.parentId === parentId);
      
      return true;
    });
    
    store.updateSession({ tags: filteredTags });
  }
}

export const taggingWorkflowService = new TaggingWorkflowService();