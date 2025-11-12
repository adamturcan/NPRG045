import { useEffect } from "react";
import type { Workspace } from "../../types/Workspace";

/**
 * Options for useWorkspaceHydration hook
 */
interface WorkspaceHydrationOptions {
  /** Current workspace ID */
  workspaceId: string | null;
  /** Current workspace data */
  workspace: Workspace | undefined;
  /** Callback when hydration should happen */
  onHydrate: (data: {
    text: string;
    editorKey: string;
  }) => void;
  /** Callback when hydration starts (before data loads) */
  onHydrationStart?: () => void;
  /** Callback when hydration completes (after data loads) */
  onHydrationComplete?: (workspaceId: string) => void;
}

/**
 * Hook for managing workspace hydration
 * 
 * Handles loading workspace data when the workspace changes.
 * Coordinates with autosave to prevent saving during hydration.
 * 
 * @param options - Configuration options
 */
export function useWorkspaceHydration(options: WorkspaceHydrationOptions) {
  const {
    workspaceId,
    workspace,
    onHydrate,
    onHydrationStart,
    onHydrationComplete,
  } = options;

  useEffect(() => {
    if (!workspaceId || !workspace) return;
    
    // Signal hydration start (disable autosave, etc.)
    onHydrationStart?.();
    
    // Load workspace data
    onHydrate({
      text: workspace.text || "",
      editorKey: `${workspaceId}:${workspace.updatedAt ?? 0}`,
    });
    
    // Signal hydration complete after React has updated state
    // Use Promise.resolve to defer to next tick
    Promise.resolve().then(() => {
      onHydrationComplete?.(workspaceId);
    });
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]); // Only re-hydrate when workspace ID changes
}

