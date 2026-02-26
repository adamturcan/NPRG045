import React, { useState, useRef, useEffect } from "react";
import { Box, Paper, ToggleButton, ToggleButtonGroup } from "@mui/material";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import ViewListIcon from "@mui/icons-material/ViewList";

const COLORS = { text: "#0F172A", border: "#E2E8F0", pillBg: "white" };

interface TabSwitcherProps {
  activeTab: "tags" | "segments";
  onChange: (tab: "tags" | "segments") => void;
}

const TabSwitcher: React.FC<TabSwitcherProps> = ({ activeTab, onChange }) => {
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, top: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLButtonElement>(null);
  const segmentsRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const updateIndicator = () => {
      const activeEl = activeTab === "tags" ? tagsRef.current : segmentsRef.current;
      const container = containerRef.current;
      if (activeEl && container) {
        const cRect = container.getBoundingClientRect();
        const bRect = activeEl.getBoundingClientRect();
        setIndicatorStyle({ left: bRect.left - cRect.left, width: bRect.width, top: bRect.top - cRect.top, height: bRect.height });
      }
    };
    updateIndicator();
    const timeout = setTimeout(updateIndicator, 10);
    return () => clearTimeout(timeout);
  }, [activeTab]);

  return (
    <Paper elevation={0} sx={{ p: 0.5, borderRadius: 999, display: "inline-flex", alignSelf: "center", border: `1px solid ${COLORS.border}`, background: COLORS.pillBg, backdropFilter: "blur(6px)", boxShadow: "0 6px 18px rgba(0,0,0,0.25)", mb: 1.25 }}>
      <Box ref={containerRef} sx={{ position: "relative", display: "inline-flex" }}>
        <Box sx={{ ...indicatorStyle, position: "absolute", backgroundColor: "#3B82F6", borderRadius: 999, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", zIndex: 0 }} />
        <ToggleButtonGroup value={activeTab} exclusive onChange={(_, val) => val && onChange(val)} sx={{ position: "relative", zIndex: 1, "& .MuiToggleButton-root": { border: "none", px: 2, py: 0.6, borderRadius: 999, fontWeight: 800, fontSize: "0.875rem", textTransform: "none", color: COLORS.text, "&.Mui-selected": { color: "white", backgroundColor: "transparent" }, "&.Mui-selected:hover": { color: "white", backgroundColor: "transparent" } } }}>
          <ToggleButton ref={tagsRef} value="tags"><LocalOfferOutlinedIcon sx={{ fontSize: 18, mr: 0.75 }} /> Tags</ToggleButton>
          <ToggleButton ref={segmentsRef} value="segments"><ViewListIcon sx={{ fontSize: 18, mr: 0.75 }} /> Segments</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Paper>
  );
};

export default TabSwitcher;
