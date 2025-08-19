import React from "react";
import {
  Box,
  Paper,
  Typography,
  Chip,
  Divider,
  Select,
  MenuItem,
  IconButton,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";

// Consider moving this to a shared file later (e.g. src/theme/entities.ts)
export const ENTITY_COLORS: Record<string, string> = {
  PERS: "#C2185B",
  DATE: "#1976D2",
  LOC: "#388E3C",
  ORG: "#F57C00",
  CAMP: "#6A1B9A",
};

interface Props {
  categories: string[];
  selectedCategories: string[];
  onChangeSelected: (cats: string[]) => void;
  onAddSelection: (category: string) => void;
  children?: React.ReactNode;
}

const NotationsPanel: React.FC<Props> = ({
  categories,
  selectedCategories,
  onChangeSelected,
  onAddSelection,
  children,
}) => {
  const [selectedCategory, setSelectedCategory] = React.useState("");

  const pickColor = (c: string) => ENTITY_COLORS[c] ?? "#9CA3AF";
  const selectedColor = selectedCategory
    ? pickColor(selectedCategory)
    : "#93ACD8";

  return (
    <Paper
      elevation={0}
      sx={{
        height: "100%", // fill the available panel space
        minHeight: 0,
        p: 2,
        borderRadius: 3,
        border: "1px solid #BFD0E8",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.45) 100%)",
        backdropFilter: "blur(6px)",
        boxShadow:
          "0 1px 0 rgba(12, 24, 38, 0.04), 0 6px 16px rgba(12, 24, 38, 0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        overflow: "hidden",
      }}
    >
      {/* Section 1: highlight existing notations */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {categories.map((c) => {
          const color = pickColor(c);
          const selected = selectedCategories.includes(c);
          return (
            <Chip
              key={c}
              label={c}
              onClick={() =>
                selected
                  ? onChangeSelected(selectedCategories.filter((x) => x !== c))
                  : onChangeSelected([...selectedCategories, c])
              }
              sx={{
                fontWeight: 600,
                border: `2px solid ${color}`,
                color: selected ? "#fff" : color,
                backgroundColor: selected ? color : "transparent",
              }}
            />
          );
        })}
      </Box>

      <Typography
        variant="body2"
        sx={{ color: "#5A6A7A", fontSize: "0.85rem" }}
      >
        Select categories above to highlight existing notations.
      </Typography>

      <Divider />

      {/* Section 2: add a new notation from current text selection */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          displayEmpty
          size="small"
          sx={{
            flex: 1,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: selectedColor,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: selectedColor,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: selectedColor,
              boxShadow: `0 0 0 2px ${selectedColor}22`,
            },
          }}
        >
          <MenuItem value="">
            <em>Select category</em>
          </MenuItem>
          {categories.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </Select>

        <IconButton
          onClick={() => {
            if (selectedCategory) {
              onAddSelection(selectedCategory);
              setSelectedCategory("");
            }
          }}
          sx={{
            border: `2px solid ${selectedColor}`,
            color: selectedColor,
            bgcolor: `${selectedColor}14`,
            "&:hover": { bgcolor: `${selectedColor}22` },
          }}
          aria-label="Add notation from selected text"
        >
          <AddCircleOutlineIcon />
        </IconButton>
      </Box>

      <Typography
        variant="body2"
        sx={{ color: "#5A6A7A", fontSize: "0.85rem" }}
      >
        Use the dropdown to add a new notation from your text selection.
      </Typography>

      <Divider />

      {/* Scrollable content area if you add details later */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{children}</Box>
    </Paper>
  );
};

export default NotationsPanel;
