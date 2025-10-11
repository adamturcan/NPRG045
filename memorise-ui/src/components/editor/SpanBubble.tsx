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
        disableFocusRipple
        disableTouchRipple
        onMouseDown={onMouseDown} // Prevents closing the bubble on mousedown
        onClick={onMenuClick} // Opens the edit menu
        sx={{
          position: "absolute",
          top: spanBox.top, // Position calculated from the span's DOM range
          left: spanBox.left,
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
