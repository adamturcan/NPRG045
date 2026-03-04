import React from "react";
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from "@mui/material";
import { alpha, darken } from "@mui/material/styles";

import CloseIcon from "@mui/icons-material/Close";
import TuneIcon from "@mui/icons-material/Tune";

// Action icons (outlined = lighter/cleaner on white)
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";

interface EditorSpeedDialProps {
  onNer: () => void;
  onSegment: () => void;
  onSemTag: () => void;
  onSave: () => void;
  isProcessing: boolean;
  viewMode: "document" | "segments";
}

const COLORS = {
  gold: "#DDD1A0",
  pink: "#DDA0AF",
  apiBlue: "#A0B8DD",
  dateBlue: "#1976D2",
  darkBlue: "#21426C",
  magenta: "#C2185B",
  green: "#388E3C",
  orange: "#F57C00",
  purpleCamp: "#6A1B9A",
  purpleGhetto: "#9C27B0",
  blueGrey: "#607D8B",
};

const EditorSpeedDial: React.FC<EditorSpeedDialProps> = ({
  onNer,
  onSegment,
  onSemTag,
  onSave,
  isProcessing,
  viewMode,
}) => {
  const [open, setOpen] = React.useState(false);

  const actions = [
    {
      key: "save",
      icon: <SaveOutlinedIcon />,
      name: "Save",
      onClick: onSave,
      accent: COLORS.green,
    },
    {
      key: "semtag",
      icon: <LabelOutlinedIcon />,
      name: "Sem-Tags",
      onClick: onSemTag,
      // Pink is pretty light on white; magenta reads cleaner for an action icon.
      // If you *really* want pink, use it as a hover tint instead.
      accent: COLORS.magenta,
    },
    {
      key: "segment",
      icon: <CallSplitIcon />,
      name: viewMode === "segments" ? "Re-segment" : "Auto-Segment",
      onClick: onSegment,
      // Your light API blue is low-contrast on white; dateBlue works better for an icon.
      accent: COLORS.dateBlue,
    },
    {
      key: "ner",
      icon: <ManageSearchIcon />,
      name: viewMode === "segments" ? "NER" : "NER",
      onClick: onNer,
      accent: COLORS.magenta,
    },
  ];

  return (
    <SpeedDial
      ariaLabel="Editor Actions"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      direction="up"
      sx={{
        position: "absolute",
        bottom: 24,
        right: 24,
        zIndex: 10,
      }}
      icon={
        <SpeedDialIcon
          icon={<TuneIcon sx={{ fontSize: 20  }} />}
          openIcon={<CloseIcon sx={{ fontSize: 20 }} />}
          
        />
      }
      FabProps={{
        disabled: isProcessing,
        sx: {
          // Main button: strong contrast on white editor
          bgcolor: COLORS.darkBlue,
          color: COLORS.gold,
          width: 60,
          height: 60,
          boxShadow: "0 10px 26px rgba(0,0,0,0.20)",
          "&:hover": {
            bgcolor: darken(COLORS.darkBlue, 0.06),
            transform: "scale(1.04)",
            boxShadow: "0 14px 34px rgba(0,0,0,0.24)",
          },
        },
      }}
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.key}
          icon={action.icon}
          tooltipTitle={action.name}
          tooltipOpen={open}              // only show labels when dial is open
          tooltipPlacement="left"         // better for bottom-right corner
          onClick={() => {
            action.onClick();
            setOpen(false);
          }}
          sx={{
            "& .MuiSpeedDialAction-fab": {
              bgcolor: "white",
              color: action.accent,
              border: `1px solid ${alpha(COLORS.darkBlue, 0.14)}`,
              boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
            },
            "& .MuiSpeedDialAction-staticTooltipLabel": {
              // key fixes:
              whiteSpace: "nowrap",
              maxWidth: 220,
              overflow: "hidden",
              textOverflow: "ellipsis",
        
              // make it not shouty:
              bgcolor: alpha("#FFFFFF", 0.92),
              color: COLORS.darkBlue,
              border: `1px solid ${alpha(COLORS.darkBlue, 0.16)}`,
              boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
              borderRadius: 12,
              padding: "6px 10px",
              fontSize: 13,
              fontWeight: 500,
              backdropFilter: "blur(6px)",
            },
          }}
        />
      ))}
    </SpeedDial>
  );
};

export default EditorSpeedDial;