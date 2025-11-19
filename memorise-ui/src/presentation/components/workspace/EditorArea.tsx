// src/components/workspace/EditorArea.tsx
import LabelIcon from "@mui/icons-material/Label";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import SegmentIcon from "@mui/icons-material/ViewWeek";
import { Box, IconButton, Tooltip } from "@mui/material";
import React from "react";
import {
  type NerSpan,
} from "../../../types/NotationEditor";
import type { Segment } from "../../../types/Segment";
import NotationEditor from "../editor/NotationEditor";

interface Props {
  editorInstanceKey?: string;

  text: string;
  setText: (v: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClassify: () => void;
  onNer: () => void;
  onSegment?: () => void;

  spans?: NerSpan[];
  segments?: Segment[];
  activeSegmentId?: string;
  selectedSegmentId?: string | null;
  viewMode?: "document" | "segments";
  activeTab?: string; // "original" or translation language code

  highlightedCategories?: string[];
  onSelectionChange?: (sel: { start: number; end: number } | null) => void;
  deletableKeys?: Set<string>;

  onDeleteSpan?: (span: NerSpan) => void;
  onAddSpan?: (span: NerSpan) => void;
  onSave?: () => void;
  placeholder?: string;
  onSpansAdjusted?: (next: NerSpan[]) => void;
  onSegmentsAdjusted?: (next: Segment[]) => void;
}

const EditorArea: React.FC<Props> = ({
  editorInstanceKey,
  text,
  setText,
  onClassify,
  onNer,
  onSegment,
  spans,
  segments,
  activeSegmentId,
  selectedSegmentId,
  viewMode = "document",
  activeTab = "original",
  highlightedCategories,
  onSelectionChange,
  deletableKeys,
  onDeleteSpan,
  onAddSpan,
  placeholder,
  onSpansAdjusted,
  onSegmentsAdjusted,
}) => {
  return (
    <Box
      sx={{
        flexGrow: 1,
        position: "relative",
        mt: 2,
        height: "100%",
        mr: { xs: 0, sm: 3 },
      }}
    >
      <NotationEditor
        key={editorInstanceKey}
        value={text}
        onChange={setText}
        placeholder={placeholder ?? "Paste text here or upload file"}
        spans={spans}
        segments={segments}
        activeSegmentId={viewMode === "document" ? activeSegmentId : undefined}
        selectedSegmentId={viewMode === "segments" ? selectedSegmentId : undefined}
        activeTab={activeTab ?? undefined}
        highlightedCategories={highlightedCategories}
        onSelectionChange={onSelectionChange}
        deletableKeys={deletableKeys}
        onDeleteSpan={onDeleteSpan}
        onAddSpan={onAddSpan}
        onSpansAdjusted={onSpansAdjusted}
        onSegmentsAdjusted={onSegmentsAdjusted}
      />

      {/* Action buttons */}
      <Box
        sx={{
          position: "absolute",
          bottom: 12,
          right: 25,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
        }}
      >
        <Tooltip title="Semantic Tagging">
          <IconButton
            onClick={onClassify}
            sx={{
              backgroundColor: "rgba(221, 160, 175, 0.18)",
              "&:hover": { backgroundColor: "rgba(221, 160, 175, 0.28)" },
              color: "#C2185B",
              boxShadow: "0 2px 8px rgba(12,24,38,0.10)",
            }}
          >
            <LabelIcon sx={{ fontSize: 28 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Named Entity Recognition (NER)">
          <IconButton
            onClick={onNer}
            sx={{
              backgroundColor: "rgba(160, 184, 221, 0.18)",
              "&:hover": { backgroundColor: "rgba(160, 184, 221, 0.28)" },
              color: "#1976D2",
              boxShadow: "0 2px 8px rgba(12,24,38,0.10)",
            }}
          >
            <TextFieldsIcon sx={{ fontSize: 28 }} />
          </IconButton>
        </Tooltip>

        {onSegment && (
          <Tooltip title={
            viewMode === "segments" 
              ? "Segmentation not available in segment view" 
              : (activeTab !== "original" && viewMode === "document")
              ? "Segmentation not available in translation view"
              : "Run Segmentation"
          }>
            <span>
              <IconButton
                onClick={onSegment}
                disabled={viewMode === "segments" || (activeTab !== "original" && viewMode === "document")}
                sx={{
                  backgroundColor: (viewMode === "segments" || (activeTab !== "original" && viewMode === "document"))
                    ? "rgba(139, 195, 74, 0.08)" 
                    : "rgba(139, 195, 74, 0.18)",
                  "&:hover": { 
                    backgroundColor: (viewMode === "segments" || (activeTab !== "original" && viewMode === "document"))
                      ? "rgba(139, 195, 74, 0.08)" 
                      : "rgba(139, 195, 74, 0.28)" 
                  },
                  color: (viewMode === "segments" || (activeTab !== "original" && viewMode === "document")) ? "#94A3B8" : "#689F38",
                  boxShadow: "0 2px 8px rgba(12,24,38,0.10)",
                  cursor: (viewMode === "segments" || (activeTab !== "original" && viewMode === "document")) ? "not-allowed" : "pointer",
                }}
              >
                <SegmentIcon sx={{ fontSize: 28 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

export default EditorArea;
