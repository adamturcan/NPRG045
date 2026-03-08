import React from "react";
import { Box, Fade } from "@mui/material";

import TagTable, { type TagRow } from "./tags/TagTable";


import type { ThesaurusItem } from "./inputs/TagThesaurusInput";
import type { ThesaurusIndexItem } from "../../../types/Thesaurus";
import type { Segment } from "../../../types/Segment";


export type { TagRow };


const COLORS = { text: "#0F172A", border: "#E2E8F0", pillBg: "white" };

interface Props {
  tags: TagRow[];
  onDeleteTag: (name: string, keywordId?: number, parentId?: number) => void;
  onAddTag: (name: string, keywordId?: number, parentId?: number) => void;  
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
  
  return (
    <Box sx={{ width: 300, height: "100%", display: "flex", flexDirection: "column", minHeight: 0, color: COLORS.text, mt: -1.1 }}>      
      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", borderRadius: 3, background: "#FFFFFF", border: `1px solid ${COLORS.border}`, boxShadow: "0 14px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.25)" }}>
        <Box sx={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
          
          
            <Fade in timeout={300}>
              <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
                <TagTable
                  data={props.tags}
                  onDelete={props.onDeleteTag}                  
                  thesaurus={props.thesaurus ? { ...props.thesaurus, onAdd: props.onAddTag } : undefined}
                  thesaurusIndex={props.thesaurusIndex}
                />
              </Box>
            </Fade>       
        </Box>
      </Box>
    </Box>
  );
};

export default RightPanel;