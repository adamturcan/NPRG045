import React, { useState, useMemo, useCallback } from "react";
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
  type Theme,
  type SxProps,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { BOOKMARK_COLORS } from "../../../shared/constants/ui";

const BookmarkBar: React.FC<{
  translationLanguages: string[];
  activeTab: string;
  onTabClick: (tab: string) => void;
  onAddClick: (e: React.MouseEvent<HTMLElement>) => void;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSelectLanguage: (lang: string) => void;
  onDeleteTranslation: (lang: string) => void;
  onUpdateTranslation: (lang: string) => void;
  isUpdating: boolean;
  isDisabled?: boolean;
  languageOptions: { code: string; label: string }[];
  isLanguageListLoading: boolean;
}> = ({
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
  isDisabled = false,
  languageOptions,
  isLanguageListLoading = false,
}) => {
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [languageSearch, setLanguageSearch] = useState("");

  const filteredLanguageOptions = useMemo(() => {
    const query = languageSearch.trim().toLowerCase();
    if (!query) return languageOptions;

    return languageOptions.filter(({ code, label }) => 
      code.toLowerCase().includes(query) || label.toLowerCase().includes(query)
    );
  }, [languageOptions, languageSearch]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX + 2, mouseY: event.clientY - 6 });
  }, []);

  const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);

  const handleDelete = useCallback(() => {
    setDeleteDialogOpen(true);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleConfirmDelete = useCallback(() => {
    onDeleteTranslation(activeTab);
    setDeleteDialogOpen(false);
  }, [onDeleteTranslation, activeTab]);

  const handleCancelDelete = useCallback(() => setDeleteDialogOpen(false), []);

  const handleUpdate = useCallback(() => {
    onUpdateTranslation(activeTab);
    handleCloseContextMenu();
  }, [onUpdateTranslation, activeTab, handleCloseContextMenu]);

  const getTabStyles = useCallback((tabId: string, idx: number = 0, isOriginal: boolean = false): SxProps<Theme> => {
    const isActive = activeTab === tabId;
    const bgColor = isOriginal ? BOOKMARK_COLORS[0] : BOOKMARK_COLORS[(idx + 1) % BOOKMARK_COLORS.length];
    
    return {
      backgroundColor: bgColor,
      color: "#000",
      textTransform: "uppercase",
      
      opacity: isDisabled ? 0.4 : (isActive ? 1 : 0.7),
      pointerEvents: isDisabled ? "none" : "auto",
      cursor: isDisabled ? "not-allowed" : "pointer",
      
      position: "relative",
      transform: isActive && !isDisabled ? "translateY(-6px) scale(1.04)" : "translateY(0) scale(1)",
      boxShadow: isActive && !isDisabled ? "0 8px 18px rgba(15, 23, 42, 0.18), 0 0 0 2px rgba(33, 66, 108, 0.45)" : "none",
      zIndex: isActive ? 2 : 1,
      transition: "transform 150ms ease, box-shadow 180ms ease, opacity 120ms ease",
      borderRadius: "6px 6px 3px 3px",
      "&::after": isActive ? {
        content: '""',
        position: "absolute",
        left: "50%",
        bottom: "-8px", 
        transform: "translateX(-50%)",
        width: "12px",  
        height: "8px",  
        backgroundColor: bgColor,
        clipPath: "polygon(50% 100%, 0 0, 100% 0)",
        boxShadow: "0 4px 10px rgba(15, 23, 42, 0.15)",
      } : undefined,
    };
  }, [activeTab, isDisabled]);

  return (
    <Box sx={{ mb: -2.2, ml: 4, display: "flex", gap: 0.5, alignItems: "center" }}>
      
      <Button
        variant="contained"
        size="small"
        onClick={() => onTabClick("original")}
        sx={getTabStyles("original", 0, true)}
      >
        Original
      </Button>

      {translationLanguages.map((lang: string, idx: number) => (
        <Button
          key={lang}
          variant="contained"
          size="small"
          component="div"
          onClick={() => onTabClick(lang)}
          onContextMenu={activeTab === lang && !isUpdating ? handleContextMenu : undefined}
          sx={[
            ...(Array.isArray(getTabStyles(lang, idx, false)) 
              ? (getTabStyles(lang, idx, false) as SxProps<Theme>[]) 
              : [getTabStyles(lang, idx, false)]),
            {
              pr: activeTab === lang ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              cursor: "pointer",
            }
          ]}
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
              sx={{ color: "#000", p: 0.25, minWidth: "auto", margin: 0, "&:hover": { backgroundColor: "rgba(0,0,0,0.1)" } }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
        </Button>
      ))}

<Tooltip title={isDisabled ? "Please wait..." : "Add translation"}>
        <span> 
          <IconButton 
            onClick={onAddClick} 
            size="small" 
            disabled={isDisabled}
            sx={{
              ml: 0.5,
              width: 28,
              height: 28,
              backgroundColor: isDisabled ? "rgba(255, 255, 255, 0.1)" : "#DDD1A0", 
              color: isDisabled ? "rgba(255, 255, 255, 0.3)" : "#1a1a1a", 
              boxShadow: isDisabled ? "none" : "0 2px 6px rgba(0,0,0,0.15)",
              border: "none",
              transition: "all 0.2s ease",
              "&:hover": { 
                backgroundColor: "#EFE5C3",
                transform: "translateY(-2px) scale(1.05)",
                boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
              },
              "&:focus-visible": {
                outline: "none",
                boxShadow: "0 0 0 2px rgba(221, 209, 160, 0.6)",
              },
              "&:active": { 
                transform: "translateY(0) scale(0.95)",
                boxShadow: "none",
              },
            }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={onClose}
        PaperProps={{ sx: { maxHeight: 280, overflowY: "auto", minWidth: 260 } }}
        MenuListProps={{ sx: { py: 0 } }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eee' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search language..."
            value={languageSearch}
            autoFocus
            onChange={(event) => setLanguageSearch(event.target.value)}
            variant="standard"
            InputProps={{ disableUnderline: true }}
            sx={{ backgroundColor: "#fff", borderRadius: 1, px: 1, py: 0.5 }}
          />
        </Box>
        
        <Box sx={{ px: 1, pb: 1, maxHeight: 220, overflowY: "auto" }}>
            {isLanguageListLoading ? (
              <MenuItem disabled>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={16} thickness={4} />
                  Loading languages…
                </Box>
              </MenuItem>
            ) : filteredLanguageOptions.length > 0 ? (
              filteredLanguageOptions.map(({ code, label }: { code: string; label: string }) => (
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
      </Menu>

      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        <MenuItem onClick={handleUpdate}>Update Translation</MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>Delete Translation</MenuItem>
      </Menu>

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Delete Translation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the "{activeTab}" translation? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="primary">Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default React.memo(BookmarkBar);