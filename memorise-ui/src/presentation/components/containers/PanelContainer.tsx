import React, { useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import RightPanel, { type TagRow } from "../right/RightPanel";
import SplitSegmentDialog from "../segmentation/SplitSegmentDialog";
import type { ThesaurusItem } from "../tags/TagThesaurusInput";
import { useSessionStore } from "../../stores/sessionStore";
import { useNotificationStore } from "../../stores/notificationStore";
import { useThesaurusDisplay, useThesaurusWorker } from "../../hooks";
import { useSegmentOperations } from "../../hooks/useSegmentOperations";
import { presentError } from "../../../application/errors/errorPresenter";
import { errorHandlingService } from "../../../infrastructure/services/ErrorHandlingService";
import { workflowService } from "../../../application/services/WorkflowApplicationService";

const PanelContainer: React.FC = () => {
  const { id: routeId } = useParams();
  
  const enqueueNotification = useNotificationStore((state) => state.enqueue);

  const session = useSessionStore((state) => state.session);
  const segments = useSessionStore((state) => state.session?.segments ?? []);
  const tags = useSessionStore((state) => state.session?.tags ?? []);
  const sessionText = useSessionStore((state) => state.session?.text ?? "");
  const sessionTranslations = useSessionStore((state) => state.session?.translations ?? []);
  const activeSegmentId = useSessionStore((state) => state.activeSegmentId);
  const selectedSegmentId = useSessionStore((state) => state.selectedSegmentId);
  const translationViewMode = useSessionStore((state) => state.translationViewMode);
  const setTranslationViewMode = useSessionStore((state) => state.setTranslationViewMode);
  const activeTab = useSessionStore((state) => state.activeTab);
  const setDraftText = useSessionStore((state) => state.setDraftText);
  
  const currentId = routeId ?? session?.id ?? null;

  const showNotice = useCallback((msg: string, opts?: { tone?: "success" | "error" | "info" | "default" | "warning"; persistent?: boolean }) => {
    enqueueNotification({ message: msg, tone: opts?.tone, persistent: opts?.persistent });
  }, [enqueueNotification]);

  const handleError = useCallback((err: unknown) => {
    const appError = errorHandlingService.isAppError(err) ? err : errorHandlingService.handleApiError(err);
    const notice = presentError(appError);
    showNotice(notice.message, { tone: notice.tone, persistent: notice.persistent });
  }, [showNotice]);

  const segmentOps = useSegmentOperations(currentId, session, showNotice);
  const thesaurusWorker = useThesaurusWorker();
  const thesaurusIndexForDisplay = useThesaurusDisplay(thesaurusWorker);

  const currentSegmentId = translationViewMode === "segments" ? selectedSegmentId : undefined;
  const filteredTags = useMemo(
    () => !currentSegmentId ? tags.filter(t => !t.segmentId) : tags.filter(t => t.segmentId === currentSegmentId),
    [tags, currentSegmentId]
  );

  const tagRows = useMemo<TagRow[]>(
    () => filteredTags.map((t) => ({
      name: t.name,
      source: t.source,
      keywordId: t.label ? Number(t.label) : undefined,
      parentId: t.parentId
    })),
    [filteredTags]
  );

  const fullDocumentText = useMemo(
    () => activeTab === "original" 
      ? sessionText
      : sessionTranslations.find((t) => t.language === activeTab)?.text || "",
    [sessionText, sessionTranslations, activeTab]
  );

  const addCustomTag = useCallback(async (name: string, keywordId?: number, parentId?: number) => {
    try {
      await workflowService.addCustomTag(name, { keywordId, parentId, segmentId: currentSegmentId ?? undefined });
    } catch (err) {
      handleError(err);
    }
  }, [currentSegmentId, handleError]);

  const deleteTag = useCallback(
    (name: string, keywordId?: number, parentId?: number) => workflowService.deleteTag(name, keywordId, parentId),
    []
  );

  const fetchThesaurus = useCallback(async (q: string): Promise<ThesaurusItem[]> => {
    if (!q.trim() || !thesaurusWorker.ready) return [];
    try {
      return (await thesaurusWorker.search(q, 20)).map(item => ({
        name: item.label,
        path: item.path,
        keywordId: item.id,
        parentId: item.parentId,
        isPreferred: item.isPreferred,
        depth: item.depth
      }));
    } catch {
      return [];
    }
  }, [thesaurusWorker]);

  const thesaurusConfig = useMemo(
    () => ({
      onAdd: addCustomTag,
      fetchSuggestions: fetchThesaurus,
      defaultRestrictToThesaurus: false,
      isThesaurusLoading: !thesaurusWorker.ready,
      resetKey: currentId ?? undefined
    }),
    [addCustomTag, fetchThesaurus, thesaurusWorker.ready, currentId]
  );

  return (
    <>
      <RightPanel
        tags={tagRows}
        onDeleteTag={deleteTag}
        thesaurus={thesaurusConfig}
        thesaurusIndex={thesaurusIndexForDisplay}
        segments={segments}
        activeSegmentId={activeSegmentId}
        selectedSegmentId={selectedSegmentId}
        onSegmentClick={(seg) => segmentOps.handleSegmentClick(seg, setDraftText, () => {})}
        onJoinSegments={segmentOps.handleJoinSegments}
        onSplitSegment={segmentOps.handleSplitSegment}
        viewMode={translationViewMode}
        onViewModeChange={setTranslationViewMode}
        text={fullDocumentText}
      />
      <SplitSegmentDialog
        open={segmentOps.splitDialogOpen}
        segment={segmentOps.segmentToSplit}
        fullText={segmentOps.fullDocumentTextRef.current || session?.text || ""}
        onClose={() => {
          segmentOps.setSplitDialogOpen(false);
          segmentOps.setSegmentToSplit(null);
        }}
        onConfirm={segmentOps.handleConfirmSplit}
      />
    </>
  );
};

export default PanelContainer;
