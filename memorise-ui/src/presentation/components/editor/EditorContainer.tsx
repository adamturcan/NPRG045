// src/components/editor/EditorContainer.tsx
/**
 * EditorContainer - Styled wrapper for the Slate editor
 * 
 * This component provides the visual container and styling for the notation editor.
 * It includes:
 * - Border and shadow styling
 * - Hover and focus states
 * - Relative positioning for absolute-positioned bubbles
 * - Overflow handling
 * 
 * The containerRef is used by the parent to calculate bubble positions
 * relative to this container.
 */
import React from "react";
import { Box } from "@mui/material";
import { COLORS } from "../../../shared/constants/notationEditor";
import type { EditorContainerProps } from "../../../types/NotationEditor";

const EditorContainer: React.FC<EditorContainerProps> = ({
  children,
  containerRef,
}) => {
  return (
    <Box
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="flex-1 flex flex-col overflow-hidden relative"
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "16px",
        background: "#FFFFFF",
        boxShadow:
          "0 14px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.25)",
        "&:hover": { borderColor: COLORS.borderHover },
        "&:focus-within": { borderColor: COLORS.borderFocus },
        color: COLORS.text,
        fontFamily: "DM Mono, monospace",
        overflow: "hidden",
        position: "relative", // Required for absolute positioning of bubbles
        "& .slate-placeholder": {
          "& *": {
            display: "inline !important",
            whiteSpace: "nowrap !important",
          },
        },
      }}
    >
      {children}
    </Box>
  );
};

export default EditorContainer;
