import React, { useCallback, useMemo, useState } from "react";
import { Box, Menu, MenuItem, Typography } from "@mui/material";

import CallSplitIcon from "@mui/icons-material/CallSplit";

import { useSessionStore } from "../../stores/sessionStore";
import { useNotificationStore } from "../../stores/notificationStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { presentError } from "../../../application/errors/errorPresenter";
import { errorHandlingService } from "../../../infrastructure/services/ErrorHandlingService";
import { useLanguageOptions } from "../../hooks/useLanguageOptions";
import { useConflictResolution } from "../../hooks/useConflictResolution";
import { useActionGuard } from "../../hooks/useActionGuard";
import type { ActionGuardActions } from "../../hooks/useActionGuard";
import ConflictResolutionDialog from "../editor/dialogs/ConflictResolutionDialog";
import ActionGuardDialog from "../editor/dialogs/ActionGuardDialog";

import { annotationWorkflowService, type AnnotationResult } from "../../../application/services/AnnotationWorkflowService";
import { segmentWorkflowService } from "../../../application/services/SegmentWorkflowService";
import { editorWorkflowService } from "../../../application/services/EditorWorkflowService";
import { taggingWorkflowService } from "../../../application/services/TaggingWorkflowSercice";
import { translationWorkflowService } from "../../../application/services/TranslationWorkflowService";

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
  const setActiveTab = useSessionStore((state) => state.setActiveTab);
  const updateTranslations = useSessionStore((state) => state.updateTranslations);

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
  const { languageOptions, isLanguageListLoading } = useLanguageOptions();

  const guardActions: ActionGuardActions = useMemo(() => ({
    translateSegment: async (segmentId: string, lang: string) => {
      const fresh = useSessionStore.getState().session;
      const result = await translationWorkflowService.addSegmentTranslation(lang, segmentId, {
        segments: fresh?.segments || [],
        translations: fresh?.translations || [],
      });
      if (result.ok && result.translationsPatch) {
        useSessionStore.getState().updateTranslations(result.translationsPatch);
      }
      if (!result.ok) throw new Error(result.notice.message);
    },
    deleteSegmentTranslation: (lang: string, segmentId: string) => {
      const fresh = useSessionStore.getState().session;
      const currentLayer = fresh?.translations?.find(t => t.language === lang);
      if (currentLayer) {
        const newSegs = { ...currentLayer.segmentTranslations };
        delete newSegs[segmentId];
        const translations = (fresh?.translations || []).map(t =>
          t.language === lang ? { ...t, segmentTranslations: newSegs } : t
        );
        useSessionStore.getState().updateSession({ translations });
      }
    },
  }), []);

  const { guardJoin, guardSplit, guardShift, dialogProps: guardDialogProps, closeDialog: closeGuardDialog } = useActionGuard(guardActions);

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
      editedSegmentTranslations: t.editedSegmentTranslations,
    };
  };
  const applyLayerPatch = (lang: string, patch: AnnotationResult['layerPatch']) => {
    if (!patch) return;
    if (lang === "original") {
      sessionStore.updateSession(patch);
    } else {
      const currentSession = useSessionStore.getState().session;
      const translations = (currentSession?.translations || []).map(t =>
        t.language === lang ? { ...t, ...patch } : t
      );
      sessionStore.updateSession({ translations });
    }
  };

  const markSegmentEdited = (segmentId: string | undefined, lang: string) => {
    const currentSession = useSessionStore.getState().session;
    if (!segmentId || !currentSession) return;
    if (lang === "original") {
      const updatedSegments = (currentSession.segments || []).map(s =>
        s.id === segmentId ? { ...s, isEdited: true } : s
      );
      sessionStore.updateSession({ segments: updatedSegments });
    } else {
      const translations = (currentSession.translations || []).map(t =>
        t.language === lang
          ? { ...t, editedSegmentTranslations: { ...(t.editedSegmentTranslations || {}), [segmentId]: true } }
          : t
      );
      sessionStore.updateSession({ translations });
    }
  };


  const handleError = useCallback((err: unknown) => {
    const appError = errorHandlingService.isAppError(err) ? err : errorHandlingService.handleApiError(err);
    const notice = presentError(appError);
    notify(notice);
  }, [notify]);

  const handleRunGlobalTranslate = useCallback(async (targetLang: string) => {
    if (!session) return;
    setIsProcessing(true);
    try {
      const result = await translationWorkflowService.addTranslation(targetLang, {
        segments: session.segments || [],
        translations: session.translations || [],
      });

      if (result.ok) {
        if (result.translationsPatch) updateTranslations(result.translationsPatch);
        if (result.newActiveTab) setActiveTab(result.newActiveTab);
        if (result.newActiveTab && result.translationsPatch) {
          const newText = result.translationsPatch.find(t => t.language === result.newActiveTab)?.text || "";
          setDraftText(newText);
        }
      }
      notify(result.notice);
    } catch (err) {
      handleError(err);
    } finally {
      setIsProcessing(false);
    }
  }, [session, updateTranslations, setActiveTab, setDraftText, notify, handleError]);

  const handleTranslateSegment = useCallback(async (segmentId: string, lang: string) => {
    if (!session) return;
    setIsProcessing(true);
    notify({ message: `Translating segment to ${lang}...`, tone: "info" });
    try {
      const result = await translationWorkflowService.addSegmentTranslation(lang, segmentId, {
        segments: session.segments || [],
        translations: session.translations || [],
      });

      if (result.ok) {
        if (result.translationsPatch) updateTranslations(result.translationsPatch);
        if (result.newActiveTab) setActiveTab(result.newActiveTab);
      }
      notify(result.notice);
    } catch (err) {
      handleError(err);
    } finally {
      setIsProcessing(false);
    }
  }, [session, updateTranslations, setActiveTab, notify, handleError]);

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

  const handleUpdateSegmentTranslation = useCallback(async (segmentId: string, lang: string) => {
    if (!session) return;
    setIsProcessing(true);
    notify({ message: `Updating translation (${lang})...`, tone: "info" });
    try {
      const result = await translationWorkflowService.updateSegmentTranslation(lang, segmentId, {
        segments: session.segments || [],
        translations: session.translations || [],
      });
      if (result.ok && result.translationsPatch) {
        updateTranslations(result.translationsPatch);
      }
      notify(result.notice);
    } catch (err) {
      handleError(err);
    } finally {
      setIsProcessing(false);
    }
  }, [session, updateTranslations, notify, handleError]);

  // Segment operations

  const handleJoinUp = useCallback((segmentId: string) => {
    const idx = session?.segments?.findIndex(s => s.id === segmentId) ?? -1;
    if (idx <= 0 || !session?.segments) return;

    const seg1Id = session.segments[idx - 1].id;
    const segments = session.segments;
    const translations = session.translations || [];

    guardJoin(seg1Id, segmentId, segments, translations, () => {
      const fresh = useSessionStore.getState().session;
      const result = segmentWorkflowService.joinSegments(seg1Id, segmentId, {
        translations: fresh?.translations || [],
        segments: fresh?.segments || [],
      });
      if (result.ok && result.patch) {
        useSessionStore.getState().updateSession(result.patch);
      }
      notify(result.notice);
    });
  }, [session?.segments, session?.translations, notify, guardJoin]);

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
        markSegmentEdited(newSelection.segmentId, newSelection.localLang);
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
    const { pos, segmentId } = splitAnchor;
    const segments = session?.segments || [];
    const translations = session?.translations || [];

    setSplitAnchor(null);

    guardSplit(segmentId, segments, translations, () => {
      const fresh = useSessionStore.getState().session;
      const freshDraft = useSessionStore.getState().draftText;
      const result = segmentWorkflowService.splitSegment(pos, {
        text: freshDraft,
        translations: fresh?.translations || [],
        segments: fresh?.segments || [],
      }, segmentId);
      if (result.ok && result.patch) {
        useSessionStore.getState().updateSession(result.patch);
      }
      notify(result.notice);
    });
  }, [splitAnchor, session?.translations, session?.segments, notify, guardSplit]);

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
    const segments = session?.segments || [];
    const translations = session?.translations || [];

    setDraggingFromIndex(null);

    guardShift(sourceSegmentId, globalTargetPos, segments, translations, async () => {
      const fresh = useSessionStore.getState().session;
      const freshDraft = useSessionStore.getState().draftText;
      const result = await segmentWorkflowService.shiftSegmentBoundary(sourceSegmentId, globalTargetPos, {
        text: freshDraft,
        translations: fresh?.translations || [],
        segments: fresh?.segments || [],
      });
      if (result.ok && result.patch) {
        useSessionStore.getState().updateSession(result.patch);
        if (result.patch.text) {
          useSessionStore.getState().setDraftText(result.patch.text);
        }
      }
      notify(result.notice);
    });
  }, [session?.segments, session?.translations, notify, guardShift]);

  // Global operations

  const handleRunGlobalNer = useCallback(async () => {
    setIsProcessing(true); setActiveSegmentId(undefined);
    try {
      // Run NER on the original layer first
      const originalLayer = resolveLayer("original");
      if (originalLayer) {
        const result = await annotationWorkflowService.runNer({ layer: originalLayer, segments: session?.segments || [], deletedApiKeys: session?.deletedApiKeys ?? [] }, requestConflictResolution);
        if (result.ok) {
          applyLayerPatch("original", result.layerPatch);
          sessionStore.updateSession({ deletedApiKeys: result.deletedApiKeys });
        }
        notify(result.notice);
      }

      //iterate over each translation layer
      const translations = useSessionStore.getState().session?.translations || [];
      for (const t of translations) {
        const freshSession = useSessionStore.getState().session;
        const tLayer = freshSession?.translations?.find(tr => tr.language === t.language);
        if (!tLayer?.text?.trim()) continue;

        const layer: AnnotationLayer = {
          text: tLayer.text || "",
          userSpans: tLayer.userSpans ?? [],
          apiSpans: tLayer.apiSpans ?? [],
          segmentTranslations: tLayer.segmentTranslations,
          editedSegmentTranslations: tLayer.editedSegmentTranslations,
        };

        const result = await annotationWorkflowService.runNer({ layer, segments: freshSession?.segments || [], deletedApiKeys: freshSession?.deletedApiKeys ?? [] }, requestConflictResolution);
        if (result.ok) {
          applyLayerPatch(t.language, result.layerPatch);
          if (result.deletedApiKeys) sessionStore.updateSession({ deletedApiKeys: result.deletedApiKeys });
        }
      }

      if (translations.length > 0) {
        notify({ message: `NER completed for original + ${translations.length} translation(s).`, tone: "success" });
      }
    } finally { setIsProcessing(false); }
  }, [session, draftText, notify, requestConflictResolution]);

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
    setIsProcessing(true);
    try {
      const result = await segmentWorkflowService.runAutoSegmentation({ text: draftText, translations: session?.translations, segments: session?.segments }, activeTab);
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
          markSegmentEdited(activeSegmentId, actionLangContext);
        }
        notify(result.notice);
      }
      closeEditMenu();
      return;
    }
    cmReplaceFn?.(normalized);
    markSegmentEdited(activeSegmentId, actionLangContext);
    closeEditMenu();
  }, [activeSpan, cmReplaceFn, closeEditMenu, actionLangContext, session, draftText, activeSegmentId]);

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
          isAlreadySegmented={(session?.segments?.length ?? 0) > 1}
          languageOptions={languageOptions}
          isLanguageListLoading={isLanguageListLoading}
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
                  onUpdateTranslation: handleUpdateSegmentTranslation,
                  languageOptions: languageOptions,
                  isLanguageListLoading: isLanguageListLoading,
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
                  onInvalidDrop: () => notify({ message: "Cannot drop boundary here — target is above the source or showing a translation view.", tone: "warning" }),
                };

                const translationHandlers: SegmentTranslationHandlers = {
                  onAddTranslation: handleTranslateSegment,
                  onDeleteTranslation: handleDeleteSegmentTranslation,
                  onUpdateTranslation: handleUpdateSegmentTranslation,
                  languageOptions: languageOptions,
                  isLanguageListLoading: isLanguageListLoading,
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
                markSegmentEdited(activeSegmentId, actionLangContext);
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
                markSegmentEdited(activeSegmentId, actionLangContext);
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

      {guardDialogProps && (
        <ActionGuardDialog {...guardDialogProps} onClose={closeGuardDialog} />
      )}
    </div>
  );
};

export default EditorContainer;