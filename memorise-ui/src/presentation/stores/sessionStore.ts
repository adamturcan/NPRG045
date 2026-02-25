import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Workspace, Translation } from '../../types/Workspace';
import type { NerSpan } from '../../types/NotationEditor';
import type { Segment } from '../../types/Segment';

// Equality check to prevent unnecessary re-renders & updates
const areSpansEqual = (a: NerSpan[], b: NerSpan[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((s, i) => 
    s.start === b[i].start && 
    s.end === b[i].end && 
    s.entity === b[i].entity &&
    s.id === b[i].id &&         
    s.origin === b[i].origin    
  );
};

interface SessionStore {
  session: Workspace | null;      
  draftText: string;              
  activeTab: string;
  translationViewMode: "document" | "segments";
  selectedSegmentId: string | null;
  activeSegmentId: string | undefined;
  
  isDirty: boolean;
  lastChangedAt: number;
  
  loadSession: (workspace: Workspace) => void;
  resetSession: () => void;
  setLoading: () => void;
  
  setDraftText: (text: string) => void;
  updateUserSpans: (spans: NerSpan[]) => void;
  updateApiSpans: (spans: NerSpan[]) => void;
  updateDeletedApiKeys: (keys: string[]) => void;
  updateSegments: (segments: Segment[]) => void;
  updateTranslations: (translations: Translation[]) => void;
  
  setActiveTab: (tab: string) => void;
  setTranslationViewMode: (mode: "document" | "segments") => void;
  setSelectedSegmentId: (id: string | null) => void;
  setActiveSegmentId: (id: string | undefined) => void;
}

export const useSessionStore = create<SessionStore>()(
  devtools(
    (set, get) => ({
      session: null,
      draftText: "",
      
      activeTab: "original",
      translationViewMode: "document",
      selectedSegmentId: null,
      activeSegmentId: undefined,
      
      isDirty: false,
      lastChangedAt: 0,

      loadSession: (workspace) => {
        const normalized: Workspace = {
          ...workspace,
          userSpans: workspace.userSpans ?? [],
          apiSpans: workspace.apiSpans ?? [],
          deletedApiKeys: workspace.deletedApiKeys ?? [],
          tags: workspace.tags ?? [],
          translations: workspace.translations ?? [],
          segments: workspace.segments ?? [],
        };

        set({
          session: normalized,
          draftText: normalized.text || "", 
          isDirty: false,
          lastChangedAt: 0,
          activeTab: "original",
          translationViewMode: "document",
          selectedSegmentId: null,
          activeSegmentId: undefined,
        });
      },

      resetSession: () => {
        set({
          session: null,
          draftText: "",
          isDirty: false,
          lastChangedAt: 0,
          activeTab: "original",
          translationViewMode: "document",
          selectedSegmentId: null,
          activeSegmentId: undefined,
        });
      },

      setLoading: () => {
         set({
          session: {
            id: "",
            name: "",
            owner: "",
            updatedAt: 0,
            text: "",
            userSpans: [],
            apiSpans: [],
            deletedApiKeys: [],
            tags: [],
            translations: [],
            segments: [],
          },
          draftText: "",
          isDirty: false,
        });
      },

      setDraftText: (newText) => {
        const state = get();
        if (state.draftText === newText) return;

        const isNowDirty = newText !== state.session?.text;

        set({ 
          draftText: newText,
          isDirty: isNowDirty,
          lastChangedAt: Date.now(),
        });
      },

      updateUserSpans: (nextUserSpans) => {
        const state = get();
        if (!state.session) return;

        const currentUserSpans = state.session.userSpans ?? [];

        if (areSpansEqual(currentUserSpans, nextUserSpans)) return;

        set({
          session: { ...state.session, userSpans: nextUserSpans },
          isDirty: true,
          lastChangedAt: Date.now(),
        });
      },

      updateApiSpans: (nextApiSpans) => {
        const state = get();
        if (!state.session) return;

        const currentApiSpans = state.session.apiSpans ?? [];

        if (areSpansEqual(currentApiSpans, nextApiSpans)) return;

        set({
          session: { ...state.session, apiSpans: nextApiSpans },
          isDirty: true,
          lastChangedAt: Date.now(),
        });
      },

      updateDeletedApiKeys: (nextKeys) => {
        const state = get();
        if (!state.session) return;

        const currentKeys = state.session.deletedApiKeys ?? [];

        if (currentKeys.length === nextKeys.length && 
            currentKeys.every((k, i) => k === nextKeys[i])) return;

        set({
          session: { ...state.session, deletedApiKeys: nextKeys },
          isDirty: true,
          lastChangedAt: Date.now(),
        });
      },

      updateSegments: (nextSegments) => {
        const state = get();
        if (!state.session) return;
        
        const currentSegments = state.session.segments ?? [];
        
        if (currentSegments.length === nextSegments.length && 
            currentSegments === nextSegments) return;

        set({
          session: { ...state.session, segments: nextSegments },
          isDirty: true,
          lastChangedAt: Date.now(),
        });
      },

      updateTranslations: (nextTranslations) => {
        const state = get();
        if (!state.session) return;
        
        const currentTranslations = state.session.translations ?? [];
        
        if (currentTranslations.length === nextTranslations.length && 
            currentTranslations === nextTranslations) return;

        set({
          session: { ...state.session, translations: nextTranslations },
          isDirty: true,
          lastChangedAt: Date.now(),
        });
      },

      setActiveTab: (tab) => {
        set({ activeTab: tab });
      },
      
      setTranslationViewMode: (mode) => {
        set({ translationViewMode: mode, selectedSegmentId: null });
      },
      
      setSelectedSegmentId: (id) => {
        set({ selectedSegmentId: id });
      },
      
      setActiveSegmentId: (id) => {
        set({ activeSegmentId: id });
      },
    }),
    { name: 'session-store' }
  )
);