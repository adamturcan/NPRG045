import { getApiService } from "../../infrastructure/providers/apiProvider";
import { errorHandlingService, type ErrorContext } from "../../infrastructure/services/ErrorHandlingService";
import type { LanguageCode } from "../../shared/utils/translation";
import type { Workspace, Translation } from "../../types/Workspace";

export class TranslationWorkflowService {
  private apiService = getApiService();
  private errorService = errorHandlingService;

  async getSupportedLanguages(): Promise<LanguageCode[]> {
    try {
      return await this.apiService.getSupportedLanguages();
    } catch (error) {
      const appError = this.errorService.handleApiError(error, { operation: "load supported languages" });
      this.errorService.logError(appError);
      throw appError;
    }
  }

  async executeAddTranslation(
    workspaceId: string,
    targetLang: LanguageCode,
    currentWorkspace: Workspace | null,
    updateWorkspaceFn: (id: string, updates: Partial<Workspace>) => Promise<void>
  ): Promise<{ translatedText: string; editorInstanceKey: string; targetLang: string }> {
    if (!currentWorkspace?.segments || currentWorkspace.segments.length === 0) {
      throw this.errorService.handleValidationError("Document must be segmented before translating.", { operation: "add translation" });
    }

    const context: ErrorContext = { operation: "add translation", workspaceId };

    try {
      const segmentTranslations: Record<string, string> = {};
      let sourceLang = "auto";

      const translationPromises = currentWorkspace.segments.map(async (seg) => {
        if (!seg.text?.trim()) return { id: seg.id, text: "" };
        const res = await this.apiService.translate({ text: seg.text, targetLang });
        if (res.sourceLang) sourceLang = res.sourceLang;
        return { id: seg.id, text: res.translatedText };
      });

      const results = await Promise.all(translationPromises);
      results.forEach((res) => {
        segmentTranslations[res.id] = res.text;
      });

      const translatedFullText = currentWorkspace.segments
        .map((s) => segmentTranslations[s.id] || "")
        .join("");

      const newTranslation: Translation = {
        language: targetLang,
        text: translatedFullText,
        sourceLang,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        segmentTranslations,
      };

      await updateWorkspaceFn(workspaceId, {
        translations: [...(currentWorkspace.translations || []), newTranslation],
      });

      return { 
        translatedText: translatedFullText, 
        editorInstanceKey: `${workspaceId}:${targetLang}:${Date.now()}`, 
        targetLang 
      };
    } catch (error) {
      const appError = this.errorService.handleApiError(error, context);
      this.errorService.logError(appError, context);
      throw appError;
    }
  }

  async executeUpdateTranslation(
    workspaceId: string,
    targetLang: LanguageCode,
    currentWorkspace: Workspace | null,
    updateWorkspaceFn: (id: string, updates: Partial<Workspace>) => Promise<void>,
    activeTab: string
  ): Promise<{ translatedText: string; editorInstanceKey?: string; shouldUpdateEditor: boolean }> {
    
    if (!currentWorkspace?.segments || currentWorkspace.segments.length === 0) {
      throw this.errorService.handleValidationError("Document must be segmented before translating.", { operation: "update translation" });
    }

    const context: ErrorContext = { operation: "update translation", workspaceId };

    try {
      const segmentTranslations: Record<string, string> = {};
      let sourceLang = "auto";

      const translationPromises = currentWorkspace.segments.map(async (seg) => {
        if (!seg.text?.trim()) return { id: seg.id, text: "" };
        const res = await this.apiService.translate({ text: seg.text, targetLang });
        if (res.sourceLang) sourceLang = res.sourceLang;
        return { id: seg.id, text: res.translatedText };
      });

      const results = await Promise.all(translationPromises);
      results.forEach((res) => { segmentTranslations[res.id] = res.text; });
      
      const translatedFullText = currentWorkspace.segments
        .map((s) => segmentTranslations[s.id] || "")
        .join("");

      await updateWorkspaceFn(workspaceId, {
        translations: (currentWorkspace.translations || []).map((t) =>
          t.language === targetLang 
            ? { 
                ...t, 
                text: translatedFullText, 
                segmentTranslations, 
                sourceLang: sourceLang !== "auto" ? sourceLang : t.sourceLang,
                updatedAt: Date.now() 
              } 
            : t
        ),
      });

      const shouldUpdateEditor = activeTab === targetLang;
      return { 
        translatedText: translatedFullText, 
        editorInstanceKey: shouldUpdateEditor ? `${workspaceId}:${targetLang}:${Date.now()}` : undefined, 
        shouldUpdateEditor 
      };
    } catch (error) {
        const appError = this.errorService.handleApiError(error, context);
        this.errorService.logError(appError, context);
        throw appError;
    }
  }

