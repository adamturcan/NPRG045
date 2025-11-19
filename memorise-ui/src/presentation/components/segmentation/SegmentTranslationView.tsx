/**
 * SegmentTranslationView - Component for per-segment translation
 * 
 * Displays segments as cards with translate buttons, allowing users to
 * translate individual segments rather than the whole document.
 * 
 * Features:
 * - Shows all segments as cards
 * - Each card displays original segment text
 * - Translate button for each segment
 * - Shows translation status (translated ✓ or not)
 * - Displays translated text when available
 */
import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  CircularProgress,
  Chip,
} from "@mui/material";
import TranslateIcon from "@mui/icons-material/Translate";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { Segment } from "../../../types/Segment";
import { getSegmentText } from "../../../types/Segment";
import type { LanguageCode } from "../../../shared/utils/translation";

interface Props {
  /** Segments to display */
  segments: Segment[];
  
  /** Full text to derive segment text from indices */
  text?: string;
  
  /** Current translation language */
  targetLang: LanguageCode;
  
  /** Existing segment translations: segmentId → translatedText */
  segmentTranslations?: {
    [segmentId: string]: string;
  };
  
  /** Callback when user clicks translate for a segment */
  onTranslateSegment: (segment: Segment) => Promise<void>;
  
  /** Whether a translation is in progress */
  isTranslating?: boolean;
  
  /** Currently translating segment ID (if any) */
  translatingSegmentId?: string | null;
}

const SegmentTranslationView: React.FC<Props> = ({
  segments,
  text = "",
  targetLang,
  segmentTranslations = {},
  onTranslateSegment,
  isTranslating = false,
  translatingSegmentId = null,
}) => {
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());

  const toggleExpand = (segmentId: string) => {
    setExpandedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) {
        next.delete(segmentId);
      } else {
        next.add(segmentId);
      }
      return next;
    });
  };

  const isTranslated = (segmentId: string) => {
    return segmentTranslations[segmentId] !== undefined;
  };

  const getTranslatedText = (segmentId: string) => {
    return segmentTranslations[segmentId] || "";
  };

  if (segments.length === 0) {
    return (
      <Box
        sx={{
          p: 3,
          textAlign: "center",
          color: "text.secondary",
        }}
      >
        <Typography variant="body2">
          No segments available. Run segmentation first to enable per-segment translation.
        </Typography>
      </Box>
    );
  }

  // Sort segments by start position (or order) to ensure correct sequence
  // Use the sorted array index for numbering, not the API's order field
  const sortedSegments = [...segments].sort((a, b) => {
    // First try sorting by start position
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    // If start positions are equal, fall back to order
    return a.order - b.order;
  });

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        p: 2,
        maxHeight: "calc(100vh - 200px)",
        overflowY: "auto",
      }}
    >
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
        Segment Translations ({targetLang.toUpperCase()})
      </Typography>
      
      <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
        Translate individual segments. Each segment can be translated independently.
      </Typography>

      {sortedSegments.map((segment, index) => {
        const translated = isTranslated(segment.id);
        const isCurrentlyTranslating = translatingSegmentId === segment.id;
        const isExpanded = expandedSegments.has(segment.id);
        const translatedText = getTranslatedText(segment.id);

        return (
          <Card
            key={segment.id}
            sx={{
              border: "1px solid #E2E8F0",
              borderRadius: 2,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              transition: "box-shadow 0.2s ease",
              "&:hover": {
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              },
            }}
          >
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              {/* Segment header */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 1.5,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip
                    label={`Segment ${index + 1}`}
                    size="small"
                    sx={{
                      backgroundColor: "rgba(139, 195, 74, 0.15)",
                      color: "rgba(139, 195, 74, 0.9)",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                    }}
                  />
                  {translated && (
                    <Chip
                      icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                      label="Translated"
                      size="small"
                      color="success"
                      sx={{ fontSize: "0.75rem" }}
                    />
                  )}
                </Box>

                <Button
                  variant={translated ? "outlined" : "contained"}
                  size="small"
                  startIcon={
                    isCurrentlyTranslating ? (
                      <CircularProgress size={16} />
                    ) : (
                      <TranslateIcon fontSize="small" />
                    )
                  }
                  onClick={() => onTranslateSegment(segment)}
                  disabled={isTranslating}
                  sx={{
                    textTransform: "none",
                    minWidth: 120,
                  }}
                >
                  {isCurrentlyTranslating
                    ? "Translating..."
                    : translated
                    ? "Re-translate"
                    : "Translate"}
                </Button>
              </Box>

              {/* Original segment text */}
              <Box
                sx={{
                  mb: translated ? 1.5 : 0,
                  p: 1.5,
                  backgroundColor: "rgba(0, 0, 0, 0.02)",
                  borderRadius: 1,
                  border: "1px solid rgba(0, 0, 0, 0.05)",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    mb: 0.5,
                    fontWeight: 600,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    fontSize: "0.7rem",
                  }}
                >
                  Original
                </Typography>
                <Typography variant="body2" sx={{ color: "text.primary" }}>
                  {segment.text ?? getSegmentText(segment, text)}
                </Typography>
              </Box>

              {/* Translated text (if available) */}
              {translated && (
                <Box
                  sx={{
                    p: 1.5,
                    backgroundColor: "rgba(139, 195, 74, 0.05)",
                    borderRadius: 1,
                    border: "1px solid rgba(139, 195, 74, 0.2)",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      mb: 0.5,
                      fontWeight: 600,
                      color: "text.secondary",
                      textTransform: "uppercase",
                      fontSize: "0.7rem",
                    }}
                  >
                    Translation ({targetLang.toUpperCase()})
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.primary" }}>
                    {translatedText}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
};

export default SegmentTranslationView;


