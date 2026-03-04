import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { WorkspaceMetadata } from '../../core/entities/Workspace';

export interface WorkspaceStore {
  workspaces: WorkspaceMetadata[];
  owner: string | null;
  currentWorkspaceId: string | null;

  setWorkspaces: (list: WorkspaceMetadata[], owner: string) => void;
  addWorkspaceMetadata: (metadata: WorkspaceMetadata) => void;
  updateWorkspaceMetadata: (id: string, updates: Partial<WorkspaceMetadata>) => void;
  removeWorkspaceMetadata: (id: string) => void;
  setCurrentWorkspace: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  devtools(
    (set) => ({
      workspaces: [],
      owner: null,
      currentWorkspaceId: null,

      setWorkspaces: (list, owner) => {
        set({ workspaces: list, owner });
      },

      addWorkspaceMetadata: (metadata) => {
        set((state) => ({ workspaces: [metadata, ...state.workspaces] }));
      },

      updateWorkspaceMetadata: (id, updates) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) => 
            w.id === id ? { ...w, ...updates, updatedAt: Date.now() } : w
          ),
        }));
      },

      removeWorkspaceMetadata: (id) => {
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
        }));
      },

      setCurrentWorkspace: (id) => {
        set({ currentWorkspaceId: id });
      },
    }),
    { name: 'workspace-store' }
  )
);