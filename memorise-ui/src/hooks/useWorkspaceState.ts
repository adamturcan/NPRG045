import { useMemo } from "react";
import type { Workspace } from "../types/Workspace";

/**
 * Hook for managing workspace selection state
 * 
 * Finds the current workspace based on route parameter, with fallback logic.
 * Returns the selected workspace, its ID, and loading state.
 * 
 * @param workspaces - Array of available workspaces
 * @param routeId - Workspace ID from route parameter (optional)
 * @returns Object containing currentWorkspace, currentId, and isLoading
 */
export function useWorkspaceState(
  workspaces: Workspace[],
  routeId?: string
) {
  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === routeId) ?? workspaces[0],
    [workspaces, routeId]
  );

  const currentId = currentWorkspace?.id ?? null;
  const isLoading = !routeId || workspaces.length === 0;

  return {
    currentWorkspace,
    currentId,
    isLoading,
  };
}

