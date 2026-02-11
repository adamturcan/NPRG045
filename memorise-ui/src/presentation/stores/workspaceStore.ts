import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Workspace } from '../../types/Workspace';
import type { WorkspaceMetadata } from '../../core/entities/Workspace';
import { getWorkspaceApplicationService } from '../../infrastructure/providers/workspaceProvider';
import type { AppError } from '../../infrastructure/services/ErrorHandlingService';

export interface WorkspaceStore {
  // Metadata-first: lightweight list for UI navigation
  workspaces: WorkspaceMetadata[];
  
  // Full workspaces cache for backward compatibility
  fullWorkspaces: Workspace[];
  
  currentWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Save state tracking
  lastSavedState: Workspace[] | null;
  isSaving: boolean;
  saveError: AppError | null;

  // Actions
  loadWorkspaces: (username: string) => Promise<void>;
  setWorkspaces: (list: WorkspaceMetadata[]) => void;
  createWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (id: string) => void;
  setCurrentWorkspace: (id: string) => void;
  clearError: () => void;
  
  // Save state management (DEPRECATED - for backward compatibility only)
  // DEPRECATED: Use optimistic updates with proper error handling instead
  markSaveSuccess: () => void;
  // DEPRECATED: Use optimistic updates with proper error handling instead
  markSaveFailed: (error: AppError) => void;
  // DEPRECATED: Use optimistic updates with proper error handling instead
  rollbackToLastSaved: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  devtools(
    (set, get) => ({
      workspaces: [],
      fullWorkspaces: [],
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
            // Extract metadata for the lightweight list
            const metadata: WorkspaceMetadata[] = loaded.map(ws => ({
              id: ws.id,
              name: ws.name,
              owner: ws.owner ?? username,
              updatedAt: ws.updatedAt ?? Date.now(),
            }));
            
            set({ 
              workspaces: metadata,
              fullWorkspaces: loaded,
              isLoading: false,
              lastSavedState: loaded, // Mark loaded state as saved
            });
          } else {
            const seeded = service.seedForOwner(username);
            const metadata: WorkspaceMetadata[] = seeded.map(ws => ({
              id: ws.id,
              name: ws.name,
              owner: ws.owner ?? username,
              updatedAt: ws.updatedAt ?? Date.now(),
            }));
            
            set({ 
              workspaces: metadata,
              fullWorkspaces: seeded,
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

      setWorkspaces: (list: WorkspaceMetadata[]) => {
        set({ workspaces: list });
      },

      createWorkspace: (workspace) => {
        const now = Date.now();
        const normalisedWorkspace: Workspace = {
          userSpans: [],
          apiSpans: [],
          deletedApiKeys: [],
          translations: [],
          tags: [],
          updatedAt: now,
          ...workspace,
        };
        
        const metadata: WorkspaceMetadata = {
          id: normalisedWorkspace.id,
          name: normalisedWorkspace.name,
          owner: normalisedWorkspace.owner ?? '',
          updatedAt: normalisedWorkspace.updatedAt ?? now,
        };
        
        set((state) => ({
          workspaces: [metadata, ...state.workspaces],
          fullWorkspaces: [normalisedWorkspace, ...state.fullWorkspaces],
        }));
      },

      updateWorkspace: (id, updates) => {
        const now = Date.now();
        const updatesWithTimestamp = { ...updates, updatedAt: now };
        
        set((state) => {
          // Update full workspaces
          const updatedFullWorkspaces = state.fullWorkspaces.map((w) =>
            w.id === id ? { ...w, ...updatesWithTimestamp } : w
          );
          
          // Update metadata list
          const updatedMetadata = state.workspaces.map((w) => {
            if (w.id !== id) return w;
            
            return {
              id: w.id,
              name: updates.name !== undefined ? updates.name : w.name,
              owner: w.owner,
              updatedAt: now,
            };
          });
          
          return {
            workspaces: updatedMetadata,
            fullWorkspaces: updatedFullWorkspaces,
          };
        });
      },

      deleteWorkspace: (id) => {
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
          fullWorkspaces: state.fullWorkspaces.filter((w) => w.id !== id),
        }));
      },

      setCurrentWorkspace: (id) => {
        set({ currentWorkspaceId: id });
      },

      clearError: () => {
        set({ error: null });
      },

      // DEPRECATED: Use optimistic updates with proper error handling instead
      markSaveSuccess: () => {
        const currentFullWorkspaces = get().fullWorkspaces;
        set({ 
          isSaving: false, 
          saveError: null,
          lastSavedState: JSON.parse(JSON.stringify(currentFullWorkspaces)), // Deep clone
        });
      },

      // DEPRECATED: Use optimistic updates with proper error handling instead
      markSaveFailed: (error: AppError) => {
        set({ 
          isSaving: false, 
          saveError: error,
        });
      },

      // DEPRECATED: Use optimistic updates with proper error handling instead
      rollbackToLastSaved: () => {
        const lastSaved = get().lastSavedState;
        if (lastSaved !== null) {
          const restoredFullWorkspaces = JSON.parse(JSON.stringify(lastSaved)); // Deep clone
          const restoredMetadata: WorkspaceMetadata[] = restoredFullWorkspaces.map((ws: Workspace) => ({
            id: ws.id,
            name: ws.name,
            owner: ws.owner ?? '',
            updatedAt: ws.updatedAt ?? Date.now(),
          }));
          
          set({ 
            workspaces: restoredMetadata,
            fullWorkspaces: restoredFullWorkspaces,
            saveError: null,
          });
        }
      },
    }),
    { name: 'workspace-store' }
  )
);
