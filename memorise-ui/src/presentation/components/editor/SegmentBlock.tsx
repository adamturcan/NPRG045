import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Box, IconButton, Tooltip, Menu, MenuItem, TextField, CircularProgress,
  Select, FormControl, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Collapse
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TranslateIcon from "@mui/icons-material/Translate";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import CallMergeIcon from "@mui/icons-material/CallMerge";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

import { CodeMirrorWrapper } from "./codemirror/CodeMirrorWrapper";
import { SegmentLogic } from "../../../core/domain/entities/SegmentLogic";
import type { NerSpan } from "../../../types/NotationEditor";
import { COLORS, getSpanId } from "./utils/editorUtils";
import { useSegmentDrag } from "./context/SegmentDragContext";

// Prop groups

export interface SegmentDisplayProps {
  isActive: boolean;
  isDragging: boolean;
  dropDisabled: boolean;
}

export interface SegmentHandlers {
  onActivate: () => void;
  onJoinUp: (segmentId: string) => void;
  onRunNer: (segmentId: string, lang: string) => void;
  onRunSemTag: (segmentId: string, lang: string) => void;
  onSpanClick: (span: NerSpan, el: HTMLElement, fn: any, lang: string, start: number) => void;
  onSelectionChange: (sel: any, segmentId: string, lang: string, start: number) => void;
  onTextChange: (segmentId: string, text: string, coords: any, deadIds?: string[], lang?: string) => void;
  onShiftBoundary?: (sourceSegmentId: string, globalTargetPos: number) => void;
  onInvalidDrop?: () => void;
}

export interface SegmentTranslationHandlers {
  onAddTranslation: (segmentId: string, lang: string) => void;
  onDeleteTranslation: (lang: string, segmentId: string) => void;
  languageOptions: any[];
  isLanguageListLoading: boolean;
}

export interface SegmentDragHandlers {
  prevSegmentId?: string;
}

// Component props

export interface SegmentBlockProps {
  segment: any;
  index: number;
  session: any;
  display: SegmentDisplayProps;
  handlers: SegmentHandlers;
  translationHandlers: SegmentTranslationHandlers;
  dragHandlers: SegmentDragHandlers;
}

// Component

