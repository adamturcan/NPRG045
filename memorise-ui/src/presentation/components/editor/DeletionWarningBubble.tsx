// src/components/editor/DeletionWarningBubble.tsx
/**
 * DeletionWarningBubble - Floating alert icon that appears when deleting text that contains entities
 * 
 * This component displays a warning icon positioned at the cursor/deletion point
 * when the user is attempting to delete text that contains one or more entity annotations.
 * 
 * Similar to SelectionBubble and SpanBubble but shows a warning instead of an action button.
 */
import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import WarningIcon from "@mui/icons-material/Warning";
import type { DeletionWarningBox } from "../../../types/NotationEditor";

interface Props {
  warningBox: DeletionWarningBox;
  onMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
}

const DeletionWarningBubble: React.FC<Props> = ({
  warningBox,
  onMouseDown,
}) => {
  const affectedEntities = warningBox.affectedSpans
    .map((span) => span.entity)
    .filter((entity, index, self) => self.indexOf(entity) === index); // Unique entities
  
  const tooltipText = affectedEntities.length === 1
    ? `Deleting this text will remove the "${affectedEntities[0]}" entity annotation`
    : `Deleting this text will remove ${warningBox.affectedSpans.length} entity annotation${warningBox.affectedSpans.length > 1 ? 's' : ''}`;

  return (
    <Tooltip title={tooltipText} arrow>
      <IconButton
        size="small"
        disableRipple
        onMouseDown={onMouseDown} // Prevents closing the bubble on mousedown
        sx={{
          position: "absolute",
          top: warningBox.top - 4,
          left: warningBox.left - 4,
          width: 30,
          height: 30,
          borderRadius: "999px",
          backgroundColor: "#FFF3CD",
          border: "1px solid rgba(212, 167, 1, 0.5)",
          boxShadow:
            "0 8px 18px rgba(212, 167, 1, 0.25), 0 3px 7px rgba(212, 167, 1, 0.15)",
          "&:hover": {
            backgroundColor: "#FFE69C",
            borderColor: "rgba(212, 167, 1, 0.7)",
          },
          outline: "none",
          "&:focus": {
            outline: "none",
            boxShadow:
              "0 0 0 2px rgba(212, 167, 1, 0.4), 0 8px 18px rgba(212, 167, 1, 0.25), 0 3px 7px rgba(212, 167, 1, 0.15)",
          },
          "&:focus-visible": {
            outline: "none",
            boxShadow:
              "0 0 0 2px rgba(212, 167, 1, 0.4), 0 8px 18px rgba(212, 167, 1, 0.25), 0 3px 7px rgba(212, 167, 1, 0.15)",
          },
          WebkitTapHighlightColor: "transparent",
          color: "#856404",
          zIndex: 60, // Ensure it appears above editor content
          cursor: "default",
          "&:hover .MuiSvgIcon-root": {
            transform: "scale(1.1)",
            transition: "transform 0.2s ease",
          },
        }}
      >
        <WarningIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>
  );
};

export default DeletionWarningBubble;



