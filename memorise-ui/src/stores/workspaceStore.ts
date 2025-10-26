import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Workspace } from '../types/Workspace';
import { WorkspaceService } from '../services/workspaceService';

interface WorkspaceStore {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadWorkspaces: (username: string) => Promise<void>;
  createWorkspace: (workspace: Omit<Workspace, 'id'>) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (id: string) => void;
  setCurrentWorkspace: (id: string) => void;
  clearError: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  devtools(
    (set) => ({
      workspaces: [],
      currentWorkspaceId: null,
      isLoading: false,
      error: null,

      loadWorkspaces: async (username: string) => {
        set({ isLoading: true, error: null });
        try {
          const loaded = WorkspaceService.loadForUser(username);
          if (loaded && loaded.length) {
            set({ workspaces: loaded, isLoading: false });
          } else {
            const seeded = WorkspaceService.seedForUser(username);
            set({ workspaces: seeded, isLoading: false });
            WorkspaceService.saveForUser(username, seeded);
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load workspaces',
            isLoading: false,
          });
        }
      },

      createWorkspace: (workspaceData) => {
        const newWorkspace: Workspace = {
          id: crypto.randomUUID(),
          ...workspaceData,
          userSpans: workspaceData.userSpans || [],
          updatedAt: Date.now(),
        };
        set((state) => ({ workspaces: [newWorkspace, ...state.workspaces] }));
      },

      updateWorkspace: (id, updates) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, ...updates, updatedAt: Date.now() } : w
          ),
        }));
      },

      deleteWorkspace: (id) => {
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
        }));
      },

      setCurrentWorkspace: (id) => {
        set({ currentWorkspaceId: id });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'workspace-store' }
  )
);
