import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { NerSpan } from '../types/NotationEditor';
import { ApiService } from '../services/apiService';

interface AnnotationStore {
  userSpans: NerSpan[];
  apiSpans: NerSpan[];
  deletedApiKeys: Set<string>;

  // Actions
  addUserSpan: (span: NerSpan) => void;
  deleteSpan: (span: NerSpan) => void;
  runNerApi: (text: string) => Promise<void>;
  clearApiSpans: () => void;
  setUserSpans: (spans: NerSpan[]) => void;
  setApiSpans: (spans: NerSpan[]) => void;
  setDeletedApiKeys: (keys: Set<string>) => void;
}

const spanKey = (span: NerSpan): string => `${span.start}:${span.end}:${span.entity}`;

export const useAnnotationStore = create<AnnotationStore>()(
  devtools(
    (set) => ({
      userSpans: [],
      apiSpans: [],
      deletedApiKeys: new Set(),

      addUserSpan: (span) => {
        set((state) => ({
          userSpans: [...state.userSpans, span],
        }));
      },

      deleteSpan: (span) => {
        set((state) => ({
          userSpans: state.userSpans.filter((s) => !(s.start === span.start && s.end === span.end && s.entity === span.entity)),
          deletedApiKeys: state.deletedApiKeys.add(spanKey(span)),
        }));
      },

      runNerApi: async (text) => {
        try {
          const result = await ApiService.ner(text);
          if (result && Array.isArray(result)) {
            set({ apiSpans: result });
          }
        } catch (error) {
          console.error('NER API failed:', error);
          set({ apiSpans: [] });
        }
      },

      clearApiSpans: () => {
        set({ apiSpans: [], deletedApiKeys: new Set() });
      },

      setUserSpans: (spans) => {
        set({ userSpans: spans });
      },

      setApiSpans: (spans) => {
        set({ apiSpans: spans });
      },

      setDeletedApiKeys: (keys) => {
        set({ deletedApiKeys: keys });
      },
    }),
    { name: 'annotation-store' }
  )
);
