import React, { useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import EditorArea from "../editor/EditorArea";
import ConflictResolutionDialog from "../editor/dialogs/ConflictResolutionDialog";

import type { NerSpan } from "../../../types/NotationEditor";

import { useSessionStore } from "../../stores/sessionStore";
import { useNotificationStore } from "../../stores/notificationStore";
import { useWorkspaceOperations } from "../../hooks/useWorkspaceOperations";
import { useConflictResolution } from "../../hooks/useConflictResolution";
import { useSegmentOperations } from "../../hooks/useSegmentOperations";
import { workflowService } from "../../../application/services/WorkflowApplicationService";
import { SegmentationApiService } from "../../../infrastructure/services/SegmentationApiService";
import { errorHandlingService } from "../../../infrastructure/services/ErrorHandlingService";
import { presentError } from "../../../application/errors/errorPresenter";

const keyOfSpan = (s: NerSpan) => `${s.start}:${s.end}:${s.entity}`;

const EditorContainer: React.FC = () => {
  const { id: routeId } = useParams();
  const segmentationService = useMemo(() => new SegmentationApiService(), []);

  const enqueueNotification = useNotificationStore((s) => s.enqueue);
  
  const sessionStore = useSessionStore();
  const { 
    session, 
    draftText,
    activeTab,
    translationViewMode,
    activeSegmentId,
    selectedSegmentId,
    setDraftText,
    updateUserSpans,
    updateApiSpans,
    updateSegments,
  } = sessionStore;

  const currentId = routeId ?? session?.id ?? null;

  const deletedApiKeys = useMemo(() => new Set(session?.deletedApiKeys ?? []), [session?.deletedApiKeys]);
  
  const combinedSpans = useMemo(() => {
    const api = session?.apiSpans ?? [];
    const user = session?.userSpans ?? [];
    
    const validApi = api
      .filter(s => !deletedApiKeys.has(keyOfSpan(s)))
      .map(s => ({ ...s, origin: 'api' as const, id: s.id || uuidv4() }));

    const taggedUser = user.map(s => ({ ...s, origin: 'user' as const, id: s.id || uuidv4() }));

    return [...validApi, ...taggedUser];
  }, [session?.apiSpans, session?.userSpans, deletedApiKeys]);

  const deletableKeys = useMemo(() => new Set(combinedSpans.map(keyOfSpan)), [combinedSpans]);

  const showNotice = useCallback((msg: string, opts?: { tone?: "success" | "error" | "info" | "default" | "warning"; persistent?: boolean }) => {
    enqueueNotification({ message: msg, tone: opts?.tone, persistent: opts?.persistent });
  }, [enqueueNotification]);

  const handleError = useCallback((err: unknown) => {
    const appError = errorHandlingService.isAppError(err) ? err : errorHandlingService.handleApiError(err);
    const notice = presentError(appError);
    showNotice(notice.message, { tone: notice.tone, persistent: notice.persistent });
  }, [showNotice]);

  const conflictResolution = useConflictResolution();
  const segmentOps = useSegmentOperations(currentId, session, showNotice);
  
  const workspaceOps = useWorkspaceOperations(
    currentId, 
    session, 
    draftText,
    showNotice, 
    handleError, 
    segmentationService, 
    conflictResolution.requestConflictResolution, 
    segmentOps.fullDocumentTextRef
  );


  const handleSpansAdjusted = useCallback((nextSpans: NerSpan[]) => {
    const currentSession = useSessionStore.getState().session;
    if (!currentSession) return;

    const nextApiSpans = nextSpans.filter(s => s.origin === 'api');
    const nextUserSpans = nextSpans.filter(s => s.origin === 'user');

    const originalApiSpans = currentSession.apiSpans ?? [];
    const currentDeletedKeys = new Set(currentSession.deletedApiKeys ?? []);
    
    const hiddenApiSpans = originalApiSpans.filter(s => currentDeletedKeys.has(keyOfSpan(s)));

    const fullNewApiSpans = [...nextApiSpans, ...hiddenApiSpans];

    updateApiSpans(fullNewApiSpans);
    updateUserSpans(nextUserSpans);
    
    workspaceOps.latestAdjustedSpansRef.current = { 
        userSpans: nextUserSpans, 
        apiSpans: fullNewApiSpans
    };
  }, [updateUserSpans, updateApiSpans, workspaceOps.latestAdjustedSpansRef]);

  const handleTextChange = useCallback((newText: string) => {
    segmentOps.handleTextChange(newText, () => {}); 
    setDraftText(newText);
  }, [segmentOps, setDraftText]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setDraftText(await file.text());
  }, [setDraftText]);

  const onAddSpan = useCallback((s: NerSpan) => workflowService.addSpan(s), []);
  const onDeleteSpan = useCallback((s: NerSpan) => workflowService.deleteSpan(s), []);
  const onRunSegment = useCallback(() => workspaceOps.handleRunSegment(setDraftText, () => {}), [workspaceOps, setDraftText]);

  return (
    <>
      <EditorArea
        editorInstanceKey={currentId || "empty"}
        text={draftText}
        spans={combinedSpans}
        segments={session?.segments ?? []}
        activeTab={activeTab}
        viewMode={translationViewMode}
        activeSegmentId={activeSegmentId}
        selectedSegmentId={selectedSegmentId}
        deletableKeys={deletableKeys}
        highlightedCategories={[]}
        setText={handleTextChange}
        onSpansAdjusted={handleSpansAdjusted}
        onSegmentsAdjusted={updateSegments}
        onUpload={handleUpload}
        onClassify={workspaceOps.handleRunClassify}
        onNer={workspaceOps.handleRunNer}
        onSegment={onRunSegment}
        onSave={workspaceOps.handleSave}
        onAddSpan={onAddSpan}
        onDeleteSpan={onDeleteSpan}
        placeholder={translationViewMode === "segments" && !selectedSegmentId ? "Select a segment to edit" : undefined}
      />
      {conflictResolution.conflictPrompt && (
        <ConflictResolutionDialog
          prompt={conflictResolution.conflictPrompt}
          onKeepExisting={() => conflictResolution.resolveConflictPrompt("existing")}
          onKeepApi={() => conflictResolution.resolveConflictPrompt("api")}
        />
      )}
    </>
  );
};

export default EditorContainer;