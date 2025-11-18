/**
 * RightPanel - Tag and Segment management panel for the workspace
 * 
 * This component displays the tag and segment sidebar on the right side of the workspace.
 * Users can:
 * - View all tags (user-added + API-generated)
 * - Add new tags via thesaurus input with suggestions
 * - Delete existing tags
 * - See visual distinction between user and API tags
 * - Navigate text segments (from segmentation API)
 * - Switch between Tags and Segments tabs
 * 
 * FEATURES:
 * 
 * 1. Visual Design:
 *    - Header pill with tab toggle (Tags/Segments)
 *    - White card with strong shadow (matches editor styling)
 *    - Clean, minimal interface
 * 
 * 2. Tab System:
 *    - Toggle between Tags and Segments views
 *    - Segments tab always visible (shows note if empty)
 * 
 * 3. Tag Input Modes:
 *    - Legacy: Custom input field passed as prop
 *    - Modern: Thesaurus integration with autocomplete suggestions
 * 
 * 4. Thesaurus Integration:
 *    - Fetches tag suggestions from external API
 *    - Optional restriction mode (thesaurus-only vs custom tags)
 *    - Real-time autocomplete as user types
 * 
 * 5. Taxonomy Support (optional):
 *    - Group tags by hierarchical categories
 *    - Display tag relationships and synonyms
 * 
 * 6. Segment Navigation:
 *    - Scrollable list of segments
 *    - Click to scroll to segment in editor
 *    - Empty state message when no segments
 */
