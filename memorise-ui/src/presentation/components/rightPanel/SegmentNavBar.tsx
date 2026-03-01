import React, { useCallback } from "react";
import { Box, Typography, Paper, List, ListItem, ListItemButton, IconButton, Tooltip } from "@mui/material";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import type { Segment } from "../../../types/Segment";
import { getSegmentText } from "../../../types/Segment";

interface SegmentNavBarProps {
  segments: Segment[];
  activeSegmentId?: string;  
  viewMode?: "document" | "segments"; 
  onSegmentClick?: (segment: Segment) => void;
  onJoinSegments?: (segmentId1: string, segmentId2: string) => void;
  onSplitSegment?: (segmentId: string) => void;
  text?: string; 
} 

const SegmentItem = React.memo(({ 
  segment, 
  isActive, 
  nextSegment, 
  text, 
  onSegmentClick, 
  onSplitSegment, 
  onJoinSegments 
}: { 
  segment: Segment, 
  isActive: boolean, 
  nextSegment: Segment | null, 
  text: string,
  onSegmentClick?: (segment: Segment) => void,
  onSplitSegment?: (segmentId: string) => void,
  onJoinSegments?: (id1: string, id2: string) => void
}) => {
  const segmentText = segment.text ?? getSegmentText(segment, text);

  return (
    <ListItem disablePadding sx={styles.listItem}>
      <ListItemButton
        onClick={() => onSegmentClick?.(segment)}
        sx={{
          py: 1.5,
          px: 2,
          pr: onSplitSegment ? 5 : 2, 
          backgroundColor: isActive ? "#EFF6FF" : "transparent",
          "&:hover": { backgroundColor: isActive ? "#DBEAFE" : "#F8FAFC" },
          transition: "background-color 0.2s",
        }}
      >
        <Box sx={{ width: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Paper
              elevation={0}
              sx={{
                px: 1, py: 0.25, borderRadius: 1,
                backgroundColor: isActive ? "#3B82F6" : "#E2E8F0",
                color: isActive ? "white" : "#64748B",
                fontSize: "0.75rem", fontWeight: 600, minWidth: "24px", textAlign: "center",
              }}
            >
              {segment.order + 1}
            </Paper>
            <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 500 }}>
              Segment {segment.order + 1}
            </Typography>
          </Box>
          <Typography variant="body2" sx={styles.textPreview}>
            {segmentText}
          </Typography>
        </Box>
      </ListItemButton>
      
      {/* Split button */}
      {onSplitSegment && (
        <Box sx={styles.splitButtonBox}>
          <Tooltip title="Split segment">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onSplitSegment(segment.id); }} sx={styles.splitButton}>
              <CallSplitIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      
      {/* Join button */}
      {nextSegment && onJoinSegments && (
        <Box sx={styles.joinButtonBox}>
          <Tooltip title="Join with next segment">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onJoinSegments(segment.id, nextSegment.id); }} sx={styles.joinButton}>
              <MergeTypeIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </ListItem>
  );
});

const SegmentNavBar: React.FC<SegmentNavBarProps> = ({
  segments,
  activeSegmentId,
  onSegmentClick,
  onJoinSegments,
  onSplitSegment,
  text = "",
}) => {
  const handleSegmentClick = useCallback((segment: Segment) => {
    onSegmentClick?.(segment);
  }, [onSegmentClick]);

  if (segments.length === 0) {
    return (
      <Box sx={styles.emptyState}>
        <Typography variant="body2" sx={{ textAlign: "center", mb: 1 }}>No segments yet</Typography>
        <Typography variant="caption" sx={{ textAlign: "center", color: "#94A3B8" }}>
          Use the segmentation API to divide your text into segments
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      <List sx={styles.list}>
        {segments.map((segment, index) => {
          const isActive = segment.id === activeSegmentId;
          const nextSegment = index < segments.length - 1 ? segments[index + 1] : null;

          return (
            <SegmentItem
              key={segment.id}
              segment={segment}
              isActive={isActive}
              nextSegment={nextSegment}
              text={text}
              onSegmentClick={handleSegmentClick}
              onSplitSegment={onSplitSegment}
              onJoinSegments={onJoinSegments}
            />
          );
        })}
      </List>
    </Box>
  );
};



const styles = {
  emptyState: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 3, color: "#64748B" },
  list: { flex: 1, overflowY: "auto", p: 0, "&::-webkit-scrollbar": { width: "8px" }, "&::-webkit-scrollbar-track": { background: "transparent" }, "&::-webkit-scrollbar-thumb": { background: "#CBD5E1", borderRadius: "4px", "&:hover": { background: "#94A3B8" } } },
  listItem: { position: "relative", borderBottom: "1px solid #F1F5F9" },
  splitButtonBox: { position: "absolute", top: 8, right: 8, zIndex: 10 },
  splitButton: { backgroundColor: "rgba(139, 195, 74, 0.1)", color: "#8BC34A", "&:hover": { backgroundColor: "rgba(139, 195, 74, 0.2)" }, width: 24, height: 24 },
  joinButtonBox: { position: "absolute", bottom: -12, left: "50%", transform: "translateX(-50%)", zIndex: 10 },
  joinButton: { backgroundColor: "rgba(59, 130, 246, 0.1)", color: "#3B82F6", border: "2px solid white", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", "&:hover": { backgroundColor: "rgba(59, 130, 246, 0.2)", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }, width: 24, height: 24 },
  textPreview: { color: "#0F172A", fontSize: "0.875rem", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }
};

export default SegmentNavBar;