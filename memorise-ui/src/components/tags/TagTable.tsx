// src/components/tags/TagTable.tsx
import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  Box,
  IconButton,
  Paper,
  Typography,
  Collapse,
  Divider,
  Tooltip,
  Switch,
  FormControlLabel,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import TagThesaurusInput, { type ThesaurusItem } from "./TagThesaurusInput";

export type TagRow = { name: string; source: "api" | "user" };

type TaxonomyNode = {
  /** Full path from root to term, e.g., ["Person","Artist"] */
  path?: string[];
  /** Optional synonyms for richer display */
  synonyms?: string[];
};

interface Props {
  data: TagRow[];
  onDelete: (name: string) => void;

  /** Legacy input slot (if you still want to render your own). */
  inputField?: React.ReactNode;

  /** Integrated thesaurus input. The toggle lives ABOVE the input now. */
  thesaurus?: {
    onAdd: (name: string) => void;
    fetchSuggestions: (query: string) => Promise<ThesaurusItem[]>;
    /** If provided, treated as a controlled prop and mirrored into the switch. */
    restrictToThesaurus?: boolean;
    /** Called when the header switch toggles. */
    onRestrictChange?: (v: boolean) => void;
    /** Initial value if not controlled. */
    defaultRestrictToThesaurus?: boolean;
    placeholder?: string;
  };

  /**
   * Optional thesaurus/taxonomy info keyed by tag name.
   * If provided, the table groups by top-level path (non-flat).
   * Otherwise, it groups by "source" (api/user).
   */
  taxonomy?: Record<string, TaxonomyNode>;
}

const groupLabelStyle = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase" as const,
  color: "#21426C",
};

