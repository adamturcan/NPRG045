import React, { useMemo, useCallback, useState, useEffect } from "react";
import { 
  Box, IconButton, Tooltip, Menu, MenuItem, TextField, CircularProgress,
  Select, FormControl, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Typography 
} from "@mui/material";
import { alpha } from "@mui/material/styles";

// Icons
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TranslateIcon from "@mui/icons-material/Translate";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import CallMergeIcon from "@mui/icons-material/CallMerge";
import CallSplitIcon from "@mui/icons-material/CallSplit";

import { useSessionStore } from "../../stores/sessionStore";
import { useNotificationStore } from "../../stores/notificationStore";
import { presentError } from "../../../application/errors/errorPresenter";
import { errorHandlingService } from "../../../infrastructure/services/ErrorHandlingService";
import { useTranslationOperations } from "../../hooks/useTranslationOperations";

import { CodeMirrorWrapper } from "../editor/codemirror/CodeMirrorWrapper.tsx";
import CategoryMenu from "../editor/menus/CategoryMenu.tsx";
import DeletionConfirmationDialog from "../editor/dialogs/DeletionConfirmationDialog";
import MultiDeletionDialog from "../editor/dialogs/MultiDeletionDialog";
import EditorSpeedDial from "../editor/menus/EditorSpeedDial.tsx";

import type { NerSpan } from "../../../types/NotationEditor";
import { SegmentLogic } from "../../../core/domain/entities/SegmentLogic.ts";
import { annotationWorkflowService } from "../../../application/services/AnnotationWorkflowService.ts";
import { segmentWorkflowService } from "../../../application/services/SegmentWorkflowService.ts";
import { editorWorkflowService } from "../../../application/services/EditorWorkflowService.ts";
import { taggingWorkflowService } from "../../../application/services/TaggingWorkflowSercice.ts";

const COLORS = { gold: "#DDD1A0", magenta: "#C2185B", dateBlue: "#1976D2", darkBlue: "#21426C", green: "#388E3C" };
const SPLIT_DELIMITERS = ["!", "?", ".", "-", ",", ":"];

const getSpanId = (s: NerSpan) => s.id ?? `span-${s.start}-${s.end}-${s.entity}`;
const safeSubstring = (text: string, start: number, end: number) => {
  const s = Number(start); const e = Number(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || s < 0 || e < 0 || s >= e || s >= text.length) return undefined;
  const out = text.substring(s, Math.min(e, text.length));
  return out.length > 0 ? out : undefined;
};

