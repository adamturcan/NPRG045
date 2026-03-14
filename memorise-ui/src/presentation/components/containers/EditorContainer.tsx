import React, { useCallback, useState } from "react";
import { Box, Menu, MenuItem, Typography } from "@mui/material";

import CallSplitIcon from "@mui/icons-material/CallSplit";

import { useSessionStore } from "../../stores/sessionStore";
import { useNotificationStore } from "../../stores/notificationStore";
import { presentError } from "../../../application/errors/errorPresenter";
import { errorHandlingService } from "../../../infrastructure/services/ErrorHandlingService";
import { useTranslationOperations } from "../../hooks/useTranslationOperations";

import { annotationWorkflowService } from "../../../application/services/AnnotationWorkflowService";
import { segmentWorkflowService } from "../../../application/services/SegmentWorkflowService";
import { editorWorkflowService } from "../../../application/services/EditorWorkflowService";
import { taggingWorkflowService } from "../../../application/services/TaggingWorkflowSercice";

import EditorGlobalMenu from "../editor/menus/EditorGlobalMenu.tsx";
import CategoryMenu from "../editor/menus/CategoryMenu.tsx";
import { SegmentBlock } from "../editor/SegmentBlock"; 
import type { NerSpan } from "../../../types/NotationEditor";

import { COLORS, SPLIT_DELIMITERS, getSpanId, safeSubstring, normalizeReplacement } from "../editor/utils/editorUtils"; 