const TagTable: React.FC<Props> = ({
  data,
  onDelete,
  inputField,
  thesaurus,
  taxonomy,
}) => {
  // --- Switch state (mirrors controlled prop if present) ---------------------
  const [restrictOnly, setRestrictOnly] = useState<boolean>(
    Boolean(
      thesaurus?.restrictToThesaurus ??
        thesaurus?.defaultRestrictToThesaurus ??
        false
    )
  );

  useEffect(() => {
    if (typeof thesaurus?.restrictToThesaurus === "boolean") {
      setRestrictOnly(thesaurus.restrictToThesaurus);
    }
  }, [thesaurus?.restrictToThesaurus]);

  const handleToggleRestrict = (_: unknown, checked: boolean) => {
    setRestrictOnly(checked);
    thesaurus?.onRestrictChange?.(checked);
  };

  // --- Build groups ----------------------------------------------------------
  const groups = useMemo(() => {
    const map = new Map<string, TagRow[]>();
    const getKey = (row: TagRow) => {
      if (taxonomy) {
        const node = taxonomy[row.name];
        const top = node?.path?.[0];
        if (top && top.trim().length > 0) return top;
        return "Other"; // fallback bucket when taxonomy present but tag not found
      }
      // no taxonomy -> group by source
      return row.source === "api" ? "Suggested" : "User tags";
    };

    for (const row of data) {
      const k = getKey(row);
      const arr = map.get(k);
      if (arr) arr.push(row);
      else map.set(k, [row]);
    }

    if (!taxonomy) {
      const suggested = map.get("Suggested");
      const user = map.get("User tags");
      const arr: Array<[string, TagRow[]]> = [];
      if (suggested) arr.push(["Suggested", suggested]);
      if (user) arr.push(["User tags", user]);
      return arr;
    }

    const sorted = Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    return sorted;
  }, [data, taxonomy]);

  // collapsed state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = useCallback(
    (k: string) => setCollapsed((prev) => ({ ...prev, [k]: !prev[k] })),
    []
  );

  // stub fetch: returns nothing (used when thesaurus switch is OFF)
  const emptySuggestions = useCallback(async () => [], []);

  return (
    <Paper
      elevation={0}
      sx={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        border: "1px solid #BFD0E8",
        borderRadius: "14px",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.45) 100%)",
        backdropFilter: "blur(6px)",
        boxShadow:
          "0 1px 0 rgba(12, 24, 38, 0.04), 0 6px 16px rgba(12, 24, 38, 0.06)",
        overflow: "hidden",
      }}
    >
      {/* Row with ONLY the Thesaurus switch (no title pill) */}
      {thesaurus && (
        <Box
          sx={{
            p: "8px 12px 4px",
            borderBottom: "1px solid #E2E8F0",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.60) 100%)",
            flexShrink: 0,
            display: "flex",
            justifyContent: "flex-start",
          }}
        >
          <FormControlLabel
            sx={{
              m: 0,
              ".MuiFormControlLabel-label": {
                fontSize: 12,
                fontWeight: 800,
                color: "#21426C",
                letterSpacing: 0.3,
              },
            }}
            control={
              <Switch
                size="small"
                checked={restrictOnly}
                onChange={handleToggleRestrict}
              />
            }
            label="Thesaurus only"
          />
        </Box>
      )}

      {/* Sticky input row: full-width input (and + inside the input component) */}
      <Box
        sx={{
          p: 1,
          borderBottom: "1px solid #E2E8F0",
          position: "sticky",
          top: thesaurus ? 41 : 0, // keep input below the switch bar if present
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.80) 0%, rgba(255,255,255,0.55) 100%)",
          zIndex: 1,
          flexShrink: 0,
        }}
      >
        {inputField ??
          (thesaurus && (
            <TagThesaurusInput
              onAdd={thesaurus.onAdd}
              fetchSuggestions={
                restrictOnly ? thesaurus.fetchSuggestions : emptySuggestions
              }
              restrictToThesaurus={restrictOnly}
              placeholder={thesaurus.placeholder}
            />
          ))}
      </Box>

      {/* Scrollable grouped list */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          p: 1,
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
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
        {groups.length === 0 ? (
          <Typography sx={{ color: "#5A6A7A", fontSize: 13 }}>
            No semantic tags yet. Click the tag icon above to generate.
          </Typography>
        ) : (
          groups.map(([groupKey, rows]) => {
            const isCollapsed = !!collapsed[groupKey];
            return (
              <Box
                key={groupKey}
                sx={{
                  border: "1px dashed rgba(160, 184, 221, 0.45)",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.65)",
                }}
              >
                {/* Group header */}
                <Box
                  onClick={() => toggle(groupKey)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 0.75,
                    px: 1,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={groupLabelStyle}>{groupKey}</Typography>
                    <Typography
                      sx={{
                        fontSize: 11,
                        color: "#5A6A7A",
                        fontWeight: 700,
                        letterSpacing: 0.3,
                      }}
                    >
                      {rows.length}
                    </Typography>
                  </Box>
                  {isCollapsed ? (
                    <ExpandMoreIcon
                      fontSize="small"
                      sx={{ color: "#21426C" }}
                    />
                  ) : (
                    <ExpandLessIcon
                      fontSize="small"
                      sx={{ color: "#21426C" }}
                    />
                  )}
                </Box>

                <Collapse in={!isCollapsed} timeout="auto" unmountOnExit>
                  <Divider sx={{ borderColor: "rgba(191,208,232,0.6)" }} />
                  <Box sx={{ display: "flex", flexDirection: "column", p: 1 }}>
                    {rows
                      .slice()
                      .sort((a, b) =>
                        a.name.localeCompare(b.name, undefined, {
                          sensitivity: "base",
                        })
                      )
                      .map((row) => {
                        const node = taxonomy?.[row.name];
                        const path = node?.path?.join(" › ");
                        const hasTaxo = Boolean(
                          node?.path && node?.path?.length
                        );
                        return (
                          <Box
                            key={`${groupKey}::${row.name}`}
                            sx={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              columnGap: 0.5,
                              alignItems: "start",
                              py: 0.5,
                            }}
                          >
                            {/* pill */}
                            <Box
                              sx={{
                                maxWidth: "100%",
                                backgroundColor:
                                  row.source === "user"
                                    ? "rgba(210, 132, 150, 0.18)"
                                    : "rgba(160, 184, 221, 0.18)",
                                borderRadius: "999px",
                                px: 1,
                                py: 0.75,
                                border: "1px solid rgba(160, 184, 221, 0.50)",
                              }}
                            >
                              <Typography
                                sx={{
                                  m: 0,
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: "#21426C",
                                  lineHeight: 1.25,
                                  whiteSpace: "normal",
                                  wordBreak: "break-word",
                                }}
                              >
                                {row.name}
                              </Typography>
                              {hasTaxo && (
                                <Typography
                                  sx={{
                                    mt: 0.25,
                                    fontSize: 11,
                                    color: "#5A6A7A",
                                    fontWeight: 600,
                                  }}
                                >
                                  {path}
                                </Typography>
                              )}
                            </Box>

                            {/* delete */}
                            <Tooltip title="Remove tag">
                              <IconButton
                                onClick={() => onDelete(row.name)}
                                size="small"
                                sx={{
                                  mt: 0.25,
                                  color:
                                    row.source === "user"
                                      ? "#C2185B"
                                      : "#1976D2",
                                  width: 26,
                                  height: 26,
                                  flexShrink: 0,
                                }}
                              >
                                <ClearIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        );
                      })}
                  </Box>
                </Collapse>
              </Box>
            );
          })
        )}
      </Box>
    </Paper>
  );
};

export default TagTable;
