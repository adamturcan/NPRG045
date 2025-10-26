// src/components/tags/TagTable.tsx
/**
 * TagTable - Grouped display of tags with input and delete functionality
 * 
 * This component displays a list of tags organized into collapsible groups.
 * It includes an input field for adding new tags and supports two grouping modes:
 * 
 * FEATURES:
 * 
 * 1. Two Grouping Modes:
 *    - Simple: Group by source (User tags vs Suggested/API tags)
 *    - Taxonomy: Group by hierarchical category (e.g., Person, Location, etc.)
 * 
 * 2. Input Methods:
 *    - Legacy: Custom input field passed as prop (backwards compatibility)
 *    - Modern: Integrated TagThesaurusInput with autocomplete
 * 
 * 3. Thesaurus Mode:
 *    - Toggle switch to enable/disable thesaurus-only mode
 *    - When ON: Only suggestions from API allowed
 *    - When OFF: Free-form custom tags allowed + suggestions
 * 
 * 4. Visual Features:
 *    - Collapsible groups (click header to expand/collapse)
 *    - Tag pills with different colors for user vs API tags
 *    - Delete button for each tag
 *    - Tag count badges on group headers
 *    - Taxonomy path display (e.g., "Person › Artist")
 * 
 * 5. Layout:
 *    - Sticky header with thesaurus toggle
 *    - Sticky input field
 *    - Scrollable tag list
 *    - Frosted glass aesthetic
 */
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
import type { ThesaurusIndexItem } from "../../types/Thesaurus";
import { buildTagHierarchy, countAllTags } from "../../lib/thesaurusHelpers";
import type { HierarchyNode } from "../../lib/thesaurusHelpers";

/**
 * Tag row data format
 * - name: The tag text (human-readable label)
 * - source: "user" (manual) or "api" (ML-generated)
 * - keywordId: Optional KeywordID from thesaurus (for hierarchical matching)
 */
export type TagRow = { 
  name: string; 
  source: "api" | "user";
  keywordId?: number;
};

/**
 * Taxonomy metadata for hierarchical tag organization
 */
type TaxonomyNode = {
  /** Full path from root to term, e.g., ["Person","Artist"] */
  path?: string[];
  /** Optional synonyms for richer display */
  synonyms?: string[];
};

interface Props {
  /** Array of tags to display */
  data: TagRow[];
  
  /** Callback when user deletes a tag */
  onDelete: (name: string, keywordId?: number, parentId?: number) => void;

  /**
   * LEGACY: Custom input field component
   * If provided, renders this instead of TagThesaurusInput.
   * Kept for backwards compatibility.
   */
  inputField?: React.ReactNode;

  /**
   * MODERN: Integrated thesaurus input with autocomplete
   * Includes toggle switch for thesaurus-only mode
   */
  thesaurus?: {
    /** Called when user adds a tag */
    onAdd: (name: string) => void;
    
    /** Async function to fetch tag suggestions */
    fetchSuggestions: (query: string) => Promise<ThesaurusItem[]>;
    
    /** Controlled: current restriction mode state */
    restrictToThesaurus?: boolean;
    
    /** Called when user toggles restriction mode */
    onRestrictChange?: (v: boolean) => void;
    
    /** Uncontrolled: initial restriction mode */
    defaultRestrictToThesaurus?: boolean;
    
    /** Placeholder text for input */
    placeholder?: string;
    
    /** Whether thesaurus is still loading */
    isThesaurusLoading?: boolean;
    
    /** Key to force component remount (e.g., workspace ID) */
    resetKey?: string;
  };

  /**
   * Optional taxonomy mapping for hierarchical grouping
   * - If provided: Groups by top-level taxonomy category
   * - If not provided: Groups by source (user vs suggested)
   */
  taxonomy?: Record<string, TaxonomyNode>;
  
  /**
   * NEW: Thesaurus index for hierarchical display
   * When provided, shows tags in thesaurus hierarchy instead of flat lists
   */
  thesaurusIndex?: ThesaurusIndexItem[];
}

