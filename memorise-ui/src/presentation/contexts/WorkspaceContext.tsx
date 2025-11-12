/**
 * ⚠️ PHASE 3 RESERVATION ⚠️
 * 
 * This WorkspaceContext is reserved for Phase 3 multi-tenant architecture.
 * 
 * Current Phase 1/2 approach: Use Zustand store directly in components.
 * This context will be needed when:
 * - Organization-scoped workspace contexts are required
 * - Real-time updates need broadcasting across components
 * - API-backed workspace loading with different auth contexts
 * 
 * Do not delete - will be implemented in Phase 3.
 * 
 * Phase 3 Use Case:
 * ```tsx
 * <OrganizationProvider orgId={orgId}>
 *   <WorkspaceProvider>
 *     <WorkspaceContainer />
 *   </WorkspaceProvider>
 * </OrganizationProvider>
 * ```
 */

import React, { createContext, useContext, useCallback } from "react";
import type { Workspace } from "../../types/Workspace";

/**
 * Workspace context type
 */
interface WorkspaceContextType {
  /** Update a workspace by ID */
  updateWorkspace: (
    id: string,
    updater: (workspace: Workspace) => Workspace
  ) => void;
  /** Get all workspaces */
  workspaces: Workspace[];
}

/**
 * Workspace context for managing workspace state updates
 * 
 * Eliminates prop drilling of setWorkspaces through multiple hooks.
 * Provides a clean API for workspace updates.
 */
const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

/**
 * Props for WorkspaceProvider
 */
interface WorkspaceProviderProps {
  children: React.ReactNode;
  workspaces: Workspace[];
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>;
}

/**
 * Provider component for workspace context
 * 
 * Wrap your workspace-related components with this provider.
 * 
 * @example
 * ```tsx
 * <WorkspaceProvider workspaces={workspaces} setWorkspaces={setWorkspaces}>
 *   <WorkspaceContainer />
 * </WorkspaceProvider>
 * ```
 */
export function WorkspaceProvider({
  children,
  workspaces,
  setWorkspaces,
}: WorkspaceProviderProps) {
  const updateWorkspace = useCallback(
    (id: string, updater: (workspace: Workspace) => Workspace) => {
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === id ? updater(w) : w))
      );
    },
    [setWorkspaces]
  );

  const value = {
    updateWorkspace,
    workspaces,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Hook to access workspace context
 * 
 * Must be used within a WorkspaceProvider.
 * 
 * @returns Workspace context value
 * @throws Error if used outside of WorkspaceProvider
 * 
 * @example
 * ```tsx
 * const { updateWorkspace } = useWorkspaceContext();
 * 
 * // Update a workspace
 * updateWorkspace(workspaceId, (ws) => ({
 *   ...ws,
 *   text: newText,
 *   updatedAt: Date.now(),
 * }));
 * ```
 */
export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  
  if (!context) {
    throw new Error(
      "useWorkspaceContext must be used within a WorkspaceProvider"
    );
  }
  
  return context;
}

