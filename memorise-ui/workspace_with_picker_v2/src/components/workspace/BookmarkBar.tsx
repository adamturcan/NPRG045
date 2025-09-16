import React from "react";
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { BOOKMARK_COLORS, LANGUAGES } from "../../constants/ui";

interface Props {
  bookmarks: string[];
  onAddClick: (e: React.MouseEvent<HTMLElement>) => void;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSelect: (lang: string) => void;
}

const BookmarkBar: React.FC<Props> = ({
  bookmarks,
  onAddClick,
  anchorEl,
  onClose,
  onSelect,
}) => {
  return (
    <Box
      sx={{ mb: -2.2, ml: 1, display: "flex", gap: 0.5, alignItems: "center" }}
    >
      <Button
        variant="contained"
        size="small"
        sx={{
          backgroundColor: BOOKMARK_COLORS[0],
          color: "#000",
          textTransform: "uppercase",
        }}
      >
        Original
      </Button>

      {bookmarks.map((lang, idx) => (
        <Button
          key={lang}
          variant="contained"
          size="small"
          sx={{
            backgroundColor:
              BOOKMARK_COLORS[(idx + 1) % BOOKMARK_COLORS.length],
            color: "#000",
            textTransform: "uppercase",
          }}
        >
          {lang}
        </Button>
      ))}

      <Tooltip title="Add translation">
        <IconButton onClick={onAddClick} size="small" sx={{ color: "#DDD1A0" }}>
          <AddIcon />
        </IconButton>
      </Tooltip>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
        {LANGUAGES.map((lang) => (
          <MenuItem key={lang} onClick={() => onSelect(lang)}>
            {lang}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default BookmarkBar;
