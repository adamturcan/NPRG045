import React, { useState, useRef, useEffect } from "react";
import { Box, Typography, Fade } from "@mui/material";

import TagTable, { type TagRow } from "./tags/TagTable";
import SegmentNavBar from "./SegmentNavBar";
import TabSwitcher from "./TabSwitcher";
import EditorModeSwitcher from "./EditorModeSwitcher";
import type { ThesaurusItem } from "./inputs/TagThesaurusInput";
import type { ThesaurusIndexItem } from "../../../types/Thesaurus";
import type { Segment } from "../../../types/Segment";


export type { TagRow };


const COLORS = { text: "#0F172A", border: "#E2E8F0", pillBg: "white" };

interface Props {
  tags: TagRow[];
  onDeleteTag: (name: string, keywordId?: number, parentId?: number) => void;
  onAddTag: (name: string, keywordId?: number, parentId?: number) => void;
  tagInputField?: React.ReactNode;
  thesaurus?: {
    fetchSuggestions: (query: string) => Promise<ThesaurusItem[]>;
    restrictToThesaurus?: boolean;
    onRestrictChange?: (v: boolean) => void;
    defaultRestrictToThesaurus?: boolean;
    placeholder?: string;
    isThesaurusLoading?: boolean;
    resetKey?: string;
  };
  thesaurusIndex?: ThesaurusIndexItem[];
  segments?: Segment[];
  segmentOperations: {
    handleSegmentClick: (segment: Segment) => void;
    handleJoinSegments: (segmentId1: string, segmentId2: string) => void;
    handleSplitSegment: (segmentId: string) => void;
  };
  activeSegmentId?: string;
  viewMode?: "document" | "segments";
  onViewModeChange?: (mode: "document" | "segments") => void;
  text?: string;
}


const RightPanel: React.FC<Props> = (props) => {
  const { segments = [], viewMode = "document", onViewModeChange, activeSegmentId } = props;
  const shouldShowSegments = segments.length > 0;
  
  const [activeTab, setActiveTab] = useState<"tags" | "segments">(
    shouldShowSegments && viewMode === "segments" ? "segments" : "tags"
  );

  const prevViewModeRef = useRef(viewMode);
    
  useEffect(() => {
    if (prevViewModeRef.current === "document" && viewMode === "segments" && shouldShowSegments) {
      setActiveTab("segments");
    }
    prevViewModeRef.current = viewMode;
  }, [viewMode, shouldShowSegments]);

  return (
    <Box sx={{ width: 300, height: "100%", display: "flex", flexDirection: "column", minHeight: 0, color: COLORS.text, mt: -1.1 }}>
      <TabSwitcher activeTab={activeTab} onChange={setActiveTab} />

      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", borderRadius: 3, background: "#FFFFFF", border: `1px solid ${COLORS.border}`, boxShadow: "0 14px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.25)" }}>
        <Box sx={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
          
          {/* TAGS PANEL */}
          {activeTab === "tags" && (
            <Fade in timeout={300}>
              <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
                {viewMode === "segments" && activeSegmentId && (
                  <Box sx={{ px: 2, pt: 1.5, pb: 1, borderBottom: `1px solid ${COLORS.border}`, backgroundColor: "rgba(59, 130, 246, 0.05)" }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", textTransform: "uppercase" }}>Segment Tags</Typography>
                    <Typography variant="body2">{activeSegmentId}</Typography>
                  </Box>
                )}
                <TagTable
                  data={props.tags}
                  onDelete={props.onDeleteTag}
                  inputField={props.tagInputField}
                  thesaurus={props.thesaurus ? { ...props.thesaurus, onAdd: props.onAddTag } : undefined}
                  thesaurusIndex={props.thesaurusIndex}
                />
              </Box>
            </Fade>
          )}

          {/* SEGMENTS PANEL */}
          {activeTab === "segments" && (
            <Fade in timeout={300}>
              <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
                {shouldShowSegments && onViewModeChange && (
                  <EditorModeSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
                )}
                <SegmentNavBar
                  segments={segments}
                  activeSegmentId={activeSegmentId}
                  viewMode={viewMode}
                  onSegmentClick={props.segmentOperations.handleSegmentClick}
                  onJoinSegments={props.segmentOperations.handleJoinSegments}
                  onSplitSegment={props.segmentOperations.handleSplitSegment}
                  text={props.text}
                />
              </Box>
            </Fade>
          )}

        </Box>
      </Box>
    </Box>
  );
};

export default RightPanel;