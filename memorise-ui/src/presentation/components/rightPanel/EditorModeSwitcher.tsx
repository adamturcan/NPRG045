import React from "react";
import { Box, Typography, ToggleButton, ToggleButtonGroup } from "@mui/material";
import ViewListIcon from "@mui/icons-material/ViewList";
import DescriptionIcon from "@mui/icons-material/Description";


const COLORS = { border: "#E2E8F0" };

interface EditorModeSwitcherProps {
  viewMode: "document" | "segments";
  onViewModeChange: (mode: "document" | "segments") => void;
}

const EditorModeSwitcher: React.FC<EditorModeSwitcherProps> = ({ viewMode, onViewModeChange }) => (
  <Box sx={{ px: 2, pt: 2, pb: 1.5, borderBottom: `1px solid ${COLORS.border}` }}>
    <Typography variant="caption" sx={{ display: "block", mb: 1, fontWeight: 600, color: "text.secondary", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.5px" }}>
      Editor Mode
    </Typography>
    <ToggleButtonGroup value={viewMode} exclusive onChange={(_, val) => val && onViewModeChange(val)} size="small" fullWidth sx={{ "& .MuiToggleButton-root": { py: 0.75, px: 1.5, textTransform: "none", fontSize: "0.875rem", fontWeight: 500, border: `1px solid ${COLORS.border}` } }}>
      <ToggleButton value="document"><DescriptionIcon sx={{ fontSize: 18, mr: 0.75 }} /> Document</ToggleButton>
      <ToggleButton value="segments"><ViewListIcon sx={{ fontSize: 18, mr: 0.75 }} /> Segments</ToggleButton>
    </ToggleButtonGroup>
  </Box>
);

export default EditorModeSwitcher;