  async executeAddSegmentTranslation(
    workspaceId: string,
    targetLang: LanguageCode,
    segmentId: string,
    currentWorkspace: Workspace | null,
    updateWorkspaceFn: (id: string, updates: Partial<Workspace>) => Promise<void>
  ): Promise<{ translatedText: string; targetLang: string }> {
    
    const segmentToTranslate = currentWorkspace?.segments?.find(s => s.id === segmentId);
    if (!segmentToTranslate?.text?.trim()) {
      throw this.errorService.handleValidationError("Segment is empty.", { operation: "add segment translation" });
    }

    const context: ErrorContext = { operation: "add segment translation", workspaceId };

    try {
      const result = await this.apiService.translate({ text: segmentToTranslate.text, targetLang });
      
      const existingTranslation = currentWorkspace?.translations?.find(t => t.language === targetLang);
      
      const updatedSegmentTranslations = {
        ...(existingTranslation?.segmentTranslations || {}),
        [segmentId]: result.translatedText
      };

      const updatedFullText = (currentWorkspace?.segments || [])
        .map(s => updatedSegmentTranslations[s.id] || "")
        .join("");

      const updatedTranslation: Translation = {
        language: targetLang,
        text: updatedFullText,
        sourceLang: result.sourceLang ?? existingTranslation?.sourceLang ?? "auto",
        createdAt: existingTranslation?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        userSpans: existingTranslation?.userSpans ?? [],
        apiSpans: existingTranslation?.apiSpans ?? [],
        deletedApiKeys: existingTranslation?.deletedApiKeys ?? [],
        segmentTranslations: updatedSegmentTranslations
      };

      const newTranslationsList = existingTranslation
        ? (currentWorkspace?.translations || []).map(t => t.language === targetLang ? updatedTranslation : t)
        : [...(currentWorkspace?.translations || []), updatedTranslation];

      await updateWorkspaceFn(workspaceId, { translations: newTranslationsList });

      return { translatedText: result.translatedText, targetLang };
    } catch (error) {
      const appError = this.errorService.handleApiError(error, context);
      this.errorService.logError(appError, context);
      throw appError;
    }
  }

  async executeUpdateSegmentTranslation(
    workspaceId: string,
    targetLang: LanguageCode,
    segmentId: string,
    currentWorkspace: Workspace | null,
    updateWorkspaceFn: (id: string, updates: Partial<Workspace>) => Promise<void>
  ): Promise<{ translatedText: string; targetLang: string }> {
    return this.executeAddSegmentTranslation(workspaceId, targetLang, segmentId, currentWorkspace, updateWorkspaceFn);
  }

  async executeDeleteTranslation(
    workspaceId: string,
    language: string,
    currentWorkspace: Workspace | null,
    updateWorkspaceFn: (id: string, updates: Partial<Workspace>) => Promise<void>,
    activeTab: string
  ): Promise<{ shouldResetToOriginal: boolean }> {
    await updateWorkspaceFn(workspaceId, {
      translations: (currentWorkspace?.translations || []).filter((t) => t.language !== language),
    });
    return { shouldResetToOriginal: activeTab === language };
  }
}

export const translationWorkflowService = new TranslationWorkflowService();