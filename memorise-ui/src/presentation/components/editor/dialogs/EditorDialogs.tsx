import React from "react";
import DeletionConfirmationDialog from "./DeletionConfirmationDialog.tsx";
import MultiDeletionDialog from "./MultiDeletionDialog.tsx";
import SegmentJoinDialog from "./SegmentJoinDialog.tsx";
import type { NerSpan } from "../../../../types/NotationEditor.ts";


export interface EditorDialogsProps {
    pendingDeletionId: string | null;
    pendingDeletionSpan: NerSpan | null;
    pendingDeletionText?: string;
    pendingProtectionIds: string[];
    pendingProtectionSpans: NerSpan[];
    spanTextsForMultiDelete: Map<string, string>;
    pendingJoinIds: [string, string] | null;
    onConfirmDelete: () => void;
    onCancelDelete: () => void;
    onConfirmMultiDelete: () => void;
    onCancelMultiDelete: () => void;
    onConfirmJoin: () => void;
    onCancelJoin: () => void;
  }


export const EditorDialogs: React.FC<EditorDialogsProps> = ({
  pendingDeletionId,
  pendingDeletionSpan,
  pendingDeletionText,
  pendingProtectionIds,
  pendingProtectionSpans,
  spanTextsForMultiDelete,
  pendingJoinIds,
  onConfirmDelete,
  onCancelDelete,
  onConfirmMultiDelete,
  onCancelMultiDelete,
  onConfirmJoin,
  onCancelJoin,
}) => {
  return (
    <>
      <DeletionConfirmationDialog 
        open={pendingDeletionId !== null} 
        span={pendingDeletionSpan} 
        spanText={pendingDeletionText} 
        onConfirm={onConfirmDelete} 
        onCancel={onCancelDelete} 
      />
      <MultiDeletionDialog 
        open={pendingProtectionIds.length > 0} 
        spans={pendingProtectionSpans} 
        spanTexts={spanTextsForMultiDelete} 
        onConfirm={onConfirmMultiDelete} 
        onCancel={onCancelMultiDelete} 
      />
      <SegmentJoinDialog 
        open={pendingJoinIds !== null} 
        onConfirm={onConfirmJoin} 
        onCancel={onCancelJoin} 
      />
    </>
  );
};