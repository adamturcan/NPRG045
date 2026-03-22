import { SegmentLogic } from "../../core/domain/entities/SegmentLogic";
import { getApiService } from "../../infrastructure/providers/apiProvider";
import type { Notice } from "../../types/Notice";
import type { SessionPatch } from "../../types/SessionPatch";
import type { Translation } from "../../types/Workspace";
import type { Segment } from "../../types/Segment";

export type SegmentationResult = {
  ok: boolean;
  patch?: SessionPatch;
  notice: Notice;
}


export class SegmentWorkflowService {
  private apiService = getApiService();

  async runAutoSegmentation(session: { text?: string, translations?: Translation[], segments?: Segment[] }, activeTab: string): Promise<SegmentationResult> {
    const { text, translations, segments } = session;

    if ((segments?.length ?? 0) > 1) {
      return {
        ok: false,
        notice: { message: "Document has already been segmented.", tone: "warning" }
      };
    }

    if (!text || !text?.trim()) {
      return {
        ok: false,
        notice: { message: "No text to segment.", tone: "error" }
      };
    }

    if (activeTab !== "original") {
      return {
        ok: false,
        notice: { message: "Segmentation can only be run on the original text.", tone: "error" }
      };
    }

    try {
      const newSegments = await this.apiService.segmentText(text);

      if (newSegments.length === 0) {
        return {
          ok: false,
          notice: { message: "No segments found.", tone: "error" }
        };
      }

      const patch: SessionPatch = {
        segments: newSegments,
        translations: (translations || []).map(t => ({
          ...t,
          segmentTranslations: {},
          text: ""
        }))
      };

      return {
        ok: true,
        patch,
        notice: { message: `Auto-segmented into ${newSegments.length} segment(s).`, tone: "success" }
      };

    } catch (error) {
      return {
        ok: false,
        notice: { message: "Segmentation analysis failed.", tone: "error" }
      };
    }
  }



  joinSegments(segment1Id: string, segment2Id: string, session: { translations: Translation[], segments: Segment[] }): SegmentationResult {
    const { segments, translations } = session;

    if (!segments) {
      return {
        ok: false,
        notice: { message: "No segments available.", tone: "error" }
      };
    }

    const nextSegments = SegmentLogic.joinMasterSegments(segments, segment1Id, segment2Id);
    if (!nextSegments) {
      return {
        ok: false,
        notice: { message: "Segments must be consecutive to be joined.", tone: "error" }
      };
    }

    const nextTranslations = (translations || []).map(translation => {
      const nextSegTrans = SegmentLogic.joinSegmentTranslations(
        translation.segmentTranslations,
        segment1Id,
        segment2Id
      );

      const nextEdited = { ...(translation.editedSegmentTranslations || {}) };
      const wasEdited = nextEdited[segment1Id] || nextEdited[segment2Id];
      if (wasEdited) {
        nextEdited[segment1Id] = true;
      }
      delete nextEdited[segment2Id];

      const nextFullText = nextSegments.map(s => nextSegTrans[s.id] || "").join("");

      return {
        ...translation,
        segmentTranslations: nextSegTrans,
        editedSegmentTranslations: nextEdited,
        text: nextFullText
      };
    });

    return {
      ok: true,
      patch: {
        segments: nextSegments,
        translations: nextTranslations
      },
      notice: { message: "Segments joined successfully.", tone: "success" }
    };
  }

  splitSegment(position: number, session: { text: string, translations: Translation[], segments: Segment[] }, activeSegmentId: string): SegmentationResult {
    const { segments, translations, text } = session;

    if (!segments || !activeSegmentId) {
      return {
        ok: false,
        notice: { message: "No active segment to split.", tone: "error" }
      };
    }

    const fullText = text || "";
    const updatedSegments = SegmentLogic.split(segments, activeSegmentId, position, fullText);
    if (!updatedSegments) {
      return {
        ok: false,
        notice: { message: "Invalid split position.", tone: "error" }
      }
    }

    const updatedTranslations = (translations || []).map(translation => {
      const nextDict = { ...(translation.segmentTranslations || {}) };
      delete nextDict[activeSegmentId];
      const nextFullText = updatedSegments.map(s => nextDict[s.id] || "").join("");
      return { ...translation, segmentTranslations: nextDict, text: nextFullText };
    });

    return {
      ok: true,
      patch: {
        segments: updatedSegments,
        translations: updatedTranslations
      },
      notice: { message: "Segment split successfully.", tone: "success" }
    };
  }

