// src/pages/WorkspacePage.tsx
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
import type { TagItem } from "../types/Tag";
import type { NerSpan } from "../components/editor/NotationEditor";

import BookmarkBar from "../components/workspace/BookmarkBar";
import EditorArea from "../components/workspace/EditorArea";
import TagInput from "../components/tags/TagInput";
import RightPanel, { type TagRow } from "../components/right/RightPanel";

import { classify as apiClassify, ner as apiNer } from "../lib/api";

// --- helpers -----------------------------------------------------------------
const keyOfSpan = (s: NerSpan) => `${s.start}:${s.end}:${s.entity}`;

interface Props {
  workspaces: Workspace[];
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>;
}

const COLORS = {
  text: "#0F172A",
  gold: "#DDD1A0",
};

const WorkspacePage: React.FC<Props> = ({ workspaces, setWorkspaces }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { id: routeId } = useParams();

  // 1) Pick current workspace (fallback to first)
  const currentWs = useMemo(
    () => workspaces.find((w) => w.id === routeId) ?? workspaces[0],
    [workspaces, routeId]
  );
  const currentId = currentWs?.id;

  // 2) Editor & state
  const [editorInstanceKey, setEditorInstanceKey] = useState<string>("");
  const [text, setText] = useState<string>("");

  const [userSpans, setUserSpans] = useState<NerSpan[]>([]);

  // Add span from editor selection picker
  const handleAddSpan = useCallback((span: NerSpan) => {
    setUserSpans((prev) => {
      const key = `${span.start}:${span.end}:${span.entity}`;
      const seen = new Set(prev.map(s => `${s.start}:${s.end}:${s.entity}`));
      if (seen.has(key)) return prev;
      return [...prev, span];
    });
    if (currentId) {
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === currentId
            ? { ...w, userSpans: [...(w.userSpans ?? []), span], updatedAt: Date.now() }
            : w
        )
      );
    }
  }, [currentId, setWorkspaces]);
  const [apiSpans, setApiSpans] = useState<NerSpan[]>([]);
  const [deletedApiKeys, setDeletedApiKeys] = useState<Set<string>>(new Set());

  // Tags (persist per workspace)
  const [userTags, setUserTags] = useState<TagItem[]>([]); // source: "user"
  const [apiTags, setApiTags] = useState<TagItem[]>([]); // source: "api"
  const [customTagInput, setCustomTagInput] = useState("");

  const combinedTags: TagItem[] = useMemo(() => {
    const map = new Map<string, TagItem>(); // dedupe by name+source
    [...userTags, ...apiTags].forEach((t) =>
      map.set(`${t.source}:${t.name.toLowerCase()}`, t)
    );
    return Array.from(map.values());
  }, [userTags, apiTags]);

  // 4) Bookmarks & notices
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [bookmarkAnchor, setBookmarkAnchor] = useState<HTMLElement | null>(
    null
  );
  const openBookmarkMenu = (e: React.MouseEvent<HTMLElement>) =>
    setBookmarkAnchor(e.currentTarget);
  const closeBookmarkMenu = () => setBookmarkAnchor(null);
  const handleBookmarkSelect = (lang: string) => {
    setBookmarks((prev) => (prev.includes(lang) ? prev : [lang, ...prev]));
    closeBookmarkMenu();
  };

  const [notice, setNotice] = useState<string | null>(null);
  const showNotice = useCallback((msg: string) => setNotice(msg), []);

  // 5) Hydration guard
  const hydratedIdRef = useRef<string | null>(null);

  // 6) HYDRATE from current workspace on id change
  useEffect(() => {
    if (!currentId) return;
    hydratedIdRef.current = null; // block autosave while loading

    setText(currentWs?.text ?? "");
    setUserSpans((currentWs?.userSpans as NerSpan[]) ?? []);
    setApiSpans((currentWs?.apiSpans as NerSpan[]) ?? []);
    setDeletedApiKeys(new Set(currentWs?.deletedApiKeys ?? []));

    // hydrate tags
    const tags: TagItem[] = currentWs?.tags ?? [];
    setUserTags(tags.filter((t) => t.source === "user"));
    setApiTags(tags.filter((t) => t.source === "api"));

    // force Slate remount for a clean selection & placeholder state
    Promise.resolve().then(() => {
      hydratedIdRef.current = currentId;
      setEditorInstanceKey(`${currentId}:${currentWs?.updatedAt ?? 0}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  // 7) AUTOSAVE (debounced, hydration-aware)
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
                tags: combinedTags,
                updatedAt: Date.now(),
              }
            : w
        )
      );
    }, 350);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [
    currentId,
    text,
    userSpans,
    apiSpans,
    deletedApiKeys,
    combinedTags,
    setWorkspaces,
  ]);

  // 8) Explicit SAVE
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
              tags: combinedTags,
              updatedAt: Date.now(),
            }
          : w
      )
    );
    setNotice("Workspace saved.");
  }, [
    currentId,
    text,
    userSpans,
    apiSpans,
    deletedApiKeys,
    combinedTags,
    setWorkspaces,
  ]);

  // 9) Classification → write API tags to THIS workspace
  const handleRunClassify = useCallback(async () => {
    if (!text.trim()) {
      showNotice("Paste some text before running classify.");
      return;
    }
    const data = await apiClassify(text);
    const newApiTags: TagItem[] = (data.results || []).map((r: any) => ({
      name: r.name,
      source: "api",
    }));
    setApiTags(newApiTags);
    if (currentId) {
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === currentId
            ? {
                ...w,
                tags: [...userTags, ...newApiTags],
                updatedAt: Date.now(),
              }
            : w
        )
      );
    }
    showNotice("Classification completed.");
  }, [text, currentId, userTags, setWorkspaces, showNotice]);

  // 10) NER → write API spans to THIS workspace
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
    } catch {
      showNotice("NER failed. Try again.");
    }
  }, [text, currentId, setWorkspaces, showNotice]);

  // 11) Tag input handlers (user tags)
  const addCustomTag = useCallback(
    (name: string) => {
      const tag = name.trim();
      if (!tag) return;
      const exists =
        userTags.some((t) => t.name.toLowerCase() === tag.toLowerCase()) ||
        apiTags.some((t) => t.name.toLowerCase() === tag.toLowerCase());
      if (exists) return;
      const next = [{ name: tag, source: "user" as const }, ...userTags];
      setUserTags(next);
      if (currentId) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === currentId
              ? { ...w, tags: [...next, ...apiTags], updatedAt: Date.now() }
              : w
          )
        );
      }
    },
    [userTags, apiTags, currentId, setWorkspaces]
  );

  const deleteTag = useCallback(
    (name: string) => {
      const nextUser = userTags.filter((t) => t.name !== name);
      const nextApi = apiTags.filter((t) => t.name !== name);
      setUserTags(nextUser);
      setApiTags(nextApi);
      if (currentId) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === currentId
              ? { ...w, tags: [...nextUser, ...nextApi], updatedAt: Date.now() }
              : w
          )
        );
      }
    },
    [userTags, apiTags, currentId, setWorkspaces]
  );

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

  // Deletable keys for editor spans
  const filteredApiSpans = useMemo(
    () => apiSpans.filter((s) => !deletedApiKeys.has(keyOfSpan(s))),
    [apiSpans, deletedApiKeys]
  );
  const combinedSpans = useMemo<NerSpan[]>(
    () => [...filteredApiSpans, ...userSpans],
    [filteredApiSpans, userSpans]
  );

  const handleDeleteSpan = useCallback(
    (span: NerSpan) => {
      const k = keyOfSpan(span);
      if (userSpans.some((s) => keyOfSpan(s) === k)) {
        setUserSpans((prev) => prev.filter((s) => keyOfSpan(s) !== k));
      } else {
        setDeletedApiKeys((prev) => new Set(prev).add(k));
      }
    },
    [userSpans]
  );
  const deletableKeys = useMemo(() => {
    const keys = new Set<string>();
    filteredApiSpans.forEach((s) => keys.add(keyOfSpan(s)));
    userSpans.forEach((s) => keys.add(keyOfSpan(s)));
    return keys;
  }, [filteredApiSpans, userSpans]);

  // 13) Render
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        px: isMobile ? 0 : 4,
        color: COLORS.text,
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
          onClassify={handleRunClassify}
          onNer={handleRunNer}
          spans={combinedSpans}
          highlightedCategories={[]} // no notations filter UI anymore
          deletableKeys={deletableKeys}
          onDeleteSpan={handleDeleteSpan}
          onAddSpan={handleAddSpan}
                    onSave={handleSave}
        />
      </Box>

      {/* Right column (Tags only) */}
      <Box
        sx={{
          width: isMobile ? "100%" : "300px",
          boxSizing: "border-box",
          height: isMobile ? "60vh" : "86vh",
          display: "flex",
          flexDirection: "column",
          mt: isMobile ? 2 : 4,
          p: isMobile ? 2 : 0,
          pr: { xs: 0, sm: 1 }, // ← add this
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
          />
        ) : (
          <>
            <Typography
              variant="h6"
              sx={{
                mb: 1,
                color: COLORS.gold,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                textShadow: "0 1px 2px rgba(0,0,0,0.35)",
              }}
            >
              Tags
            </Typography>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <RightPanel
                tags={tagRows}
                onDeleteTag={deleteTag}
                tagInputField={tagInputField}
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