export const SegmentBlock: React.FC<SegmentBlockProps> = ({
  segment, index, session,
  display: { isActive, isDragging, dropDisabled },
  handlers: { onActivate, onJoinUp, onRunNer, onRunSemTag, onSpanClick, onSelectionChange, onTextChange, onShiftBoundary, onInvalidDrop },
  translationHandlers: { onAddTranslation, onDeleteTranslation, languageOptions, isLanguageListLoading },
  dragHandlers: { prevSegmentId },
}) => {
  const [localLang, setLocalLang] = useState("original");
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [languageSearch, setLanguageSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isHeaderOpen, setIsHeaderOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const { notifyDragStart, notifyDragEnd, setHoveredIdx, registerNode } = useSegmentDrag();

  useEffect(() => {
    const el = boxRef.current;
    registerNode(index, el);
    return () => registerNode(index, null);
  }, [index, registerNode]);

  const availableLangs = useMemo(() => (session?.translations || []).filter((t: any) => t.segmentTranslations?.[segment.id] !== undefined).map((t: any) => t.language), [session?.translations, segment.id]);

  const isSegmentEdited = useMemo(() => {
    if (localLang === "original") return !!segment.isEdited;
    const tLayer = session?.translations?.find((t: any) => t.language === localLang);
    return !!tLayer?.editedSegmentTranslations?.[segment.id];
  }, [localLang, segment.isEdited, segment.id, session?.translations]);

  useEffect(() => { if (localLang !== "original" && !availableLangs.includes(localLang)) setLocalLang("original"); }, [localLang, availableLangs]);

  useEffect(() => {
    if (!isActive) {
      setIsHeaderOpen(false);
    }
  }, [isActive]);

  const virtualSegment = useMemo(() => {
    if (localLang === "original") return segment;
    const tLayer = session?.translations?.find((t: any) => t.language === localLang);
    return SegmentLogic.calculateVirtualBoundaries(session?.segments || [], tLayer?.segmentTranslations || {}).find((b: any) => b.id === segment.id) || segment;
  }, [localLang, segment, session]);

  const localSpans = useMemo(() => {
    if (!isActive) return [];

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
        id: getSpanId(s),
        start: Math.max(0, s.start - virtualSegment.start),
        end: Math.min(virtualSegment.end - virtualSegment.start, s.end - virtualSegment.start)
      }));
  }, [localLang, session, virtualSegment, isActive]);

  const filteredLanguageOptions = useMemo(() => {
    const query = languageSearch.trim().toLowerCase();
    if (!query) return languageOptions;
    return languageOptions.filter(({ code, label }: any) => code.toLowerCase().includes(query) || label.toLowerCase().includes(query));
  }, [languageOptions, languageSearch]);

  const handleDelete = () => { onDeleteTranslation(localLang, segment.id); setLocalLang("original"); setDeleteDialogOpen(false); };

  const handleCmChange = useCallback((newText: string, liveCoords: any, deadIds?: string[]) => {
    onTextChange(segment.id, newText, liveCoords, deadIds, localLang);
  }, [onTextChange, segment.id, localLang]);

  const handleCmSpanClick = useCallback((span: any, el: any, fn: any) => {
    onSpanClick(span, el, fn, localLang, virtualSegment.start);
  }, [onSpanClick, localLang, virtualSegment.start]);

  const handleCmSelectionChange = useCallback((sel: any) => {
    onSelectionChange(sel, segment.id, localLang, virtualSegment.start);
  }, [onSelectionChange, segment.id, localLang, virtualSegment.start]);

  const handleDropTextPosition = useCallback((localOffset: number, dataTransfer: DataTransfer) => {
    const sourceSegmentId = dataTransfer.getData("application/segment-id");
    if (sourceSegmentId && onShiftBoundary) {
      onShiftBoundary(sourceSegmentId, virtualSegment.start + localOffset);
    }
  }, [virtualSegment.start, onShiftBoundary]);

  return (
    <Box
      ref={boxRef}
      onClick={onActivate}
      onFocus={onActivate}
      onMouseEnter={() => setHoveredIdx(index)}
      onMouseLeave={() => setHoveredIdx(null)}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("application/segment-id") && !isActive && !dropDisabled) {
          onActivate();
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/segment-id")) {
          if (dropDisabled) {
            e.dataTransfer.dropEffect = "none";
          } else {
            e.preventDefault();
          }
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes("application/segment-id")) {
          e.preventDefault();
          e.stopPropagation();
          if (dropDisabled && onInvalidDrop) {
            onInvalidDrop();
          }
        }
      }}
      sx={{
        position: "relative",
        backgroundColor: dropDisabled
          ? "#fff5f5"
          : isActive ? "#ffffff" : "#f1f5f9",
        backgroundImage: dropDisabled
          ? `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 8px,
              ${alpha("#ef4444", 0.07)} 8px,
              ${alpha("#ef4444", 0.07)} 10px
            )`
          : "none",
        borderBottom: `2px dashed ${alpha(COLORS.dateBlue, 0.3)}`,
        display: "flex",
        flexDirection: "column",
        transition: isDragging ? "none" : "background-color 0.2s ease",
        cursor: isDragging && !dropDisabled ? "crosshair" : "auto",
        "& .boundary-btn-group": { opacity: 0 },
        "&[data-boundary-visible='1'] .boundary-btn-group": { opacity: 1 },
        "&[data-dragging='1'] .boundary-btn-group": { opacity: 0 },
        "&:last-child": { borderBottom: "none" }
      }}
    >

      {index > 0 && (
        <Box
          className="boundary-btn-group"
          onMouseEnter={() => setHoveredIdx(index - 1)}
          onMouseLeave={() => setHoveredIdx(null)}
          sx={{ position: "absolute", top: "-14px", left: "50%", transform: "translateX(-50%)", zIndex: 10 }}
        >
          <Tooltip title="Merge segments">
            <IconButton
              className="join-btn"
              onClick={(e) => { e.stopPropagation(); onJoinUp(segment.id); }}
              sx={{
                transition: "transform 0.2s ease",
                bgcolor: "#ffffff",
                border: `1px solid ${COLORS.dateBlue}`,
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                width: 28, height: 28,
                "&:hover": { bgcolor: "#f0f7ff", transform: "scale(1.1)" }
              }}
            >
              <CallMergeIcon sx={{ transform: "rotate(180deg)", fontSize: "1.1rem", color: COLORS.dateBlue }} />
            </IconButton>
          </Tooltip>
          {/* Drag Handle */}
          <Tooltip title="Drag to shift boundary">
            <IconButton
              className="drag-btn"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/segment-id", prevSegmentId || segment.id);
                e.dataTransfer.effectAllowed = "move";
                if (index > 0) notifyDragStart(index - 1);
              }}
              onDragEnd={() => notifyDragEnd()}
              sx={{
                cursor: "grab",
                transition: "transform 0.2s ease",
                bgcolor: "#ffffff",
                border: `1px solid ${COLORS.dateBlue}`,
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                width: 28, height: 28,
                ml: 1,
                "&:hover": { bgcolor: "#f0f7ff", transform: "scale(1.1)" },
                "&:active": { cursor: "grabbing" }
              }}
            >
              <DragIndicatorIcon sx={{ fontSize: "1.1rem", color: COLORS.dateBlue }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Box sx={{
        position: "relative",
        backgroundColor: isHeaderOpen ? "#f8fafc" : "transparent",
        borderBottom: isHeaderOpen ? "1px solid #e2e8f0" : "none",
        transition: "background-color 0.2s ease"
      }}>
        <Box sx={{ position: "absolute", top: isHeaderOpen ? "8px" : "4px", right: "8px", zIndex: 10, display: "flex", alignItems: "center", gap: 0.5 }}>
          {isSegmentEdited && !isHeaderOpen && (
            <Tooltip title="Segment manually edited">
              <Box sx={{
                display: "flex", alignItems: "center", gap: 0.5,
                bgcolor: alpha("#f59e0b", 0.12), color: "#b45309",
                borderRadius: "12px", px: 1, py: 0.25,
                fontSize: "11px", fontWeight: 600, lineHeight: 1,
              }}>
                <EditOutlinedIcon sx={{ fontSize: "13px" }} />
                Edited
              </Box>
            </Tooltip>
          )}
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setIsHeaderOpen(!isHeaderOpen); }} sx={{ color: "#94a3b8", width: 28, height: 28 }}>
            {isHeaderOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>

        {!isHeaderOpen && <Box sx={{ height: "32px", width: "100%" }} />}

        <Collapse in={isHeaderOpen}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 48px 8px 16px" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <TranslateIcon sx={{ color: "#94a3b8", fontSize: "18px" }} />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <Select value={localLang} onChange={(e) => setLocalLang(e.target.value)} sx={{ backgroundColor: "transparent", fontWeight: 600, fontSize: "12px", height: "28px", "& fieldset": { border: "none" } }}>
                  <MenuItem value="original">Original Text</MenuItem>
                  {availableLangs.map((lang: string) => <MenuItem key={lang} value={lang}>Translation: {lang.toUpperCase()}</MenuItem>)}
                </Select>
              </FormControl>
              <Tooltip title="Translate segment"><IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }} sx={{ bgcolor: COLORS.gold, color: COLORS.darkBlue, width: "28px", height: "28px", borderRadius: "6px" }}><AddIcon fontSize="small" /></IconButton></Tooltip>
              {localLang !== "original" && <Tooltip title="Clear Translation"><IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteDialogOpen(true); }} sx={{ bgcolor: alpha("#d32f2f", 0.1), color: "#d32f2f", width: "28px", height: "28px", borderRadius: "6px" }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {isSegmentEdited && (
                <Tooltip title="Segment manually edited">
                  <Box sx={{
                    display: "flex", alignItems: "center", gap: 0.5,
                    bgcolor: alpha("#f59e0b", 0.12), color: "#b45309",
                    border: `1px solid ${alpha("#f59e0b", 0.3)}`,
                    borderRadius: "12px", px: 1, py: 0.25,
                    fontSize: "11px", fontWeight: 600, lineHeight: 1,
                    mr: 0.5,
                  }}>
                    <EditOutlinedIcon sx={{ fontSize: "13px" }} />
                    Edited
                  </Box>
                </Tooltip>
              )}
              <Tooltip title="Run NER on segment"><IconButton size="small" onClick={(e) => { e.stopPropagation(); onRunNer(segment.id, localLang); }} sx={{ bgcolor: alpha(COLORS.magenta, 0.1), color: COLORS.magenta, borderRadius: "6px", width: "28px", height: "28px" }}><ManageSearchIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Run Sem-Tag on segment"><IconButton size="small" onClick={(e) => { e.stopPropagation(); onRunSemTag(segment.id, localLang); }} sx={{ bgcolor: alpha(COLORS.magenta, 0.1), color: COLORS.magenta, borderRadius: "6px", width: "28px", height: "28px" }}><LabelOutlinedIcon fontSize="small" /></IconButton></Tooltip>
            </Box>
          </Box>
        </Collapse>
      </Box>

      <Box sx={{
        padding: "0pxg 20px 20px 20px",
        "& .cm-editor": { outline: "none", backgroundColor: "transparent !important" },
        "& .cm-scroller": { backgroundColor: "transparent !important" },
        "& .cm-activeLine": { backgroundColor: "transparent !important" },
        "& .cm-gutters": { backgroundColor: "transparent !important", border: "none" },
        "& .cm-placeholder": { color: "#94a3b8", fontStyle: "italic" },
        ...(isDragging && !dropDisabled ? {
          "& .cm-editor, & .cm-scroller, & .cm-content": { cursor: "crosshair !important" },
          "& .cm-dropCursor": {
            borderLeft: `3px solid ${COLORS.dateBlue} !important`,
            marginLeft: "-1px !important"
          }
        } : {})
      }}>
        <CodeMirrorWrapper
          value={virtualSegment.text}
          spans={localSpans}
          onChange={handleCmChange}
          onSpanClick={handleCmSpanClick}
          onSelectionChange={handleCmSelectionChange}
          placeholder={segment.id === "root" ? "Insert your document text here..." : undefined}
          onDropTextPosition={handleDropTextPosition}
        />
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={(e: any) => { e.stopPropagation(); setAnchorEl(null); }} PaperProps={{ sx: { maxHeight: 280, minWidth: 260 } }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eee' }}><TextField fullWidth size="small" placeholder="Search language..." value={languageSearch} autoFocus onChange={(e) => setLanguageSearch(e.target.value)} variant="standard" InputProps={{ disableUnderline: true }} /></Box>
        <Box sx={{ px: 1, pb: 1, maxHeight: 220, overflowY: "auto" }}>
          {isLanguageListLoading ? <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} /> Loading…</MenuItem> : filteredLanguageOptions.length > 0 ? filteredLanguageOptions.map(({ code, label }: any) => <MenuItem key={code} onClick={(e) => { e.stopPropagation(); onAddTranslation(segment.id, code); setLocalLang(code); setAnchorEl(null); }}><Box sx={{ display: "flex", flexDirection: "column" }}><span style={{ textTransform: "uppercase", fontWeight: 600 }}>{code}</span><span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{label}</span></Box></MenuItem>) : <MenuItem disabled>No matches</MenuItem>}
        </Box>
      </Menu>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Clear Segment Translation</DialogTitle>
        <DialogContent><DialogContentText>Are you sure you want to delete the {localLang.toUpperCase()} translation for this specific segment?</DialogContentText></DialogContent>
        <DialogActions><Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button><Button onClick={handleDelete} color="error" variant="contained">Clear</Button></DialogActions>
      </Dialog>
    </Box>
  );
};