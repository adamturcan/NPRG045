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

const SegmentNavBar: React.FC<SegmentNavBarProps> = ({
  segments,
  activeSegmentId,
  viewMode = "document",
  onSegmentClick,
  onJoinSegments,
  onSplitSegment,
  text = "",
}) => {
  const handleSegmentClick = useCallback(
    (segment: Segment) => {
      onSegmentClick?.(segment);
    },
    [onSegmentClick]
  );
// Empty state
  if (segments.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          p: 3,
          color: "#64748B",
        }}
      >
        <Typography variant="body2" sx={{ textAlign: "center", mb: 1 }}>
          No segments yet
        </Typography>
        <Typography variant="caption" sx={{ textAlign: "center", color: "#94A3B8" }}>
          Use the segmentation API to divide your text into segments
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <List
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 0,
          "&::-webkit-scrollbar": {
            width: "8px",
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "#CBD5E1",
            borderRadius: "4px",
            "&:hover": {
              background: "#94A3B8",
            },
          },
        }}
      >
        {segments.map((segment, index) => {
          const isActive = viewMode === "document" 
            ? segment.id === activeSegmentId
            : segment.id === activeSegmentId;
          const segmentText = segment.text ?? getSegmentText(segment, text);
          const preview = segmentText.length > 50 
            ? `${segmentText.substring(0, 50)}...` 
            : segmentText;

          const nextSegment = index < segments.length - 1 ? segments[index + 1] : null;

          return (
            <ListItem
              key={segment.id}
              disablePadding
              sx={{
                position: "relative",
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <ListItemButton
                onClick={() => handleSegmentClick(segment)}
                sx={{
                  py: 1.5,
                  px: 2,
                  pr: onSplitSegment ? 5 : 2, 
                  backgroundColor: isActive ? "#EFF6FF" : "transparent",
                  "&:hover": {
                    backgroundColor: isActive ? "#DBEAFE" : "#F8FAFC",
                  },
                  transition: "background-color 0.2s",
                }}
              >
                <Box sx={{ width: "100%" }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 0.5,
                    }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        backgroundColor: isActive ? "#3B82F6" : "#E2E8F0",
                        color: isActive ? "white" : "#64748B",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        minWidth: "24px",
                        textAlign: "center",
                      }}
                    >
                      {segment.order + 1}
                    </Paper>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#64748B",
                        fontWeight: 500,
                      }}
                    >
                      Segment {segment.order + 1}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "#0F172A",
                      fontSize: "0.875rem",
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {preview}
                  </Typography>
                </Box>
              </ListItemButton>
              
              {/* Split button positioned at top-right of segment */}
              {onSplitSegment && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    zIndex: 10,
                  }}
                >
                  <Tooltip title="Split segment">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSplitSegment(segment.id);
                      }}
                      sx={{
                        backgroundColor: "rgba(139, 195, 74, 0.1)",
                        color: "#8BC34A",
                        "&:hover": {
                          backgroundColor: "rgba(139, 195, 74, 0.2)",
                        },
                        width: 24,
                        height: 24,
                      }}
                    >
                      <CallSplitIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
              
              {/* Join button positioned at the border between segments */}
              {nextSegment && onJoinSegments && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: -12, 
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 10, 
                  }}  
                >
                  <Tooltip title="Join with next segment">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onJoinSegments(segment.id, nextSegment.id);
                      }}
                      sx={{
                        backgroundColor: "rgba(59, 130, 246, 0.1)",
                        color: "#3B82F6",
                        border: "2px solid white", 
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        "&:hover": {
                          backgroundColor: "rgba(59, 130, 246, 0.2)",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                        },
                        width: 24,
                        height: 24,
                      }}
                    >
                      <MergeTypeIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default SegmentNavBar;

