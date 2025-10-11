// src/components/editor/SelectionBubble.tsx
/**
 * SelectionBubble - Floating button that appears when text is selected
 * 
 * This component displays a "..." button positioned at the end of the user's
 * text selection. When clicked, it opens the CategoryMenu to allow the user
 * to annotate the selected text with an entity type.
 * 
 * The bubble only appears when:
 * - Text is selected (non-collapsed selection)
 * - The selection doesn't overlap with existing annotations
 */
import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import type { SelectionBubbleProps } from "../../types/NotationEditor";

const SelectionBubble: React.FC<SelectionBubbleProps> = ({
  selectionBox,
  onMenuClick,
  onMouseDown,
}) => {
  return (
    <Tooltip title="Add to category">
      <IconButton
        size="small"
        disableRipple
        disableFocusRipple
        disableTouchRipple
        onMouseDown={onMouseDown} // Prevents closing the bubble on mousedown
        onClick={onMenuClick} // Opens the category menu
        sx={{
          position: "absolute",
          top: selectionBox.top, // Position calculated from DOM selection
          left: selectionBox.left,
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

export default SelectionBubble;
