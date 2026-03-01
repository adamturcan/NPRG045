import React, { useMemo, useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useSessionStore } from "../../stores/sessionStore";
import { CodeMirrorWrapper } from "../editor/CodeMirrorWrapper";
import CategoryMenu from "../editor/CategoryMenu";
import type { NerSpan } from "../../../types/NotationEditor";
import DeletionConfirmationDialog from "../editor/dialogs/DeletionConfirmationDialog";
import MultiDeletionDialog from "../editor/dialogs/MultiDeletionDialog";
import { SegmentService } from "../../../core/services/SegmentService";
import type { Segment } from "../../../types/Segment";
import SegmentJoinDialog from "../editor/dialogs/SegmentJoinDialog";

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
  const { id: routeId } = useParams();
  const sessionStore = useSessionStore();
  const {
    session,
    draftText,    
    activeSegmentId,
    viewMode,
    activeTab, 
  } = sessionStore;

  const activeContent = useMemo(() => {
    if (!session) return null;
    if (activeTab === "original") return session;
    return session.translations?.find((t) => t.language === activeTab) || null;
  }, [session, activeTab]);

  const updateActiveLayer = useCallback((updates: any) => {
    const store = useSessionStore.getState();
    const currentSession = store.session;
    if (!currentSession) return;

    if (store.activeTab === "original") {
      store.updateSession({ ...currentSession, ...updates });
    } else {
      const updatedTranslations = (currentSession.translations || []).map((t) =>
        t.language === store.activeTab ? { ...t, ...updates } : t
      );
      store.updateTranslations(updatedTranslations);
    }
  }, []);

  
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
    const segmentTranslations = currentTranslation?.segmentTranslations || {};
    
    let currentOffset = 0;
    return masterSegments.map(seg => {
       const translatedText = segmentTranslations[seg.id] || "";
       const start = currentOffset;
       const end = start + translatedText.length;
       currentOffset = end; 
       return { ...seg, start, end, text: translatedText };
    });
  }, [viewMode, session?.segments, session?.translations, activeTab]);

  const displayText = useMemo(() => {
    if (viewMode === "segments") return activeSegment?.text || "";
    return draftText || "";
  }, [viewMode, activeSegment, draftText]);

  const [pendingJoinIds, setPendingJoinIds] = useState<[string, string] | null>(null);

  const handleSegmentJoinRequest = useCallback((id1: string, id2: string) => {
    if (activeTab !== "original") return; 
    setPendingJoinIds([id1, id2]);
  }, [activeTab]);

  const confirmJoinSegments = () => {
    if (!pendingJoinIds || !session?.segments) return;
    const [id1, id2] = pendingJoinIds;
    const updated = SegmentService.joinSegments(session.segments, id1, id2);
    if (updated) updateActiveLayer({ segments: updated }); 
    setPendingJoinIds(null);
  };

  const [activeSpan, setActiveSpan] = useState<NerSpan | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [cmReplaceFn, setCmReplaceFn] = useState<((text: string) => void) | null>(null);
  const [newSelection, setNewSelection] = useState<{ start: number; end: number; top: number; left: number } | null>(null);

  const displaySpans = useMemo(() => {
    const rawApi = activeContent?.apiSpans || [];
    const rawUser = activeContent?.userSpans || [];
    const allSpans = [...rawApi, ...rawUser].map((span) => ({ ...span, id: getSpanId(span) }));

    if (viewMode === "document") {
      if (activeSegmentId) return [];
      return allSpans;
    }

    if (!activeSegment) return [];
    
    const segStart = activeTab === "original" 
      ? activeSegment.start 
      : (displaySegments.find(s => s.id === activeSegmentId)?.start || 0);
      
    const segEnd = activeTab === "original"
      ? activeSegment.end
      : (displaySegments.find(s => s.id === activeSegmentId)?.end || 0);

    return allSpans
      .filter((s) => s.start >= segStart && s.end <= segEnd)
      .map((s) => ({ ...s, start: s.start - segStart, end: s.end - segStart }));
  }, [activeContent?.apiSpans, activeContent?.userSpans, viewMode, activeSegmentId, activeSegment, activeTab, displaySegments]);

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

  const [pendingDeletionId, setPendingDeletionId] = useState<string | null>(null);
  const [pendingProtectionIds, setPendingProtectionIds] = useState<string[]>([]);

  const handleDeleteSpan = () => {
    if (!activeSpan) return;
    setPendingDeletionId(getSpanId(activeSpan)); closeEditMenu();
  };

  const pendingDeletionSpan = useMemo(() => pendingDeletionId ? displaySpans.find((s) => getSpanId(s) === pendingDeletionId) ?? null : null, [pendingDeletionId, displaySpans]);
  const pendingDeletionText = useMemo(() => pendingDeletionSpan ? safeSubstring(displayText, pendingDeletionSpan.start, pendingDeletionSpan.end) : undefined, [pendingDeletionSpan, displayText]);

  const confirmDeleteSpan = () => {
    if (!pendingDeletionId || !activeContent) return;
    const filterOut = (spans: NerSpan[]) => spans.filter((s) => getSpanId(s) !== pendingDeletionId);
    updateActiveLayer({ userSpans: filterOut(activeContent.userSpans ?? []), apiSpans: filterOut(activeContent.apiSpans ?? []) });
    setPendingDeletionId(null);
  };

  const cancelDeleteSpan = () => setPendingDeletionId(null);

  const handleChangeCategory = (newCategory: string) => {
    if (!activeSpan || !activeContent) return;
    const activeId = getSpanId(activeSpan);
    const updateSpans = (spans: NerSpan[]) => spans.map((s) => (getSpanId(s) === activeId ? { ...s, entity: newCategory, id: activeId } : s));
    updateActiveLayer({ userSpans: updateSpans(activeContent.userSpans ?? []), apiSpans: updateSpans(activeContent.apiSpans ?? []) });
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

  const handleCreateSpan = (category: string) => {
    if (!newSelection || !activeContent) return;
    const shiftOffset = viewMode === "segments" && activeSegment 
      ? (activeTab === "original" ? activeSegment.start : (displaySegments.find(s => s.id === activeSegmentId)?.start || 0))
      : 0;

    const newSpan: NerSpan = { id: uuidv4(), start: newSelection.start + shiftOffset, end: newSelection.end + shiftOffset, entity: category, origin: "user" };
    updateActiveLayer({ userSpans: [...(activeContent.userSpans ?? []), newSpan] });
    setNewSelection(null);
  };

  const virtualElement = newSelection
    ? ({ getBoundingClientRect: () => ({ top: newSelection.top, left: newSelection.left, bottom: newSelection.top, right: newSelection.left, width: 0, height: 0 }), nodeType: 1 } as unknown as HTMLElement)
    : null;

    const handleTextChange = useCallback(
      (text: string, liveCoords?: Map<string, { start: number; end: number }>, liveSegments?: Segment[], contextMode?: string, contextSegId?: string) => {
        if (contextMode && contextMode !== viewMode) return;
        if (viewMode === "segments" && contextSegId !== undefined && contextSegId !== activeSegmentId) return;
    
        const store = useSessionStore.getState();
        const currentSession = store.session;
        if (!currentSession) return;
        
        const currentDataLayer = store.activeTab === "original" ? currentSession : currentSession.translations?.find(t => t.language === store.activeTab);
        if (!currentDataLayer) return;
    
        const currentFullText = store.draftText || currentDataLayer.text || "";
        let nextUserSpans = currentDataLayer.userSpans ?? [];
        let nextApiSpans = currentDataLayer.apiSpans ?? [];
        const shiftedInStepA = new Set<string>();
    
        if (liveCoords) {
          let shiftOffset = 0;
          if (viewMode === "segments" && activeSegmentId) {
             if (store.activeTab === "original") {
                 shiftOffset = currentSession.segments?.find(s => s.id === activeSegmentId)?.start || 0;
             } else {
                 const currentTranslation = currentDataLayer as import("../../../types/Workspace").Translation;
                 for (const s of (currentSession.segments || [])) {
                    if (s.id === activeSegmentId) break;
                    shiftOffset += (currentTranslation.segmentTranslations?.[s.id] || "").length;
                 }
             }
          }
          
          const syncSpans = (spans: NerSpan[]) => spans.map((s) => {
            const id = getSpanId(s);
            const coords = liveCoords.get(id);
            if (coords) {
              shiftedInStepA.add(id); 
              const globalStart = coords.start + shiftOffset;
              const globalEnd = coords.end + shiftOffset;
              if (s.start !== globalStart || s.end !== globalEnd) return { ...s, start: globalStart, end: globalEnd, id };
            }
            return { ...s, id };
          });
          nextUserSpans = syncSpans(nextUserSpans); nextApiSpans = syncSpans(nextApiSpans);
        }
    
        if (viewMode === "document") {
          store.setDraftText(text);
          
          if (store.activeTab === "original") {
             const nextSegments = (liveSegments && liveSegments !== currentSession.segments) 
               ? liveSegments.map(seg => ({ ...seg, text: text.substring(seg.start, seg.end) }))
               : currentSession.segments;
               
             updateActiveLayer({ text, segments: nextSegments, userSpans: nextUserSpans, apiSpans: nextApiSpans });
          } else {
             updateActiveLayer({ text, userSpans: nextUserSpans, apiSpans: nextApiSpans });
          }
    
        } else if (viewMode === "segments" && activeSegmentId) {
          
          if (store.activeTab === "original") {
            const masterActiveSegment = currentSession.segments?.find(s => s.id === activeSegmentId);
            if (!masterActiveSegment) return;
            
            const lengthDiff = text.length - (masterActiveSegment.end - masterActiveSegment.start);
            const updatedFull = currentFullText.substring(0, masterActiveSegment.start) + text + currentFullText.substring(masterActiveSegment.end);
      
            let updatedSegments = SegmentService.updateSegmentAndShift(
              currentSession.segments || [], masterActiveSegment.id, masterActiveSegment.start + text.length, lengthDiff, masterActiveSegment.end
            );
      
            updatedSegments = updatedSegments.map(seg => seg.id === masterActiveSegment.id ? { ...seg, text } : { ...seg, text: updatedFull.substring(seg.start, seg.end) });
      
            if (lengthDiff !== 0) {
              const shiftGlobalSpans = (spans: NerSpan[]) => spans.map(s => {
                if (shiftedInStepA.has(getSpanId(s))) return s;
                let newStart = s.start; let newEnd = s.end;
                if (s.start >= masterActiveSegment.end) newStart += lengthDiff;
                if (s.end >= masterActiveSegment.end) newEnd += lengthDiff;
                if (newStart !== s.start || newEnd !== s.end) return { ...s, start: newStart, end: newEnd };
                return s;
              });
              nextUserSpans = shiftGlobalSpans(nextUserSpans); nextApiSpans = shiftGlobalSpans(nextApiSpans);
            }
      
            store.setDraftText(updatedFull); 
            updateActiveLayer({ text: updatedFull, segments: updatedSegments, userSpans: nextUserSpans, apiSpans: nextApiSpans });
            
          } else {
            const currentTranslation = currentDataLayer as import("../../../types/Workspace").Translation; 
            
            const oldSegText = currentTranslation.segmentTranslations?.[activeSegmentId] || "";
            const lengthDiff = text.length - oldSegText.length;
            
            const updatedSegmentTranslations = {
              ...(currentTranslation.segmentTranslations || {}),
              [activeSegmentId]: text
            };
            
            const updatedFull = (currentSession.segments || []).map(s => updatedSegmentTranslations[s.id] || "").join("");
            
            let virtualStart = 0;
            for (const s of (currentSession.segments || [])) {
               if (s.id === activeSegmentId) break;
               virtualStart += (currentTranslation.segmentTranslations?.[s.id] || "").length;
            }
            const virtualEnd = virtualStart + oldSegText.length;
  
            if (lengthDiff !== 0) {
              const shiftGlobalSpans = (spans: NerSpan[]) => spans.map(s => {
                if (shiftedInStepA.has(getSpanId(s))) return s;
                let newStart = s.start; let newEnd = s.end;
                if (s.start >= virtualEnd) newStart += lengthDiff;
                if (s.end >= virtualEnd) newEnd += lengthDiff;
                if (newStart !== s.start || newEnd !== s.end) return { ...s, start: newStart, end: newEnd };
                return s;
              });
              nextUserSpans = shiftGlobalSpans(nextUserSpans); nextApiSpans = shiftGlobalSpans(nextApiSpans);
            }
            
            store.setDraftText(updatedFull);
            updateActiveLayer({ text: updatedFull, segmentTranslations: updatedSegmentTranslations, userSpans: nextUserSpans, apiSpans: nextApiSpans });
          }
        }
      },
      [viewMode, activeSegmentId, updateActiveLayer]
    );

  const handleProtectSpans = useCallback((affected: NerSpan[]) => { setPendingProtectionIds(affected.map(getSpanId)); }, []);
  const cancelProtection = () => setPendingProtectionIds([]);

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
    if (pendingProtectionIds.length === 0 || !activeContent) return;
    const idsToDelete = new Set(pendingProtectionIds);
    const filter = (list: NerSpan[]) => list.filter((s) => !idsToDelete.has(getSpanId(s)));
    updateActiveLayer({ userSpans: filter(activeContent.userSpans ?? []), apiSpans: filter(activeContent.apiSpans ?? []) });
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