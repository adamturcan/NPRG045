import { useSessionStore } from "../../presentation/stores/sessionStore";
import { SpanLogic } from "../../core/domain/entities/SpanLogic";
import { SegmentLogic } from "../../core/domain/entities/SegmentLogic";
import type { NerSpan } from "../../types/NotationEditor";
import { useWorkspaceStore } from "../../presentation/stores/workspaceStore";
import { useNotificationStore } from "../../presentation/stores/notificationStore";
import { getWorkspaceApplicationService } from "../../infrastructure/providers/workspaceProvider";

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
    activeSegId: string,
    liveCoords?: Map<string, { start: number; end: number }>,
    deadSpanIds?: string[]
  ): void {
    const store = useSessionStore.getState();
    const { session, activeTab } = store;

    const currentLayer = this.getCurrentLayer(store);
    if (!session || !currentLayer) return;

    const { nextUserSpans, nextApiSpans, shiftedInStepA } = this.syncLiveSpans(
      store, currentLayer, activeSegId, liveCoords, deadSpanIds 
    );

    if (!activeSegId) {
      store.setDraftText(text);
      store.updateActiveLayer({ text, userSpans: nextUserSpans, apiSpans: nextApiSpans });
      return;
    }

    if (activeTab === "original") {
      this.processMasterSegmentEdit(text, activeSegId, nextUserSpans, nextApiSpans, shiftedInStepA);
    } else {
      this.processTranslationSegmentEdit(text, activeSegId, currentLayer, nextUserSpans, nextApiSpans, shiftedInStepA);
    }
  }

  private syncLiveSpans(
    store: any, 
    currentLayer: any, 
    activeSegId: string, 
    liveCoords?: Map<string, { start: number; end: number }>, 
    deadSpanIds?: string[]
  ) {
    const deadSet = new Set(deadSpanIds || []);

    let nextUserSpans = (currentLayer.userSpans ?? []).filter((s: NerSpan) => !deadSet.has(s.id));
    let nextApiSpans = (currentLayer.apiSpans ?? []).filter((s: NerSpan) => !deadSet.has(s.id));
    const shiftedInStepA = new Set<string>();

    if (!liveCoords) return { nextUserSpans, nextApiSpans, shiftedInStepA };

    let shiftOffset = 0;
    if (activeSegId && store.session.segments) {
      const translations = store.activeTab === "original" ? undefined : currentLayer.segmentTranslations;
      shiftOffset = SegmentLogic.calculateGlobalOffset(activeSegId, store.session.segments, translations);
    }
    
    nextUserSpans = SpanLogic.syncLiveCoords(nextUserSpans, liveCoords, shiftOffset, shiftedInStepA);
    nextApiSpans = SpanLogic.syncLiveCoords(nextApiSpans, liveCoords, shiftOffset, shiftedInStepA);

    return { nextUserSpans, nextApiSpans, shiftedInStepA };
  }

  private processMasterSegmentEdit(text: string, activeSegId: string, userSpans: NerSpan[], apiSpans: NerSpan[], shiftedSet: Set<string>) {
    const store = useSessionStore.getState();
    const session = store.session!;
    const currentFullText = store.draftText || session.text || "";
    const masterActiveSegment = session.segments?.find(s => s.id === activeSegId);
    
    if (!masterActiveSegment || !session.segments) return;
    
    const lengthDiff = text.length - (masterActiveSegment.end - masterActiveSegment.start);
    const updatedFull = currentFullText.substring(0, masterActiveSegment.start) + text + currentFullText.substring(masterActiveSegment.end);

    let updatedSegments = SegmentLogic.updateSegmentAndShift(
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

  async saveWorkspace(): Promise<boolean> {
    const sessionStore = useSessionStore.getState();
    const workspaceStore = useWorkspaceStore.getState();
    const notify = useNotificationStore.getState().enqueue;

    const { session, draftText } = sessionStore;

    if (!session || !session.id) {
      notify({ message: "No active workspace to save.", tone: "error" });
      return false;
    }

    try {
      const appService = getWorkspaceApplicationService();

      const patch = {
        text: draftText, 
        userSpans: session.userSpans,
        apiSpans: session.apiSpans,
        deletedApiKeys: session.deletedApiKeys,
        tags: session.tags,
        translations: session.translations,
        segments: session.segments, 
      };

      await appService.updateWorkspace({
        workspaceId: session.id,
        patch
      });

      workspaceStore.updateWorkspaceMetadata(session.id, { 
        updatedAt: Date.now() 
      });

      useSessionStore.setState({ 
        session: { ...session, text: draftText },
        isDirty: false 
      });

      notify({ message: "Workspace saved successfully.", tone: "success" });
      return true;

    } catch (error) {
      console.error("Failed to save workspace:", error);
      notify({ message: "Failed to save workspace.", tone: "error" });
      return false;
    }
  }
}

export const editorWorkflowService = new EditorWorkflowService();