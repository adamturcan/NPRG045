import React, { useState, useEffect } from "react";
import {
  Button,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
} from "@mui/material";

import type { NerSpan } from "../../../types/NotationEditor";
import { ENTITY_COLORS, COLORS } from "../../../shared/constants/notationEditor";

interface Props {
  open: boolean;
  spans: NerSpan[];
  spanTexts: Map<string, string>; // Map of span key to text
  onConfirm: (selectedSpans: NerSpan[]) => void;
  onCancel: () => void;
}

const getEntityColor = (entity: string) => ENTITY_COLORS[entity] ?? COLORS.borderFocus;

const keyOfSpan = (span: NerSpan): string => `${span.start}:${span.end}:${span.entity}`;

const UndoAffectedSpansDialog: React.FC<Props> = ({
  open,
  spans,
  spanTexts,
  onConfirm,
  onCancel,
}) => {
  // Track which spans are selected for deletion
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Initialize with all spans selected when dialog opens or spans change
  useEffect(() => {
    if (open && spans.length > 0) {
      setSelectedKeys(new Set(spans.map(keyOfSpan)));
    }
  }, [open, spans]);

  const handleToggleSpan = (span: NerSpan) => {
    const key = keyOfSpan(span);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedKeys(new Set(spans.map(keyOfSpan)));
  };

  const handleDeselectAll = () => {
    setSelectedKeys(new Set());
  };

  const handleConfirm = () => {
    const selectedSpans = spans.filter((span) => selectedKeys.has(keyOfSpan(span)));
    onConfirm(selectedSpans);
  };

  const selectedCount = selectedKeys.size;
  const totalCount = spans.length;

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          onCancel();
        }
      }}
      aria-labelledby="undo-affected-spans-dialog-title"
      aria-describedby="undo-affected-spans-dialog-description"
      maxWidth="md"
      fullWidth
    >
      <DialogTitle id="undo-affected-spans-dialog-title">
        Undo will affect annotations
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="undo-affected-spans-dialog-description" sx={{ mb: 2 }}>
          Undoing this action will remove or modify text that contains {totalCount} annotation{totalCount !== 1 ? "s" : ""}.
          These annotations will be deleted. You can choose which ones to keep before proceeding with undo.
        </DialogContentText>

        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Button size="small" onClick={handleSelectAll}>
            Select all
          </Button>
          <Button size="small" onClick={handleDeselectAll}>
            Deselect all
          </Button>
          <Typography variant="body2" sx={{ alignSelf: "center", ml: "auto" }}>
            {selectedCount} of {totalCount} selected
          </Typography>
        </Stack>

        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 50 }}>
                  <Checkbox
                    indeterminate={selectedCount > 0 && selectedCount < totalCount}
                    checked={totalCount > 0 && selectedCount === totalCount}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleSelectAll();
                      } else {
                        handleDeselectAll();
                      }
                    }}
                  />
                </TableCell>
                <TableCell>Text</TableCell>
                <TableCell sx={{ width: 150 }}>Entity</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {spans.map((span) => {
                const key = keyOfSpan(span);
                const isSelected = selectedKeys.has(key);
                const text = spanTexts.get(key) || "(text unavailable)";
                const entityColor = getEntityColor(span.entity);

                return (
                  <TableRow
                    key={key}
                    hover
                    onClick={() => handleToggleSpan(span)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleToggleSpan(span)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: "DM Mono, monospace",
                          color: isSelected ? "text.primary" : "text.secondary",
                        }}
                      >
                        "{text}"
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={span.entity}
                        size="small"
                        sx={{
                          backgroundColor: entityColor,
                          color: "#fff",
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onCancel} color="primary">
          Cancel Undo
        </Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={selectedCount === 0}
        >
          Undo {selectedCount > 0 && `(${selectedCount} annotation${selectedCount !== 1 ? "s" : ""} will be deleted)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UndoAffectedSpansDialog;