import React, { useState, useRef, useEffect } from "react";
import { Box, Paper, Typography, ToggleButton, ToggleButtonGroup, Fade } from "@mui/material";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import ViewListIcon from "@mui/icons-material/ViewList";
import DescriptionIcon from "@mui/icons-material/Description";
import TagTable from "../tags/TagTable";
import SegmentNavBar from "../segmentation/SegmentNavBar";
import type { ThesaurusItem } from "../tags/TagThesaurusInput";
import type { ThesaurusIndexItem } from "../../../types/Thesaurus";
import type { Segment } from "../../../types/Segment";

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

  /**
   * Segments from segmentation API
   * Optional array of text segments for navigation
   */
  segments?: Segment[];

  /**
   * Callback when user clicks on a segment
   * Used to scroll to segment in editor
   */
  onSegmentClick?: (segment: Segment) => void;

  /**
   * Currently active segment ID (for highlighting in document mode)
   */
  activeSegmentId?: string;

  /**
   * Currently selected segment ID (for segment mode - which segment is loaded in editor)
   */
  selectedSegmentId?: string | null;

  /**
   * View mode toggle: "document" (whole document) or "segments" (individual segments)
   */
  viewMode?: "document" | "segments";
  onViewModeChange?: (mode: "document" | "segments") => void;

  /**
   * Full text to derive segment text from indices
   */
  text?: string;
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
  segments = [],
  onSegmentClick,
  activeSegmentId,
  selectedSegmentId,
  viewMode = "document",
  onViewModeChange,
  text = "",
}) => {
  // Auto-switch to segments tab when view mode is segments and segments exist
  const shouldShowSegments = segments.length > 0;
  const [activeTab, setActiveTab] = useState<"tags" | "segments">(
    shouldShowSegments && viewMode === "segments" ? "segments" : "tags"
  );
  
  // Auto-switch to segments tab when view mode changes to segments
  useEffect(() => {
    if (viewMode === "segments" && shouldShowSegments && activeTab !== "segments") {
      setActiveTab("segments");
    }
  }, [viewMode, shouldShowSegments, activeTab]);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; top: number; height: number }>({
    left: 0,
    width: 0,
    top: 0,
    height: 0,
  });
  const tagsButtonRef = useRef<HTMLButtonElement>(null);
  const segmentsButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update indicator position when tab changes
  useEffect(() => {
    const updateIndicator = () => {
      const activeButton = activeTab === "tags" ? tagsButtonRef.current : segmentsButtonRef.current;
      const container = containerRef.current;
      
      if (activeButton && container) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        
        setIndicatorStyle({
          left: buttonRect.left - containerRect.left,
          width: buttonRect.width,
          top: buttonRect.top - containerRect.top,
          height: buttonRect.height,
        });
      }
    };

    // Update immediately
    updateIndicator();
    
    // Also update after a short delay to handle any layout changes
    const timeout = setTimeout(updateIndicator, 10);
    
    return () => clearTimeout(timeout);
  }, [activeTab]);

  const handleTabChange = (
    _event: React.MouseEvent<HTMLElement>,
    newTab: "tags" | "segments" | null
  ) => {
    if (newTab !== null) {
      setActiveTab(newTab);
    }
  };

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
          HEADER PILL: Tab toggle (Tags/Segments)
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
          position: "relative",            // For absolute positioning of indicator
        }}
      >
        <Box
          ref={containerRef}
          sx={{
            position: "relative",
            display: "inline-flex",
          }}
        >
          {/* Sliding blue pill indicator */}
          <Box
            sx={{
              position: "absolute",
              top: `${indicatorStyle.top}px`,
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
              height: `${indicatorStyle.height}px`,
              backgroundColor: "#3B82F6",
              borderRadius: 999,
              transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1), top 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              zIndex: 0,
            }}
          />
          
          <ToggleButtonGroup
            value={activeTab}
            exclusive
            onChange={handleTabChange}
            aria-label="panel tabs"
            sx={{
              position: "relative",
              zIndex: 1,
              "& .MuiToggleButton-root": {
                border: "none",
                px: 2,
                py: 0.6,
                borderRadius: 999,
                fontWeight: 800,
                fontSize: "0.875rem",
                textTransform: "none",
                minWidth: "auto", // Prevent buttons from stretching
                transition: "color 0.2s ease-in-out", // Only transition color
                margin: "0 2px", // Add small margin between buttons to prevent overlap
                backgroundColor: "transparent", // Transparent background so indicator shows through
                "&.Mui-selected": {
                  backgroundColor: "transparent", // Transparent so blue pill shows
                  color: "white",
                  "&:hover": {
                    backgroundColor: "transparent",
                    color: "white",
                  },
                },
                "&:not(.Mui-selected)": {
                  color: COLORS.text,
                  "&:hover": {
                    backgroundColor: "transparent",
                    color: COLORS.text,
                  },
                },
              },
            }}
          >
            <ToggleButton 
              ref={tagsButtonRef}
              value="tags" 
              aria-label="tags tab"
            >
              <LocalOfferOutlinedIcon sx={{ fontSize: 18, mr: 0.75 }} />
              Tags
            </ToggleButton>
            <ToggleButton 
              ref={segmentsButtonRef}
              value="segments" 
              aria-label="segments tab"
            >
              <ViewListIcon sx={{ fontSize: 18, mr: 0.75 }} />
              Segments
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* ========================================================================
          MAIN CARD: Contains tag table or segment navigation
          ======================================================================== 
          
          Structure uses nested boxes for proper overflow handling:
          - Outer: position relative (for absolute child)
          - Middle: position absolute with inset 0 (fills parent)
          - Inner: flex 1 (allows content to handle its own scrolling)
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
          <Box 
            sx={{ 
              flex: 1, 
              minHeight: 0, 
              display: "flex", 
              flexDirection: "column",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Tags tab with fade animation */}
            {activeTab === "tags" && (
              <Fade in={true} timeout={300}>
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    height: "100%",
                  }}
                >
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
              </Fade>
            )}

            {/* Segments tab with fade animation */}
            {activeTab === "segments" && (
              <Fade in={true} timeout={300}>
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    height: "100%",
                  }}
                >
                  {/* View mode toggle - only show when segments exist */}
                  {segments.length > 0 && onViewModeChange && (
                    <Box
                      sx={{
                        px: 2,
                        pt: 2,
                        pb: 1.5,
                        borderBottom: `1px solid ${COLORS.border}`,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          mb: 1,
                          fontWeight: 600,
                          color: "text.secondary",
                          textTransform: "uppercase",
                          fontSize: "0.7rem",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Editor Mode
                      </Typography>
                      <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(_e, newMode) => {
                          if (newMode !== null) {
                            onViewModeChange(newMode);
                          }
                        }}
                        size="small"
                        fullWidth
                        sx={{
                          "& .MuiToggleButton-root": {
                            py: 0.75,
                            px: 1.5,
                            textTransform: "none",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            border: `1px solid ${COLORS.border}`,
                            "&.Mui-selected": {
                              backgroundColor: "rgba(139, 195, 74, 0.15)",
                              color: "rgba(139, 195, 74, 0.9)",
                              borderColor: "rgba(139, 195, 74, 0.4)",
                              "&:hover": {
                                backgroundColor: "rgba(139, 195, 74, 0.2)",
                              },
                            },
                            "&:not(.Mui-selected)": {
                              backgroundColor: "transparent",
                              color: "text.secondary",
                              "&:hover": {
                                backgroundColor: "rgba(0, 0, 0, 0.04)",
                              },
                            },
                          },
                        }}
                      >
                        <ToggleButton value="document">
                          <DescriptionIcon sx={{ fontSize: 18, mr: 0.75 }} />
                          Document
                        </ToggleButton>
                        <ToggleButton value="segments">
                          <ViewListIcon sx={{ fontSize: 18, mr: 0.75 }} />
                          Segments
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  )}

                  {/* 
                    SegmentNavBar renders:
                    - Scrollable list of segments
                    - Click to scroll to segment in editor (document mode)
                    - Click to load segment in editor (segment mode)
                    - Empty state message when no segments
                  */}
                  <SegmentNavBar
                    segments={segments}
                    activeSegmentId={activeSegmentId}
                    selectedSegmentId={selectedSegmentId ?? undefined}
                    viewMode={viewMode}
                    onSegmentClick={onSegmentClick}
                    text={text}
                  />
                </Box>
              </Fade>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default RightPanel;
