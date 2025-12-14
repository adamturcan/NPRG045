/**
 * SegmentNavBar - Navigation sidebar for text segments
 * 
 * Displays a scrollable list of segments with:
 * - Segment preview text (first 50 chars)
 * - Segment number/order
 * - Click to scroll to segment in editor
 * - Empty state message when no segments
 */
import React, { useCallback } from "react";
import { Box, Typography, Paper, List, ListItem, ListItemButton, IconButton, Tooltip } from "@mui/material";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import type { Segment } from "../../../types/Segment";
import { getSegmentText } from "../../../types/Segment";

interface SegmentNavBarProps {
  segments: Segment[];
  activeSegmentId?: string;
  selectedSegmentId?: string;
  viewMode?: "document" | "segments";
  onSegmentClick?: (segment: Segment) => void;
  onJoinSegments?: (segment1: Segment, segment2: Segment) => void;
  onSplitSegment?: (segment: Segment) => void;
  text?: string; // Full text to derive segment text from indices
}

const SegmentNavBar: React.FC<SegmentNavBarProps> = ({
  segments,
  activeSegmentId,
  selectedSegmentId,
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

  const handleJoinSegments = useCallback(
    (segment1: Segment, segment2: Segment, event: React.MouseEvent) => {
      event.stopPropagation(); // Prevent triggering segment click
      onJoinSegments?.(segment1, segment2);
    },
    [onJoinSegments]
  );

  const handleSplitSegment = useCallback(
    (segment: Segment, event: React.MouseEvent) => {
      event.stopPropagation(); // Prevent triggering segment click
      onSplitSegment?.(segment);
    },
    [onSplitSegment]
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

  // Sort segments by start position (or order) to ensure correct sequence
  // Use the sorted array index for numbering, not the API's order field
  const sortedSegments = [...segments].sort((a, b) => {
    // First try sorting by start position
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    // If start positions are equal, fall back to order
    return a.order - b.order;
  });

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
        {sortedSegments.map((segment, index) => {
          // In document view, use activeSegmentId for highlighting
          // In segment view, use selectedSegmentId for highlighting
          const isActive = viewMode === "document" 
            ? segment.id === activeSegmentId
            : segment.id === selectedSegmentId;
          const segmentText = segment.text ?? getSegmentText(segment, text);
          const preview = segmentText.length > 50 
            ? `${segmentText.substring(0, 50)}...` 
            : segmentText;
          const nextSegment = sortedSegments[index + 1];
          const showJoinButton = onJoinSegments && nextSegment !== undefined;

          return (
            <React.Fragment key={segment.id}>
              <ListItem
                disablePadding
                sx={{
                  borderBottom: "1px solid #F1F5F9",
                  position: "relative",
                }}
              >
                <ListItemButton
                  onClick={() => handleSegmentClick(segment)}
                  sx={{
                    py: 1.5,
                    px: 2,
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
                        {index + 1}
                      </Paper>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#64748B",
                          fontWeight: 500,
                        }}
                      >
                        Segment {index + 1}
                      </Typography>
                      {/* Split button - only show in segment view mode */}
                      {viewMode === "segments" && onSplitSegment && (
                        <Tooltip title="Split segment" arrow>
                          <IconButton
                            size="small"
                            onClick={(e) => handleSplitSegment(segment, e)}
                            sx={{
                              ml: "auto",
                              backgroundColor: "rgba(139, 195, 74, 0.1)",
                              color: "#689F38",
                              "&:hover": {
                                backgroundColor: "rgba(139, 195, 74, 0.2)",
                              },
                              width: 20,
                              height: 20,
                            }}
                          >
                            <CallSplitIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      )}
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
                {/* Join button always visible between segments */}
                {showJoinButton && (
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: -12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 10,
                    }}
                  >
                    <Tooltip title="Join segments" arrow>
                      <IconButton
                        size="small"
                        onClick={(e) => handleJoinSegments(segment, nextSegment, e)}
                        sx={{
                          backgroundColor: "#3B82F6",
                          color: "white",
                          "&:hover": {
                            backgroundColor: "#2563EB",
                          },
                          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
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
            </React.Fragment>
          );
        })}
      </List>
    </Box>
  );
};

export default SegmentNavBar;

