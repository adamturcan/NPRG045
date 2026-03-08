import { useSessionStore } from "../../presentation/stores/sessionStore";
import { SpanLogic } from "../../core/domain/entities/SpanLogic";
import { SegmentLogic } from "../../core/domain/entities/SegmentLogic";
import type { NerSpan } from "../../types/NotationEditor";
import type { Segment } from "../../types/Segment";
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
    liveCoords?: Map<string, { start: number; end: number }>, 
    liveSegments?: Segment[], 
    contextMode?: string, 
    contextSegId?: string
  ): void {
    const store = useSessionStore.getState();
    const { session, viewMode, activeTab } = store;

    // 1. Trust the contextSegId from the active editor first!
    const targetSegId = contextSegId || store.activeSegmentId;

    if (contextMode && contextMode !== viewMode) return;
    
    // REMOVED: The early return that was swallowing your keystrokes.
    // if (viewMode === "segments" && contextSegId !== undefined && contextSegId !== store.activeSegmentId) return;
    
    const currentLayer = this.getCurrentLayer(store);
    if (!session || !currentLayer) return;

    // 2. Pass targetSegId down so it uses the correct segment for offset math
    const { nextUserSpans, nextApiSpans, shiftedInStepA } = this.syncLiveSpans(
      store, currentLayer, liveCoords, targetSegId
    );

    if (viewMode === "document") {
      this.processDocumentEdit(text, liveSegments, nextUserSpans, nextApiSpans);
    } 
    else if (viewMode === "segments" && targetSegId) {
      if (activeTab === "original") {
        this.processMasterSegmentEdit(text, targetSegId, nextUserSpans, nextApiSpans, shiftedInStepA);
      } else {
        this.processTranslationSegmentEdit(text, targetSegId, currentLayer, nextUserSpans, nextApiSpans, shiftedInStepA);
      }
    }
  }

  // 3. Update signature to accept targetSegId
  private syncLiveSpans(store: any, currentLayer: any, liveCoords?: Map<string, { start: number; end: number }>, targetSegId?: string) {
    let nextUserSpans = currentLayer.userSpans ?? [];
    let nextApiSpans = currentLayer.apiSpans ?? [];
    const shiftedInStepA = new Set<string>();

    if (!liveCoords) return { nextUserSpans, nextApiSpans, shiftedInStepA };

    let shiftOffset = 0;
    // 4. Calculate offset based on targetSegId, not store.activeSegmentId
    if (store.viewMode === "segments" && targetSegId && store.session.segments) {
      const translations = store.activeTab === "original" ? undefined : currentLayer.segmentTranslations;
      shiftOffset = SegmentLogic.calculateGlobalOffset(targetSegId, store.session.segments, translations);
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

      // 1. Gather the heavy data directly from the Session Store
      const patch = {
        text: draftText, // Use draftText to catch any pending CodeMirror edits
        userSpans: session.userSpans,
        apiSpans: session.apiSpans,
        deletedApiKeys: session.deletedApiKeys,
        tags: session.tags,
        translations: session.translations,
        segments: session.segments, // The bug fix we just applied ensures this gets saved!
      };

      // 2. Call the Application Service directly
      await appService.updateWorkspace({
        workspaceId: session.id,
        patch
      });

      // 3. Update the lightweight metadata store (so UI lists show the correct timestamp)
      workspaceStore.updateWorkspaceMetadata(session.id, { 
        updatedAt: Date.now() 
      });

      // 4. Mark the session as clean
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