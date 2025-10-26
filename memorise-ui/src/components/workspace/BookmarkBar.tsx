import React, { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { BOOKMARK_COLORS, LANGUAGES } from "../../constants/ui";

interface Props {
  translationLanguages: string[];
  activeTab: string;
  onTabClick: (tabId: string) => void;
  onAddClick: (e: React.MouseEvent<HTMLElement>) => void;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSelectLanguage: (lang: string) => void;
  onDeleteTranslation: (lang: string) => void;
  onUpdateTranslation: (lang: string) => void;
}

const BookmarkBar: React.FC<Props> = ({
  translationLanguages,
  activeTab,
  onTabClick,
  onAddClick,
  anchorEl,
  onClose,
  onSelectLanguage,
  onDeleteTranslation,
  onUpdateTranslation,
}) => {
  // State for context menu on active translation tab
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);

  // State for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    handleCloseContextMenu();
  };

  const handleConfirmDelete = () => {
    onDeleteTranslation(activeTab);
    setDeleteDialogOpen(false);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
  };

  const handleUpdate = () => {
    onUpdateTranslation(activeTab);
    handleCloseContextMenu();
  };
  return (
    <Box
      sx={{ mb: -2.2, ml: 1, display: "flex", gap: 0.5, alignItems: "center" }}
    >
      <Button
        variant="contained"
        size="small"
        onClick={() => onTabClick("original")}
        sx={{
          backgroundColor: BOOKMARK_COLORS[0],
          color: "#000",
          textTransform: "uppercase",
          opacity: activeTab === "original" ? 1 : 0.7,
        }}
      >
        Original
      </Button>

      {translationLanguages.map((lang, idx) => (
        <Box
          key={lang}
          sx={{
            display: "flex",
            alignItems: "center",
            position: "relative",
          }}
        >
          <Button
            variant="contained"
            size="small"
            onClick={() => onTabClick(lang)}
            onContextMenu={activeTab === lang ? handleContextMenu : undefined}
            sx={{
              backgroundColor:
                BOOKMARK_COLORS[(idx + 1) % BOOKMARK_COLORS.length],
              color: "#000",
              textTransform: "uppercase",
              opacity: activeTab === lang ? 1 : 0.7,
              pr: activeTab === lang ? 0.5 : 1,
            }}
          >
            {lang}
            {activeTab === lang && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e);
                }}
                sx={{
                  color: "#000",
                  ml: 0.5,
                  p: 0.25,
                  minWidth: "auto",
                  "&:hover": {
                    backgroundColor: "rgba(0,0,0,0.1)",
                  },
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}
          </Button>
        </Box>
      ))}

      <Tooltip title="Add translation">
        <IconButton onClick={onAddClick} size="small" sx={{ color: "#DDD1A0" }}>
          <AddIcon />
        </IconButton>
      </Tooltip>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
        {LANGUAGES.map((lang) => (
          <MenuItem key={lang} onClick={() => onSelectLanguage(lang)}>
            {lang}
          </MenuItem>
        ))}
      </Menu>

      {/* Context menu for active translation tab */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleUpdate}>
          Update Translation
        </MenuItem>
        <MenuItem 
          onClick={handleDelete}
          sx={{ color: "error.main" }}
        >
          Delete Translation
        </MenuItem>
      </Menu>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Translation
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete the "{activeTab}" translation? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BookmarkBar;
