import React, { useMemo, useCallback, useState } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { CodeMirrorWrapper } from "../editor/codemirror/CodeMirrorWrapper.tsx";
import CategoryMenu from "../editor/menus/CategoryMenu.tsx";
import type { NerSpan } from "../../../types/NotationEditor";
import DeletionConfirmationDialog from "../editor/dialogs/DeletionConfirmationDialog";
import { annotationWorkflowService } from "../../../application/services/AnnotationWorkflowService.ts";
import { segmentWorkflowService } from "../../../application/services/SegmentWorkflowService.ts";
import { editorWorkflowService } from "../../../application/services/EditorWorkflowService.ts";
import { taggingWorkflowService } from "../../../application/services/TaggingWorkflowSercice.ts";
import EditorSpeedDial from "../editor/menus/EditorSpeedDial.tsx";

const getSpanId = (s: NerSpan) => s.id ?? `span-${s.start}-${s.end}-${s.entity}`;

const safeSubstring = (text: string, start: number, end: number) => {
  const s = Number(start);
  const e = Number(end);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return undefined;
  if (s < 0 || e < 0 || s >= e) return undefined;
  if (s >= text.length) return undefined;
  const ee = Math.min(e, text.length);
  const out = text.substring(s, ee);
  return out.length > 0 ? out : undefined;
};

const normalizeReplacement = (s: string) => s.replace(/\r\n/g, "\n");

const EditorContainer: React.FC = () => {
  const sessionStore = useSessionStore();
  const {
    session,
    draftText,    
    activeTab, 
  } = sessionStore;

  const [activeSpan, setActiveSpan] = useState<NerSpan | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [cmReplaceFn, setCmReplaceFn] = useState<((text: string) => void) | null>(null);
  const [newSelection, setNewSelection] = useState<{ start: number; end: number; top: number; left: number } | null>(null);

  const [pendingDeletionId, setPendingDeletionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRunNer = async () => {
    setIsProcessing(true);
    try {
      await annotationWorkflowService.runNer(async () => "api");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunSegmentation = async () => {
    setIsProcessing(true);
    try {   
      await segmentWorkflowService.runAutoSegmentation();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      await editorWorkflowService.saveWorkspace();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunSemTag = async () => {
    setIsProcessing(true);
    try {
      await taggingWorkflowService.runClassify();
    } finally {
      setIsProcessing(false);
    }
  };

  const activeContent = useMemo(() => {
    if (!session) return null;
    if (activeTab === "original") return session;
    return session.translations?.find((t) => t.language === activeTab) || null;
  }, [session, activeTab]);

  const displayText = draftText || "";

  const displaySpans = useMemo(() => {
    const bannedKeys = new Set(session?.deletedApiKeys || []);
    const rawApi = (activeContent?.apiSpans || []).filter(
      s => !bannedKeys.has(`${s.start}:${s.end}:${s.entity}`)
    );
    const rawUser = activeContent?.userSpans || [];
    return [...rawApi, ...rawUser].map((span) => ({ ...span, id: getSpanId(span) }));
  }, [activeContent?.apiSpans, activeContent?.userSpans, session?.deletedApiKeys]);

  const activeSpanText = useMemo(() => {
    if (!activeSpan) return "";
    return safeSubstring(displayText, activeSpan.start, activeSpan.end) ?? "";
  }, [activeSpan, displayText]);

  const handleSpanClick = useCallback((span: NerSpan, element: HTMLElement, replaceFn: (newText: string) => void) => {
    setNewSelection(null);
    setActiveSpan({ ...span, id: getSpanId(span) });
    setMenuAnchor(element);
    setCmReplaceFn(() => replaceFn);
  }, []);

  const closeEditMenu = () => {
    setActiveSpan(null); setMenuAnchor(null); setCmReplaceFn(null);
  };

  const handleCreateSpan = (category: string) => {
    if (!newSelection) return;
    annotationWorkflowService.createSpan(category, newSelection.start, newSelection.end);
    setNewSelection(null);
  };

  const pendingDeletionSpan = useMemo(() => pendingDeletionId ? displaySpans.find((s) => getSpanId(s) === pendingDeletionId) ?? null : null, [pendingDeletionId, displaySpans]);
  const pendingDeletionText = useMemo(() => pendingDeletionSpan ? safeSubstring(displayText, pendingDeletionSpan.start, pendingDeletionSpan.end) : undefined, [pendingDeletionSpan, displayText]);

  const handleDeleteSpan = () => {
    if (!activeSpan) return;
    setPendingDeletionId(getSpanId(activeSpan)); closeEditMenu();
  };

  const confirmDeleteSpan = () => {
    if (!pendingDeletionId) return;
    annotationWorkflowService.deleteSpan(pendingDeletionId);
    setPendingDeletionId(null);
  };
  const cancelDeleteSpan = () => setPendingDeletionId(null);

  const handleChangeCategory = (newCategory: string) => {
    if (!activeSpan) return;    
    annotationWorkflowService.updateSpanCategory(activeSpan.id ?? "", newCategory);
    closeEditMenu();
  };

  const handleUpdateSpanText = (newText: string) => {
    if (!activeSpan) return;
    const normalized = normalizeReplacement(newText);
    if (normalized.trim().length === 0) { setPendingDeletionId(getSpanId(activeSpan)); closeEditMenu(); return; }
    cmReplaceFn?.(normalized); closeEditMenu();
  };

  const handleSelectionChange = useCallback((sel: { start: number; end: number; top: number; left: number } | null) => {
    if (sel) closeEditMenu(); setNewSelection(sel);
  }, []);

  const virtualElement = newSelection
    ? ({ getBoundingClientRect: () => ({ top: newSelection.top, left: newSelection.left, bottom: newSelection.top, right: newSelection.left, width: 0, height: 0 }), nodeType: 1 } as unknown as HTMLElement)
    : null;

    const handleTextChange = useCallback(
      (text: string, liveCoords?: Map<string, { start: number; end: number }>, deadSpanIds?: string[]) => {
        editorWorkflowService.handleTextChange(text, "", liveCoords, deadSpanIds);
      },
      [] 
    );

  return (
    <div style={{ padding: "20px", height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        
        <CodeMirrorWrapper
          key={`document-view-${activeTab}`} 
          value={displayText}
          spans={displaySpans}
          onChange={handleTextChange}
          onSpanClick={handleSpanClick}
          onSelectionChange={handleSelectionChange}
        />

        <EditorSpeedDial 
            onNer={handleRunNer}
            onSegment={handleRunSegmentation}
            onSemTag={handleRunSemTag}
            onSave={handleSave}
            isProcessing={isProcessing}
        />
      </div>

      <CategoryMenu anchorEl={menuAnchor} onClose={closeEditMenu} onCategorySelect={handleChangeCategory} showDelete={true} onDelete={handleDeleteSpan} spanText={activeSpanText} onTextUpdate={handleUpdateSpanText} onMouseDown={() => {}}/>
      <CategoryMenu anchorEl={virtualElement} open={Boolean(virtualElement)} onClose={() => setNewSelection(null)} onCategorySelect={handleCreateSpan} showDelete={false} />
      <DeletionConfirmationDialog open={pendingDeletionId !== null} span={pendingDeletionSpan} spanText={pendingDeletionText} onConfirm={confirmDeleteSpan} onCancel={cancelDeleteSpan} />
      
    </div>
  );
};

export default EditorContainer;