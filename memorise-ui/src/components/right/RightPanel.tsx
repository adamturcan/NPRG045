import React, { useState } from "react";
import { Box, ToggleButton, ToggleButtonGroup, Paper } from "@mui/material";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import BubbleChartIcon from "@mui/icons-material/BubbleChart";
import TagTable from "../tags/TagTable";
import NotationsPanel from "./NotationsPanel";

export type TagRow = { name: string; source: "api" | "user" };

export type NotationsProps = {
  categories: string[];
  selectedCategories: string[];
  onChangeSelected: (cats: string[]) => void;
  onAddSelection: (category: string) => void; // independent action
};

interface Props {
  tags: TagRow[];
  onDeleteTag: (name: string) => void;
  tagInputField: React.ReactNode;

  notationsProps?: NotationsProps;
}

const RightPanel: React.FC<Props> = ({
  tags,
  onDeleteTag,
  tagInputField,

  notationsProps,
}) => {
  const [panel, setPanel] = useState<"tags" | "notes">("tags");

  return (
    <Box
      sx={{
        width: 300,
        height: "100%",
        maxHeight: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        bgcolor: "transparent",
        flexShrink: 0,
      }}
    >
      {/* Switcher */}
      <Paper
        elevation={0}
        sx={{
          p: 0.5,
          borderRadius: 999,
          display: "inline-flex",
          alignSelf: "center",
          border: "1px solid #BFD0E8",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.45) 100%)",
          backdropFilter: "blur(6px)",
          boxShadow:
            "0 1px 0 rgba(12, 24, 38, 0.04), 0 6px 16px rgba(12, 24, 38, 0.06)",
          flexShrink: 0,
          mb: 1.5,
        }}
      >
        <ToggleButtonGroup
          exclusive
          value={panel}
          onChange={(_, v) => v && setPanel(v)}
          sx={{
            "& .MuiToggleButton-root": {
              textTransform: "none",
              fontWeight: 700,
              border: "none",
              px: 1.5,
              borderRadius: 999,
            },
            "& .Mui-selected": {
              backgroundColor: "rgba(160,184,221,0.25) !important",
              color: "#21426C",
            },
          }}
        >
          <ToggleButton value="tags">
            <LocalOfferOutlinedIcon sx={{ fontSize: 18, mr: 0.75 }} />
            Tags
          </ToggleButton>
          <ToggleButton value="notes">
            <BubbleChartIcon sx={{ fontSize: 18, mr: 0.75 }} />
            Notations
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* Body */}
      <Box
        sx={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden" }}
      >
        {/* TAGS */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            minHeight: 0,
            pointerEvents: panel === "tags" ? "auto" : "none",
            opacity: panel === "tags" ? 1 : 0,
            transform: panel === "tags" ? "scale(1)" : "scale(0.98)",
            transition: "opacity .18s ease, transform .18s ease",
          }}
        >
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <TagTable
              data={tags}
              onDelete={onDeleteTag}
              inputField={tagInputField}
            />
          </Box>
        </Box>

        {/* NOTATIONS */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            minHeight: 0,
            pointerEvents: panel === "notes" ? "auto" : "none",
            opacity: panel === "notes" ? 1 : 0,
            transform: panel === "notes" ? "scale(1)" : "scale(0.98)",
            transition: "opacity .18s ease, transform .18s ease",
          }}
        >
          <Box sx={{ flex: 1, minHeight: 0 }}>
            {notationsProps ? (
              <NotationsPanel
                categories={notationsProps.categories}
                selectedCategories={notationsProps.selectedCategories}
                onChangeSelected={notationsProps.onChangeSelected}
                onAddSelection={notationsProps.onAddSelection}
              ></NotationsPanel>
            ) : (
              <NotationsPanel
                categories={[]}
                selectedCategories={[]}
                onChangeSelected={() => {}}
                onAddSelection={() => {}}
              ></NotationsPanel>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default RightPanel;
