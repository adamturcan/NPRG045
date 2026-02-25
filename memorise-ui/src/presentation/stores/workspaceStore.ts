import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Workspace } from '../../types/Workspace';
import type { WorkspaceMetadata } from '../../core/entities/Workspace';
import { getWorkspaceApplicationService } from '../../infrastructure/providers/workspaceProvider';

export interface WorkspaceStore {
  
  workspaces: WorkspaceMetadata[];
  
  // Owner of the currently loaded workspaces
  owner: string | null;
  
  currentWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;

 
  loadWorkspaces: (username: string) => Promise<void>;
  setWorkspaces: (list: WorkspaceMetadata[]) => void;
  createWorkspace: (workspace: Workspace) => Promise<void>;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setCurrentWorkspace: (id: string) => void;
  clearError: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  devtools(
    (set, get) => ({
      workspaces: [],
      owner: null,
      currentWorkspaceId: null,
      isLoading: false,
      error: null,

      loadWorkspaces: async (username: string) => {
        set({ isLoading: true, error: null });
        try {
          const service = getWorkspaceApplicationService();
          const loaded = await service.loadForOwner(username);
          if (loaded && loaded.length) {        
            const metadata: WorkspaceMetadata[] = loaded.map(ws => ({
              id: ws.id,
              name: ws.name,
              owner: ws.owner ?? username,
              updatedAt: ws.updatedAt ?? Date.now(),
            }));
            
            set({ 
              workspaces: metadata,
              owner: username,
              isLoading: false,
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
              owner: username,
              isLoading: false,
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

      createWorkspace: async (workspace) => {
        const owner = get().owner;
        if (!owner) {
          set({ error: 'No owner set. Please log in first.' });
          return;
        }

        const now = Date.now();
        const normalisedWorkspace: Workspace = {
          userSpans: [],
          apiSpans: [],
          deletedApiKeys: [],
          translations: [],
          tags: [],
          updatedAt: now,
          ...workspace,
          owner, 
        };
        
        const metadata: WorkspaceMetadata = {
          id: normalisedWorkspace.id,
          name: normalisedWorkspace.name,
          owner: normalisedWorkspace.owner ?? owner,
          updatedAt: normalisedWorkspace.updatedAt ?? now,
        };
        
        
        const previousState = {
          workspaces: get().workspaces,
        };
        
        set((state) => ({
          workspaces: [metadata, ...state.workspaces],
        }));

        
        try {
          const service = getWorkspaceApplicationService();
          await service.createWorkspace({
            ownerId: owner,
            workspaceId: normalisedWorkspace.id,
            name: normalisedWorkspace.name,
            text: normalisedWorkspace.text,
            isTemporary: normalisedWorkspace.isTemporary,
            userSpans: normalisedWorkspace.userSpans,
            apiSpans: normalisedWorkspace.apiSpans,
            deletedApiKeys: normalisedWorkspace.deletedApiKeys,
            tags: normalisedWorkspace.tags,
            translations: normalisedWorkspace.translations,
            updatedAt: normalisedWorkspace.updatedAt,
          });
        } catch (error) {
          set({
            workspaces: previousState.workspaces,
            error: error instanceof Error ? error.message : 'Failed to create workspace',
          });
          console.error('Failed to persist workspace creation:', error);
        }
      },

      updateWorkspace: async (id, updates) => {
        const now = Date.now();
        const updatesWithTimestamp = { ...updates, updatedAt: now };
        
        const previousState = {
          workspaces: get().workspaces,
        };
        
        set((state) => {
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
          };
        });

        try {
          const service = getWorkspaceApplicationService();
          await service.updateWorkspace({
            workspaceId: id,
            patch: updatesWithTimestamp,
          });
        } catch (error) {
          set({
            workspaces: previousState.workspaces,
            error: error instanceof Error ? error.message : 'Failed to update workspace',
          });
          console.error('Failed to persist workspace update:', error);
        }
      },

      deleteWorkspace: async (id) => {
        const previousState = {
          workspaces: get().workspaces,
        };
        
        set((state) => ({
            workspaces: state.workspaces.filter((w) => w.id !== id),
        }));

        try {
          const service = getWorkspaceApplicationService();
          await service.deleteWorkspace(id);
        } catch (error) {
          set({
            workspaces: previousState.workspaces,
            error: error instanceof Error ? error.message : 'Failed to delete workspace',
          });
          console.error('Failed to persist workspace deletion:', error);
        }
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
