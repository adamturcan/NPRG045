import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";

interface BubbleProps {
  box: { top: number; left: number };
  tooltip: string;
  onMenuClick: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
} 

// Bubble component used to display the "..." button for the span menu
const Bubble: React.FC<BubbleProps> = ({
  box,
  tooltip,
  onMenuClick,
  onMouseDown,
}) => {
  return (
    <Tooltip title={tooltip}>
      <IconButton
        size="small"
        disableRipple
        onMouseDown={onMouseDown}
        onClick={onMenuClick}
        sx={{
          position: "absolute",
          top: box.top - 4,
          left: box.left - 4,
          width: 30,
          height: 30,
          borderRadius: "999px",
          backgroundColor: "#ffffff",
          border: "1px solid rgba(2,6,23,0.28)",
          boxShadow:
            "0 8px 18px rgba(2,6,23,0.22), 0 3px 7px rgba(2,6,23,0.16)",
          "&:hover": {
            backgroundColor: "#ffffff",
            borderColor: "rgba(2,6,23,0.45)",
          },
          outline: "none",
          "&:focus": {
            outline: "none",
            boxShadow:
              "0 0 0 2px rgba(33, 66, 108, 0.35), 0 8px 18px rgba(2,6,23,0.22), 0 3px 7px rgba(2,6,23,0.16)",
          },
          "&:focus-visible": {
            outline: "none",
            boxShadow:
              "0 0 0 2px rgba(33, 66, 108, 0.35), 0 8px 18px rgba(2,6,23,0.22), 0 3px 7px rgba(2,6,23,0.16)",
          },
          WebkitTapHighlightColor: "transparent",
          color: "#0F172A",
          zIndex: 60,
        }}
      >
        <MoreHorizIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>
  );
};

export default Bubble;
