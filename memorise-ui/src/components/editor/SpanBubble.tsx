// src/components/editor/SpanBubble.tsx
/**
 * SpanBubble - Floating button that appears when an annotated span is clicked
 * 
 * This component displays a "..." button positioned at the end of an active
 * annotation span. When clicked, it opens the CategoryMenu with options to:
 * - Change the entity category
 * - Delete the annotation
 * 
 * Similar to SelectionBubble but for existing annotations instead of new selections.
 */
import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import type { SpanBubbleProps } from "../../types/NotationEditor";

const SpanBubble: React.FC<SpanBubbleProps> = ({
  spanBox,
  onMenuClick,
  onMouseDown,
}) => {
  return (
    <Tooltip title="Edit entity">
      <IconButton
        size="small"
        disableRipple
        onMouseDown={onMouseDown} // Prevents closing the bubble on mousedown
        onClick={onMenuClick} // Opens the edit menu
        sx={{
          position: "absolute",
          top: spanBox.top - 4, // Position calculated from the span's DOM range
          left: spanBox.left - 4,
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
          zIndex: 60, // Ensure it appears above editor content
        }}
      >
        <MoreHorizIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>
  );
};

export default SpanBubble;
