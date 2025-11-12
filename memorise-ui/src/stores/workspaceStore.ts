import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Workspace } from '../types/Workspace';
import { getWorkspaceApplicationService } from '../infrastructure/providers/workspaceProvider';

export interface WorkspaceStore {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadWorkspaces: (username: string) => Promise<void>;
  createWorkspace: (workspace: Workspace) => void;
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
          const service = getWorkspaceApplicationService();
          const loaded = await service.loadForOwner(username);
          if (loaded && loaded.length) {
            set({ workspaces: loaded, isLoading: false });
          } else {
            const seeded = service.seedForOwner(username);
            set({ workspaces: seeded, isLoading: false });
            await service.replaceAllForOwner(username, seeded);
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load workspaces',
            isLoading: false,
          });
        }
      },

      createWorkspace: (workspace) => {
        const normalisedWorkspace: Workspace = {
          userSpans: [],
          apiSpans: [],
          deletedApiKeys: [],
          translations: [],
          tags: [],
          ...workspace,
        };
        set((state) => ({
          workspaces: [normalisedWorkspace, ...state.workspaces],
        }));
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
