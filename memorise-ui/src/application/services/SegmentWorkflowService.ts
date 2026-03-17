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

  async runAutoSegmentation(session: { text?: string, translations?: Translation[] }, activeTab: string): Promise<SegmentationResult> {
    const { text, translations } = session;

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



  joinSegments(segment1Id: string, segment2Id: string, session: { translations: Translation[], segments: Segment[] }, activeTab: string): SegmentationResult {
    const { segments, translations } = session;


    if (!segments) {
      return {
        ok: false,
        notice: { message: "No segments available.", tone: "error" }
      };
    }

    if (activeTab !== "original") {
      return {
        ok: false,
        notice: { message: "Segments can only be joined in the original text.", tone: "error" }
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

      const nextFullText = nextSegments.map(s => nextSegTrans[s.id] || "").join("");

      return {
        ...translation,
        segmentTranslations: nextSegTrans,
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

  splitSegment(position: number, session: { text: string, translations: Translation[], segments: Segment[] }, activeTab: string, activeSegmentId: string): SegmentationResult {
    const { segments, translations, text } = session;

    if (!segments || !activeSegmentId) {
      return {
        ok: false,
        notice: { message: "No active segment to split.", tone: "error" }
      };
    }

    if (activeTab !== "original") {
      return {
        ok: false,
        notice: { message: "Segments can only be split in the original document.", tone: "error" }
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

  shiftSegmentBoundary(sourceSegmentId: string, globalTargetPosition: number, session: { text: string, translations: Translation[], segments: Segment[] }, activeTab: string): SegmentationResult {
    const { segments, translations, text } = session;

    if (!segments) {
      return {
        ok: false,
        notice: { message: "No segments available.", tone: "error" }
      };
    }

    if (activeTab !== "original") {
      return {
        ok: false,
        notice: { message: "Boundaries can only be shifted in the original document.", tone: "error" }
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

    const updatedTranslations = (translations || []).map(translation => {
      const nextDict = { ...(translation.segmentTranslations || {}) };

      let combinedTranslation = nextDict[sourceSegmentId] || "";

      for (const mergedId of mergedIds) {
        const mergedText = nextDict[mergedId] || "";
        if (mergedText) {
          combinedTranslation += (combinedTranslation ? " " : "") + mergedText;
        }
        delete nextDict[mergedId];
      }

      nextDict[sourceSegmentId] = combinedTranslation;

      const nextFullText = updatedSegments.map(s => nextDict[s.id] || "").join("");

      return { ...translation, segmentTranslations: nextDict, text: nextFullText };
    });

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