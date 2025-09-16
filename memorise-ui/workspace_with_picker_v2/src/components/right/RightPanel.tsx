import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import TagTable from "../tags/TagTable";

export type TagRow = { name: string; source: "api" | "user" };

interface Props {
  tags: TagRow[];
  onDeleteTag: (name: string) => void;
  tagInputField: React.ReactNode;
}

const COLORS = {
  text: "#0F172A",
  border: "#E2E8F0",
  pillBg: "white",
};

const RightPanel: React.FC<Props> = ({ tags, onDeleteTag, tagInputField }) => {
  return (
    <Box
      sx={{
        width: 300,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        color: COLORS.text,
      }}
    >
      {/* Header pill */}
      <Paper
        elevation={0}
        sx={{
          p: 0.5,
          borderRadius: 999,
          display: "inline-flex",
          alignSelf: "center",
          border: `1px solid ${COLORS.border}`,
          background: COLORS.pillBg,
          backdropFilter: "blur(6px)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
          mb: 1.25,
        }}
      >
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            px: 2,
            py: 0.6,
            borderRadius: 999,
            fontWeight: 800,
          }}
        >
          <LocalOfferOutlinedIcon sx={{ fontSize: 18, mr: 0.75 }} />
          <Typography variant="body2" fontWeight={800}>
            Tags
          </Typography>
        </Box>
      </Paper>

      {/* MAIN WHITE CARD (strong shadow like editor) */}
      <Box
        sx={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          borderRadius: 3,
          background: "#FFFFFF",
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 14px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.25)",
          zIndex: 1,
        }}
      >
        <Box
          sx={{ position: "absolute", inset: 0, display: "flex", minHeight: 0 }}
        >
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <TagTable
              data={tags}
              onDelete={onDeleteTag}
              inputField={tagInputField}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default RightPanel;
