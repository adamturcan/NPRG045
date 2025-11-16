import React from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";

import type { NerSpan } from "../../../types/NotationEditor";
import { ENTITY_COLORS, COLORS, hexToRgba } from "../../../shared/constants/notationEditor";

interface Props {
  open: boolean;
  span: NerSpan | null;
  spanText?: string; // Optional text snippet to display
  onConfirm: () => void;
  onCancel: () => void;
}

const getEntityColor = (entity: string) => ENTITY_COLORS[entity] ?? COLORS.borderFocus;

const DeletionConfirmationDialog: React.FC<Props> = ({
  open,
  span,
  spanText,
  onConfirm,
  onCancel,
}) => {
  if (!span) return null;

  const entityColor = getEntityColor(span.entity);

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          onCancel();
        }
      }}
      aria-labelledby="deletion-confirmation-dialog-title"
      aria-describedby="deletion-confirmation-dialog-description"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="deletion-confirmation-dialog-title">
        Delete annotation
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="deletion-confirmation-dialog-description" sx={{ mb: 3 }}>
          Proceeding with deletion will remove this span. This action cannot be undone.
        </DialogContentText>

        <Box
          sx={{
            borderRadius: 2,
            border: `1px solid ${hexToRgba(entityColor, 0.7)}`,
            p: 2,
            backgroundColor: hexToRgba(entityColor, 0.1),
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Annotation to delete
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography 
              variant="body1" 
              sx={{ 
                fontFamily: "DM Mono, monospace", 
                flexGrow: 1,
                minWidth: 0, // Allow text to shrink if needed
              }}
            >
              {spanText ? `"${spanText}"` : "(text unavailable)"}
            </Typography>
            <Chip
              label={span.entity}
              size="small"
              sx={{
                backgroundColor: entityColor,
                color: "#fff",
              }}
            />
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onCancel} color="primary">
          Cancel
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeletionConfirmationDialog;

