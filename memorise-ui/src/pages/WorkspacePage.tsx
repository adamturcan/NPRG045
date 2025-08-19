import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Box,
  Typography,
  useMediaQuery,
  useTheme,
  Snackbar,
  Alert,
} from "@mui/material";
import { useParams } from "react-router-dom";
import type { Workspace } from "../types/Workspace";
import BookmarkBar from "../components/workspace/BookmarkBar";
import EditorArea from "../components/workspace/EditorArea";
import TagInput from "../components/tags/TagInput";
import RightPanel, { type TagRow } from "../components/right/RightPanel";
import { useSemanticTags } from "../hooks/useSemanticTags";
import type { NerSpan } from "../components/editor/NotationEditor";
import { ner as apiNer } from "../lib/api"; // ← call NER directly here

interface Props {
  workspaces: Workspace[];
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>;
}

const keyOf = (s: NerSpan) => `${s.start}:${s.end}:${s.entity}`;

const WorkspacePage: React.FC<Props> = ({ workspaces, setWorkspaces }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { id: routeId } = useParams();

  // Pick current workspace (fallback to first)
  const currentWs = useMemo(
    () => workspaces.find((w) => w.id === routeId) ?? workspaces[0],
    [workspaces, routeId]
  );
  const currentId = currentWs?.id;

  // Force Slate remount per workspace
  const [editorInstanceKey, setEditorInstanceKey] = useState<string>("");

  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [bookmarkAnchor, setBookmarkAnchor] = useState<HTMLElement | null>(
    null
  );

  // We still use the tag/classify bits from the hook (but not its nerSpans)
  const {
    text,
    setText,
    combinedTags,
    customTagInput,
    setCustomTagInput,
    addCustomTag,
    deleteTag,
    runClassify,
  } = useSemanticTags();

  // Selection & local spans
  const [selectionRange, setSelectionRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [userSpans, setUserSpans] = useState<NerSpan[]>([]);
  const [apiSpans, setApiSpans] = useState<NerSpan[]>([]); // ← per-workspace API spans
  const [deletedApiKeys, setDeletedApiKeys] = useState<Set<string>>(new Set());

  // Hydration guard
  const hydratedIdRef = useRef<string | null>(null);

  // Load content from the selected workspace
  useEffect(() => {
    if (!currentId) return;
    hydratedIdRef.current = null; // block autosave while loading

    setText(currentWs?.text ?? "");
    setUserSpans((currentWs?.userSpans as NerSpan[]) ?? []);
    setApiSpans((currentWs?.apiSpans as NerSpan[]) ?? []);
    setDeletedApiKeys(new Set(currentWs?.deletedApiKeys ?? []));
    // clear active category chips when switching workspaces
    setActiveCategories([]);

    Promise.resolve().then(() => {
      hydratedIdRef.current = currentId;
      setEditorInstanceKey(`${currentId}:${currentWs?.updatedAt ?? 0}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  // UI: categories are derived from *this* workspace's API spans
  const notationCategories = useMemo(
    () => Array.from(new Set(apiSpans.map((s) => s.entity))).filter(Boolean),
    [apiSpans]
  );
  const [activeCategories, setActiveCategories] = useState<string[]>([]);

  // Hide API spans that were "deleted" (tombstoned) in this workspace
  const filteredApiSpans = useMemo(
    () => apiSpans.filter((s) => !deletedApiKeys.has(keyOf(s))),
    [apiSpans, deletedApiKeys]
  );

  // Spans shown in the editor
  const combinedSpans = useMemo<NerSpan[]>(
    () => [...filteredApiSpans, ...userSpans],
    [filteredApiSpans, userSpans]
  );

  // Notices
  const [notice, setNotice] = useState<string | null>(null);
  const showNotice = useCallback((msg: string) => setNotice(msg), []);

  // Validation
  const hasOverlap = useCallback(
    (start: number, end: number) =>
      combinedSpans.some(
        (s) => Math.max(start, s.start) < Math.min(end, s.end)
      ),
    [combinedSpans]
  );

  const tryAddAnnotation = useCallback(
    (category: string) => {
      if (!selectionRange)
        return showNotice("Select some text in the editor first.");
      const { start, end } = selectionRange;
      if (start >= end) return showNotice("Selection is empty.");
      if (hasOverlap(start, end))
        return showNotice("That selection overlaps an existing annotation.");
      setUserSpans((prev) => [{ start, end, entity: category }, ...prev]);
      showNotice("Annotation added.");
    },
    [selectionRange, hasOverlap, showNotice]
  );

  // Run NER for the *current* workspace and store locally
  const handleRunNer = useCallback(async () => {
    if (!text.trim()) {
      showNotice("Paste some text before running NER.");
      return;
    }
    try {
      const data = await apiNer(text);
      const spans: NerSpan[] = (data.results ?? []).map((r: any) => ({
        start: r.start,
        end: r.end,
        entity: r.entity,
        score: r.score,
      }));
      setApiSpans(spans);
      // persist immediately
      if (currentId) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === currentId
              ? { ...w, apiSpans: spans, updatedAt: Date.now() }
              : w
          )
        );
      }
      showNotice("NER completed.");
    } catch (e) {
      showNotice("NER failed. Try again.");
    }
  }, [text, currentId, setWorkspaces, showNotice]);

  // Bookmarks UI
  const openBookmarkMenu = (e: React.MouseEvent<HTMLElement>) =>
    setBookmarkAnchor(e.currentTarget);
  const closeBookmarkMenu = () => setBookmarkAnchor(null);
  const handleBookmarkSelect = (lang: string) => {
    setBookmarks((prev) => (prev.includes(lang) ? prev : [lang, ...prev]));
    closeBookmarkMenu();
  };

  const tagInputField = (
    <TagInput
      value={customTagInput}
      onChange={setCustomTagInput}
      onSubmit={() => {
        addCustomTag(customTagInput);
        setCustomTagInput("");
      }}
    />
  );

  const tagRows: TagRow[] = useMemo(
    () => combinedTags.map((t) => ({ name: t.name, source: t.source })),
    [combinedTags]
  );

  // AUTOSAVE (debounced, hydration-aware) — saves text, userSpans, apiSpans & deletedApiKeys
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!currentId) return;
    if (hydratedIdRef.current !== currentId) return;

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === currentId
            ? {
                ...w,
                text,
                userSpans,
                apiSpans,
                deletedApiKeys: Array.from(deletedApiKeys),
                updatedAt: Date.now(),
              }
            : w
        )
      );
    }, 350);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [currentId, text, userSpans, apiSpans, deletedApiKeys, setWorkspaces]);

  // Explicit Save
  const handleSave = useCallback(() => {
    if (!currentId) return;
    hydratedIdRef.current = currentId;
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.id === currentId
          ? {
              ...w,
              text,
              userSpans,
              apiSpans,
              deletedApiKeys: Array.from(deletedApiKeys),
              updatedAt: Date.now(),
            }
          : w
      )
    );
    setNotice("Workspace saved.");
  }, [currentId, text, userSpans, apiSpans, deletedApiKeys, setWorkspaces]);

  // Delete handler for both user & API spans
  const handleDeleteSpan = useCallback(
    (span: NerSpan) => {
      const k = keyOf(span);
      // Try remove from userSpans
      if (userSpans.some((s) => keyOf(s) === k)) {
        setUserSpans((prev) => prev.filter((s) => keyOf(s) !== k));
      } else {
        // Mark API span deleted (tombstone)
        setDeletedApiKeys((prev) => new Set(prev).add(k));
      }
    },
    [userSpans]
  );

  // Deletable keys = all visible spans (API + user)
  const deletableKeys = useMemo(() => {
    const keys = new Set<string>();
    filteredApiSpans.forEach((s) => keys.add(keyOf(s)));
    userSpans.forEach((s) => keys.add(keyOf(s)));
    return keys;
  }, [filteredApiSpans, userSpans]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        px: isMobile ? 0 : 4,
      }}
    >
      {/* Left column */}
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
          bookmarks={bookmarks}
          onAddClick={openBookmarkMenu}
          anchorEl={bookmarkAnchor}
          onClose={closeBookmarkMenu}
          onSelect={handleBookmarkSelect}
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
          onClassify={runClassify}
          onNer={handleRunNer} // ← use local NER
          spans={combinedSpans}
          highlightedCategories={activeCategories}
          onSelectionChange={setSelectionRange}
          deletableKeys={deletableKeys}
          onDeleteSpan={handleDeleteSpan}
          onSave={handleSave}
        />
      </Box>

      {/* Right column */}
      <Box
        sx={{
          width: isMobile ? "100%" : "300px",
          boxSizing: "border-box",
          height: isMobile ? "60vh" : "86vh",
          display: "flex",
          flexDirection: "column",
          mt: isMobile ? 2 : 4,
          p: isMobile ? 2 : 0,
          minHeight: 0,
          overflow: "visible",
          ml: { xs: 0, sm: 2 },
        }}
      >
        {!isMobile ? (
          <RightPanel
            tags={tagRows}
            onDeleteTag={deleteTag}
            tagInputField={tagInputField}
            notationsProps={{
              categories: notationCategories,
              selectedCategories: activeCategories,
              onChangeSelected: setActiveCategories,
              onAddSelection: tryAddAnnotation,
            }}
          />
        ) : (
          <>
            <Typography variant="h6" sx={{ mb: 1, color: "#1E293B" }}>
              Panels
            </Typography>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <RightPanel
                tags={tagRows}
                onDeleteTag={deleteTag}
                tagInputField={tagInputField}
                notationsProps={{
                  categories: notationCategories,
                  selectedCategories: activeCategories,
                  onChangeSelected: setActiveCategories,
                  onAddSelection: tryAddAnnotation,
                }}
              />
            </Box>
          </>
        )}
      </Box>

      {/* Snackbar */}
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

export default WorkspacePage;
