import React from "react";
import { Box, IconButton, Typography } from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";

export type TagRow = { 
  name: string; 
  source: "api" | "user";
  keywordId?: number;
  parentId?: number;
};

interface TagItemProps {
  row: TagRow;
  onDelete: (name: string, keywordId?: number, parentId?: number) => void;
}

const TagItem: React.FC<TagItemProps> = React.memo(({ row, onDelete }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.5 }}>
    <Box sx={{ flex: 1, minWidth: 0, backgroundColor: row.source === "user" ? "rgba(210, 132, 150, 0.18)" : "rgba(160, 184, 221, 0.18)", borderRadius: "999px", px: 1, py: 0.5, border: "1px solid rgba(160, 184, 221, 0.50)", overflow: 'hidden' }}>
      <Typography sx={{ m: 0, fontSize: 12, fontWeight: 700, color: "#21426C", lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.name}>
        {row.name}
      </Typography>
    </Box>
    <IconButton onClick={() => onDelete(row.name, row.keywordId, row.parentId)} size="small" sx={{ color: row.source === "user" ? "#C2185B" : "#1976D2", width: 24, height: 24, flexShrink: 0 }}>
      <ClearIcon sx={{ fontSize: 14 }} />
    </IconButton>
  </Box>
));

TagItem.displayName = "TagItem";

export default TagItem;
