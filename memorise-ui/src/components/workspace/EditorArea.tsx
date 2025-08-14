import React from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LabelIcon from "@mui/icons-material/Label";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import NotationEditor, {
  type NerSpan,
} from "../../components/editor/NotationEditor";

interface Props {
  text: string;
  setText: (v: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClassify: () => void;
  onNer: () => void;
  spans?: NerSpan[];
  setSpans?: (s: NerSpan[] | ((p: NerSpan[]) => NerSpan[])) => void;
  highlightedCategories?: string[]; // ← multi-select categories
}

const EditorArea: React.FC<Props> = ({
  text,
  setText,
  onUpload,
  onClassify,
  onNer,
  spans,
  setSpans,
  highlightedCategories,
}) => {
  return (
    <Box
      sx={{
        flexGrow: 1,
        position: "relative",
        mt: 2,
        height: "100%",
        mr: { xs: 0, sm: 3 }, // gap to the right panel
      }}
    >
      <NotationEditor
        value={text}
        onChange={setText}
        placeholder="Paste text here or upload file"
        spans={spans}
        highlightedCategories={highlightedCategories} // ← pass array
        onDeleteSpan={
          setSpans
            ? (span) =>
                setSpans((prev) =>
                  prev.filter(
                    (s) =>
                      !(
                        s.start === span.start &&
                        s.end === span.end &&
                        s.entity === span.entity
                      )
                  )
                )
            : undefined
        }
      />

      {/* Action icons */}
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
        <Tooltip title="Upload file">
          <IconButton
            component="label"
            sx={{
              backgroundColor: "rgba(237, 232, 212, 0.18)",
              "&:hover": { backgroundColor: "rgba(237, 232, 212, 0.28)" },
              color: "#E0CFA5",
              boxShadow: "0 2px 8px rgba(12,24,38,0.10)",
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 28 }} />
            <input type="file" hidden onChange={onUpload} />
          </IconButton>
        </Tooltip>

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