// ============================================================================
// 1. THE SEGMENT BLOCK COMPONENT 
// ============================================================================
const SegmentBlock = ({ 
  segment, index, session, languageOptions, isLanguageListLoading,
  onAddTranslation, onDeleteTranslation, onJoinUp, onRunNer, onRunSemTag,
  onSpanClick, onSelectionChange, onProtectSpans, onTextChange 
}: any) => {
  const [localLang, setLocalLang] = useState("original");
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [languageSearch, setLanguageSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const availableLangs = useMemo(() => (session?.translations || []).filter((t: any) => t.segmentTranslations?.[segment.id] !== undefined).map((t: any) => t.language), [session?.translations, segment.id]);

  useEffect(() => { if (localLang !== "original" && !availableLangs.includes(localLang)) setLocalLang("original"); }, [localLang, availableLangs]);

  const virtualSegment = useMemo(() => {
    if (localLang === "original") return segment;
    const tLayer = session?.translations?.find((t: any) => t.language === localLang);
    return SegmentLogic.calculateVirtualBoundaries(session?.segments || [], tLayer?.segmentTranslations || {}).find((b: any) => b.id === segment.id) || segment;
  }, [localLang, segment, session]);

  const localSpans = useMemo(() => {
    let rawSpans: NerSpan[] = [];
    const bannedKeys = new Set(session?.deletedApiKeys || []);
    if (localLang === "original") {
      const api = (session?.apiSpans || []).filter((s: NerSpan) => !bannedKeys.has(`${s.start}:${s.end}:${s.entity}`));
      rawSpans = [...api, ...(session?.userSpans || [])];
    } else {
      const tLayer = session?.translations?.find((t: any) => t.language === localLang);
      const api = (tLayer?.apiSpans || []).filter((s: NerSpan) => !bannedKeys.has(`${s.start}:${s.end}:${s.entity}`));
      rawSpans = [...api, ...(tLayer?.userSpans || [])];
    }
    return rawSpans
      .filter(s => Math.max(s.start, virtualSegment.start) < Math.min(s.end, virtualSegment.end))
      .map(s => ({ 
        ...s, 
        // 1. BAKE IN THE GLOBAL ID BEFORE CHANGING COORDINATES!
        id: s.id ?? `span-${s.start}-${s.end}-${s.entity}`, 
        
        // 2. Now it is safe to shift the coordinates to local view
        start: Math.max(0, s.start - virtualSegment.start), 
        end: Math.min(virtualSegment.end - virtualSegment.start, s.end - virtualSegment.start) 
      }));
  }, [localLang, session, virtualSegment]);

  const filteredLanguageOptions = useMemo(() => {
    const query = languageSearch.trim().toLowerCase();
    if (!query) return languageOptions;
    return languageOptions.filter(({ code, label }: any) => code.toLowerCase().includes(query) || label.toLowerCase().includes(query));
  }, [languageOptions, languageSearch]);

  const handleDelete = () => { onDeleteTranslation(localLang, segment.id); setLocalLang("original"); setDeleteDialogOpen(false); };

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f8fafc", padding: "10px 16px", borderBottom: "1px solid #e2e8f0" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <TranslateIcon sx={{ color: "#94a3b8", fontSize: "20px" }} />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select value={localLang} onChange={(e) => setLocalLang(e.target.value)} sx={{ backgroundColor: "transparent", fontWeight: 600, fontSize: "13px", height: "32px", "& fieldset": { border: "none" } }}>
              <MenuItem value="original">Original Text</MenuItem>
              {availableLangs.map((lang: string) => <MenuItem key={lang} value={lang}>Translation: {lang.toUpperCase()}</MenuItem>)}
            </Select>
          </FormControl>
          <Tooltip title="Translate this segment"><IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ bgcolor: COLORS.gold, color: COLORS.darkBlue, width: "32px", height: "32px", borderRadius: "8px", "&:hover": { bgcolor: "#EFE5C3" } }}><AddIcon fontSize="small" /></IconButton></Tooltip>
          {localLang !== "original" && <Tooltip title="Clear Translation"><IconButton size="small" onClick={() => setDeleteDialogOpen(true)} sx={{ bgcolor: alpha("#d32f2f", 0.1), color: "#d32f2f", width: "32px", height: "32px", borderRadius: "8px", "&:hover": { bgcolor: alpha("#d32f2f", 0.2) } }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title="Run NER on segment"><IconButton size="small" onClick={() => onRunNer(segment.id, localLang)} sx={{ bgcolor: alpha(COLORS.magenta, 0.1), color: COLORS.magenta, borderRadius: "8px", "&:hover": { bgcolor: alpha(COLORS.magenta, 0.2) } }}><ManageSearchIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Run Sem-Tag on segment"><IconButton size="small" onClick={() => onRunSemTag(segment.id, localLang)} sx={{ bgcolor: alpha(COLORS.magenta, 0.1), color: COLORS.magenta, borderRadius: "8px", "&:hover": { bgcolor: alpha(COLORS.magenta, 0.2) } }}><LabelOutlinedIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      </Box>
      
      <Box sx={{ padding: "20px", minHeight: "80px", "& .cm-editor": { outline: "none" } }}>
        <CodeMirrorWrapper 
          value={virtualSegment.text} 
          spans={localSpans} 
          onChange={(newText: string, liveCoords: any) => onTextChange(segment.id, newText, liveCoords, localLang)} 
          onSpanClick={(span, el, fn) => onSpanClick(span, el, fn, localLang, virtualSegment.start)} 
          onSelectionChange={(sel: any) => onSelectionChange(sel, segment.id, localLang, virtualSegment.start)} 
          onProtectSpans={(spans: any) => onProtectSpans(spans, localLang)} 
        />
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { maxHeight: 280, minWidth: 260 } }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eee' }}><TextField fullWidth size="small" placeholder="Search language..." value={languageSearch} autoFocus onChange={(e) => setLanguageSearch(e.target.value)} variant="standard" InputProps={{ disableUnderline: true }} /></Box>
        <Box sx={{ px: 1, pb: 1, maxHeight: 220, overflowY: "auto" }}>
            {isLanguageListLoading ? <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} /> Loading…</MenuItem> : filteredLanguageOptions.length > 0 ? filteredLanguageOptions.map(({ code, label }: any) => <MenuItem key={code} onClick={() => { onAddTranslation(segment.id, code); setLocalLang(code); setAnchorEl(null); }}><Box sx={{ display: "flex", flexDirection: "column" }}><span style={{ textTransform: "uppercase", fontWeight: 600 }}>{code}</span><span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{label}</span></Box></MenuItem>) : <MenuItem disabled>No matches</MenuItem>}
        </Box>
      </Menu>
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Clear Segment Translation</DialogTitle>
        <DialogContent><DialogContentText>Are you sure you want to delete the {localLang.toUpperCase()} translation for this specific segment?</DialogContentText></DialogContent>
        <DialogActions><Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button><Button onClick={handleDelete} color="error" variant="contained">Clear</Button></DialogActions>
      </Dialog>
    </div>
  );
};

