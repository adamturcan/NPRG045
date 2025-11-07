import { Box } from "@mui/material";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";

import type { NerSpan } from "../../types/NotationEditor";
import type { NoticeOptions, NoticeTone } from "../../types/Notice";

import RightPanel, { type TagRow } from "../right/RightPanel";
import { NotificationSnackbar } from "../shared/NotificationSnackbar";
import type { ThesaurusItem } from "../tags/TagThesaurusInput";
import BookmarkBar from "../workspace/BookmarkBar";
import EditorArea from "../workspace/EditorArea";
import ConflictResolutionDialog from "../editor/ConflictResolutionDialog";

import { useShallow } from "zustand/react/shallow";
import { COLORS } from "../../constants/ui";
import {
  useAnnotationManager,
  useAutoSave,
  useSemanticTags,
  useThesaurusDisplay,
  useThesaurusWorker,
  useTranslationManager,
  useWorkspaceHydration,
  useWorkspaceState,
  useWorkspaceSync,
} from "../../hooks";
import { useWorkspaceStore } from "../../stores/workspaceStore";

/**
 * WorkspaceContainer - Container component that orchestrates workspace editing
 * 
 * Uses Zustand store directly instead of props (Phase 1/2 approach).
 * All workspace state management goes through Zustand store.
 * 
 * Architecture:
 * - Gets workspaces from Zustand store
 * - Uses custom hooks for business logic
 * - Coordinates between hooks
 * - Renders presentational components
 */

// Constants moved outside component to prevent recreation on every render
const EMPTY_HIGHLIGHTED_CATEGORIES: string[] = [];

