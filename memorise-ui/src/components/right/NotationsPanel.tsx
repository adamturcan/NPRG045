import React, { type PropsWithChildren } from "react";
import { Box, Chip } from "@mui/material";

type CategoryBubbleProps = {
  categories: string[];
  selectedCategories: string[]; // ← multi-select
  onChangeSelected: (cats: string[]) => void; // ← callback
};

type Props = PropsWithChildren<CategoryBubbleProps>;

const CATEGORY_COLORS: Record<string, string> = {
  PERS: "#DDA0AF",
  DATE: "#A0B8DD",
  LOC: "#CCFF90",
  ORG: "#FFD180",
  CAMP: "#80D8FF",
};

const hexToRgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const NotationsPanel: React.FC<Props> = ({
  categories,
  selectedCategories,
  onChangeSelected,
  children,
}) => {
  const toggle = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      onChangeSelected(selectedCategories.filter((c) => c !== cat));
    } else {
      onChangeSelected([...selectedCategories, cat]);
    }
  };

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: "16px",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.55) 100%)",
        backdropFilter: "blur(6px)",
        overflow: "hidden",
      }}
    >
      {/* Category chips */}
      <Box
        sx={{
          p: 1,
          display: "flex",
          flexWrap: "wrap",
          gap: 0.5,
          borderBottom: "1px solid #E2E8F0",
          flexShrink: 0,
          background: "transparent",
        }}
      >
        {categories.map((cat) => {
          const base = CATEGORY_COLORS[cat] ?? "#EDE8D4";
          const isOn = selectedCategories.includes(cat);
          const bg = isOn ? hexToRgba(base, 0.35) : hexToRgba(base, 0.18);
          const hover = isOn ? hexToRgba(base, 0.45) : hexToRgba(base, 0.28);
          const border = hexToRgba(base, 0.55);

          return (
            <Chip
              key={cat}
              label={cat}
              onClick={() => toggle(cat)}
              sx={{
                fontWeight: 700,
                fontSize: 12,
                color: "#1E293B",
                backgroundColor: bg,
                border: `1px solid ${border}`,
                "&:hover": { backgroundColor: hover },
                borderRadius: "999px",
              }}
            />
          );
        })}
      </Box>

      {/* Scrollable content */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          p: 1,
          background: "transparent",
          "& .MuiTypography-root": {
            wordBreak: "break-word",
            whiteSpace: "normal",
          },
          "&::-webkit-scrollbar": { width: 10 },
          "&::-webkit-scrollbar-thumb": {
            background: "#C7D5EA",
            borderRadius: 10,
            border: "3px solid transparent",
            backgroundClip: "content-box",
          },
          "&::-webkit-scrollbar-thumb:hover": { background: "#B3C6E4" },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default NotationsPanel;