// ============================================================================
// 2. THE MAIN EDITOR CONTAINER 
// ============================================================================
const EditorContainer: React.FC = () => {
  const sessionStore = useSessionStore();
  const enqueueNotification = useNotificationStore((state) => state.enqueue);
  const { session, draftText, viewMode, setDraftText } = sessionStore;

  const [activeSpan, setActiveSpan] = useState<NerSpan | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [newSelection, setNewSelection] = useState<{ start: number; end: number; top: number; left: number, segmentId?: string, localLang?: string, virtualStart?: number } | null>(null);
  const [pendingDeletionId, setPendingDeletionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionLangContext, setActionLangContext] = useState("original");
  const [pendingProtectionIds, setPendingProtectionIds] = useState<string[]>([]);
  
  // Split Logic State
  const [splitAnchor, setSplitAnchor] = useState<{ top: number; left: number, pos: number, segmentId: string } | null>(null);

  const [globalLangAnchor, setGlobalLangAnchor] = useState<HTMLElement | null>(null);
  const [globalLanguageSearch, setGlobalLanguageSearch] = useState("");

  const showNotice = useCallback((msg: string, opts?: { tone?: "success" | "error" | "info" | "default" | "warning"; persistent?: boolean }) => { enqueueNotification({ message: msg, tone: opts?.tone, persistent: opts?.persistent }); }, [enqueueNotification]);
  const handleError = useCallback((err: unknown) => { const appError = errorHandlingService.isAppError(err) ? err : errorHandlingService.handleApiError(err); const notice = presentError(appError); showNotice(notice.message, { tone: notice.tone, persistent: notice.persistent }); }, [showNotice]);
  const translationOps = useTranslationOperations(session?.id ?? null, session, showNotice, handleError);

  const filteredGlobalLanguageOptions = useMemo(() => {
    const query = globalLanguageSearch.trim().toLowerCase();
    if (!query) return translationOps.languageOptions;
    return translationOps.languageOptions.filter(({ code, label }: any) => code.toLowerCase().includes(query) || label.toLowerCase().includes(query));
  }, [translationOps.languageOptions, globalLanguageSearch]);

  const handleTranslateSegment = useCallback((segmentId: string, lang: string) => { showNotice(`Translating segment to ${lang}...`, { tone: "info" }); translationOps.handleAddTranslation(lang, setDraftText, segmentId); }, [translationOps, setDraftText, showNotice]);
  const handleDeleteSegmentTranslation = useCallback((lang: string, segmentId: string) => { useSessionStore.setState({ activeTab: lang }); const currentLayer = useSessionStore.getState().session?.translations?.find(t => t.language === lang); if (currentLayer) { const newSegs = { ...currentLayer.segmentTranslations }; delete newSegs[segmentId]; useSessionStore.getState().updateActiveLayer({ segmentTranslations: newSegs }); } }, []);
  const handleJoinUp = useCallback((segmentId: string) => { const idx = session?.segments?.findIndex(s => s.id === segmentId) ?? -1; if (idx > 0 && session?.segments) { segmentWorkflowService.joinSegments(session.segments[idx - 1].id, segmentId); showNotice("Segments merged. Translations updated.", { tone: "success" }); } }, [session?.segments, showNotice]);
  const handleRunSegmentNer = useCallback((segmentId: string, lang: string) => { showNotice(`Running NER on segment (${lang})...`, { tone: "info" }); annotationWorkflowService.runNer(async () => "api"); }, [showNotice]);
  const handleRunSegmentSemTag = useCallback((segmentId: string, lang: string) => { showNotice(`Running Sem-Tag on segment (${lang})...`, { tone: "info" }); taggingWorkflowService.runClassify(); }, [showNotice]);

  const handleSpanClick = useCallback((span: NerSpan, element: HTMLElement, _replaceFn: any, localLang: string, vStart: number) => { 
    setNewSelection(null); 
    const globalizedSpan = { ...span, start: span.start + vStart, end: span.end + vStart };
    const id = globalizedSpan.id ?? `span-${globalizedSpan.start}-${globalizedSpan.end}-${globalizedSpan.entity}`;
    setActiveSpan({ ...globalizedSpan, id }); 
    setActionLangContext(localLang); 
    setMenuAnchor(element); 
  }, []);

  const closeEditMenu = () => { setActiveSpan(null); setMenuAnchor(null); };

  const handleCreateSpan = (category: string) => { 
    if (!newSelection || !newSelection.localLang) return; 
    annotationWorkflowService.createSpan(category, (newSelection.virtualStart || 0) + newSelection.start, (newSelection.virtualStart || 0) + newSelection.end, newSelection.localLang); 
    setNewSelection(null); 
  };
  
  const handleSelectionChange = useCallback((sel: { start: number; end: number; top: number; left: number } | null, segmentId: string, localLang: string, virtualStart: number) => { 
    if (!sel) {
      setNewSelection(null);
      setSplitAnchor(null);
      return;
    }

    const segmentText = session?.segments?.find(s => s.id === segmentId)?.text || "";
    const selectedText = segmentText.substring(sel.start, sel.end).trim();
    const isDelimiter = selectedText.length === 1 && SPLIT_DELIMITERS.includes(selectedText);

    if (isDelimiter && localLang === "original") {
      // Sync the store so the splitSegment workflow knows which segment to target
      useSessionStore.getState().setActiveSegmentId(segmentId);
      
      closeEditMenu();
      setNewSelection(null);
      setSplitAnchor({ top: sel.top, left: sel.left, pos: virtualStart + sel.end, segmentId });
    } else {
      setSplitAnchor(null);
      closeEditMenu();
      setNewSelection({ ...sel, segmentId, localLang, virtualStart }); 
    }
  }, [session?.segments, closeEditMenu]);

  const handleConfirmSplit = useCallback(() => {
    if (!splitAnchor) return;
    const success = segmentWorkflowService.splitSegment(splitAnchor.pos);
    if (success) {
      setSplitAnchor(null);
    }
  }, [splitAnchor]);

  const handleTextChange = useCallback((segmentId: string, text: string, liveCoords: any, localLang: string) => { editorWorkflowService.handleTextChange(text, liveCoords, session?.segments, "segments", segmentId); }, [session?.segments]);

  const handleRunGlobalTranslate = useCallback((lang: string) => { showNotice(`Translating entire document to ${lang}...`, { tone: "info" }); translationOps.handleAddTranslation(lang, setDraftText); setGlobalLangAnchor(null); }, [translationOps, setDraftText, showNotice]);
  const handleRunGlobalNer = async () => { setIsProcessing(true); try { await annotationWorkflowService.runNer(async () => "api"); showNotice("NER completed for the entire document.", { tone: "success" }); } finally { setIsProcessing(false); } };
  const handleRunGlobalSemTag = async () => { setIsProcessing(true); try { await taggingWorkflowService.runClassify(); showNotice("Semantic tagging completed for the entire document.", { tone: "success" }); } finally { setIsProcessing(false); } };
  const handleSave = async () => { setIsProcessing(true); try { await editorWorkflowService.saveWorkspace(); showNotice("Workspace saved successfully!", { tone: "success" }); } finally { setIsProcessing(false); } };
  const handleRunGlobalSegment = async () => { if (session?.segments && session.segments.length > 1) { showNotice("Auto-segmentation can only be run on an unsegmented document.", { tone: "warning" }); return; } setIsProcessing(true); try { await segmentWorkflowService.runAutoSegmentation(); showNotice("Document segmented successfully!", { tone: "success" }); } finally { setIsProcessing(false); } };
  
  const virtualElement = newSelection ? ({ getBoundingClientRect: () => ({ top: newSelection.top, left: newSelection.left, bottom: newSelection.top, right: newSelection.left, width: 0, height: 0 }), nodeType: 1 } as unknown as HTMLElement) : null;

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box", overflow: "hidden", backgroundColor: "transparent" }}>
      {/* 1. FIXED TOP HEADER BAR */}
      <Box sx={{ display: "flex", alignItems: "center", px: 4, py: 2, borderBottom: "1px solid rgba(255, 255, 255, 0.2)", zIndex: 50 }}>
        <EditorSpeedDial onNer={handleRunGlobalNer} onSegment={handleRunGlobalSegment} onSemTag={handleRunGlobalSemTag} onSave={handleSave} onTranslateAll={(e) => setGlobalLangAnchor(e.currentTarget)} isProcessing={isProcessing} viewMode={viewMode} />
      </Box>

      {/* 2. SCROLLABLE EDITOR CANVAS */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", width: "100%", px: 4, py: 4 }}>
        {!session?.segments || session.segments.length === 0 ? (
           <SegmentBlock segment={{ id: "root", start: 0, end: draftText.length, text: draftText }} index={0} session={session} languageOptions={translationOps.languageOptions} isLanguageListLoading={translationOps.isLanguageListLoading} onAddTranslation={handleTranslateSegment} onDeleteTranslation={handleDeleteSegmentTranslation} onJoinUp={handleJoinUp} onRunNer={handleRunSegmentNer} onRunSemTag={handleRunSegmentSemTag} onSpanClick={handleSpanClick} onSelectionChange={handleSelectionChange} onProtectSpans={(spans: any, lang: string) => { setPendingProtectionIds(spans.map(getSpanId)); setActionLangContext(lang); }} onTextChange={handleTextChange} />
        ) : (
          session.segments.map((segment, idx) => (
             <React.Fragment key={segment.id}>
                {idx > 0 && (
                  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", my: 2.5, position: "relative", zIndex: 2 }}>
                    <Box sx={{ position: "absolute", width: "2px", height: "100%", bgcolor: "rgba(255, 255, 255, 0.4)", zIndex: 0 }} />
                    <Tooltip title="Merge with segment above">
                      <IconButton onClick={() => handleJoinUp(segment.id)} sx={{ bgcolor: "#ffffff", color: COLORS.dateBlue, border: `2px solid ${COLORS.dateBlue}`, boxShadow: "0 2px 4px rgba(0,0,0,0.1)", zIndex: 1, width: "48px", height: "48px", transition: "all 0.2s ease-in-out", "&:hover": { bgcolor: "#f0f7ff", transform: "scale(1.1)", boxShadow: "0 4px 10px rgba(25, 118, 210, 0.25)" }}}>
                        <CallMergeIcon sx={{ transform: "rotate(180deg)", fontSize: "2rem" }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
                <SegmentBlock segment={segment} index={idx} session={session} languageOptions={translationOps.languageOptions} isLanguageListLoading={translationOps.isLanguageListLoading} onAddTranslation={handleTranslateSegment} onDeleteTranslation={handleDeleteSegmentTranslation} onJoinUp={handleJoinUp} onRunNer={handleRunSegmentNer} onRunSemTag={handleRunSegmentSemTag} onSpanClick={handleSpanClick} onSelectionChange={handleSelectionChange} onProtectSpans={(spans: any, lang: string) => { setPendingProtectionIds(spans.map(getSpanId)); setActionLangContext(lang); }} onTextChange={handleTextChange} />
             </React.Fragment>
          ))
        )}
        <Box sx={{ minHeight: "80px" }} />
      </Box>

      {/* MENUS & DIALOGS */}
      <Menu anchorEl={globalLangAnchor} open={Boolean(globalLangAnchor)} onClose={() => setGlobalLangAnchor(null)} PaperProps={{ sx: { maxHeight: 280, minWidth: 260 } }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eee' }}><TextField fullWidth size="small" placeholder="Search language..." value={globalLanguageSearch} autoFocus onChange={(e) => setGlobalLanguageSearch(e.target.value)} variant="standard" InputProps={{ disableUnderline: true }} /></Box>
        <Box sx={{ px: 1, pb: 1, maxHeight: 220, overflowY: "auto" }}>
            {translationOps.isLanguageListLoading ? <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} /> Loading…</MenuItem> : filteredGlobalLanguageOptions.length > 0 ? filteredGlobalLanguageOptions.map(({ code, label }: any) => <MenuItem key={code} onClick={() => handleRunGlobalTranslate(code)}><Box sx={{ display: "flex", flexDirection: "column" }}><span style={{ textTransform: "uppercase", fontWeight: 600 }}>{code}</span><span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{label}</span></Box></MenuItem>) : <MenuItem disabled>No matches</MenuItem>}
        </Box>
      </Menu>

      <CategoryMenu 
        anchorEl={menuAnchor} 
        open={Boolean(menuAnchor)} 
        onClose={closeEditMenu} 
        onCategorySelect={(c) => { if (activeSpan?.id) annotationWorkflowService.updateSpanCategory(activeSpan.id, c, actionLangContext); closeEditMenu(); }} 
        showDelete={true} 
        onDelete={() => { if (activeSpan?.id) { setPendingDeletionId(activeSpan.id); setMenuAnchor(null); } }} 
        spanText={activeSpan ? safeSubstring(draftText, activeSpan.start, activeSpan.end) : ""} 
      />

      <CategoryMenu anchorEl={virtualElement} open={Boolean(virtualElement)} onClose={() => setNewSelection(null)} onCategorySelect={handleCreateSpan} showDelete={false} />
      
      <DeletionConfirmationDialog open={pendingDeletionId !== null} span={activeSpan} spanText={activeSpan ? safeSubstring(draftText, activeSpan.start, activeSpan.end) : ""} onConfirm={() => { if (pendingDeletionId) annotationWorkflowService.deleteSpan(pendingDeletionId, actionLangContext); setPendingDeletionId(null); setActiveSpan(null); }} onCancel={() => { setPendingDeletionId(null); setActiveSpan(null); }} />
      
      {/* SPLIT MENU (Using Anchor Position for 4K precision) */}
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

      <MultiDeletionDialog open={pendingProtectionIds.length > 0} spans={[]} spanTexts={new Map()} onConfirm={() => { annotationWorkflowService.deleteMultipleSpans(pendingProtectionIds, actionLangContext); setPendingProtectionIds([]); }} onCancel={() => setPendingProtectionIds([])} />
    </div>
  );
};

export default EditorContainer;