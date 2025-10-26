/**
 * RightPanel - Tag management panel for the workspace
 * 
 * This component displays the tag sidebar on the right side of the workspace.
 * Users can:
 * - View all tags (user-added + API-generated)
 * - Add new tags via thesaurus input with suggestions
 * - Delete existing tags
 * - See visual distinction between user and API tags
 * 
 * FEATURES:
 * 
 * 1. Visual Design:
 *    - Header pill with icon ("Tags" label)
 *    - White card with strong shadow (matches editor styling)
 *    - Clean, minimal interface
 * 
 * 2. Tag Input Modes:
 *    - Legacy: Custom input field passed as prop
 *    - Modern: Thesaurus integration with autocomplete suggestions
 * 
 * 3. Thesaurus Integration:
 *    - Fetches tag suggestions from external API
 *    - Optional restriction mode (thesaurus-only vs custom tags)
 *    - Real-time autocomplete as user types
 * 
 * 4. Taxonomy Support (optional):
 *    - Group tags by hierarchical categories
 *    - Display tag relationships and synonyms
 */
import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import TagTable from "../tags/TagTable";
import type { ThesaurusItem } from "../tags/TagThesaurusInput";
import type { ThesaurusIndexItem } from "../../types/Thesaurus";

/**
 * Tag row format for display
 * - name: The tag text (human-readable label)
 * - source: "user" (manually added) or "api" (ML-generated)
 * - keywordId: Optional KeywordID from thesaurus (for matching)
 * - parentId: Optional ParentID to disambiguate duplicate KeywordIDs
 */
export type TagRow = { 
  name: string; 
  source: "api" | "user";
  keywordId?: number;  // From API or thesaurus lookup
  parentId?: number;   // To disambiguate entries with same KeywordID
  hierarchicalPath?: string[];  // Path through hierarchy for nested tags
  isCategory?: boolean;  // Flag to indicate this is a category, not a regular tag
};

/**
 * Taxonomy node structure for hierarchical tag organization
 * Currently supports path and synonyms (expandable for future features)
 */
type TaxonomyNode = {
  path?: string[];
  synonyms?: string[];
};

interface Props {
  /** Array of tags to display (from both user and API sources) */
  tags: TagRow[];
  
  /** Callback when user deletes a tag */
  onDeleteTag: (name: string, keywordId?: number, parentId?: number) => void;

  /**
   * LEGACY: Custom input field component
   * Kept for backwards compatibility. New code should use thesaurus prop instead.
   */
  tagInputField?: React.ReactNode;

  /**
   * MODERN: Thesaurus-powered tag input with suggestions
   * Provides autocomplete suggestions from external API (e.g., Datamuse)
   */
  thesaurus?: {
    /** Callback when user adds a new tag */
    onAdd: (name: string, keywordId?: number, parentId?: number) => void;
    
    /** Async function to fetch tag suggestions (e.g., from Datamuse API) */
    fetchSuggestions: (query: string) => Promise<ThesaurusItem[]>;
    
    /** Current state of restriction mode (thesaurus-only vs allow custom) */
    restrictToThesaurus?: boolean;
    
    /** Callback when user toggles restriction mode */
    onRestrictChange?: (v: boolean) => void;
    
    /** Initial restriction mode on mount */
    defaultRestrictToThesaurus?: boolean;
    
    /** Placeholder text for input field */
    placeholder?: string;
    
    /** Whether thesaurus is still loading (for large datasets) */
    isThesaurusLoading?: boolean;
    
    /** Key to force component remount (e.g., workspace ID) */
    resetKey?: string;
  };

  /**
   * Optional taxonomy mapping for hierarchical tag organization
   * Maps tag names to their taxonomy metadata (path, synonyms, etc.)
   */
  taxonomy?: Record<string, TaxonomyNode>;
  
  /**
   * NEW: Thesaurus index for hierarchical tag display
   * When provided, tags are grouped by their thesaurus hierarchy
   * instead of simple "User" vs "API" groups
   */
  thesaurusIndex?: ThesaurusIndexItem[];
}

/**
 * Color constants for consistent styling
 */
const COLORS = {
  text: "#0F172A",      // Dark blue-gray for text
  border: "#E2E8F0",    // Light gray for borders
  pillBg: "white",      // White background for header pill
};

const RightPanel: React.FC<Props> = ({
  tags,
  onDeleteTag,
  tagInputField,
  thesaurus,
  taxonomy,
  thesaurusIndex,
}) => {
  return (
    <Box
      sx={{
        width: 300,              // Fixed width for consistency
        height: "100%",          // Fill parent height
        display: "flex",
        flexDirection: "column",
        minHeight: 0,            // Enable proper scrolling in flex layout
        color: COLORS.text,
        mt: -1.1,                // Negative margin to move panel up slightly
      }}
    >
      {/* ========================================================================
          HEADER PILL: "Tags" label with icon
          ======================================================================== */}
      <Paper
        elevation={0}
        sx={{
          p: 0.5,
          borderRadius: 999,              // Fully rounded pill shape
          display: "inline-flex",
          alignSelf: "center",            // Center horizontally
          border: `1px solid ${COLORS.border}`,
          background: COLORS.pillBg,
          backdropFilter: "blur(6px)",    // Subtle blur effect
          boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
          mb: 1.25,                       // Space below pill
        }}
      >
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            px: 2,
            py: 0.6,
            borderRadius: 999,
            fontWeight: 800,
          }}
        >
          {/* Tag icon */}
          <LocalOfferOutlinedIcon sx={{ fontSize: 18, mr: 0.75 }} />
          
          {/* "Tags" label */}
          <Typography variant="body2" fontWeight={800}>
            Tags
          </Typography>
        </Box>
      </Paper>

      {/* ========================================================================
          MAIN CARD: Contains tag table with input and tag list
          ======================================================================== 
          
          Structure uses nested boxes for proper overflow handling:
          - Outer: position relative (for absolute child)
          - Middle: position absolute with inset 0 (fills parent)
          - Inner: flex 1 (allows TagTable to handle its own scrolling)
      */}
      <Box
        sx={{
          position: "relative",
          flex: 1,                        // Take remaining vertical space
          minHeight: 0,                   // Enable flex child scrolling
          overflow: "hidden",             // Clip content to card bounds
          borderRadius: 3,                // Rounded corners (12px)
          background: "#FFFFFF",
          border: `1px solid ${COLORS.border}`,
          // Strong shadow to match editor card styling
          boxShadow: "0 14px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.25)",
          zIndex: 1,                      // Ensure card appears above background
        }}
      >
        {/* Absolute positioning wrapper for proper scroll behavior */}
        <Box
          sx={{ position: "absolute", inset: 0, display: "flex", minHeight: 0 }}
        >
          <Box sx={{ flex: 1, minHeight: 0 }}>
            {/* 
              TagTable renders:
              - Tag input field (legacy or thesaurus-based)
              - List of tags with delete buttons
              - Visual distinction between user/API tags
            */}
            <TagTable
              data={tags}
              onDelete={onDeleteTag}
              inputField={tagInputField}        // Legacy input (optional)
              thesaurus={thesaurus}             // Modern thesaurus input (optional)
              taxonomy={taxonomy}               // Hierarchical grouping (optional)
              thesaurusIndex={thesaurusIndex}   // Thesaurus hierarchy (NEW)
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default RightPanel;
