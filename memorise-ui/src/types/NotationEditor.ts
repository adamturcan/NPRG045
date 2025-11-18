// src/types/NotationEditor.ts
import type {  BaseEditor } from "slate";
import type { ReactEditor } from "slate-react";
import type { HistoryEditor } from "slate-history";

/** ---- Slate custom types ---- */
type ParagraphElement = { type: "paragraph"; children: { text: string }[] };

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: ParagraphElement;
    Text: { text: string };
  }
}

/** ---- Span type ---- */
export type NerSpan = {
  start: number;
  end: number;
  entity: string;
  score?: number;
};

export type SelectionBox = {
  top: number;
  left: number;
  start: number;
  end: number;
};

export type SpanBox = {
  top: number;
  left: number;
  span: NerSpan;
};

export type DeletionWarningBox = {
  top: number;
  left: number;
  affectedSpans: NerSpan[];
};

export type LeafInfo = { 
  path: number[]; 
  gStart: number; 
  gEnd: number; 
  len: number 
};

export interface NotationEditorProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  spans?: NerSpan[];
  onDeleteSpan?: (span: NerSpan) => void;
  highlightedCategories?: string[];
  onSelectionChange?: (sel: { start: number; end: number } | null) => void;
  /** Called whenever editor adjusts span indices due to text edits */
  onSpansAdjusted?: (next: NerSpan[]) => void;
  /** Called whenever editor adjusts segment indices due to text edits */
  onSegmentsAdjusted?: (next: Array<{ id: string; start: number; end: number; order: number }>) => void;
  /** keys: `${start}:${end}:${entity}` */
  deletableKeys?: Set<string>;
  /** adding a span via selection "…" menu or change-category */
  onAddSpan?: (span: NerSpan) => void;
  /** segments for visual markers */
  segments?: Array<{ id: string; start: number; end: number; order: number }>;
  /** active segment ID for highlighting */
  activeSegmentId?: string;
  /** selected segment ID in segment view mode - used to adjust annotation offsets */
  selectedSegmentId?: string;
}

export interface EntityLeafProps {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: any;
  children: React.ReactNode;
  leaf: {
    underline?: boolean;
    entity?: string;
    spanStart?: number;
    spanEnd?: number;
    active?: boolean;
    segment?: boolean;
    segmentId?: string;
    segmentOrder?: number;
    segmentActive?: boolean;
    segmentStart?: boolean;
    segmentEnd?: boolean;
  };
  onSpanClick: (span: NerSpan) => void;
  activeSpan: NerSpan | null;
}

export interface SelectionBubbleProps {
  selectionBox: SelectionBox;
  onMenuClick: (event: React.MouseEvent<HTMLElement>) => void;
  onMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
}

export interface SpanBubbleProps {
  spanBox: SpanBox;
  onMenuClick: (event: React.MouseEvent<HTMLElement>) => void;
  onMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
}

export interface CategoryMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onCategorySelect: (category: string) => void;
  onMouseDown: (event: React.MouseEvent) => void;
  showDelete?: boolean;
  onDelete?: () => void;
}

export interface EditorContainerProps {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
}
