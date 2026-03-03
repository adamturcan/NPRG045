import React, { useMemo, useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { useSessionStore } from "../../stores/sessionStore";
import { CodeMirrorWrapper } from "../editor/CodeMirrorWrapper";
import CategoryMenu from "../editor/menus/CategoryMenu.tsx";
import type { NerSpan } from "../../../types/NotationEditor";
import DeletionConfirmationDialog from "../editor/dialogs/DeletionConfirmationDialog";
import MultiDeletionDialog from "../editor/dialogs/MultiDeletionDialog";
import { SegmentService } from "../../../core/services/SegmentService";
import type { Segment } from "../../../types/Segment";
import SegmentJoinDialog from "../editor/dialogs/SegmentJoinDialog";
import { annotationWorkflowService } from "../../../application/services/AnnotationWorkflowService.ts";
import { SegmentLogic } from "../../../core/domain/entities/SegmentLogic.ts";
import { segmentWorkflowService } from "../../../application/services/SegmentWorkflowService.ts";
import { SpanLogic } from "../../../core/domain/entities/SpanLogic.ts";
import { editorWorkflowService } from "../../../application/services/EditorWorkflowService.ts";

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
    activeSegmentId,
    viewMode,
    activeTab, 
  } = sessionStore;

  const [activeSpan, setActiveSpan] = useState<NerSpan | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [cmReplaceFn, setCmReplaceFn] = useState<((text: string) => void) | null>(null);
  const [newSelection, setNewSelection] = useState<{ start: number; end: number; top: number; left: number } | null>(null);


  const [pendingDeletionId, setPendingDeletionId] = useState<string | null>(null);
  const [pendingProtectionIds, setPendingProtectionIds] = useState<string[]>([]);

  const [pendingJoinIds, setPendingJoinIds] = useState<[string, string] | null>(null);


  const activeContent = useMemo(() => {
    if (!session) return null;
    if (activeTab === "original") return session;
    return session.translations?.find((t) => t.language === activeTab) || null;
  }, [session, activeTab]);
  
  const activeSegment = useMemo(() => {
    const masterSeg = session?.segments?.find((s) => s.id === activeSegmentId);
    if (!masterSeg) return null;
    
    if (activeTab === "original") return masterSeg;
    
    const translation = session?.translations?.find((t) => t.language === activeTab);
    const translatedText = translation?.segmentTranslations?.[masterSeg.id] ?? "";
    return { ...masterSeg, text: translatedText };
  }, [session, activeSegmentId, activeTab]);

  const displaySegments = useMemo(() => {
    if (viewMode === "segments") return [];
    const masterSegments = session?.segments || [];
    if (activeTab === "original") return masterSegments;

    const currentTranslation = session?.translations?.find(t => t.language === activeTab);

    return SegmentLogic.calculateVirtualBoundaries(
      masterSegments, 
      currentTranslation?.segmentTranslations || {}
    );
  }, [viewMode, session?.segments, session?.translations, activeTab]);

  const displayText = useMemo(() => {
    if (viewMode === "segments") return activeSegment?.text || "";
    return draftText || "";
  }, [viewMode, activeSegment, draftText]);


  const displaySpans = useMemo(() => {
    const bannedKeys = new Set(session?.deletedApiKeys || []);
    const rawApi = (activeContent?.apiSpans || []).filter(
      s => !bannedKeys.has(`${s.start}:${s.end}:${s.entity}`)
    );
    const rawUser = activeContent?.userSpans || [];
    const allSpans = [...rawApi, ...rawUser].map((span) => ({ ...span, id: getSpanId(span) }));

    return SpanLogic.projectSpansForView(
      allSpans,
      viewMode,
      activeTab,
      activeSegmentId,
      activeSegment,
      displaySegments
    );
    
  }, [activeContent?.apiSpans, activeContent?.userSpans, viewMode,activeSegmentId,activeSegment, activeTab, displaySegments, session?.deletedApiKeys]);

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
    
    annotationWorkflowService.createSpan(
      category, 
      newSelection.start, 
      newSelection.end
    );
    
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

  const handleSegmentJoinRequest = useCallback((id1: string, id2: string) => {
    if (activeTab !== "original") return; 
    setPendingJoinIds([id1, id2]);
  }, [activeTab]);

  const confirmJoinSegments = () => {
    if (!pendingJoinIds) return;    
    segmentWorkflowService.joinSegments(pendingJoinIds[0], pendingJoinIds[1]);    
    setPendingJoinIds(null);
  };

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

  const handleProtectSpans = useCallback((affected: NerSpan[]) => { setPendingProtectionIds(affected.map(getSpanId)); }, []);
  const cancelProtection = () => setPendingProtectionIds([]);

  const handleTextChange = useCallback(
    (
      text: string, 
      liveCoords?: Map<string, { start: number; end: number }>, 
      liveSegments?: Segment[], 
      contextMode?: string, 
      contextSegId?: string
    ) => {
      editorWorkflowService.handleTextChange(
        text, 
        liveCoords, 
        liveSegments, 
        contextMode, 
        contextSegId
      );
    },
    [] 
  );

  const pendingProtectionSpans = useMemo(() => {
    if (pendingProtectionIds.length === 0) return [];
    const set = new Set(pendingProtectionIds);
    return displaySpans.filter((s) => set.has(getSpanId(s)));
  }, [pendingProtectionIds, displaySpans]);

  const spanTextsForMultiDelete = useMemo(() => {
    const ids = new Set(pendingProtectionIds); const m = new Map<string, string>();
    for (const s of displaySpans) {
      if (!ids.has(getSpanId(s))) continue;
      const txt = safeSubstring(displayText, s.start, s.end);
      if (txt) m.set(`${s.start}:${s.end}:${s.entity}`, txt);
    }
    return m;
  }, [pendingProtectionIds, displaySpans, displayText]);

  const confirmProtectionDelete = () => {
    if (pendingProtectionIds.length === 0) return;    
    annotationWorkflowService.deleteMultipleSpans(pendingProtectionIds);    
    setPendingProtectionIds([]);
  };

  return (
    <div style={{ padding: "20px", height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <CodeMirrorWrapper
        key={viewMode === "segments" ? `segment-${activeSegmentId}-${activeTab}` : `document-view-${activeTab}`} 
        onProtectSpans={handleProtectSpans}
        editorContext={viewMode}
        value={displayText}
        spans={displaySpans}
        activeSegmentId={viewMode === "document" ? activeSegmentId : undefined} 
        segments={displaySegments} 
        onChange={handleTextChange}
        onSpanClick={handleSpanClick}
        onSelectionChange={handleSelectionChange}
        onSegmentJoinRequest={handleSegmentJoinRequest}
      />
      <CategoryMenu anchorEl={menuAnchor} onClose={closeEditMenu} onCategorySelect={handleChangeCategory} showDelete={true} onDelete={handleDeleteSpan} spanText={activeSpanText} onTextUpdate={handleUpdateSpanText}/>
      <CategoryMenu anchorEl={virtualElement} open={Boolean(virtualElement)} onClose={() => setNewSelection(null)} onCategorySelect={handleCreateSpan} showDelete={false} />
      <DeletionConfirmationDialog open={pendingDeletionId !== null} span={pendingDeletionSpan} spanText={pendingDeletionText} onConfirm={confirmDeleteSpan} onCancel={cancelDeleteSpan} />
      <MultiDeletionDialog open={pendingProtectionIds.length > 0} spans={pendingProtectionSpans} spanTexts={spanTextsForMultiDelete} onConfirm={confirmProtectionDelete} onCancel={cancelProtection} />
      <SegmentJoinDialog open={pendingJoinIds !== null} onConfirm={confirmJoinSegments} onCancel={() => setPendingJoinIds(null)} />
    </div>
  );
};

export default EditorContainer;
