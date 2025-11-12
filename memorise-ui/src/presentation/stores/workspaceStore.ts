import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Workspace } from '../../types/Workspace';
import { getWorkspaceApplicationService } from '../../infrastructure/providers/workspaceProvider';
import type { AppError } from '../../infrastructure/services/ErrorHandlingService';

export interface WorkspaceStore {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Save state tracking
  lastSavedState: Workspace[] | null;
  isSaving: boolean;
  saveError: AppError | null;

  // Actions
  loadWorkspaces: (username: string) => Promise<void>;
  createWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (id: string) => void;
  setCurrentWorkspace: (id: string) => void;
  clearError: () => void;
  
  // Save state management
  markSaveSuccess: () => void;
  markSaveFailed: (error: AppError) => void;
  rollbackToLastSaved: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  devtools(
    (set, get) => ({
      workspaces: [],
      currentWorkspaceId: null,
      isLoading: false,
      error: null,
      lastSavedState: null,
      isSaving: false,
      saveError: null,

      loadWorkspaces: async (username: string) => {
        set({ isLoading: true, error: null });
        try {
          const service = getWorkspaceApplicationService();
          const loaded = await service.loadForOwner(username);
          if (loaded && loaded.length) {
            set({ 
              workspaces: loaded, 
              isLoading: false,
              lastSavedState: loaded, // Mark loaded state as saved
            });
          } else {
            const seeded = service.seedForOwner(username);
            set({ 
              workspaces: seeded, 
              isLoading: false,
              lastSavedState: seeded, // Mark seeded state as saved
            });
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

      markSaveSuccess: () => {
        const currentWorkspaces = get().workspaces;
        set({ 
          isSaving: false, 
          saveError: null,
          lastSavedState: JSON.parse(JSON.stringify(currentWorkspaces)), // Deep clone
        });
      },

      markSaveFailed: (error: AppError) => {
        set({ 
          isSaving: false, 
          saveError: error,
        });
      },

      rollbackToLastSaved: () => {
        const lastSaved = get().lastSavedState;
        if (lastSaved !== null) {
          set({ 
            workspaces: JSON.parse(JSON.stringify(lastSaved)), // Deep clone
            saveError: null,
          });
        }
      },
    }),
    { name: 'workspace-store' }
  )
);
