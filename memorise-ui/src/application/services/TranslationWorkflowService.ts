import { getApiService } from "../../infrastructure/providers/apiProvider";
import { errorHandlingService } from "../../infrastructure/services/ErrorHandlingService";
import type { Translation } from "../../types/Workspace";
import type { Notice } from "../../types/Notice";
import type { Segment } from "../../types/Segment";

export type TranslationResult = {
  ok: boolean;
  notice: Notice;
  translationsPatch?: Translation[];
  newActiveTab?: string;
  editorKey?: string;
};

export class TranslationWorkflowService {
  private apiService = getApiService();
  private errorService = errorHandlingService;

  async addTranslation(
    targetLang: string,
    session: { segments: Segment[]; translations: Translation[] }
  ): Promise<TranslationResult> {
    if (!session.segments || session.segments.length === 0) {
      return { ok: false, notice: { message: "Document must be segmented before translating.", tone: "error" } };
    }
    try {
      const segmentTranslations: Record<string, string> = {};
      let sourceLang = "auto";

      const results = await Promise.all(
        session.segments.map(async (seg) => {
          if (!seg.text?.trim()) return { id: seg.id, text: "" };
          const res = await this.apiService.translate({ text: seg.text, targetLang });
          if (res.sourceLang) sourceLang = res.sourceLang;
          return { id: seg.id, text: res.translatedText };
        })
      );

      results.forEach(r => { segmentTranslations[r.id] = r.text; });

      const translatedFullText = session.segments.map(s => segmentTranslations[s.id] || "").join("");
      const now = Date.now();

      const newTranslation: Translation = {
        language: targetLang,
        text: translatedFullText,
        sourceLang,
        createdAt: now,
        updatedAt: now,
        segmentTranslations,
        userSpans: [],
        apiSpans: [],
        deletedApiKeys: [],
      };

      return {
        ok: true,
        notice: { message: `Translated document to ${targetLang}.`, tone: "success" },
        translationsPatch: [...(session.translations || []), newTranslation],
        newActiveTab: targetLang,
        editorKey: `${targetLang}:${now}`,
      };
    } catch (error) {
      const appError = this.errorService.handleApiError(error, { operation: "add translation" });
      this.errorService.logError(appError);
      return { ok: false, notice: { message: "Failed to translate document.", tone: "error" } };
    }
  }

  async updateTranslation(
    targetLang: string,
    session: { segments: Segment[]; translations: Translation[] }
  ): Promise<TranslationResult> {
    if (!session.segments || session.segments.length === 0) {
      return { ok: false, notice: { message: "Document must be segmented before translating.", tone: "error" } };
    }
    try {
      const segmentTranslations: Record<string, string> = {};
      let sourceLang = "auto";

      const results = await Promise.all(
        session.segments.map(async (seg) => {
          if (!seg.text?.trim()) return { id: seg.id, text: "" };
          const res = await this.apiService.translate({ text: seg.text, targetLang });
          if (res.sourceLang) sourceLang = res.sourceLang;
          return { id: seg.id, text: res.translatedText };
        })
      );

      results.forEach(r => { segmentTranslations[r.id] = r.text; });

      const translatedFullText = session.segments.map(s => segmentTranslations[s.id] || "").join("");
      const now = Date.now();

      const translationsPatch = (session.translations || []).map(t =>
        t.language === targetLang
          ? {
            ...t,
            text: translatedFullText,
            segmentTranslations,
            sourceLang: sourceLang !== "auto" ? sourceLang : t.sourceLang,
            updatedAt: now
          }
          : t
      );

      return {
        ok: true,
        notice: { message: `Updated ${targetLang} translation.`, tone: "success" },
        translationsPatch,
        editorKey: `${targetLang}:${now}`,
      };
    } catch (error) {
      const appError = this.errorService.handleApiError(error, { operation: "update translation" });
      this.errorService.logError(appError);
      return { ok: false, notice: { message: "Failed to update translation.", tone: "error" } };
    }
  }

  async addSegmentTranslation(
    targetLang: string,
    segmentId: string,
    session: { segments: Segment[]; translations: Translation[] }
  ): Promise<TranslationResult> {
    const seg = session.segments?.find(s => s.id === segmentId);
    if (!seg?.text?.trim()) {
      return { ok: false, notice: { message: "Segment is empty.", tone: "error" } };
    }

    try {
      const res = await this.apiService.translate({ text: seg.text, targetLang });
      const existing = session.translations?.find(t => t.language === targetLang);
      const updatedSegmentTranslations = { ...(existing?.segmentTranslations || {}), [segmentId]: res.translatedText };
      const updatedFullText = (session.segments || []).map(s => updatedSegmentTranslations[s.id] || "").join("");
      const now = Date.now();

      const updatedTranslation: Translation = {
        language: targetLang,
        text: updatedFullText,
        sourceLang: res.sourceLang ?? existing?.sourceLang ?? "auto",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        userSpans: existing?.userSpans ?? [],
        apiSpans: existing?.apiSpans ?? [],
        deletedApiKeys: existing?.deletedApiKeys ?? [],
        segmentTranslations: updatedSegmentTranslations,
      };

      const translationsPatch = existing
        ? (session.translations || []).map(t => t.language === targetLang ? updatedTranslation : t)
        : [...(session.translations || []), updatedTranslation];

      return {
        ok: true,
        notice: { message: `Translated segment to ${targetLang}.`, tone: "success" },
        translationsPatch,
        newActiveTab: targetLang,
      };
    } catch (error) {
      const appError = this.errorService.handleApiError(error, { operation: "add segment translation" });
      this.errorService.logError(appError);
      return { ok: false, notice: { message: "Failed to translate segment.", tone: "error" } };
    }
  }

  deleteTranslation(
    language: string,
    session: { translations: Translation[]; activeTab: string }
  ): TranslationResult {
    const translationsPatch = (session.translations || []).filter(t => t.language !== language);
    const resetToOriginal = session.activeTab === language;
    return {
      ok: true,
      notice: { message: "Translation deleted.", tone: "success" },
      translationsPatch,
      newActiveTab: resetToOriginal ? "original" : undefined,
    };
  }
}

export const translationWorkflowService = new TranslationWorkflowService();