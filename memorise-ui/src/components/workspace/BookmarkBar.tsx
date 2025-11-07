import React, { useState, useMemo } from "react";
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
  CircularProgress,
  TextField,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { BOOKMARK_COLORS } from "../../constants/ui";

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
  isUpdating?: boolean;
  languageOptions: { code: string; label: string }[];
  isLanguageListLoading?: boolean;
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
  isUpdating = false,
  languageOptions,
  isLanguageListLoading = false,
}) => {
  // State for context menu on active translation tab
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);

  // State for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [languageSearch, setLanguageSearch] = useState("");

  const filteredLanguageOptions = useMemo(() => {
    const query = languageSearch.trim().toLowerCase();
    if (!query) {
      return languageOptions;
    }

    return languageOptions.filter(({ code, label }) => {
      const lowerCode = code.toLowerCase();
      const lowerLabel = label.toLowerCase();
      return lowerCode.includes(query) || lowerLabel.includes(query);
    });
  }, [languageOptions, languageSearch]);

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
          position: "relative",
          transform:
            activeTab === "original"
              ? "translateY(-6px) scale(1.04)"
              : "translateY(0) scale(1)",
          boxShadow:
            activeTab === "original"
              ? "0 8px 18px rgba(15, 23, 42, 0.18), 0 0 0 2px rgba(33, 66, 108, 0.45)"
              : "none",
          zIndex: activeTab === "original" ? 2 : 1,
          transition:
            "transform 150ms ease, box-shadow 180ms ease, opacity 120ms ease",
          borderRadius: "6px 6px 3px 3px",
          "&::after":
            activeTab === "original"
              ? {
                  content: '""',
                  position: "absolute",
                  left: "50%",
                  bottom: -8,
                  transform: "translateX(-50%)",
                  width: 12,
                  height: 8,
                  backgroundColor: BOOKMARK_COLORS[0],
                  clipPath: "polygon(50% 100%, 0 0, 100% 0)",
                  boxShadow: "0 4px 10px rgba(15, 23, 42, 0.15)",
                }
              : undefined,
        }}
      >
        Original
      </Button>

      {translationLanguages.map((lang, idx) => (
        <Button
          key={lang}
          variant="contained"
          size="small"
          component="div"
          onClick={() => onTabClick(lang)}
          onContextMenu={activeTab === lang && !isUpdating ? handleContextMenu : undefined}
          sx={{
            backgroundColor:
              BOOKMARK_COLORS[(idx + 1) % BOOKMARK_COLORS.length],
            color: "#000",
            textTransform: "uppercase",
            opacity: activeTab === lang ? 1 : 0.7,
            pr: activeTab === lang ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            cursor: "pointer",
            position: "relative",
            transform:
              activeTab === lang
                ? "translateY(-6px) scale(1.04)"
                : "translateY(0) scale(1)",
            boxShadow:
              activeTab === lang
                ? "0 8px 18px rgba(15, 23, 42, 0.18), 0 0 0 2px rgba(33, 66, 108, 0.45)"
                : "none",
            zIndex: activeTab === lang ? 2 : 1,
            borderRadius: "6px 6px 3px 3px",
            transition:
              "transform 150ms ease, box-shadow 180ms ease, opacity 120ms ease",
            "&::after":
              activeTab === lang
                ? {
                    content: '""',
                    position: "absolute",
                    left: "50%",
                    bottom: -8,
                    transform: "translateX(-50%)",
                    width: 12,
                    height: 8,
                    backgroundColor:
                      BOOKMARK_COLORS[(idx + 1) % BOOKMARK_COLORS.length],
                    clipPath: "polygon(50% 100%, 0 0, 100% 0)",
                    boxShadow: "0 4px 10px rgba(15, 23, 42, 0.15)",
                  }
                : undefined,
          }}
        >
          {lang}
          {activeTab === lang && !isUpdating && (
            <IconButton
              size="small"
              component="div"
              onClick={(e) => {
                e.stopPropagation();
                handleContextMenu(e);
              }}
              sx={{
                color: "#000",
                p: 0.25,
                minWidth: "auto",
                margin: 0,
                "&:hover": {
                  backgroundColor: "rgba(0,0,0,0.1)",
                },
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
        </Button>
      ))}

      <Tooltip title="Add translation">
        <IconButton
          onClick={onAddClick}
          size="small"
          disableRipple
          disableFocusRipple
          disableTouchRipple
          sx={{
            color: "#DDD1A0",
            borderRadius: "50%",
            border: "none",
            outline: "none",
            "&:focus-visible": {
              outline: "none",
              boxShadow: "0 0 0 2px rgba(33, 66, 108, 0.35)",
            },
            "&:focus": {
              outline: "none",
            },
            "&:active": {
              backgroundColor: "rgba(221, 209, 160, 0.2)",
            },
          }}
        >
          <AddIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={onClose}
        PaperProps={{
          sx: {
            maxHeight: 280,
            overflowY: "auto",
            minWidth: 260,
          },
        }}
        MenuListProps={{
          sx: {
            py: 0,
          },
        }}
      >
        <MenuItem disableRipple disableGutters sx={{ px: 2, py: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search language..."
            value={languageSearch}
            autoFocus
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setLanguageSearch(event.target.value)}
            inputProps={{
              onKeyDown: (event) => {
                // Prevent menu closure on Enter when typing search
                event.stopPropagation();
              },
            }}
            variant="standard"
            InputProps={{ disableUnderline: true }}
            sx={{
              backgroundColor: "#fff",
              borderRadius: 1,
              px: 1,
              py: 0.5,
            }}
          />
        </MenuItem>
        <Box sx={{ px: 1, pb: 1 }}>
          <Box
            sx={{
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {isLanguageListLoading ? (
              <MenuItem disabled>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={16} thickness={4} />
                  Loading languages…
                </Box>
              </MenuItem>
            ) : filteredLanguageOptions.length > 0 ? (
              filteredLanguageOptions.map(({ code, label }) => (
                <MenuItem key={code} onClick={() => onSelectLanguage(code)}>
                  <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ textTransform: "uppercase", fontWeight: 600 }}>{code}</span>
                    <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{label}</span>
                  </Box>
                </MenuItem>
              ))
            ) : (
              <MenuItem disabled>No matching languages</MenuItem>
            )}
          </Box>
        </Box>
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
