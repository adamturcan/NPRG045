import React, { useCallback, useState } from "react";
import { Box, Menu, MenuItem, Typography } from "@mui/material";

import CallSplitIcon from "@mui/icons-material/CallSplit";

import { useSessionStore } from "../../stores/sessionStore";
import { useNotificationStore } from "../../stores/notificationStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { presentError } from "../../../application/errors/errorPresenter";
import { errorHandlingService } from "../../../infrastructure/services/ErrorHandlingService";
import { useTranslationOperations } from "../../hooks/useTranslationOperations";
import { useConflictResolution } from "../../hooks/useConflictResolution";
import ConflictResolutionDialog from "../editor/dialogs/ConflictResolutionDialog";

import { annotationWorkflowService, type AnnotationResult } from "../../../application/services/AnnotationWorkflowService";
import { segmentWorkflowService } from "../../../application/services/SegmentWorkflowService";
import { editorWorkflowService } from "../../../application/services/EditorWorkflowService";
import { taggingWorkflowService } from "../../../application/services/TaggingWorkflowSercice";

import EditorGlobalMenu from "../editor/menus/EditorGlobalMenu.tsx";
import CategoryMenu from "../editor/menus/CategoryMenu.tsx";
import { SegmentBlock } from "../editor/SegmentBlock";
import type { SegmentHandlers, SegmentTranslationHandlers } from "../editor/SegmentBlock";
import { SegmentDragProvider } from "../editor/context/SegmentDragContext";
import type { NerSpan } from "../../../types/NotationEditor";

import { COLORS, SPLIT_DELIMITERS, getSpanId, safeSubstring, normalizeReplacement } from "../editor/utils/editorUtils";
import type { AnnotationLayer } from "../../../types/AnnotationTypes.ts";

