// src/presentation/components/editor/NotationOverlayLayer.tsx
import React from "react";
import Bubble from "../bubbles/Bubble";
import CategoryMenu from "../CategoryMenu";
import DeletionConfirmationDialog from "../dialogs/DeletionConfirmationDialog";
import MultiDeletionDialog from "../dialogs/MultiDeletionDialog";
import type { NerSpan, SelectionBox, SpanBox } from "../../../../types/NotationEditor";

interface UIState {
  selBox: SelectionBox | null;
  spanBox: SpanBox | null;
  selMenuAnchor: HTMLElement | null;
  spanMenuAnchor: HTMLElement | null;
  setSelMenuAnchor: (el: HTMLElement | null) => void;
  setSpanMenuAnchor: (el: HTMLElement | null) => void;
  handleSelectionClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleSpanClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleSelectionMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  handleSpanMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  handleMenuMouseDown: (e: React.MouseEvent) => void;
  dialogs: {
    pendingDeletion: NerSpan | null;
    pendingMultiDeletion: NerSpan[];
    getSpanText: (span: NerSpan) => string;
    getSpanTexts: (spans: NerSpan[]) => Map<string, string>;
    confirmDeleteSpan: () => void;
    cancelDeleteSpan: () => void;
    confirmMultiDeleteSpans: (selectedSpans: NerSpan[]) => void;
    cancelMultiDeleteSpans: () => void;
    requestDeleteSpan: (span: NerSpan) => void;
  };
  actions: {
    pickCategoryForRange: (start: number, end: number, currentEntity?: string) => (cat: string) => void;
    onDeleteSpan?: (span: NerSpan) => void;
  };
}

export const NotationOverlayLayer = ({ uiState }: { uiState: UIState }) => {
  const { 
    selBox, spanBox, selMenuAnchor, spanMenuAnchor,
    setSelMenuAnchor, setSpanMenuAnchor,
    handleSelectionClick, handleSpanClick,
    handleSelectionMouseDown, handleSpanMouseDown, handleMenuMouseDown,
    actions, dialogs
  } = uiState;

  return (
    <>
      {/* --- Bubbles --- */}
      {selBox && (
        <Bubble
          box={selBox}
          tooltip="Add to category"
          onMenuClick={handleSelectionClick}
          onMouseDown={handleSelectionMouseDown}
        />
      )}
      {spanBox && (
        <Bubble
          box={spanBox}
          tooltip="Edit entity"
          onMenuClick={handleSpanClick}
          onMouseDown={handleSpanMouseDown}
        />
      )}

      {/* --- Menus --- */}
      <CategoryMenu
        anchorEl={selMenuAnchor}
        onClose={() => setSelMenuAnchor(null)}
        onCategorySelect={(cat: string) => selBox && actions.pickCategoryForRange(selBox.start, selBox.end)(cat)}
        onMouseDown={handleMenuMouseDown}
      />
      
      <CategoryMenu
        anchorEl={spanMenuAnchor}
        onClose={() => setSpanMenuAnchor(null)}
        
        onCategorySelect={(cat: string) => 
          spanBox && actions.pickCategoryForRange(spanBox.span.start, spanBox.span.end, spanBox.span.entity)(cat)
        }
        
        onMouseDown={handleMenuMouseDown}
        showDelete={true}
        
        onDelete={() => {
          if (spanBox?.span) {
            actions.onDeleteSpan?.(spanBox.span);
          }
        }}
      />

      {/* --- Dialogs --- */}
      <DeletionConfirmationDialog
        open={dialogs.pendingDeletion !== null}
        span={dialogs.pendingDeletion}
        spanText={dialogs.pendingDeletion ? dialogs.getSpanText(dialogs.pendingDeletion) : undefined}
        onConfirm={dialogs.confirmDeleteSpan}
        onCancel={dialogs.cancelDeleteSpan}
      />
      <MultiDeletionDialog
        open={dialogs.pendingMultiDeletion.length > 0}
        spans={dialogs.pendingMultiDeletion}
        spanTexts={dialogs.pendingMultiDeletion.length > 0 ? dialogs.getSpanTexts(dialogs.pendingMultiDeletion) : new Map()}
        onConfirm={dialogs.confirmMultiDeleteSpans}
        onCancel={dialogs.cancelMultiDeleteSpans}
      />
    </>
  );
};