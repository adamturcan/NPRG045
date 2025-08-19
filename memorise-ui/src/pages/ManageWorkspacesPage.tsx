import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slide,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditNoteIcon from "@mui/icons-material/EditNote";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import type { TransitionProps } from "@mui/material/transitions";
import type { Workspace } from "../types/Workspace";

interface Props {
  workspaces: Workspace[];
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>;
}

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const ManageWorkspacesPage: React.FC<Props> = ({
  workspaces,
  setWorkspaces,
}) => {
  const navigate = useNavigate();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  // Pretty delete dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(
    null
  );

  const handleOpen = (id: string) => navigate(`/workspace/${id}`);

  const openDeleteDialog = (id: string, name: string) => {
    setToDelete({ id, name });
    setConfirmOpen(true);
  };
  const closeDeleteDialog = () => {
    setConfirmOpen(false);
    setToDelete(null);
  };
  const confirmDelete = () => {
    if (!toDelete) return;
    setWorkspaces((prev) => prev.filter((w) => w.id !== toDelete.id));
    // Legacy per-workspace cache (safe to call even if unused)
    localStorage.removeItem(`workspace-content:${toDelete.id}`);
    closeDeleteDialog();
  };

  const startEdit = (ws: Workspace) => {
    setEditingId(ws.id);
    setDraftName(ws.name);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraftName("");
  };
  const saveEdit = () => {
    if (!editingId) return;
    const name = draftName.trim();
    if (!name) return;
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === editingId ? { ...w, name } : w))
    );
    setEditingId(null);
    setDraftName("");
  };

  return (
    <Box
      sx={{
        px: 4,
        py: 3,
        width: "100%",
        height: "100%",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <Typography
        variant="h5"
        fontWeight={700}
        mb={2}
        ml={3}
        sx={{ color: "#21426C", textTransform: "uppercase", letterSpacing: 1 }}
      >
        Manage Workspaces
      </Typography>

      <TableContainer
        component={Paper}
        sx={{
          maxHeight: "85vh",
          overflow: "hidden",
          ml: { xs: 0, sm: 2 },
          borderRadius: "16px",
          border: "1px solid #BFD0E8",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.45) 100%)",
          backdropFilter: "blur(6px)",
          boxShadow:
            "0 1px 0 rgba(12, 24, 38, 0.04), 0 6px 16px rgba(12, 24, 38, 0.06)",
        }}
      >
        <Box
          sx={{
            maxHeight: "85vh",
            overflowY: "auto",
            overflowX: "hidden",
            p: 2,
          }}
        >
          <Table stickyHeader>
            <TableHead
              sx={{
                "& .MuiTableCell-head": {
                  backgroundColor: "transparent !important",
                },
              }}
            >
              <TableRow>
                <TableCell sx={{ color: "#21426C", fontWeight: 700 }}>
                  Name
                </TableCell>
                <TableCell sx={{ color: "#21426C", fontWeight: 700 }}>
                  ID
                </TableCell>
                <TableCell sx={{ color: "#21426C", fontWeight: 700 }}>
                  Last Updated
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ color: "#21426C", fontWeight: 700 }}
                >
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workspaces.map((ws) => (
                <TableRow
                  key={ws.id}
                  hover
                  sx={{
                    "&:hover": { backgroundColor: "rgba(160,184,221,0.10)" },
                  }}
                >
                  <TableCell sx={{ color: "#21426C", width: "40%" }}>
                    {editingId === ws.id ? (
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <TextField
                          size="small"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveEdit();
                            }
                          }}
                          autoFocus
                        />
                        <IconButton
                          size="small"
                          onClick={saveEdit}
                          color="primary"
                        >
                          <CheckIcon />
                        </IconButton>
                        <IconButton size="small" onClick={cancelEdit}>
                          <CloseIcon />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Typography
                          sx={{
                            color: "#21426C",
                            fontWeight: ws.isTemporary ? 500 : 700,
                            fontStyle: ws.isTemporary ? "italic" : "normal",
                          }}
                        >
                          {ws.name}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => startEdit(ws)}
                          sx={{ color: "#1976D2" }}
                        >
                          <EditNoteIcon />
                        </IconButton>
                      </Box>
                    )}
                  </TableCell>

                  <TableCell sx={{ color: "#21426C" }}>{ws.id}</TableCell>
                  <TableCell sx={{ color: "#21426C", width: "20%" }}>
                    {ws.updatedAt
                      ? new Date(ws.updatedAt).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleOpen(ws.id)}
                      sx={{
                        mr: 1,
                        color: "#21426C",
                        borderColor: "#BFD0E8",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        "&:hover": {
                          backgroundColor: "rgba(160,184,221,0.15)",
                          borderColor: "#93ACD8",
                        },
                      }}
                    >
                      Open
                    </Button>
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => openDeleteDialog(ws.id, ws.name)}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </TableContainer>

      {/* Modern Delete Confirmation */}
      <Dialog
        open={confirmOpen}
        TransitionComponent={Transition}
        keepMounted
        onClose={closeDeleteDialog}
        PaperProps={{
          sx: {
            borderRadius: "16px",
            border: "1px solid #BFD0E8",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.75) 100%)",
            backdropFilter: "blur(6px)",
            boxShadow:
              "0 1px 0 rgba(12, 24, 38, 0.04), 0 12px 28px rgba(12, 24, 38, 0.12)",
          },
        }}
      >
        <DialogTitle sx={{ color: "#1E293B", fontWeight: 800 }}>
          Delete workspace?
        </DialogTitle>
        <DialogContent sx={{ color: "#334155" }}>
          {toDelete ? (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="body1" sx={{ mb: 0.5 }}>
                You’re about to delete:
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, color: "#21426C" }}
              >
                {toDelete.name}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                ID: {toDelete.id}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1.5 }}>
                This action can’t be undone.
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 2.25 }}>
          <Button
            onClick={closeDeleteDialog}
            sx={{
              color: "#21426C",
              borderColor: "#BFD0E8",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            variant="contained"
            sx={{
              textTransform: "uppercase",
              fontWeight: 800,
              bgcolor: "#E53935",
              "&:hover": { bgcolor: "#C62828" },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManageWorkspacesPage;
