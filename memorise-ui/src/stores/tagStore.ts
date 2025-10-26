import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TagItem } from '../types/Tag';
import { ApiService } from '../services/apiService';

interface TagStore {
  userTags: TagItem[];
  apiTags: TagItem[];

  // Actions
  addUserTag: (tag: TagItem) => void;
  deleteTag: (name: string, keywordId?: number, parentId?: number) => void;
  runClassification: (text: string) => Promise<void>;
  clearApiTags: () => void;
  setUserTags: (tags: TagItem[]) => void;
  setApiTags: (tags: TagItem[]) => void;
}

export const useTagStore = create<TagStore>()(
  devtools(
    (set) => ({
      userTags: [],
      apiTags: [],

      addUserTag: (tag) => {
        set((state) => {
          // Check if tag already exists
          const exists = state.userTags.some(
            (t) =>
              t.name === tag.name &&
              t.label === tag.label &&
              t.parentId === tag.parentId
          );
          if (exists) return state;
          return { userTags: [...state.userTags, tag] };
        });
      },

      deleteTag: (name, keywordId, parentId) => {
        set((state) => ({
          userTags: state.userTags.filter(
            (t) =>
              !(
                t.name === name &&
                (keywordId === undefined || t.label === keywordId) &&
                (parentId === undefined || t.parentId === parentId)
              )
          ),
        }));
      },

      runClassification: async (text) => {
        try {
          const result = await ApiService.classify(text);
          if (result && Array.isArray(result)) {
            // Map API response to TagItem format
            const tags: TagItem[] = result.map((item: { name?: string; tag?: string; label?: number; keywordId?: number; parentId?: number }) => ({
              name: item.name || item.tag || '',
              source: 'api' as const,
              label: item.label || item.keywordId,
              parentId: item.parentId,
            }));
            set({ apiTags: tags });
          }
        } catch (error) {
          console.error('Classification API failed:', error);
          set({ apiTags: [] });
        }
      },

      clearApiTags: () => {
        set({ apiTags: [] });
      },

      setUserTags: (tags) => {
        set({ userTags: tags });
      },

      setApiTags: (tags) => {
        set({ apiTags: tags });
      },
    }),
    { name: 'tag-store' }
  )
);
