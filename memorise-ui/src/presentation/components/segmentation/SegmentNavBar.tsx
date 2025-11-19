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
import { Box, Typography, Paper, List, ListItem, ListItemButton } from "@mui/material";
import type { Segment } from "../../../types/Segment";
import { getSegmentText } from "../../../types/Segment";

interface SegmentNavBarProps {
  segments: Segment[];
  activeSegmentId?: string;
  selectedSegmentId?: string;
  viewMode?: "document" | "segments";
  onSegmentClick?: (segment: Segment) => void;
  text?: string; // Full text to derive segment text from indices
}

const SegmentNavBar: React.FC<SegmentNavBarProps> = ({
  segments,
  activeSegmentId,
  selectedSegmentId,
  viewMode = "document",
  onSegmentClick,
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
        {segments.map((segment) => {
          // In document view, use activeSegmentId for highlighting
          // In segment view, use selectedSegmentId for highlighting
          const isActive = viewMode === "document" 
            ? segment.id === activeSegmentId
            : segment.id === selectedSegmentId;
          const segmentText = segment.text ?? getSegmentText(segment, text);
          const preview = segmentText.length > 50 
            ? `${segmentText.substring(0, 50)}...` 
            : segmentText;

          return (
            <ListItem
              key={segment.id}
              disablePadding
              sx={{
                borderBottom: "1px solid #F1F5F9",
                "&:last-child": {
                  borderBottom: "none",
                },
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
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default SegmentNavBar;

