import React from "react";
import { Box, IconButton, Paper, Typography } from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";

export type TagRow = { name: string; source: "api" | "user" };

interface Props {
  data: TagRow[];
  onDelete: (name: string) => void;
  inputField: React.ReactNode;
}

const TagTable: React.FC<Props> = ({ data, onDelete, inputField }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        height: "100%", // fill parent
        minHeight: 0, // allow inner scroll
        display: "flex",
        flexDirection: "column",
        border: "1px solid #BFD0E8",
        borderRadius: "14px",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.45) 100%)",
        backdropFilter: "blur(6px)",
        boxShadow:
          "0 1px 0 rgba(12, 24, 38, 0.04), 0 6px 16px rgba(12, 24, 38, 0.06)",
        overflow: "hidden", // prevent outer scrollbars
      }}
    >
      {/* Sticky input */}
      <Box
        sx={{
          p: 1,
          borderBottom: "1px solid #E2E8F0",
          position: "sticky",
          top: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.80) 0%, rgba(255,255,255,0.55) 100%)",
          borderTopLeftRadius: "14px",
          borderTopRightRadius: "14px",
          zIndex: 1,
          flexShrink: 0,
        }}
      >
        {inputField}
      </Box>

      {/* Scrollable list */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0, // ← CRITICAL
          overflowY: "auto", // ← inner scroll lives here
          overflowX: "hidden",
          p: 1,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
          "&::-webkit-scrollbar": { width: 10 },
          "&::-webkit-scrollbar-thumb": {
            background: "#C7D5EA",
            borderRadius: 10,
            border: "3px solid transparent",
            backgroundClip: "content-box",
          },
          "&::-webkit-scrollbar-thumb:hover": { background: "#B3C6E4" },
        }}
      >
        {data.length === 0 ? (
          <Typography sx={{ color: "#5A6A7A", fontSize: 13 }}>
            No semantic tags yet. Click the tag icon above to generate.
          </Typography>
        ) : (
          data.map((row) => (
            <Box
              key={row.name}
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                columnGap: 0.5,
                alignItems: "start",
                py: 0.25,
              }}
            >
              {/* pill label (wraps; no side scroll) */}
              <Box
                sx={{
                  maxWidth: "100%",
                  backgroundColor:
                    row.source === "user"
                      ? "rgba(210, 132, 150, 0.18)"
                      : "rgba(160, 184, 221, 0.18)",
                  borderRadius: "999px",
                  px: 1,
                  py: 0.5,
                  border: "1px solid rgba(160, 184, 221, 0.50)",
                }}
              >
                <Typography
                  sx={{
                    m: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#21426C",
                    lineHeight: 1.25,
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }}
                >
                  {row.name}
                </Typography>
              </Box>

              {/* delete */}
              <IconButton
                onClick={() => onDelete(row.name)}
                size="small"
                sx={{
                  mt: 0.25,
                  color: row.source === "user" ? "#C2185B" : "#1976D2",
                  width: 26,
                  height: 26,
                  flexShrink: 0,
                }}
              >
                <ClearIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ))
        )}
      </Box>
    </Paper>
  );
};

export default TagTable;
