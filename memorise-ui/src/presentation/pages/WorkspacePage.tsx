import React from "react";
import { Box } from "@mui/material";
import { useLocation } from "react-router-dom";
import EditorContainer from "../components/containers/EditorContainer";
import { COLORS } from "../../shared/constants/ui";
import { useSessionStore } from "../stores/sessionStore";

const WorkspacePage: React.FC = () => {
  const location = useLocation();
  const currentSessionId = useSessionStore((state) => state.session?.id);
  
  const match = location.pathname.match(/^\/workspace\/([^/]+)/);
  const urlId = match && match[1] !== 'new' ? match[1] : null;

  const isDataReady = currentSessionId === urlId && currentSessionId !== undefined;

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "visible", px: 4, color: COLORS.text }}>
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", height: "88.5vh", pl: 4, minHeight: 0 }}>
        {/* <BookmarkContainer /> */}
        
        {isDataReady ? (
          <EditorContainer key={currentSessionId} />
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            Loading workspace...
          </Box>
        )}
        
      </Box>
      <Box sx={{ width: "300px", height: "86vh", display: "flex", flexDirection: "column", mt: 4, minHeight: 0, ml: 2, pr: 1 }}>
        {/* <PanelContainer /> */}
      </Box>
    </Box>
  );
};

export default WorkspacePage;