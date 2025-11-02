import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Box,
  Snackbar,
  Alert,
} from "@mui/material";
import { useParams } from "react-router-dom";

import type { Workspace } from "../../types/Workspace";
import type { NerSpan } from "../../types/NotationEditor";

import BookmarkBar from "../workspace/BookmarkBar";
import EditorArea from "../workspace/EditorArea";
import RightPanel, { type TagRow } from "../right/RightPanel";
import type { ThesaurusItem } from "../tags/TagThesaurusInput";

import { useSemanticTags } from "../../hooks/useSemanticTags";
import { useThesaurusWorker } from "../../hooks/useThesaurusWorker";
import { useWorkspaceState } from "../../hooks/useWorkspaceState";
import { useAutoSave } from "../../hooks/useAutoSave";
import { useAnnotationManager } from "../../hooks/useAnnotationManager";
import { useTranslationManager } from "../../hooks/useTranslationManager";
import { useWorkspaceHydration } from "../../hooks/useWorkspaceHydration";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { loadThesaurusIndex } from "../../lib/thesaurusHelpers";
import type { ThesaurusIndexItem } from "../../types/Thesaurus";

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
const COLORS = {
  text: "#0F172A",
  gold: "#DDD1A0",
};


const WorkspaceContainer: React.FC = () => {
  const { id: routeId } = useParams();
  
  // Get workspaces and updateWorkspace from Zustand store
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const updateWorkspace = useWorkspaceStore((state) => state.updateWorkspace);
  const getWorkspaces = useWorkspaceStore.getState;
  
  // Create setWorkspaces-compatible function for hooks
  // Always gets fresh state from Zustand to avoid stale closures
  const setWorkspaces = useMemo(
    () => {
      return (updater: Workspace[] | ((prev: Workspace[]) => Workspace[])) => {
        // Always get fresh state from Zustand
        const currentWorkspaces = getWorkspaces().workspaces;
        const newWorkspaces = typeof updater === 'function' 
          ? updater(currentWorkspaces)
          : updater;
        
        // Sync changes back to Zustand store
        // Compare each workspace and call updateWorkspace for changed ones
        newWorkspaces.forEach((newWs) => {
          const oldWs = currentWorkspaces.find(w => w.id === newWs.id);
          
          // If workspace doesn't exist in old array, or if it changed, update it
          if (!oldWs || oldWs !== newWs) {
            // Use updateWorkspace with the full new workspace as updates
            // Zustand will merge this with existing workspace
            updateWorkspace(newWs.id, newWs);
          }
        });
      };
    },
    [updateWorkspace, getWorkspaces]
  );
  
  const { currentWorkspace: currentWs, currentId } = useWorkspaceState(
    workspaces,
    routeId
  );

  const [editorInstanceKey, setEditorInstanceKey] = useState<string>("");
  const [text, setText] = useState<string>("");

  const tags = useSemanticTags({
    initialTags: currentWs?.tags,
    hydrateKey: currentId,
  });

  const thesaurusWorker = useThesaurusWorker();
  const [thesaurusIndexForDisplay, setThesaurusIndexForDisplay] = 
    useState<ThesaurusIndexItem[] | null>(null);

  useEffect(() => {
    if (thesaurusWorker.ready && !thesaurusIndexForDisplay) {
      loadThesaurusIndex()
        .then(setThesaurusIndexForDisplay)
        .catch(err => {
          console.error('Failed to load thesaurus for display:', err);
        });
    }
  }, [thesaurusWorker.ready, thesaurusIndexForDisplay]);

  const [notice, setNotice] = useState<string | null>(null);
  const showNotice = useCallback((msg: string) => setNotice(msg), []);

  const annotationsRef = useRef<{
    userSpans: NerSpan[];
    apiSpans: NerSpan[];
    deletedApiKeys: Set<string>;
  } | null>(null);

  const translations = useTranslationManager({
    workspaceId: currentId ?? null,
    workspace: currentWs,
    getCurrentText: () => text,
    getUserSpans: () => annotationsRef.current?.userSpans ?? [],
    getApiSpans: () => annotationsRef.current?.apiSpans ?? [],
    getDeletedApiKeys: () => annotationsRef.current?.deletedApiKeys ?? new Set(),
    setText,
    setEditorInstanceKey,
    setWorkspaces,
    onNotice: showNotice,
  });

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
  
  useEffect(() => {
    annotationsRef.current = {
      userSpans: annotations.userSpans,
      apiSpans: annotations.apiSpans,
      deletedApiKeys: annotations.deletedApiKeys,
    };
  }, [annotations.userSpans, annotations.apiSpans, annotations.deletedApiKeys]);

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

  // Hydrate workspace data when switching workspaces using dedicated hook
  useWorkspaceHydration({
    workspaceId: currentId ?? null,
    workspace: currentWs,
    onHydrate: ({ text, editorKey }) => {
      setText(text);
      setEditorInstanceKey(editorKey);
    },
    onHydrationStart: () => {
      autosave.setHydrated(null);
      translations.setActiveTab("original");
    },
    onHydrationComplete: (id) => {
      autosave.setHydrated(id);
    },
  });

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

  const tagRows: TagRow[] = useMemo(
    () => tags.combinedTags.map((t) => ({ 
      name: t.name, 
      source: t.source,
      keywordId: t.label !== undefined ? Number(t.label) : undefined,
      parentId: t.parentId,
    })),
    [tags.combinedTags]
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        px: 4,
        color: COLORS.text,
      }}
    >
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
        />

        <EditorArea
          editorInstanceKey={editorInstanceKey}
          text={text}
          setText={setText}
          onUpload={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const content = await file.text();
            setText(content);
          }}
          onClassify={handleRunClassify}
          onNer={handleRunNer}
          spans={annotations.combinedSpans}
          highlightedCategories={[]}
          deletableKeys={annotations.deletableKeys}
          onDeleteSpan={annotations.deleteSpan}
          onAddSpan={annotations.addSpan}
          onSave={handleSave}
        />
      </Box>

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
          thesaurus={{
            onAdd: (name, keywordId, parentId) => addCustomTag(name, keywordId, parentId),
            fetchSuggestions: fetchThesaurus,
            defaultRestrictToThesaurus: false,
            isThesaurusLoading: !thesaurusWorker.ready,
            resetKey: currentId,
          }}
          thesaurusIndex={thesaurusIndexForDisplay || undefined}
        />
      </Box>

      <Snackbar
        open={!!notice}
        autoHideDuration={2200}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setNotice(null)}
          severity="info"
          variant="filled"
          sx={{ bgcolor: "#21426C" }}
        >
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WorkspaceContainer;
