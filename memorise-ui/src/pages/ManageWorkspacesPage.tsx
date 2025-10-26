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

const COLORS = {
  text: "#0F172A",
  textSub: "#334155",
  border: "#E2E8F0",
  borderSoft: "#CBD5E1",
  hover: "#F8FAFC",
  brand: "#1D4ED8",
  brandHover: "#1E40AF",
  danger: "#DC2626",
  dangerHover: "#B91C1C",
  titleGold: "#DDD1A0", // memorise gold
};
const Transition = React.forwardRef(function Transition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        px: { xs: 2, sm: 4 },
        py: 3,
        width: "100%",
        height: "100%",
        color: COLORS.text,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Title with gold color */}
      <Typography
        variant="h5"
        fontWeight={900}
        mb={2}
        ml={{ xs: 0, sm: 3 }}
        sx={{
          color: COLORS.titleGold,
          textTransform: "uppercase",
          letterSpacing: 1,
          textShadow: "0 2px 4px rgba(0,0,0,0.35)",
        }}
      >
        Manage Workspaces
      </Typography>

      <TableContainer
        component={Paper}
        sx={{
          maxHeight: "85vh",
          overflow: "hidden",
          ml: { xs: 0, sm: 2 },
          borderRadius: 3,
          border: `1px solid ${COLORS.border}`,
          background: "#FFFFFF",
          backdropFilter: "blur(6px)",
          // 💡 stronger shadow like login card
          boxShadow: "0 14px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.25)",
        }}
      >
        <Box
          sx={{
            maxHeight: "85vh",
            overflowY: "auto",
            overflowX: "hidden",
            p: 2,
            "&::-webkit-scrollbar-thumb": {
              background: COLORS.borderSoft,
              borderRadius: 8,
            },
          }}
        >
          <Table stickyHeader>
            <TableHead
              sx={{
                "& .MuiTableCell-head": {
                  backgroundColor: "#FFFFFF", // solid white (no translucency)
                  color: COLORS.text,
                  fontWeight: 700,
                  borderBottom: `1px solid ${COLORS.border}`,
                },
              }}
            >
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {workspaces.map((ws) => (
                <TableRow
                  key={ws.id}
                  hover
                  sx={{
                    "&:hover": { backgroundColor: COLORS.hover },
                    "& .MuiTableCell-root": {
                      borderBottom: `1px solid ${COLORS.border}`,
                    },
                  }}
                >
                  <TableCell sx={{ width: "40%", color: COLORS.text }}>
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
                          sx={{ color: COLORS.brand }}
                        >
                          <CheckIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={cancelEdit}
                          sx={{ color: COLORS.textSub }}
                        >
                          <CloseIcon />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Typography
                          sx={{
                            color: COLORS.text,
                            fontWeight: ws.isTemporary ? 600 : 800,
                            fontStyle: ws.isTemporary ? "italic" : "normal",
                          }}
                        >
                          {ws.name}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => startEdit(ws)}
                          sx={{ color: COLORS.brand }}
                          aria-label="Rename"
                        >
                          <EditNoteIcon />
                        </IconButton>
                      </Box>
                    )}
                  </TableCell>

                  <TableCell sx={{ color: COLORS.textSub }}>{ws.id}</TableCell>

                  <TableCell sx={{ width: "20%", color: COLORS.textSub }}>
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
                        color: COLORS.text,
                        borderColor: COLORS.borderSoft,
                        textTransform: "uppercase",
                        fontWeight: 700,
                        "&:hover": {
                          backgroundColor: "#FFFFFF",
                          borderColor: COLORS.textSub,
                        },
                      }}
                    >
                      Open
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => openDeleteDialog(ws.id, ws.name)}
                      sx={{ color: COLORS.danger }}
                      aria-label="Delete"
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

      {/* Delete Confirmation */}
      <Dialog
        open={confirmOpen}
        TransitionComponent={Transition}
        keepMounted
        onClose={closeDeleteDialog}
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `1px solid ${COLORS.border}`,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.9) 100%)",
            backdropFilter: "blur(6px)",
            boxShadow:
              "0 2px 4px rgba(15,23,42,0.06), 0 20px 48px rgba(15,23,42,0.22)",
          },
        }}
      >
        <DialogTitle sx={{ color: COLORS.text, fontWeight: 900 }}>
          Delete workspace?
        </DialogTitle>
        <DialogContent sx={{ color: COLORS.textSub }}>
          {toDelete ? (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="body1" sx={{ mb: 0.5 }}>
                You’re about to delete:
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 800, color: COLORS.text }}
              >
                {toDelete.name}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
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
            variant="outlined"
            sx={{
              color: COLORS.text,
              borderColor: COLORS.borderSoft,
              textTransform: "uppercase",
              fontWeight: 800,
              "&:hover": {
                backgroundColor: "#FFFFFF",
                borderColor: COLORS.textSub,
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            variant="contained"
            sx={{
              textTransform: "uppercase",
              fontWeight: 900,
              bgcolor: COLORS.danger,
              "&:hover": { bgcolor: COLORS.dangerHover },
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
