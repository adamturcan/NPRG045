import { useSessionStore } from "../../presentation/stores/sessionStore";
import { SpanLogic } from "../../core/domain/entities/SpanLogic";
import { SegmentLogic } from "../../core/domain/entities/SegmentLogic";
import { SegmentService } from "../../core/services/SegmentService";
import type { NerSpan } from "../../types/NotationEditor";
import type { Segment } from "../../types/Segment";

export class EditorWorkflowService {
  
  private getCurrentLayer(storeState: ReturnType<typeof useSessionStore.getState>) {
    const { session, activeTab } = storeState;
    if (!session) return null;
    return activeTab === "original"
      ? session
      : session.translations?.find((t) => t.language === activeTab) || null;
  }

  handleTextChange(
    text: string, 
    liveCoords?: Map<string, { start: number; end: number }>, 
    liveSegments?: Segment[], 
    contextMode?: string, 
    contextSegId?: string
  ): void {
    const store = useSessionStore.getState();
    const { session, viewMode, activeSegmentId, activeTab } = store;

    if (contextMode && contextMode !== viewMode) return;
    if (viewMode === "segments" && contextSegId !== undefined && contextSegId !== activeSegmentId) return;
    
    const currentLayer = this.getCurrentLayer(store);
    if (!session || !currentLayer) return;

    const { nextUserSpans, nextApiSpans, shiftedInStepA } = this.syncLiveSpans(
      store, currentLayer, liveCoords
    );

    if (viewMode === "document") {
      this.processDocumentEdit(text, liveSegments, nextUserSpans, nextApiSpans);
    } 
    else if (viewMode === "segments" && activeSegmentId) {
      if (activeTab === "original") {
        this.processMasterSegmentEdit(text, activeSegmentId, nextUserSpans, nextApiSpans, shiftedInStepA);
      } else {
        this.processTranslationSegmentEdit(text, activeSegmentId, currentLayer, nextUserSpans, nextApiSpans, shiftedInStepA);
      }
    }
  }

  private syncLiveSpans(store: any, currentLayer: any, liveCoords?: Map<string, { start: number; end: number }>) {
    let nextUserSpans = currentLayer.userSpans ?? [];
    let nextApiSpans = currentLayer.apiSpans ?? [];
    const shiftedInStepA = new Set<string>();

    if (!liveCoords) return { nextUserSpans, nextApiSpans, shiftedInStepA };

    let shiftOffset = 0;
    if (store.viewMode === "segments" && store.activeSegmentId && store.session.segments) {
      const translations = store.activeTab === "original" ? undefined : currentLayer.segmentTranslations;
      shiftOffset = SegmentLogic.calculateGlobalOffset(store.activeSegmentId, store.session.segments, translations);
    }
    
    nextUserSpans = SpanLogic.syncLiveCoords(nextUserSpans, liveCoords, shiftOffset, shiftedInStepA);
    nextApiSpans = SpanLogic.syncLiveCoords(nextApiSpans, liveCoords, shiftOffset, shiftedInStepA);

    return { nextUserSpans, nextApiSpans, shiftedInStepA };
  }

  private processDocumentEdit(text: string, liveSegments: Segment[] | undefined, userSpans: NerSpan[], apiSpans: NerSpan[]) {
    const store = useSessionStore.getState();
    store.setDraftText(text);
    
    if (store.activeTab === "original") {
        const nextSegments = (liveSegments && liveSegments !== store.session?.segments) 
          ? liveSegments.map(seg => ({ ...seg, text: text.substring(seg.start, seg.end) }))
          : store.session?.segments;
        store.updateActiveLayer({ text, segments: nextSegments, userSpans, apiSpans });
    } else {
        store.updateActiveLayer({ text, userSpans, apiSpans });
    }
  }

  private processMasterSegmentEdit(text: string, activeSegId: string, userSpans: NerSpan[], apiSpans: NerSpan[], shiftedSet: Set<string>) {
    const store = useSessionStore.getState();
    const session = store.session!;
    const currentFullText = store.draftText || session.text || "";
    const masterActiveSegment = session.segments?.find(s => s.id === activeSegId);
    
    if (!masterActiveSegment || !session.segments) return;
    
    const lengthDiff = text.length - (masterActiveSegment.end - masterActiveSegment.start);
    const updatedFull = currentFullText.substring(0, masterActiveSegment.start) + text + currentFullText.substring(masterActiveSegment.end);

    let updatedSegments = SegmentService.updateSegmentAndShift(
      session.segments, masterActiveSegment.id, masterActiveSegment.start + text.length, lengthDiff, masterActiveSegment.end
    );
    updatedSegments = updatedSegments.map(seg => seg.id === masterActiveSegment.id ? { ...seg, text } : { ...seg, text: updatedFull.substring(seg.start, seg.end) });

    const nextUserSpans = SpanLogic.shiftSpansAfterEdit(userSpans, masterActiveSegment.end, lengthDiff, shiftedSet);
    const nextApiSpans = SpanLogic.shiftSpansAfterEdit(apiSpans, masterActiveSegment.end, lengthDiff, shiftedSet);

    store.setDraftText(updatedFull); 
    store.updateActiveLayer({ text: updatedFull, segments: updatedSegments, userSpans: nextUserSpans, apiSpans: nextApiSpans });
  }

  private processTranslationSegmentEdit(text: string, activeSegId: string, currentLayer: any, userSpans: NerSpan[], apiSpans: NerSpan[], shiftedSet: Set<string>) {
    const store = useSessionStore.getState();
    const session = store.session!;
    
    const oldSegText = currentLayer.segmentTranslations?.[activeSegId] || "";
    const lengthDiff = text.length - oldSegText.length;
    
    const updatedSegmentTranslations = {
      ...(currentLayer.segmentTranslations || {}),
      [activeSegId]: text
    };
    
    const updatedFull = (session.segments || []).map(s => updatedSegmentTranslations[s.id] || "").join("");
    const virtualStart = SegmentLogic.calculateGlobalOffset(activeSegId, session.segments || [], currentLayer.segmentTranslations);
    const virtualEnd = virtualStart + oldSegText.length;

    const nextUserSpans = SpanLogic.shiftSpansAfterEdit(userSpans, virtualEnd, lengthDiff, shiftedSet);
    const nextApiSpans = SpanLogic.shiftSpansAfterEdit(apiSpans, virtualEnd, lengthDiff, shiftedSet);
    
    store.setDraftText(updatedFull);
    store.updateActiveLayer({ text: updatedFull, segmentTranslations: updatedSegmentTranslations, userSpans: nextUserSpans, apiSpans: nextApiSpans });
  }
}

export const editorWorkflowService = new EditorWorkflowService();