/**
 * Shared style for group header labels
 */
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
  thesaurusIndex,
}) => {
  /**
   * ============================================================================
   * THESAURUS TOGGLE STATE
   * ============================================================================
   * 
   * Manages the "Thesaurus only" switch state.
   * Can be controlled (from parent) or uncontrolled (local state).
   */
  const [restrictOnly, setRestrictOnly] = useState<boolean>(
    Boolean(
      thesaurus?.restrictToThesaurus ??
        thesaurus?.defaultRestrictToThesaurus ??
        false
    )
  );

  // Sync with controlled prop if provided
  useEffect(() => {
    if (typeof thesaurus?.restrictToThesaurus === "boolean") {
      setRestrictOnly(thesaurus.restrictToThesaurus);
    }
  }, [thesaurus?.restrictToThesaurus]);

  /**
   * Handle toggle switch change
   */
  const handleToggleRestrict = (_: unknown, checked: boolean) => {
    setRestrictOnly(checked);
    thesaurus?.onRestrictChange?.(checked);
  };

  /**
   * ============================================================================
   * GROUPING LOGIC: Organize tags into collapsible sections
   * ============================================================================
   * 
   * Three grouping strategies:
   * 1. WITH thesaurusIndex: Hierarchical tree from thesaurus (RECOMMENDED)
   * 2. WITH taxonomy: Group by top-level category (legacy)
   * 3. WITHOUT either: Group by source ("Suggested" vs "User tags") (fallback)
   * 
   * Returns either hierarchical tree OR flat array of [groupKey, tags[]] tuples.
   */
  
  // NEW: Store hierarchical tree structure (not flattened)
  const hierarchyTree = useMemo(() => {
    if (thesaurusIndex && thesaurusIndex.length > 0) {
      return buildTagHierarchy(data, thesaurusIndex);
    }
    return null;
  }, [data, thesaurusIndex]);
  
  // LEGACY: Flat groups for non-hierarchical display
  const groups = useMemo(() => {
    // If using hierarchy, return empty (won't be used)
    if (hierarchyTree) return [];
    
    // LEGACY: Old grouping logic
    const map = new Map<string, TagRow[]>();
    
    /**
     * Determine group key for a tag based on mode
     */
    const getKey = (row: TagRow) => {
      if (taxonomy) {
        // Taxonomy mode: use first element of path as group
        const node = taxonomy[row.name];
        const top = node?.path?.[0];
        if (top && top.trim().length > 0) return top;
        return "Other"; // Fallback when tag not in taxonomy
      }
      // Simple mode: group by source
      return row.source === "api" ? "Suggested" : "User tags";
    };

    // Group all tags
    for (const row of data) {
      const k = getKey(row);
      const arr = map.get(k);
      if (arr) arr.push(row);
      else map.set(k, [row]);
    }

    // Simple mode: specific order (Suggested first, then User tags)
    if (!taxonomy) {
      const suggested = map.get("Suggested");
      const user = map.get("User tags");
      const arr: Array<[string, TagRow[]]> = [];
      if (suggested) arr.push(["Suggested", suggested]);
      if (user) arr.push(["User tags", user]);
      return arr;
    }

    // Taxonomy mode: alphabetical order
    const sorted = Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, taxonomy]);

  /**
   * ============================================================================
   * COLLAPSE STATE: Track which groups are expanded/collapsed
   * ============================================================================
   */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  
  /**
   * Toggle a group's collapsed state
   */
  const toggle = useCallback(
    (k: string) => setCollapsed((prev) => ({ ...prev, [k]: !prev[k] })),
    []
  );

  /**
   * Empty suggestions function used when thesaurus mode is OFF
   * (disables autocomplete suggestions)
   */
  const emptySuggestions = useCallback(async () => [], []);

  /**
   * ============================================================================
   * RECURSIVE GROUP RENDERER: For hierarchical display
   * ============================================================================
   */
  
  /**
   * Recursive component to render a hierarchy node and its children
   */
  const HierarchyGroup = ({ 
    node, 
    depth = 0 
  }: { 
    node: HierarchyNode;
    depth: number;
  }) => {
    const groupKey = node.fullPath.join(' › ');
    const isCollapsed = !!collapsed[groupKey];
    const hasChildren = node.children.size > 0;
    const hasTags = node.tags.length > 0;
    
    return (
      <Box
        sx={{
          border: "1px dashed rgba(160, 184, 221, 0.45)",
          borderRadius: "12px",
          background: "rgba(255,255,255,0.65)",
          mb: 0.5,
          ml: 0.625,  // 5px left margin for spacing from panel edge
          mr: 0.625,  // 5px right margin for spacing from panel edge
          width: Math.max(200, 280 - depth * 20),  // Fixed width for consistent sizing
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
            px: 0.75,  // Reset to equal padding since we have margin now
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 1, minWidth: 0 }}>
            {/* Visual depth indicator only - no layout impact */}
            {depth > 0 && (
              <Box 
                sx={{ 
                  width: 2,
                  height: 16,
                  borderRadius: 1,
                  bgcolor: '#A0B8DD',
                  opacity: 0.5,
                  flexShrink: 0,
                }} 
              />
            )}
            
            {/* Group name - truncate if too long */}
            <Typography 
              sx={{
                ...groupLabelStyle,
                fontSize: Math.max(10, 12 - depth * 0.3),
                fontWeight: Math.max(600, 800 - depth * 50),
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={node.fullPath.join(' › ')}  // Show full path on hover
            >
              {node.label}
            </Typography>
          </Box>
          
          {/* Tag count - outside flex container, always visible on right */}
          <Typography
            sx={{
              fontSize: 10,
              color: "#5A6A7A",
              fontWeight: 700,
              flexShrink: 0,
              mr: 0.5,
            }}
          >
            {countAllTags(node)}
          </Typography>
          
          {/* Expand/collapse icon (only if has tags or children) */}
          {(hasTags || hasChildren) && (
            isCollapsed ? (
              <ExpandMoreIcon fontSize="small" sx={{ color: "#21426C" }} />
            ) : (
              <ExpandLessIcon fontSize="small" sx={{ color: "#21426C" }} />
            )
          )}
        </Box>

        {/* Collapsible content */}
        <Collapse in={!isCollapsed} timeout="auto" unmountOnExit>
          {hasTags && (
            <>
              <Divider sx={{ borderColor: "rgba(191,208,232,0.6)" }} />
              <Box sx={{ 
                display: "flex", 
                flexDirection: "column", 
                px: 0.75,  // Reset to equal padding
                py: 0.75,
                gap: 0.5 
              }}>
                {/* Tags at this level */}
                {node.tags
                  .slice()
                  .sort((a, b) =>
                    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
                  )
                  .map((row) => (
                    <Box
                      key={`${groupKey}::${row.name}`}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      {/* Tag pill - flexible width */}
                      <Box
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          backgroundColor:
                            row.source === "user"
                              ? "rgba(210, 132, 150, 0.18)" // Pink for user
                              : "rgba(160, 184, 221, 0.18)", // Blue for API
                          borderRadius: "999px",
                          px: 0.75,
                          py: 0.5,
                          border: "1px solid rgba(160, 184, 221, 0.50)",
                          overflow: 'hidden',
                        }}
                      >
                        <Typography
                          sx={{
                            m: 0,
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#21426C",
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={row.name}  // Show full name on hover
                        >
                          {row.name}
                        </Typography>
                      </Box>

                      {/* Delete button - always visible */}
                      <IconButton
                        onClick={() => onDelete(row.name, row.keywordId, row.parentId)}
                        size="small"
                        sx={{
                          color: row.source === "user" ? "#C2185B" : "#1976D2",
                          width: 24,
                          height: 24,
                          flexShrink: 0,
                          p: 0.5,
                        }}
                      >
                        <ClearIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
              </Box>
            </>
          )}
          
          {/* Recursively render children INSIDE the parent collapse */}
          {hasChildren && (
            <Box sx={{ px: 0.75, pb: 0.75, pt: hasTags ? 0 : 0.75 }}>
              {Array.from(node.children.values())
                .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
                .map((childNode) => (
                  <HierarchyGroup 
                    key={childNode.fullPath.join(' › ')}
                    node={childNode}
                    depth={depth + 1}
                  />
                ))}
            </Box>
          )}
        </Collapse>
      </Box>
    );
  };

  /**
   * ============================================================================
   * RENDER
   * ============================================================================
   */
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
        // Frosted glass effect
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.45) 100%)",
        backdropFilter: "blur(6px)",
        boxShadow:
          "0 1px 0 rgba(12, 24, 38, 0.04), 0 6px 16px rgba(12, 24, 38, 0.06)",
        overflow: "hidden",
      }}
    >
      {/* ========================================================================
          HEADER: Thesaurus toggle switch
          ======================================================================== */}
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
          {/* Toggle switch: Thesaurus-only mode vs allow custom tags */}
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

      {/* ========================================================================
          INPUT ROW: Sticky input field for adding tags
          ======================================================================== */}
      <Box
        sx={{
          px: 1,                    // Horizontal padding
          py: 0.75,                 // Slightly less vertical padding
          borderBottom: "1px solid #E2E8F0",
          position: "sticky",
          top: thesaurus ? 41 : 0,  // Position below switch if present
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.80) 0%, rgba(255,255,255,0.55) 100%)",
          zIndex: 1,                // Stay on top while scrolling
          flexShrink: 0,            // Don't compress
        }}
      >
        {/* Render legacy input or thesaurus input */}
        {inputField ??
          (thesaurus && (
            <TagThesaurusInput
              key={thesaurus.resetKey}  // Force remount when workspace changes
              onAdd={thesaurus.onAdd}
              // When restrictOnly: use thesaurus suggestions
              // When NOT restrictOnly: use empty suggestions (allows free-form)
              fetchSuggestions={
                restrictOnly ? thesaurus.fetchSuggestions : emptySuggestions
              }
              restrictToThesaurus={restrictOnly}
              placeholder={thesaurus.placeholder}
              isThesaurusLoading={thesaurus.isThesaurusLoading}
            />
          ))}
      </Box>

      {/* ========================================================================
          TAG LIST: Scrollable grouped list of tags
          ======================================================================== */}
      <Box
        sx={{
          flex: 1,                  // Take remaining space
          minHeight: 0,             // Enable scrolling
          width: "100%",            // Constrain width
          maxWidth: "100%",         // Never exceed parent
          overflowY: "scroll",      // Always show scrollbar (prevents layout jump)
          overflowX: "hidden",      // Never scroll horizontally
          p: 1,
          pr: 0.5,                  // Less right padding (scrollbar takes space)
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
          boxSizing: "border-box",  // Include padding in width calculation
          // Custom scrollbar styling
          "&::-webkit-scrollbar": { width: 8 },  // Thinner scrollbar
          "&::-webkit-scrollbar-thumb": {
            background: "#C7D5EA",
            borderRadius: 10,
            border: "2px solid transparent",
            backgroundClip: "content-box",
          },
          "&::-webkit-scrollbar-thumb:hover": { background: "#B3C6E4" },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
        }}
      >
        {/* Empty state message */}
        {data.length === 0 ? (
          <Typography sx={{ color: "#5A6A7A", fontSize: 13 }}>
            No semantic tags yet. Click the tag icon above to generate.
          </Typography>
        ) : hierarchyTree ? (
          // NEW: Hierarchical rendering (nested groups)
          Array.from(hierarchyTree.values())
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
            .map((rootNode) => (
              <HierarchyGroup
                key={rootNode.fullPath.join(' › ')}
                node={rootNode}
                depth={0}
              />
            ))
        ) : (
          // LEGACY: Flat group rendering
          groups.map(([groupKey, rows]) => {
            const isCollapsed = !!collapsed[groupKey];
            return (
              <Box
                key={groupKey}
                sx={{
                  border: "1px dashed rgba(160, 184, 221, 0.45)",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.65)",
                  mb: 0.75,
                }}
              >
                {/* Group header (clickable to collapse/expand) */}
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
                    {/* Group name */}
                    <Typography sx={groupLabelStyle}>
                      {groupKey}
                    </Typography>
                    
                    {/* Tag count badge */}
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
                  
                  {/* Expand/collapse icon */}
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

                {/* Collapsible tag list */}
                <Collapse in={!isCollapsed} timeout="auto" unmountOnExit>
                  <Divider sx={{ borderColor: "rgba(191,208,232,0.6)" }} />
                  <Box sx={{ display: "flex", flexDirection: "column", p: 1 }}>
                    {/* Sort tags alphabetically within group */}
                    {rows
                      .slice()
                      .sort((a, b) =>
                        a.name.localeCompare(b.name, undefined, {
                          sensitivity: "base",
                        })
                      )
                      .map((row) => {
                        // Get taxonomy metadata if available
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
                              gridTemplateColumns: "1fr auto", // Tag pill | Delete button
                              columnGap: 0.5,
                              alignItems: "start",
                              py: 0.5,
                            }}
                          >
                            {/* Tag pill with name and optional taxonomy path */}
                            <Box
                              sx={{
                                maxWidth: "100%",
                                // Color code by source: pink for user, blue for API
                                backgroundColor:
                                  row.source === "user"
                                    ? "rgba(210, 132, 150, 0.18)" // Pink
                                    : "rgba(160, 184, 221, 0.18)", // Blue
                                borderRadius: "999px", // Fully rounded pill
                                px: 1,
                                py: 0.75,
                                border: "1px solid rgba(160, 184, 221, 0.50)",
                              }}
                            >
                              {/* Tag name */}
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
                              
                              {/* Taxonomy path (e.g., "Person › Artist") */}
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

                            {/* Delete button */}
                            <Tooltip title="Remove tag">
                              <IconButton
                                onClick={() => onDelete(row.name)}
                                size="small"
                                sx={{
                                  mt: 0.25,
                                  // Color code by source: pink for user, blue for API
                                  color:
                                    row.source === "user"
                                      ? "#C2185B" // Pink
                                      : "#1976D2", // Blue
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
