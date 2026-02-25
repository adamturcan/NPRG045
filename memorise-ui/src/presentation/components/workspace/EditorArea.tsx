import React from "react";
import LabelIcon from "@mui/icons-material/Label";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import SegmentIcon from "@mui/icons-material/ViewWeek";
import { Box, IconButton, Tooltip } from "@mui/material";
import type { NerSpan } from "../../../types/NotationEditor";
import type { Segment } from "../../../types/Segment";
import NotationEditorComposition from "../editor/NotationEditorComposition";

// --- Props Interface ---
interface Props {
  editorInstanceKey?: string;
  text: string;
  setText: (v: string) => void;
  spans?: NerSpan[];
  segments?: Segment[];
  activeSegmentId?: string;
  selectedSegmentId?: string | null;
  viewMode?: "document" | "segments";
  activeTab?: string;
  highlightedCategories?: string[];
  deletableKeys?: Set<string>;
  placeholder?: string;
  
  // Actions
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClassify: () => void;
  onNer: () => void;
  onSegment?: () => void;
  onDeleteSpan?: (span: NerSpan) => void;
  onAddSpan?: (span: NerSpan) => void;
  onSave?: () => void;
  onSelectionChange?: (sel: { start: number; end: number } | null) => void;
  onSpansAdjusted?: (next: NerSpan[]) => void;
  onSegmentsAdjusted?: (next: Segment[]) => void;
}

 const EditorArea: React.FC<Props> = (props) => {
  const {
    viewMode = "document",
    activeTab = "original",
    onSegment,
    activeSegmentId,
    selectedSegmentId,
    ...editorProps
  } = props;

  // helpers for styling
  const isSegmentDisabled = viewMode === "segments" || (activeTab !== "original" && viewMode === "document");

  const getSegmentButtonStyle = () => ({
    backgroundColor: isSegmentDisabled ? "rgba(139, 195, 74, 0.08)" : "rgba(139, 195, 74, 0.18)",
    "&:hover": { 
      backgroundColor: isSegmentDisabled ? "rgba(139, 195, 74, 0.08)" : "rgba(139, 195, 74, 0.28)" 
    },
    color: isSegmentDisabled ? "#94A3B8" : "#689F38",
    boxShadow: "0 2px 8px rgba(12,24,38,0.10)",
    cursor: isSegmentDisabled ? "not-allowed" : "pointer",
  });
  
  const getSegmentTooltip = () => {
    if (viewMode === "segments") return "Segmentation not available in segment view";
    if (activeTab !== "original" && viewMode === "document") return "Segmentation not available in translation view";
    return "Run Segmentation";
  };

  return (
    <Box sx={{ flexGrow: 1, position: "relative", mt: 2, height: "100%", mr: { xs: 0, sm: 3 } }}>
      {/* Notation editor */}
      <NotationEditorComposition
        key={props.editorInstanceKey}
        value={props.text}
        
        onChange={props.setText}
        activeTab={activeTab}
        activeSegmentId={viewMode === "document" ? activeSegmentId : undefined}
        selectedSegmentId={viewMode === "segments" ? (selectedSegmentId ?? undefined) : undefined}
        {...editorProps}
      />

      {/*  Toolbar */}
      <Box sx={{ position: "absolute", bottom: 12, right: 25, display: "flex", alignItems: "center", gap: 1.25 }}>
        {/* Semantic Tagging button */}
        <Tooltip title="Semantic Tagging">
          <IconButton onClick={props.onClassify} sx={TOOLBAR_STYLES.classify}>
            <LabelIcon sx={{ fontSize: 28 }} />
          </IconButton>
        </Tooltip>
        {/* NER button */}
        <Tooltip title="Named Entity Recognition (NER)">
          <IconButton onClick={props.onNer} sx={TOOLBAR_STYLES.ner}>
            <TextFieldsIcon sx={{ fontSize: 28 }} />
          </IconButton>
        </Tooltip>

        {/* Segmentation button */}
        {onSegment && (
          <Tooltip title={getSegmentTooltip()}>
            <span>
              <IconButton onClick={onSegment} disabled={isSegmentDisabled} sx={getSegmentButtonStyle()}>
                <SegmentIcon sx={{ fontSize: 28 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

// Styles
const TOOLBAR_STYLES = {
  classify: {
    backgroundColor: "rgba(221, 160, 175, 0.18)",
    "&:hover": { backgroundColor: "rgba(221, 160, 175, 0.28)" },
    color: "#C2185B",
    boxShadow: "0 2px 8px rgba(12,24,38,0.10)",
  },
  ner: {
    backgroundColor: "rgba(160, 184, 221, 0.18)",
    "&:hover": { backgroundColor: "rgba(160, 184, 221, 0.28)" },
    color: "#1976D2",
    boxShadow: "0 2px 8px rgba(12,24,38,0.10)",
  }
};

export default EditorArea;