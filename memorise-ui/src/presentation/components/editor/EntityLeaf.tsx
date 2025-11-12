// src/components/editor/EntityLeaf.tsx
/**
 * EntityLeaf - Custom leaf renderer for Slate.js that displays annotated entities
 * 
 * This component renders individual text spans in the editor, applying visual
 * styling to annotated entities (NER spans). It handles both annotated and
 * plain text rendering.
 * 
 * Features:
 * - Color-coded backgrounds and underlines based on entity type
 * - Active state highlighting when entity is selected
 * - Click handling for entity selection/deselection
 * - Smooth visual transitions
 */
import React from "react";
import { ENTITY_COLORS, hexToRgba, COLORS } from "../../../shared/constants/notationEditor";
import type { EntityLeafProps, NerSpan } from "../../../types/NotationEditor";

const EntityLeaf: React.FC<EntityLeafProps> = ({
  attributes,
  children,
  leaf,
  onSpanClick,
  activeSpan,
}) => {
  // Check if this leaf is part of a segment
  const isSegment = leaf.segment === true;
  const isActiveSegment = leaf.segmentActive === true;
  const isSegmentStart = leaf.segmentStart === true;
  const isSegmentEnd = leaf.segmentEnd === true;
  
  // Check if this leaf is part of an annotated entity span
  if (leaf.underline) {
    // Get the color scheme for this entity type
    const base = ENTITY_COLORS[leaf.entity as string] ?? "#37474F";
    const bg = hexToRgba(base, leaf.active ? 0.3 : 0.18); // More opaque when active
    const outline = hexToRgba(base, 0.55);

    /**
     * Handle clicks on annotated spans
     * - Clicking an active span deselects it
     * - Clicking an inactive span selects it and shows the edit bubble
     */
    const handleMouseDown: React.MouseEventHandler<HTMLSpanElement> = (e) => {
      // Prevent default text selection behavior
      e.preventDefault();
      e.stopPropagation();

      // Construct the clicked span object
      const clicked: NerSpan = {
        start: leaf.spanStart,
        end: leaf.spanEnd,
        entity: leaf.entity,
      };

      // Check if user clicked the currently active span
      const same =
        activeSpan &&
        activeSpan.start === clicked.start &&
        activeSpan.end === clicked.end &&
        activeSpan.entity === clicked.entity;

      if (same) {
        // Deselect if clicking the same span
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSpanClick(null as any);
      } else {
        // Select the new span
        onSpanClick(clicked);
      }
    };


    // Render annotated entity with styling
    return (
      <span
        {...attributes}
        onMouseDown={handleMouseDown}
        style={{
          position: "relative",
          borderRadius: 4,
          backgroundColor: bg,
          // Add outline border when active
          boxShadow: leaf.active
            ? `inset 0 0 0 1.5px ${outline}`
            : undefined,
          textDecoration: "underline",
          textDecorationStyle: "dotted",
          textDecorationColor: base,
          textDecorationThickness: "3px",
          textUnderlineOffset: "5px",
          cursor: "pointer",
          color: COLORS.text,
          transition: "box-shadow 0.15s ease",
        }}
        title={`${leaf.entity}`}
      >
        {children}
      </span>
    );
  }

  // Render plain text or segment (no entity annotation)
  const segmentStyle: React.CSSProperties = {
    color: COLORS.text,
    position: "relative",
  };

  // Add segment styling if this is a segment
  if (isSegment) {
    if (isActiveSegment) {
      // Active segment: full highlight with green background (no start border)
      segmentStyle.backgroundColor = "rgba(139, 195, 74, 0.15)";
      // Only add end border if this is the end marker
      if (isSegmentEnd) {
        segmentStyle.borderRight = "3px solid rgba(139, 195, 74, 0.6)";
        segmentStyle.paddingRight = "2px";
      }
      segmentStyle.transition = "background-color 0.2s, border-color 0.2s";
    } else if (isSegmentEnd) {
      // Inactive segment: only show end boundary marker
      segmentStyle.backgroundColor = "transparent";
      segmentStyle.position = "relative";
      segmentStyle.display = "inline-block";
      segmentStyle.borderRight = "2px solid rgba(139, 195, 74, 0.4)";
      segmentStyle.marginRight = "-2px"; // Compensate for border width
    } else {
      // Segment content (not end): no styling for inactive segments
      segmentStyle.backgroundColor = "transparent";
    }
  }

  return (
    <span 
      {...attributes} 
      style={segmentStyle}
    >
      {children}
    </span>
  );
};

export default EntityLeaf;
