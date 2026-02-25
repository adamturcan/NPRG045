import React from "react";
import ConflictResolutionDialog from "../../editor/dialogs/ConflictResolutionDialog";
import type { useConflictResolution } from "../../../hooks/useConflictResolution";

interface Props {
  conflictResolution: ReturnType<typeof useConflictResolution>;
}

export const WorkspaceDialogLayer: React.FC<Props> = ({ conflictResolution }) => {
  const { conflictPrompt, resolveConflictPrompt } = conflictResolution;

  return (
    <>
      {/* Conflict Resolution Dialog */}
      {conflictPrompt && (
        <ConflictResolutionDialog
          prompt={conflictPrompt}
          onKeepExisting={() => resolveConflictPrompt("existing")}
          onKeepApi={() => resolveConflictPrompt("api")}
        />
      )}
    </>
  );
};
