import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { NerSpan } from '../../types/NotationEditor';
import type { TagItem } from '../../types/Tag';
import type { Translation } from '../../types/Workspace';

/**
 * Session Store
 * 
 * Manages the active editing session for the currently open workspace.
 * This store is decoupled from the workspaceStore and tracks the "working set"
 * of data that the user is actively editing, along with dirty state tracking
 * for auto-save functionality.
 */

export interface WorkingSet {
  workspaceId: string | null;
  text: string;
  userSpans: NerSpan[];
  apiSpans: NerSpan[];
  deletedApiKeys: string[];
  tags: TagItem[];
  translations: Translation[];
}

export interface SessionStore {
  // Active editing state
  workingSet: WorkingSet;
  
  // Dirty tracking for auto-save
  isDirty: boolean;
  lastChangedAt: number;
  
  // Actions
  updateWorkingSet: (data: Partial<WorkingSet>) => void;
  setDirty: (status: boolean) => void;
  resetSession: () => void;
  loadWorkingSet: (workspaceId: string, data: Partial<WorkingSet>) => void;
}

const initialWorkingSet: WorkingSet = {
  workspaceId: null,
  text: '',
  userSpans: [],
  apiSpans: [],
  deletedApiKeys: [],
  tags: [],
  translations: [],
};

export const useSessionStore = create<SessionStore>()(
  devtools(
    (set) => ({
      workingSet: initialWorkingSet,
      isDirty: false,
      lastChangedAt: 0,

      updateWorkingSet: (data) => {
        set((state) => ({
          workingSet: {
            ...state.workingSet,
            ...data,
          },
          isDirty: true,
          lastChangedAt: Date.now(),
        }));
      },

      setDirty: (status) => {
        set({ isDirty: status });
      },

      resetSession: () => {
        set({
          workingSet: initialWorkingSet,
          isDirty: false,
          lastChangedAt: 0,
        });
      },

      loadWorkingSet: (workspaceId, data) => {
        set({
          workingSet: {
            ...initialWorkingSet,
            workspaceId,
            ...data,
          },
          isDirty: false,
          lastChangedAt: 0,
        });
      },
    }),
    { name: 'session-store' }
  )
);