const EditorContainer: React.FC = () => {
  const sessionStore = useSessionStore();
  const notify = useNotificationStore.getState().enqueue;
  const { session, draftText, setDraftText, activeSegmentId, setActiveSegmentId, activeTab } = sessionStore;

  const setTagPanelOpen = useSessionStore((state) => state.setTagPanelOpen);
  const isTagPanelOpen = useSessionStore((state) => state.isTagPanelOpen);

  const [activeSpan, setActiveSpan] = useState<NerSpan | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [cmReplaceFn, setCmReplaceFn] = useState<((text: string) => void) | null>(null);
  const [newSelection, setNewSelection] = useState<{ start: number; end: number; top: number; left: number, segmentId?: string, localLang?: string, virtualStart?: number } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [actionLangContext, setActionLangContext] = useState("original");

  const [splitAnchor, setSplitAnchor] = useState<{ top: number; left: number, pos: number, segmentId: string } | null>(null);
  const [draggingFromIndex, setDraggingFromIndex] = useState<number | null>(null);

  const { conflictPrompt, requestConflictResolution, resolveConflictPrompt } = useConflictResolution();

  const resolveLayer = (lang: string): AnnotationLayer | null => {
    if (!session) return null;
    if (lang === "original") {
      return {
        text: session.text || draftText || "",
        userSpans: session.userSpans ?? [],
        apiSpans: session.apiSpans ?? [],
      };
    }
    const t = session.translations?.find(tr => tr.language === lang);
    if (!t) return null;
    return {
      text: t.text || "",
      userSpans: t.userSpans ?? [],
      apiSpans: t.apiSpans ?? [],
      segmentTranslations: t.segmentTranslations,
    };
  };
  const applyLayerPatch = (lang: string, patch: AnnotationResult['layerPatch']) => {
    if (!patch) return;
    if (lang === "original") {
      sessionStore.updateSession(patch);
    } else {
      const translations = (session?.translations || []).map(t =>
        t.language === lang ? { ...t, ...patch } : t
      );
      sessionStore.updateSession({ translations });
    }
  };



  const handleError = useCallback((err: unknown) => { const appError = errorHandlingService.isAppError(err) ? err : errorHandlingService.handleApiError(err); const notice = presentError(appError); notify(notice); }, [notify]);
  const translationOps = useTranslationOperations(session?.id ?? null, session, notify, handleError);

  const handleTranslateSegment = useCallback((segmentId: string, lang: string) => { notify({ message: `Translating segment to ${lang}...`, tone: "info" }); translationOps.handleAddTranslation(lang, setDraftText, segmentId); }, [translationOps, setDraftText, notify]);

  const handleDeleteSegmentTranslation = useCallback((lang: string, segmentId: string) => {
    const currentLayer = session?.translations?.find(t => t.language === lang);
    if (currentLayer) {
      const newSegs = { ...currentLayer.segmentTranslations };
      delete newSegs[segmentId];
      const translations = (session?.translations || []).map(t =>
        t.language === lang ? { ...t, segmentTranslations: newSegs } : t
      );
      sessionStore.updateSession({ translations });
    }
  }, [session, sessionStore]);

  const handleJoinUp = useCallback((segmentId: string) => {
    const idx = session?.segments?.findIndex(s => s.id === segmentId) ?? -1;

    if (idx > 0 && session?.segments) {
      const result = segmentWorkflowService.joinSegments(session.segments[idx - 1].id, segmentId, { translations: session.translations || [], segments: session.segments || [] }, activeTab);
      if (result.ok && result.patch) {
        sessionStore.updateSession(result.patch);
      }
      notify(result.notice)
    }
  }, [session?.segments, notify, draftText, activeTab]);

  const handleRunSegmentNer = useCallback(async (segmentId: string, lang: string) => {
    notify({ message: `Running NER on segment (${lang})...`, tone: "info" });
    setActiveSegmentId(segmentId);
    const layer = resolveLayer(lang);
    if (layer && segmentId) {
      const result = await annotationWorkflowService.runNer({ layer, activeSegmentId: segmentId, segments: session?.segments || [], deletedApiKeys: session?.deletedApiKeys ?? [] }, requestConflictResolution);
      if (result.ok) {
        applyLayerPatch(lang, result.layerPatch);
        sessionStore.updateSession({ deletedApiKeys: result.deletedApiKeys });
      }
      notify(result.notice);
    }
  }, [notify, setActiveSegmentId, session, draftText, requestConflictResolution]);

  const handleRunSegmentSemTag = useCallback(async (segmentId: string, lang: string) => {
    notify({ message: `Running Sem-Tag on segment (${lang})...`, tone: "info" });
    setActiveSegmentId(segmentId);
    const result = await taggingWorkflowService.runClassify(false, { activeSegmentId: segmentId, segments: session?.segments || [], draftText, translations: session?.translations || [], text: session?.text || "", activeTab: lang, tags: session?.tags || [] });
    if (result.success && result.tags) {
      sessionStore.updateSession({ tags: result.tags });
    }
    notify(result.notice);
  }, [notify, setActiveSegmentId, session, draftText, sessionStore]);

  const closeEditMenu = useCallback(() => {
    setActiveSpan(null);
    setMenuAnchor(null);
    setCmReplaceFn(null);
  }, []);

  const handleSpanClick = useCallback((span: NerSpan, element: HTMLElement, replaceFn: any, localLang: string, vStart: number) => {
    setNewSelection(null);
    const globalizedSpan = { ...span, start: span.start + vStart, end: span.end + vStart };
    const id = getSpanId(globalizedSpan);
    setActiveSpan({ ...globalizedSpan, id });
    setActionLangContext(localLang);
    setMenuAnchor(element);
    setCmReplaceFn(() => replaceFn);
  }, []);

  const handleCreateSpan = useCallback((category: string) => {
    if (!newSelection || !newSelection.localLang) return;
    setActiveSegmentId(newSelection.segmentId);

    const layer = resolveLayer(newSelection.localLang);
    if (layer && newSelection.segmentId) {
      const result = annotationWorkflowService.createSpan(category, newSelection.start, newSelection.end, { layer, activeSegmentId: newSelection.segmentId, segments: session?.segments ?? [] });
      if (result.ok) {
        applyLayerPatch(newSelection.localLang, result.layerPatch);
      }
    }

    setNewSelection(null);
  }, [newSelection, setActiveSegmentId, session]);

  const handleSelectionChange = useCallback((sel: { start: number; end: number; top: number; left: number } | null, segmentId: string, localLang: string, virtualStart: number) => {
    if (!sel) {
      setNewSelection(null);
      setSplitAnchor(null);
      return;
    }

    const segmentText = segmentId === "root" ? draftText : (session?.segments?.find(s => s.id === segmentId)?.text || "");
    const selectedText = segmentText.substring(sel.start, sel.end).trim();
    const isDelimiter = selectedText.length === 1 && SPLIT_DELIMITERS.includes(selectedText);

    if (isDelimiter && localLang === "original") {
      setActiveSegmentId(segmentId);
      closeEditMenu();
      setNewSelection(null);
      setSplitAnchor({ top: sel.top, left: sel.left, pos: virtualStart + sel.end, segmentId });
    } else {
      setSplitAnchor(null);
      closeEditMenu();
      setNewSelection({ ...sel, segmentId, localLang, virtualStart });
    }
  }, [session?.segments, draftText, closeEditMenu, setActiveSegmentId]);

  const handleConfirmSplit = useCallback(() => {
    if (!splitAnchor) return;
    const result = segmentWorkflowService.splitSegment(splitAnchor.pos, { text: draftText, translations: session?.translations || [], segments: session?.segments || [] }, activeTab, splitAnchor.segmentId);
    if (result.ok && result.patch) {
      sessionStore.updateSession(result.patch);
    }
    notify(result.notice)
    setSplitAnchor(null);
  }, [splitAnchor, draftText, session?.translations, session?.segments, activeTab, notify]);

  const handleTextChange = useCallback((segmentId: string, text: string, liveCoords: any, deadIds?: string[], localLang?: string) => {
    const lang = localLang || "original";
    const layer = resolveLayer(lang);
    if (!layer) return;
    const targetSegmentId = segmentId === "root" ? "" : segmentId;
    const result = editorWorkflowService.handleTextChange(
      text, targetSegmentId, lang,
      { fullText: draftText, segments: session?.segments || [] },
      layer, liveCoords, deadIds
    );
    if (!result) return;
    setDraftText(result.draftText);
    applyLayerPatch(result.lang, result.layerPatch);
  }, [session, draftText, setDraftText]);

  const handleShiftBoundary = useCallback((sourceSegmentId: string, globalTargetPos: number) => {
    const result = segmentWorkflowService.shiftSegmentBoundary(sourceSegmentId, globalTargetPos, { text: draftText, translations: session?.translations || [], segments: session?.segments || [] }, activeTab);
    if (result.ok && result.patch) {
      sessionStore.updateSession(result.patch);
      if (result.patch.text) {
        setDraftText(result.patch.text);
      }
    }
    notify(result.notice)
    setDraggingFromIndex(null);
  }, [session?.segments, notify, draftText, activeTab, setDraftText]);

  const handleRunGlobalTranslate = useCallback((lang: string) => {
    notify({ message: `Translating document to ${lang}...`, tone: "info" });
    translationOps.handleAddTranslation(lang, setDraftText);
  }, [translationOps, setDraftText, notify]);

  const handleRunGlobalNer = useCallback(async () => {
    setIsProcessing(true); setActiveSegmentId(undefined); try {
      const layer = resolveLayer(activeTab);
      if (!layer) return;
      const result = await annotationWorkflowService.runNer({ layer, segments: session?.segments || [], deletedApiKeys: session?.deletedApiKeys ?? [] }, requestConflictResolution);
      if (result.ok) {
        applyLayerPatch(activeTab, result.layerPatch);
        sessionStore.updateSession({ deletedApiKeys: result.deletedApiKeys });
      }
      notify(result.notice);
    } finally { setIsProcessing(false); }
  }, [session, draftText, activeTab, notify, requestConflictResolution]);

  const handleRunGlobalSemTag = useCallback(async () => {
    setIsProcessing(true);
    setActiveSegmentId(undefined);
    try {
      const result = await taggingWorkflowService.runClassify(true, { activeSegmentId: undefined, segments: session?.segments || [], draftText, translations: session?.translations || [], text: session?.text || "", activeTab, tags: session?.tags || [] });
      if (result.success && result.tags) {
        sessionStore.updateSession({ tags: result.tags });
      }
      notify(result.notice);
    } finally {
      setIsProcessing(false);
    }
  }, [session, draftText, activeTab, notify]);


  const handleSave = useCallback(async () => {
    if (!session) return;
    setIsProcessing(true);
    try {
      const result = await editorWorkflowService.saveWorkspace(session, draftText);
      if (result.ok) {
        if (result.sessionPatch) sessionStore.updateSession(result.sessionPatch);
        if (result.workspaceMetadataPatch) useWorkspaceStore.getState().updateWorkspaceMetadata(session.id, result.workspaceMetadataPatch);
      }
      notify(result.notice);
    } finally { setIsProcessing(false); }
  }, [session, draftText, notify]);

  const handleRunGlobalSegment = useCallback(async () => {
    if (session?.segments && session.segments.length > 1) {
      notify({ message: "Auto-segmentation can only be run on an unsegmented document.", tone: "warning" }); return;
    }
    setIsProcessing(true);
    try {
      const result = await segmentWorkflowService.runAutoSegmentation({ text: draftText, translations: session?.translations }, activeTab);
      if (result.ok && result.patch) {
        sessionStore.updateSession(result.patch);
      }
      if (result.notice) {
        notify(result.notice);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [session?.segments, session?.translations, activeTab, notify, sessionStore]);

  const handleUpdateSpanText = useCallback((newText: string) => {
    if (!activeSpan) return;
    const normalized = normalizeReplacement(newText);
    if (normalized.trim().length === 0) {
      const layer = resolveLayer(actionLangContext);
      if (layer && activeSpan.id) {
        const result = annotationWorkflowService.deleteSpan(activeSpan.id, { layer, deletedApiKeys: session?.deletedApiKeys ?? [] });
        if (result.ok) {
          applyLayerPatch(actionLangContext, result.layerPatch);
          if (result.deletedApiKeys) sessionStore.updateSession({ deletedApiKeys: result.deletedApiKeys });
        }
        notify(result.notice);
      }
      closeEditMenu();
      return;
    }
    cmReplaceFn?.(normalized); closeEditMenu();
  }, [activeSpan, cmReplaceFn, closeEditMenu, actionLangContext, session, draftText]);

  const virtualElement = newSelection ? ({ getBoundingClientRect: () => ({ top: newSelection.top, left: newSelection.left, bottom: newSelection.top, right: newSelection.left, width: 0, height: 0 }), nodeType: 1 } as unknown as HTMLElement) : null;

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box", overflow: "hidden", backgroundColor: "transparent" }}>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", pt: 2, pb: 1, zIndex: 50 }}>
        <EditorGlobalMenu
          onNer={handleRunGlobalNer}
          onSegment={handleRunGlobalSegment}
          onSemTag={handleRunGlobalSemTag}
          onSave={handleSave}
          onTranslateAll={handleRunGlobalTranslate}
          isProcessing={isProcessing}
          isTagPanelOpen={isTagPanelOpen}
          onToggleTagPanel={(isOpen) => {
            setTagPanelOpen(isOpen);
            if (isOpen) {

              setActiveSegmentId(undefined);
            }
          }}
          hasActiveSegment={!!activeSegmentId && activeSegmentId !== "root"}
          hasSegments={(session?.segments?.length ?? 0) > 0}
          languageOptions={translationOps.languageOptions}
          isLanguageListLoading={translationOps.isLanguageListLoading}
        />
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: "auto", width: "100%", px: { xs: 2, md: 4 }, py: 2 }}>
        <Box sx={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", overflow: "hidden", backgroundColor: "transparent" }}>
          {!session?.segments || session.segments.length === 0 ? (
            <SegmentDragProvider onDraggingChange={setDraggingFromIndex} draggingFromIndex={draggingFromIndex}>
              <SegmentBlock
                segment={{ id: "root", start: 0, end: draftText.length, text: draftText }}
                index={0}
                session={session}
                display={{ isActive: activeSegmentId === "root", isDragging: false, dropDisabled: false }}
                handlers={{
                  onActivate: () => setActiveSegmentId("root"),
                  onJoinUp: handleJoinUp,
                  onRunNer: handleRunSegmentNer,
                  onRunSemTag: handleRunSegmentSemTag,
                  onSpanClick: handleSpanClick,
                  onSelectionChange: handleSelectionChange,
                  onTextChange: handleTextChange,
                  onShiftBoundary: handleShiftBoundary,
                }}
                translationHandlers={{
                  onAddTranslation: handleTranslateSegment,
                  onDeleteTranslation: handleDeleteSegmentTranslation,
                  languageOptions: translationOps.languageOptions,
                  isLanguageListLoading: translationOps.isLanguageListLoading,
                }}
                dragHandlers={{}}
              />
            </SegmentDragProvider>
          ) : (
            <SegmentDragProvider onDraggingChange={setDraggingFromIndex} draggingFromIndex={draggingFromIndex}>
              {session.segments.map((segment, idx) => {
                const isDragging = draggingFromIndex !== null;
                const dropDisabled = draggingFromIndex !== null && idx <= draggingFromIndex;

                const handlers: SegmentHandlers = {
                  onActivate: () => setActiveSegmentId(segment.id),
                  onJoinUp: handleJoinUp,
                  onRunNer: handleRunSegmentNer,
                  onRunSemTag: handleRunSegmentSemTag,
                  onSpanClick: handleSpanClick,
                  onSelectionChange: handleSelectionChange,
                  onTextChange: handleTextChange,
                  onShiftBoundary: handleShiftBoundary,
                  onInvalidDrop: dropDisabled
                    ? () => notify({ message: "Cannot drop boundary above the source segment.", tone: "warning" })
                    : undefined,
                };

                const translationHandlers: SegmentTranslationHandlers = {
                  onAddTranslation: handleTranslateSegment,
                  onDeleteTranslation: handleDeleteSegmentTranslation,
                  languageOptions: translationOps.languageOptions,
                  isLanguageListLoading: translationOps.isLanguageListLoading,
                };

                return (
                  <SegmentBlock
                    key={segment.id}
                    segment={segment}
                    index={idx}
                    session={session}
                    display={{ isActive: activeSegmentId === segment.id, isDragging, dropDisabled }}
                    handlers={handlers}
                    translationHandlers={translationHandlers}
                    dragHandlers={{ prevSegmentId: idx > 0 ? session.segments?.[idx - 1].id : undefined }}
                  />
                );
              })}
            </SegmentDragProvider>
          )}
        </Box>
        <Box sx={{ minHeight: "100px" }} />
      </Box>

      {/* MENUS */}
      <CategoryMenu
        anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeEditMenu}
        onCategorySelect={(c) => {
          if (activeSpan?.id) {
            const layer = resolveLayer(actionLangContext);
            if (layer) {
              const result = annotationWorkflowService.updateSpanCategory(activeSpan.id, c, { layer });
              if (result.ok) {
                applyLayerPatch(actionLangContext, result.layerPatch);
              }
              notify(result.notice);
            }
          }
          closeEditMenu();
        }}
        showDelete={true}
        onDelete={() => {
          if (activeSpan?.id) {

            const layer = resolveLayer(actionLangContext);
            if (layer) {
              const result = annotationWorkflowService.deleteSpan(activeSpan.id, { layer, deletedApiKeys: session?.deletedApiKeys ?? [] });
              if (result.ok) {
                applyLayerPatch(actionLangContext, result.layerPatch);
                if (result.deletedApiKeys) sessionStore.updateSession({ deletedApiKeys: result.deletedApiKeys });
              }
              notify(result.notice);
            }
            closeEditMenu();
          }
        }}
        spanText={activeSpan ? safeSubstring(draftText, activeSpan.start, activeSpan.end) : ""}
        onTextUpdate={handleUpdateSpanText}
      />

      <CategoryMenu anchorEl={virtualElement} open={Boolean(virtualElement)} onClose={() => setNewSelection(null)} onCategorySelect={handleCreateSpan} showDelete={false} />

      <Menu
        open={Boolean(splitAnchor)}
        anchorReference="anchorPosition"
        anchorPosition={splitAnchor ? { top: splitAnchor.top, left: splitAnchor.left } : undefined}
        onClose={() => setSplitAnchor(null)}
        PaperProps={{ sx: { borderRadius: 2, mt: 1, boxShadow: "0 8px 16px rgba(0,0,0,0.1)" } }}
      >
        <MenuItem onClick={handleConfirmSplit} sx={{ gap: 1.5, py: 1.2, px: 2 }}>
          <CallSplitIcon fontSize="small" sx={{ color: COLORS.dateBlue }} />
          <Typography variant="body2" fontWeight={600}>Split segment here</Typography>
        </MenuItem>
      </Menu>

      {conflictPrompt && (
        <ConflictResolutionDialog
          prompt={conflictPrompt}
          onKeepExisting={() => resolveConflictPrompt("existing")}
          onKeepApi={() => resolveConflictPrompt("api")}
        />
      )}
    </div>
  );
};

export default EditorContainer;