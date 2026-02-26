import React, { useMemo, useState, useCallback, useEffect } from "react";
import { Box, Paper, Typography, Collapse, Divider, Switch, FormControlLabel } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

import TagThesaurusInput, { type ThesaurusItem } from "../inputs/TagThesaurusInput";
import type { ThesaurusIndexItem } from "../../../../types/Thesaurus";
import { buildTagHierarchy } from "../../../../shared/utils/thesaurusHelpers";
import TagItem, { type TagRow } from "./TagItem";
import HierarchyGroup from "./HierarchyGroup";

export type { TagRow };

interface Props {
  data: TagRow[];
  onDelete: (name: string, keywordId?: number, parentId?: number) => void;
  thesaurus?: {
    onAdd: (name: string) => void;
    fetchSuggestions: (query: string) => Promise<ThesaurusItem[]>;
    restrictToThesaurus?: boolean;
    onRestrictChange?: (v: boolean) => void;
    defaultRestrictToThesaurus?: boolean;
    placeholder?: string;
    isThesaurusLoading?: boolean;
    resetKey?: string;
  };
  thesaurusIndex?: ThesaurusIndexItem[];
}

const styles = {
  groupLabel: { fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" as const, color: "#21426C" },
  paperBase: { height: "100%", display: "flex", flexDirection: "column", border: "1px solid #BFD0E8", borderRadius: "14px", background: "linear-gradient(180deg, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.45) 100%)", backdropFilter: "blur(6px)", boxShadow: "0 1px 0 rgba(12, 24, 38, 0.04), 0 6px 16px rgba(12, 24, 38, 0.06)", overflow: "hidden" }
};

const TagTable: React.FC<Props> = ({ data, onDelete, thesaurus, thesaurusIndex }) => {
  const [restrictOnly, setRestrictOnly] = useState(Boolean(thesaurus?.restrictToThesaurus ?? thesaurus?.defaultRestrictToThesaurus ?? false));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof thesaurus?.restrictToThesaurus === "boolean") {
      setRestrictOnly(thesaurus.restrictToThesaurus);
    }
  }, [thesaurus?.restrictToThesaurus]);

  const handleToggleRestrict = useCallback((_: unknown, checked: boolean) => {
    setRestrictOnly(checked);
    thesaurus?.onRestrictChange?.(checked);
  }, [thesaurus]);

  const toggle = useCallback((k: string) => setCollapsed((prev) => ({ ...prev, [k]: !prev[k] })), []);
  const emptySuggestions = useCallback(async () => [], []);

  const hierarchyTree = useMemo(() => {
    return (thesaurusIndex && thesaurusIndex.length > 0) ? buildTagHierarchy(data, thesaurusIndex) : null;
  }, [data, thesaurusIndex]);
  
  const groups = useMemo(() => {
    if (hierarchyTree) return [];
    const suggested = data.filter(row => row.source === "api");
    const userTags = data.filter(row => row.source === "user");
    return [
      ...(suggested.length > 0 ? [["Suggested", suggested]] : []),
      ...(userTags.length > 0 ? [["User tags", userTags]] : [])
    ] as Array<[string, TagRow[]]>;
  }, [data, hierarchyTree]);

  return (
    <Paper elevation={0} sx={styles.paperBase}>
      {/* Thesaurus Header */}
      {thesaurus && (
        <Box sx={{ p: "8px 12px 4px", borderBottom: "1px solid #E2E8F0", background: "linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.60) 100%)", flexShrink: 0 }}>
          <FormControlLabel
            sx={{ m: 0, ".MuiFormControlLabel-label": { fontSize: 12, fontWeight: 800, color: "#21426C" } }}
            control={<Switch size="small" checked={restrictOnly} onChange={handleToggleRestrict} />}
            label="Thesaurus only"
          />
        </Box>
      )}

      {/* Input section */}
      {thesaurus && (
        <Box sx={{ px: 1, py: 0.75, borderBottom: "1px solid #E2E8F0", position: "sticky", top: thesaurus ? 41 : 0, zIndex: 1, background: "linear-gradient(180deg, rgba(255,255,255,0.80) 0%, rgba(255,255,255,0.55) 100%)" }}>
          <TagThesaurusInput 
            key={thesaurus.resetKey} 
            onAdd={thesaurus.onAdd} 
            fetchSuggestions={restrictOnly ? thesaurus.fetchSuggestions : emptySuggestions} 
            restrictToThesaurus={restrictOnly} 
            placeholder={thesaurus.placeholder} 
            isThesaurusLoading={thesaurus.isThesaurusLoading} 
          />
        </Box>
      )}
      
     {/* Tag list */}
      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", p: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
        {data.length === 0 ? (
          <Typography sx={{ color: "#5A6A7A", fontSize: 13 }}>No semantic tags yet. Click the tag icon above to generate.</Typography>
        ) : hierarchyTree ? (
          Array.from(hierarchyTree.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })).map(rootNode => (
            <HierarchyGroup key={rootNode.fullPath.join(' › ')} node={rootNode} collapsed={collapsed} toggle={toggle} onDelete={onDelete} />
          ))
        ) : (
          groups.map(([groupKey, rows]) => (
            <Box key={groupKey} sx={{ border: "1px dashed rgba(160, 184, 221, 0.45)", borderRadius: "12px", background: "rgba(255,255,255,0.65)" }}>
              <Box onClick={() => toggle(groupKey)} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 0.75, px: 1, cursor: "pointer" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography sx={styles.groupLabel}>{groupKey}</Typography>
                  <Typography sx={{ fontSize: 11, color: "#5A6A7A", fontWeight: 700 }}>{rows.length}</Typography>
                </Box>
                {collapsed[groupKey] ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
              </Box>
              <Collapse in={!collapsed[groupKey]} timeout="auto" unmountOnExit>
                <Divider sx={{ borderColor: "rgba(191,208,232,0.6)" }} />
                <Box sx={{ p: 1 }}>
                {rows.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })).map(row => (
                  <TagItem 
                    key={`${groupKey}::${row.name}::${row.source}::${row.keywordId || 'no-id'}::${row.parentId || 'no-parent'}`} 
                    row={row} 
                    onDelete={onDelete} 
                  />
                ))}
                </Box>
              </Collapse>
            </Box>
          ))
        )}
      </Box>
    </Paper>
  );
};

export default TagTable;