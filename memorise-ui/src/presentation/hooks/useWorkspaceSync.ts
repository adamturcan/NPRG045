/**
 * useWorkspaceSync - Hook to create a setWorkspaces-compatible function
 * 
 * This hook provides a wrapper function that syncs workspace array changes
 * back to the Zustand store. It's designed to be compatible with the old
 * setWorkspaces API used by various hooks.
 * 
 * Features:
 * - Always gets fresh state from Zustand to avoid stale closures
 * - Compares workspaces and only updates changed ones
 * - Memoized to prevent recreation on every render
 * 
 * @returns Function to update workspaces array, compatible with setWorkspaces API
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '../stores/workspaceStore';
import type { Workspace } from '../../types/Workspace';

export function useWorkspaceSync() {
  const { updateWorkspace } = useWorkspaceStore(
    useShallow((state) => ({ updateWorkspace: state.updateWorkspace }))
  );
  const getWorkspaces = useWorkspaceStore.getState;

  // Create setWorkspaces-compatible function for hooks
  // Always gets fresh state from Zustand to avoid stale closures
  return useMemo(
    () => {
      return (updater: Workspace[] | ((prev: Workspace[]) => Workspace[])) => {
        // Always get fresh state from Zustand
        const currentWorkspaces = getWorkspaces().workspaces;
        const newWorkspaces = typeof updater === 'function' 
          ? updater(currentWorkspaces)
          : updater;
        
        // Sync changes back to Zustand store
        // Compare each workspace and call updateWorkspace for changed ones
        newWorkspaces.forEach((newWs) => {
          const oldWs = currentWorkspaces.find(w => w.id === newWs.id);
          
          // If workspace doesn't exist in old array, or if it changed, update it
          if (!oldWs || oldWs !== newWs) {
            // Use updateWorkspace with the full new workspace as updates
            // Zustand will merge this with existing workspace
            updateWorkspace(newWs.id, newWs);
          }
        });
      };
    },
    [updateWorkspace, getWorkspaces]
  );
}

