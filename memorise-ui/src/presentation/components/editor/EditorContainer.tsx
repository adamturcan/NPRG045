import React from "react";
import { Box } from "@mui/material";
import { COLORS } from "../../../shared/constants/notationEditor";
import type { EditorContainerProps } from "../../../types/NotationEditor";

//  Provides the visual container and styling for the notation editor. 
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
        color: COLORS.text,
        fontFamily: "DM Mono, monospace",
        overflow: "hidden",
        position: "relative", 
        height: "100%",
      }}
    >
      {children}
    </Box>
  );
};

export default EditorContainer;