  async shiftSegmentBoundary(sourceSegmentId: string, globalTargetPosition: number, session: { text: string, translations: Translation[], segments: Segment[] }): Promise<SegmentationResult> {
    const { segments, translations, text } = session;

    if (!segments) {
      return {
        ok: false,
        notice: { message: "No segments available.", tone: "error" }
      };
    }

    let fullText = text || "";
    const lastSeg = segments[segments.length - 1];
    if (lastSeg && fullText.length < lastSeg.end) {
      let rebuilt = "";
      for (const seg of segments) {
        while (rebuilt.length < seg.start) rebuilt += " ";
        rebuilt += seg.text;
      }
      fullText = rebuilt;
    }

    const originalSegments = segments;
    const source = segments.find(s => s.id === sourceSegmentId);
    const isForwardShift = source && globalTargetPosition > source.end;

    const updatedSegments = SegmentLogic.shiftSegmentBoundary(
      segments,
      sourceSegmentId,
      globalTargetPosition,
      fullText
    );

    if (!updatedSegments) {
      return {
        ok: false,
        notice: { message: "Invalid drop position.", tone: "error" }
      };
    }

    const newSegmentIds = new Set(updatedSegments.map(s => s.id));
    const mergedIds = originalSegments
      .filter(s => !newSegmentIds.has(s.id) && s.id !== sourceSegmentId)
      .map(s => s.id);

    const updatedSource = updatedSegments.find(s => s.id === sourceSegmentId);

    const splitRemainderIds = updatedSegments
      .filter(s => {
        const orig = originalSegments.find(o => o.id === s.id);
        return orig && orig.text !== s.text && s.id !== sourceSegmentId;
      })
      .map(s => s.id);

    let updatedTranslations: Translation[];

    if (isForwardShift && translations.length > 0 && updatedSource) {
      updatedTranslations = await Promise.all(
        (translations || []).map(async (translation) => {
          const nextDict = { ...(translation.segmentTranslations || {}) };
          const nextEdited = { ...(translation.editedSegmentTranslations || {}) };

          const affectedIds = [sourceSegmentId, ...mergedIds];
          const anyEdited = affectedIds.some(id => nextEdited[id]);

          for (const mergedId of mergedIds) {
            delete nextDict[mergedId];
            delete nextEdited[mergedId];
          }
          for (const remainderId of splitRemainderIds) {
            delete nextDict[remainderId];
            delete nextEdited[remainderId];
          }

          const hadTranslation = affectedIds.some(id =>
            translation.segmentTranslations?.[id]?.trim()
          );

          if (hadTranslation) {
            try {
              const res = await this.apiService.translate({
                text: updatedSource.text,
                targetLang: translation.language,
              });
              nextDict[sourceSegmentId] = res.translatedText;
              nextEdited[sourceSegmentId] = anyEdited;
            } catch {
              delete nextDict[sourceSegmentId];
              delete nextEdited[sourceSegmentId];
            }
          } else {
            delete nextDict[sourceSegmentId];
            delete nextEdited[sourceSegmentId];
          }

          const nextFullText = updatedSegments.map(s => nextDict[s.id] || "").join("");
          return { ...translation, segmentTranslations: nextDict, editedSegmentTranslations: nextEdited, text: nextFullText };
        })
      );
    } else {
      updatedTranslations = (translations || []).map(translation => {
        const nextDict = { ...(translation.segmentTranslations || {}) };
        const nextEdited = { ...(translation.editedSegmentTranslations || {}) };

        let combinedTranslation = nextDict[sourceSegmentId] || "";

        for (const mergedId of mergedIds) {
          const mergedText = nextDict[mergedId] || "";
          if (mergedText) {
            combinedTranslation += (combinedTranslation ? " " : "") + mergedText;
          }
          delete nextDict[mergedId];
          if (nextEdited[mergedId]) {
            nextEdited[sourceSegmentId] = true;
          }
          delete nextEdited[mergedId];
        }

        nextDict[sourceSegmentId] = combinedTranslation;

        const nextFullText = updatedSegments.map(s => nextDict[s.id] || "").join("");
        return { ...translation, segmentTranslations: nextDict, editedSegmentTranslations: nextEdited, text: nextFullText };
      });
    }

    let newFullText = "";
    for (const seg of updatedSegments) {
      while (newFullText.length < seg.start) newFullText += " ";
      newFullText += seg.text;
    }

    return {
      ok: true,
      patch: {
        text: newFullText,
        segments: updatedSegments,
        translations: updatedTranslations
      },
      notice: { message: "Segment boundary shifted.", tone: "success" }
    };
  }
}

export const segmentWorkflowService = new SegmentWorkflowService();