const EditorContainer: React.FC = () => {
  const sessionStore = useSessionStore();
  const enqueueNotification = useNotificationStore((state) => state.enqueue);
  const { session, draftText, setDraftText, activeSegmentId, setActiveSegmentId } = sessionStore;

  const setTagPanelOpen = useSessionStore((state) => state.setTagPanelOpen);
  const isTagPanelOpen = useSessionStore((state) => state.isTagPanelOpen);

  const [activeSpan, setActiveSpan] = useState<NerSpan | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [cmReplaceFn, setCmReplaceFn] = useState<((text: string) => void) | null>(null);
  const [newSelection, setNewSelection] = useState<{ start: number; end: number; top: number; left: number, segmentId?: string, localLang?: string, virtualStart?: number } | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionLangContext, setActionLangContext] = useState("original");
  
  const [splitAnchor, setSplitAnchor] = useState<{ top: number; left: number, pos: number, segmentId: string } | null>(null);

  const showNotice = useCallback((msg: string, opts?: { tone?: "success" | "error" | "info" | "default" | "warning"; persistent?: boolean }) => { enqueueNotification({ message: msg, tone: opts?.tone, persistent: opts?.persistent }); }, [enqueueNotification]);
  const handleError = useCallback((err: unknown) => { const appError = errorHandlingService.isAppError(err) ? err : errorHandlingService.handleApiError(err); const notice = presentError(appError); showNotice(notice.message, { tone: notice.tone, persistent: notice.persistent }); }, [showNotice]);
  const translationOps = useTranslationOperations(session?.id ?? null, session, showNotice, handleError);

  const handleTranslateSegment = useCallback((segmentId: string, lang: string) => { showNotice(`Translating segment to ${lang}...`, { tone: "info" }); translationOps.handleAddTranslation(lang, setDraftText, segmentId); }, [translationOps, setDraftText, showNotice]);
  
  const handleDeleteSegmentTranslation = useCallback((lang: string, segmentId: string) => { 
    useSessionStore.setState({ activeTab: lang }); 
    const currentLayer = useSessionStore.getState().session?.translations?.find(t => t.language === lang); 
    if (currentLayer) { 
      const newSegs = { ...currentLayer.segmentTranslations }; 
      delete newSegs[segmentId]; 
      useSessionStore.getState().updateActiveLayer({ segmentTranslations: newSegs }); 
    }
    useSessionStore.setState({ activeTab: "original" }); 
  }, []);

  const handleJoinUp = useCallback((segmentId: string) => { 
    const idx = session?.segments?.findIndex(s => s.id === segmentId) ?? -1; 
    if (idx > 0 && session?.segments) { 
      segmentWorkflowService.joinSegments(session.segments[idx - 1].id, segmentId); 
      showNotice("Segments merged.", { tone: "success" }); 
    } 
  }, [session?.segments, showNotice]);

  const handleRunSegmentNer = useCallback((segmentId: string, lang: string) => { 
    showNotice(`Running NER on segment (${lang})...`, { tone: "info" }); 
    setActiveSegmentId(segmentId);
    annotationWorkflowService.runNer(async () => "api"); 
  }, [showNotice, setActiveSegmentId]);
      
    const handleRunSegmentSemTag = useCallback((segmentId: string, lang: string) => { 
      showNotice(`Running Sem-Tag on segment (${lang})...`, { tone: "info" }); 
      setActiveSegmentId(segmentId);      
      taggingWorkflowService.runClassify(); 
    }, [showNotice, setActiveSegmentId]);

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
    useSessionStore.setState({ activeTab: newSelection.localLang });
    setActiveSegmentId(newSelection.segmentId);
    
    annotationWorkflowService.createSpan(category, newSelection.start, newSelection.end); 
    setNewSelection(null); 
    useSessionStore.setState({ activeTab: "original" });
  }, [newSelection, setActiveSegmentId]);
  
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
    const success = segmentWorkflowService.splitSegment(splitAnchor.pos);
    if (success) {
      setSplitAnchor(null);
    }
  }, [splitAnchor]);

  const handleTextChange = useCallback((segmentId: string, text: string, liveCoords: any, deadIds?: string[], localLang?: string) => { 
    useSessionStore.setState({ activeTab: localLang || "original" });
    const targetSegmentId = segmentId === "root" ? "" : segmentId;
    editorWorkflowService.handleTextChange(text, targetSegmentId, liveCoords, deadIds); 
    useSessionStore.setState({ activeTab: "original" });
  }, []);


  const handleRunGlobalTranslate = useCallback((lang: string) => { 
    showNotice(`Translating document to ${lang}...`, { tone: "info" }); 
    translationOps.handleAddTranslation(lang, setDraftText); 
  }, [translationOps, setDraftText, showNotice]);

  const handleRunGlobalNer = async () => { setIsProcessing(true); setActiveSegmentId(undefined); try { await annotationWorkflowService.runNer(async () => "api"); showNotice("NER completed.", { tone: "success" }); } finally { setIsProcessing(false); } };
  const handleRunGlobalSemTag = async () => { 
    setIsProcessing(true); 
    setActiveSegmentId(undefined); 
    try {       
      await taggingWorkflowService.runClassify(true); 
      showNotice("Semantic tagging completed.", { tone: "success" }); 
    } finally { 
      setIsProcessing(false); 
    } 
  };


  const handleSave = async () => { setIsProcessing(true); try { await editorWorkflowService.saveWorkspace(); showNotice("Workspace saved successfully!", { tone: "success" }); } finally { setIsProcessing(false); } };
  const handleRunGlobalSegment = async () => { if (session?.segments && session.segments.length > 1) { showNotice("Auto-segmentation can only be run on an unsegmented document.", { tone: "warning" }); return; } setIsProcessing(true); try { await segmentWorkflowService.runAutoSegmentation(); showNotice("Document segmented successfully!", { tone: "success" }); } finally { setIsProcessing(false); } };
    
  const handleUpdateSpanText = useCallback((newText: string) => {
    if (!activeSpan) return;
    const normalized = normalizeReplacement(newText);
    if (normalized.trim().length === 0) { 
      useSessionStore.setState({ activeTab: actionLangContext });
      annotationWorkflowService.deleteSpan(getSpanId(activeSpan));
      useSessionStore.setState({ activeTab: "original" });
      closeEditMenu(); 
      return; 
    }
    cmReplaceFn?.(normalized); closeEditMenu();
  }, [activeSpan, cmReplaceFn, closeEditMenu, actionLangContext]);

  const virtualElement = newSelection ? ({ getBoundingClientRect: () => ({ top: newSelection.top, left: newSelection.left, bottom: newSelection.top, right: newSelection.left, width: 0, height: 0 }), nodeType: 1 } as unknown as HTMLElement) : null;

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box", overflow: "hidden", backgroundColor: "transparent" }}>
      
      {/* 1. FIXED TOP BUBBLE (Document Toolbar) */}
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

      {/* 2. MULTI-EDITOR CANVAS (Full Width) */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", width: "100%", px: { xs: 2, md: 4 }, py: 2 }}>
        <Box sx={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", overflow: "hidden", backgroundColor: "transparent" }}>
          {!session?.segments || session.segments.length === 0 ? (
             <SegmentBlock 
               segment={{ id: "root", start: 0, end: draftText.length, text: draftText }} 
               index={0} session={session} languageOptions={translationOps.languageOptions} 
               isLanguageListLoading={translationOps.isLanguageListLoading} 
               isActive={activeSegmentId === "root"}
               onActivate={() => setActiveSegmentId("root")}
               onAddTranslation={handleTranslateSegment} onDeleteTranslation={handleDeleteSegmentTranslation} 
               onRunNer={handleRunSegmentNer} onRunSemTag={handleRunSegmentSemTag} 
               onSpanClick={handleSpanClick} onSelectionChange={handleSelectionChange} 
               onTextChange={handleTextChange} onJoinUp={handleJoinUp}
             />
          ) : (
            session.segments.map((segment, idx) => (
               <SegmentBlock 
                 key={segment.id}
                 segment={segment} index={idx} session={session} 
                 languageOptions={translationOps.languageOptions} isLanguageListLoading={translationOps.isLanguageListLoading} 
                 isActive={activeSegmentId === segment.id}
                 onActivate={() => setActiveSegmentId(segment.id)}
                 onAddTranslation={handleTranslateSegment} onDeleteTranslation={handleDeleteSegmentTranslation} 
                 onJoinUp={handleJoinUp} onRunNer={handleRunSegmentNer} onRunSemTag={handleRunSegmentSemTag} 
                 onSpanClick={handleSpanClick} onSelectionChange={handleSelectionChange} 
                 onTextChange={handleTextChange} 
               />
            ))
          )}
        </Box>
        <Box sx={{ minHeight: "100px" }} />
      </Box>

      {/* MENUS */}
      <CategoryMenu 
        anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeEditMenu} 
        onCategorySelect={(c) => { 
          if (activeSpan?.id) {
            useSessionStore.setState({ activeTab: actionLangContext });
            annotationWorkflowService.updateSpanCategory(activeSpan.id, c);
            useSessionStore.setState({ activeTab: "original" });
          }
          closeEditMenu(); 
        }} 
        showDelete={true} 
        onDelete={() => { 
          if (activeSpan?.id) { 
           
            useSessionStore.setState({ activeTab: actionLangContext });
            annotationWorkflowService.deleteSpan(activeSpan.id);
            useSessionStore.setState({ activeTab: "original" });
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
    </div>
  );
};

export default EditorContainer;