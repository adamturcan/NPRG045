// src/components/workspace/EditorArea.tsx
import LabelIcon from "@mui/icons-material/Label";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import { Box, IconButton, Tooltip } from "@mui/material";
import React from "react";
import {
  type NerSpan,
} from "../../types/NotationEditor";
import NotationEditor from "../editor/NotationEditor";

interface Props {
  editorInstanceKey?: string;

  text: string;
  setText: (v: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClassify: () => void;
  onNer: () => void;

  spans?: NerSpan[];

  highlightedCategories?: string[];
  onSelectionChange?: (sel: { start: number; end: number } | null) => void;
  deletableKeys?: Set<string>;

  onDeleteSpan?: (span: NerSpan) => void;
  onAddSpan?: (span: NerSpan) => void;
  onSave?: () => void;
}

const EditorArea: React.FC<Props> = ({
  editorInstanceKey,
  text,
  setText,
  onClassify,
  onNer,
  spans,
  highlightedCategories,
  onSelectionChange,
  deletableKeys,
  onDeleteSpan,
  onAddSpan,
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
        placeholder="Paste text here or upload file"
        spans={spans}
        highlightedCategories={highlightedCategories}
        onSelectionChange={onSelectionChange}
        deletableKeys={deletableKeys}
        onDeleteSpan={onDeleteSpan}
        onAddSpan={onAddSpan}
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
      </Box>
    </Box>
  );
};

export default EditorArea;
