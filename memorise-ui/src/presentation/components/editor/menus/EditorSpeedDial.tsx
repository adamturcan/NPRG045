import React from "react";
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from "@mui/material";
import { alpha, darken } from "@mui/material/styles";

import CloseIcon from "@mui/icons-material/Close";
import TuneIcon from "@mui/icons-material/Tune";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import TranslateIcon from "@mui/icons-material/Translate"; 

interface EditorSpeedDialProps {
  onNer: () => void;
  onSegment: () => void;
  onSemTag: () => void;
  onSave: () => void;
  onTranslateAll: (e: React.MouseEvent<HTMLElement>) => void;
  isProcessing: boolean;
  viewMode: "document" | "segments";
}

const COLORS = {
  gold: "#DDD1A0",
  magenta: "#C2185B",
  dateBlue: "#1976D2",
  darkBlue: "#21426C",
  green: "#388E3C",
  orange: "#F57C00", 
};

const EditorSpeedDial: React.FC<EditorSpeedDialProps> = ({
  onNer,
  onSegment,
  onSemTag,
  onSave,
  onTranslateAll,
  isProcessing,
  viewMode,
}) => {
  const [open, setOpen] = React.useState(false);

  const actions = [
    { key: "save", icon: <SaveOutlinedIcon />, name: "Save", onClick: onSave, accent: COLORS.green },
    { key: "translate", icon: <TranslateIcon />, name: "Translate All", onClick: onTranslateAll, accent: COLORS.orange },
    { key: "semtag", icon: <LabelOutlinedIcon />, name: "Sem-Tags", onClick: onSemTag, accent: COLORS.magenta },
    { key: "segment", icon: <CallSplitIcon />, name: viewMode === "segments" ? "Re-segment" : "Auto-Segment", onClick: onSegment, accent: COLORS.dateBlue },
    { key: "ner", icon: <ManageSearchIcon />, name: "NER", onClick: onNer, accent: COLORS.magenta },
  ];

  return (
    <SpeedDial
      ariaLabel="Editor Actions"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      direction="right" 
      sx={{
        position: "relative", 
        zIndex: 10,
      }}
      icon={
        <SpeedDialIcon
          // Cleaned up the font sizes here. 1.8rem is prominent but leaves 
          // enough room for the flexbox to center it perfectly.
          icon={<TuneIcon sx={{ fontSize: "1.8rem" }} />}
          openIcon={<CloseIcon sx={{ fontSize: "1.8rem" }} />}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        />
      }
      FabProps={{
        disabled: isProcessing,
        sx: {
          bgcolor: COLORS.darkBlue,
          color: COLORS.gold,
          width: 45,  
          height: 45, 
          minHeight: 45, // <--- CRITICAL FIX: Forces MUI to center properly
          boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
          "&:hover": {
            bgcolor: darken(COLORS.darkBlue, 0.06),
            transform: "scale(1.04)",
          },
        },
      }}
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.key}
          icon={action.icon}
          tooltipTitle={action.name}
          tooltipPlacement="bottom" 
          onClick={(e) => {
            action.onClick(e as any);
            if (action.key !== "translate") {
              setOpen(false);
            }
          }}
          sx={{
            margin: "0 6px",
            // We target the action fab directly to ensure the dimensions apply correctly
            "& .MuiSpeedDialAction-fab": {
              width: 45,
              height: 45,
              minHeight: 45, // <--- Ensures secondary buttons don't warp
              bgcolor: "white",
              color: action.accent,
              border: `1px solid ${alpha(COLORS.darkBlue, 0.14)}`,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              "& svg": {
                fontSize: "1.65rem", // <--- MADE INNER ICONS BIGGER!
              }
            },
            "& .MuiSpeedDialAction-staticTooltipLabel": {
              whiteSpace: "nowrap",
              bgcolor: alpha("#FFFFFF", 0.95),
              color: COLORS.darkBlue,
              border: `1px solid ${alpha(COLORS.darkBlue, 0.16)}`,
              boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              mt: 1, 
            },
          }}
        />
      ))}
    </SpeedDial>
  );
};

export default EditorSpeedDial;