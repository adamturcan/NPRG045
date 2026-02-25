
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

export type TagRow = { 
  name: string; 
  source: "api" | "user";
  keywordId?: number;
  parentId?: number;
  hierarchicalPath?: string[];
  isCategory?: boolean;
};

type TaxonomyNode = {
  path?: string[];
  synonyms?: string[];
};

interface Props {
  tags: TagRow[];
  onDeleteTag: (name: string, keywordId?: number, parentId?: number) => void;
  onAddTag: (name: string, keywordId?: number, parentId?: number) => void;


  tagInputField?: React.ReactNode;
  thesaurus?: {
    fetchSuggestions: (query: string) => Promise<ThesaurusItem[]>;
    restrictToThesaurus?: boolean;
    onRestrictChange?: (v: boolean) => void;
    defaultRestrictToThesaurus?: boolean;
    placeholder?: string;
    isThesaurusLoading?: boolean;
    resetKey?: string;
  };

  taxonomy?: Record<string, TaxonomyNode>;
  thesaurusIndex?: ThesaurusIndexItem[];

  segments?: Segment[];
  

  segmentOperations: {
    handleSegmentClick: (segment: Segment) => void;
    handleJoinSegments: (segmentId1: string, segmentId2: string) => void;
    handleSplitSegment: (segmentId: string) => void;
  };

  activeSegmentId?: string;

  viewMode?: "document" | "segments";
  onViewModeChange?: (mode: "document" | "segments") => void;

  text?: string;
}

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
      segmentOperations,
  activeSegmentId,
  viewMode = "document",
  onViewModeChange,
  text = "",
}) => {
  const shouldShowSegments = segments.length > 0;
  const [activeTab, setActiveTab] = useState<"tags" | "segments">(
    shouldShowSegments && viewMode === "segments" ? "segments" : "tags"
  );
  
    const prevViewModeRef = useRef<"document" | "segments">(viewMode);
  
  useEffect(() => {
    const prevViewMode = prevViewModeRef.current;
    if (prevViewMode === "document" && viewMode === "segments" && shouldShowSegments) {
      setActiveTab("segments");
    }
    prevViewModeRef.current = viewMode;
  }, [viewMode, shouldShowSegments]);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; top: number; height: number }>({
    left: 0,
    width: 0,
    top: 0,
    height: 0,
  });
  const tagsButtonRef = useRef<HTMLButtonElement>(null);
  const segmentsButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

    updateIndicator();
    
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
        width: 300,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        color: COLORS.text,
        mt: -1.1,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 0.5,
          borderRadius: 999,
          display: "inline-flex",
          alignSelf: "center",
          border: `1px solid ${COLORS.border}`,
          background: COLORS.pillBg,
          backdropFilter: "blur(6px)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
          mb: 1.25,
          position: "relative",
        }}
      >
        <Box
          ref={containerRef}
          sx={{
            position: "relative",
            display: "inline-flex",
          }}
        >
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
                minWidth: "auto",
                transition: "color 0.2s ease-in-out",
                margin: "0 2px",
                backgroundColor: "transparent",
                "&.Mui-selected": {
                  backgroundColor: "transparent",
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

      <Box
        sx={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          borderRadius: 3,
          background: "#FFFFFF",
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 14px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.25)",
          zIndex: 1,
        }}
      >
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
                  {viewMode === "segments" && activeSegmentId && (
                    <Box
                      sx={{
                        px: 2,
                        pt: 1.5,
                        pb: 1,
                        borderBottom: `1px solid ${COLORS.border}`,
                        backgroundColor: "rgba(59, 130, 246, 0.05)",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          fontWeight: 600,
                          color: "text.secondary",
                          fontSize: "0.75rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Segment Tags
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: "0.8125rem",
                          color: "text.primary",
                          mt: 0.25,
                        }}
                      >
                        {activeSegmentId}
                      </Typography>
                    </Box>
                  )}
                  <TagTable
                    data={tags}
                    onDelete={onDeleteTag}
                    inputField={tagInputField}
                    thesaurus={thesaurus}
                    taxonomy={taxonomy}
                    thesaurusIndex={thesaurusIndex}
                  />
                </Box>
              </Fade>
            )}

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

                  <SegmentNavBar
                    segments={segments}
                    activeSegmentId={activeSegmentId}
                    viewMode={viewMode}
                    onSegmentClick={segmentOperations.handleSegmentClick}
                    onJoinSegments={segmentOperations.handleJoinSegments}
                    onSplitSegment={segmentOperations.handleSplitSegment}
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
