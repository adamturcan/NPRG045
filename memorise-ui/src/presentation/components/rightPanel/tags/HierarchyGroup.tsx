import React from "react";
import { Box, Typography, Collapse, Divider } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

import TagItem from "./TagItem";
import { countAllTags } from "../../../../shared/utils/thesaurusHelpers";
import type { HierarchyNode } from "../../../../shared/utils/thesaurusHelpers";

const styles = {
  groupLabel: { fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" as const, color: "#21426C" },
};

interface HierarchyGroupProps {
  node: HierarchyNode;
  depth?: number;
  collapsed: Record<string, boolean>;
  toggle: (k: string) => void;
  onDelete: (name: string, keywordId?: number, parentId?: number) => void;
}

const HierarchyGroup: React.FC<HierarchyGroupProps> = React.memo(({ node, depth = 0, collapsed, toggle, onDelete }) => {
  const groupKey = node.fullPath.join(' › ');
  const isCollapsed = !!collapsed[groupKey];
  const hasChildren = node.children.size > 0;
  const hasTags = node.tags.length > 0;
  
  return (
    <Box sx={{ border: "1px dashed rgba(160, 184, 221, 0.45)", borderRadius: "12px", background: "rgba(255,255,255,0.65)", mb: 0.5, mx: 0.625, width: Math.max(200, 280 - depth * 20) }}>
      <Box onClick={() => toggle(groupKey)} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 0.75, px: 0.75, cursor: "pointer", userSelect: "none" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 1, minWidth: 0 }}>
          {depth > 0 && <Box sx={{ width: 2, height: 16, borderRadius: 1, bgcolor: '#A0B8DD', opacity: 0.5, flexShrink: 0 }} />}
          <Typography sx={{ ...styles.groupLabel, fontSize: Math.max(10, 12 - depth * 0.3), fontWeight: Math.max(600, 800 - depth * 50), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={groupKey}>{node.label}</Typography>
        </Box>
        <Typography sx={{ fontSize: 10, color: "#5A6A7A", fontWeight: 700, flexShrink: 0, mr: 0.5 }}>{countAllTags(node)}</Typography>
        {(hasTags || hasChildren) && (isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />)}
      </Box>

      <Collapse in={!isCollapsed} timeout="auto" unmountOnExit>
        {hasTags && (
          <Box sx={{ px: 0.75, pb: 0.75 }}>
            <Divider sx={{ borderColor: "rgba(191,208,232,0.6)", mb: 0.5 }} />
            {node.tags.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })).map((row) => (
              <TagItem 
                key={`${groupKey}::${row.name}::${row.source}::${row.keywordId || 'no-id'}::${row.parentId || 'no-parent'}`} 
                row={row} 
                onDelete={onDelete} 
              />
            ))}
          </Box>
        )}
        {hasChildren && (
          <Box sx={{ px: 0.75, pb: 0.75, pt: hasTags ? 0 : 0.75 }}>
            {Array.from(node.children.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })).map((childNode) => (
              <HierarchyGroup key={childNode.fullPath.join(' › ')} node={childNode} depth={depth + 1} collapsed={collapsed} toggle={toggle} onDelete={onDelete} />
            ))}
          </Box>
        )}
      </Collapse>
    </Box>
  );
});

HierarchyGroup.displayName = "HierarchyGroup";

export default HierarchyGroup;
