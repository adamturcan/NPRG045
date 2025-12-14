/**
 * SegmentSplitDialog - Dialog for selecting split position when cursor is not near punctuation
 * 
 * Shows nearest punctuation options when user tries to split at an invalid position
 */
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
} from "@mui/material";
import type { Segment } from "../../../types/Segment";
import { getValidSplitPositions } from "../../../shared/utils/segmentSplitValidation";

interface SegmentSplitDialogProps {
  open: boolean;
  segment: Segment | null;
  text: string;
  onClose: () => void;
  onSplitAtPosition: (position: number) => void;
}

const SegmentSplitDialog: React.FC<SegmentSplitDialogProps> = ({
  open,
  segment,
  text,
  onClose,
  onSplitAtPosition,
}) => {
  if (!segment) return null;

  // Get all valid split positions (punctuation positions)
  const validPositions = getValidSplitPositions(
    segment.text ?? text.substring(segment.start, segment.end),
    segment.start
  );

  const handleSplit = (position: number) => {
    onSplitAtPosition(position);
    onClose();
  };

  // Get preview text around each punctuation position
  const getPreview = (position: number, char: string) => {
    const segmentRelativePos = position - segment.start;
    const segmentText = segment.text ?? text.substring(segment.start, segment.end);
    const start = Math.max(0, segmentRelativePos - 20);
    const end = Math.min(segmentText.length, segmentRelativePos + 20);
    const preview = segmentText.substring(start, end);
    const highlightPos = segmentRelativePos - start;
    
    return {
      before: preview.substring(0, highlightPos),
      char,
      after: preview.substring(highlightPos + 1),
    };
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Split Position</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
          Your cursor is not near punctuation. Please select a valid split position:
        </Typography>
        {validPositions.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>
            No punctuation found in this segment. Split at cursor position anyway?
          </Typography>
        ) : (
          <List sx={{ maxHeight: 400, overflow: "auto" }}>
            {validPositions.map(({ position, char }) => {
              const preview = getPreview(position, char);
              return (
                <ListItem key={position} disablePadding>
                  <ListItemButton onClick={() => handleSplit(position)}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Typography
                            component="span"
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}
                          >
                            {preview.before}
                          </Typography>
                          <Typography
                            component="span"
                            variant="body2"
                            sx={{
                              fontFamily: "monospace",
                              fontSize: "0.875rem",
                              fontWeight: "bold",
                              color: "#3B82F6",
                              backgroundColor: "rgba(59, 130, 246, 0.1)",
                              px: 0.5,
                              borderRadius: 0.5,
                            }}
                          >
                            {preview.char}
                          </Typography>
                          <Typography
                            component="span"
                            variant="body2"
                            sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}
                          >
                            {preview.after}
                          </Typography>
                        </Box>
                      }
                      secondary={`Position ${position - segment.start + 1} in segment`}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SegmentSplitDialog;