const WorkspaceContainer: React.FC = () => {
  const { id: routeId } = useParams();
  
  // ============================================================================
  // STEP 1: WORKSPACE STATE & SELECTION
  // ============================================================================
  // Get workspaces from Zustand store with shallow comparison to prevent re-renders
  const { workspaces } = useWorkspaceStore(
    useShallow((state) => ({ workspaces: state.workspaces }))
  );
  
  // Create setWorkspaces-compatible function for hooks
  const setWorkspaces = useWorkspaceSync();
  
  // Find current workspace based on route ID (fallback to first workspace)
  const { currentWorkspace: currentWs, currentId } = useWorkspaceState(
    workspaces,
    routeId
  );

  // ============================================================================
  // STEP 2: LOCAL UI STATE
  // ============================================================================
  const [editorInstanceKey, setEditorInstanceKey] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [notice, setNotice] = useState<{
    message: string;
    tone?: NoticeTone;
    persistent?: boolean;
  } | null>(null);
  
  // Notification handlers
  const showNotice = useCallback(
    (msg: string, options?: NoticeOptions) => {
      setNotice({
        message: msg,
        tone: options?.tone,
        persistent: options?.persistent,
      });
    },
    []
  );
  const handleCloseNotice = useCallback(() => setNotice(null), []);

  // ============================================================================
  // STEP 3: HOOKS FOR BUSINESS LOGIC
  // ============================================================================
  
  // Tags: user-added + API-generated semantic tags
  const tags = useSemanticTags({
    initialTags: currentWs?.tags,
    hydrateKey: currentId,
  });

  // Thesaurus: 750k keyword lookup with Web Worker for performance
  const thesaurusWorker = useThesaurusWorker();
  const thesaurusIndexForDisplay = useThesaurusDisplay(thesaurusWorker);

  // Ref to share annotations with translations hook (avoids stale closures)
  const annotationsRef = useRef<{
    userSpans: NerSpan[];
    apiSpans: NerSpan[];
    deletedApiKeys: Set<string>;
  } | null>(null);

  // Translations: multi-language tab management (original + translations)
  const getCurrentText = useCallback(() => text, [text]);
  const translations = useTranslationManager({
    workspaceId: currentId ?? null,
    workspace: currentWs,
    getCurrentText,
    annotationsRef,
    setText,
    setEditorInstanceKey,
    setWorkspaces,
    onNotice: showNotice,
  });

  // Annotations: NER spans (user-created + API-generated)
  const annotations = useAnnotationManager({
    initialUserSpans: currentWs?.userSpans as NerSpan[],
    initialApiSpans: currentWs?.apiSpans as NerSpan[],
    initialDeletedKeys: currentWs?.deletedApiKeys ?? [],
    hydrateKey: currentId,
    activeTab: translations.activeTab,
    workspace: currentWs,
    onNotice: showNotice,
    setWorkspaces,
  });
  
  // Keep annotationsRef in sync with annotations state
  useEffect(() => {
    annotationsRef.current = {
      userSpans: annotations.userSpans,
      apiSpans: annotations.apiSpans,
      deletedApiKeys: annotations.deletedApiKeys,
    };
  }, [annotations.userSpans, annotations.apiSpans, annotations.deletedApiKeys]);

  // Auto-save: debounced saving of workspace changes
  const autosave = useAutoSave(
    currentId ?? null,
    {
      text,
      userSpans: annotations.userSpans,
      apiSpans: annotations.apiSpans,
      deletedApiKeys: annotations.deletedApiKeys,
      tags: tags.combinedTags,
    },
    setWorkspaces,
    {
      delay: 350,
      enabled: true,
      activeTab: translations.activeTab,
    }
  );

  // Hydration: load workspace data when switching workspaces
  const onHydrate = useCallback(({ text: newText, editorKey }: { text: string; editorKey: string }) => {
    setText(newText);
    setEditorInstanceKey(editorKey);
  }, []);

  const onHydrationStart = useCallback(() => {
    autosave.setHydrated(null);
    translations.setActiveTab("original");
  }, [autosave, translations]);

  const onHydrationComplete = useCallback((id: string) => {
    autosave.setHydrated(id);
  }, [autosave]);

  useWorkspaceHydration({
    workspaceId: currentId ?? null,
    workspace: currentWs,
    onHydrate,
    onHydrationStart,
    onHydrationComplete,
  });

  // ============================================================================
  // STEP 4: EVENT HANDLERS FOR USER ACTIONS
  // ============================================================================
  
  // Editor actions: save, classify, NER, upload
  const handleSave = useCallback(() => {
    autosave.saveNow(showNotice);
  }, [autosave, showNotice]);

  const handleRunClassify = useCallback(async () => {
    if (!text.trim()) {
      showNotice("Paste some text before running classify.");
      return;
    }
    await tags.runClassify(text);
    showNotice("Classification completed.");
  }, [text, tags, showNotice]);

  const handleRunNer = useCallback(async () => {
    await annotations.runNer(text, currentId ?? null);
  }, [text, currentId, annotations]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
  }, []); // setText is stable, no deps needed

  // Tag actions: add, delete
  const addCustomTag = useCallback(
    (name: string, keywordId?: number, parentId?: number) => {
      tags.addCustomTag(name, keywordId, parentId);
    },
    [tags]
  );

  const deleteTag = useCallback(
    (name: string, keywordId?: number, parentId?: number) => {
      tags.deleteTag(name, keywordId, parentId);
    },
    [tags]
  );

  // ============================================================================
  // STEP 5: COMPUTED VALUES & DATA TRANSFORMATION
  // ============================================================================
  
  // Thesaurus search handler
  const fetchThesaurus = useCallback(
    async (q: string): Promise<ThesaurusItem[]> => {
      if (!q.trim()) return [];
      if (!thesaurusWorker.ready) return [];
      
      try {
        const results = await thesaurusWorker.search(q, 20);
        return results.map(item => ({
          name: item.label,
          path: item.path,
          keywordId: item.id,
          parentId: item.parentId,
          isPreferred: item.isPreferred,
          depth: item.depth,
        }));
      } catch (error) {
        console.error('Thesaurus search error:', error);
        return [];
      }
    },
    [thesaurusWorker]
  );

  // Memoized config objects for child components
  const thesaurusConfig = useMemo(
    () => ({
      onAdd: addCustomTag,
      fetchSuggestions: fetchThesaurus,
      defaultRestrictToThesaurus: false,
      isThesaurusLoading: !thesaurusWorker.ready,
      resetKey: currentId,
    }),
    [addCustomTag, fetchThesaurus, thesaurusWorker.ready, currentId]
  );

  const tagRows: TagRow[] = useMemo(
    () => tags.combinedTags.map((t) => ({ 
      name: t.name, 
      source: t.source,
      keywordId: t.label !== undefined ? Number(t.label) : undefined,
      parentId: t.parentId,
    })),
    [tags.combinedTags]
  );

  // ============================================================================
  // STEP 6: RENDER
  // ============================================================================
  
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        height: "100vh",
        overflow: "visible",
        position: "relative",
        px: 4,
        color: COLORS.text,
      }}
    >
      {/* LEFT PANEL: Editor and bookmark bar */}
      <Box
        sx={{
          flex: 1,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          height: "88.5vh",
          pl: 4,
          minHeight: 0,
        }}
      >
        {/* Translation tabs (original + translations) */}
        <BookmarkBar
          translationLanguages={translations.translationLanguages}
          activeTab={translations.activeTab}
          onTabClick={translations.onTabSwitch}
          onAddClick={translations.openMenu}
          anchorEl={translations.menuAnchor}
          onClose={translations.closeMenu}
          onSelectLanguage={translations.onAddTranslation}
          onDeleteTranslation={translations.onDeleteTranslation}
          onUpdateTranslation={translations.onUpdateTranslation}
          isUpdating={translations.isUpdating}
          languageOptions={translations.languageOptions}
          isLanguageListLoading={translations.isLanguageListLoading}
        />

        {/* Main text editor with NER spans */}
        <EditorArea
          editorInstanceKey={editorInstanceKey}
          text={text}
          setText={setText}
          onUpload={handleUpload}
          onClassify={handleRunClassify}
          onNer={handleRunNer}
          spans={annotations.combinedSpans}
          highlightedCategories={EMPTY_HIGHLIGHTED_CATEGORIES}
          deletableKeys={annotations.deletableKeys}
          onDeleteSpan={annotations.deleteSpan}
          onAddSpan={annotations.addSpan}
          onSave={handleSave}
        />
      </Box>

      {/* RIGHT PANEL: Tags and thesaurus */}
      <Box
        sx={{
          width: "300px",
          boxSizing: "border-box",
          height: "86vh",
          display: "flex",
          flexDirection: "column",
          mt: 4,
          minHeight: 0,
          overflow: "visible",
          ml: 2,
          pr: 1,
        }}
      >
        <RightPanel
          tags={tagRows}
          onDeleteTag={deleteTag}
          thesaurus={thesaurusConfig}
          thesaurusIndex={thesaurusIndexForDisplay}
        />
      </Box>

      {/* GLOBAL: Conflict resolution dialog */}
      {annotations.conflictPrompt && (
        <ConflictResolutionDialog
          prompt={annotations.conflictPrompt}
          onKeepExisting={() => annotations.resolveConflictPrompt("existing")}
          onKeepApi={() => annotations.resolveConflictPrompt("api")}
        />
      )}

      {/* GLOBAL: Notification snackbar */}
      <NotificationSnackbar
        message={notice?.message ?? null}
        tone={notice?.tone}
        persistent={notice?.persistent}
        onClose={handleCloseNotice}
      />
    </Box>
  );
};

export default WorkspaceContainer;
