import React, { useMemo, useState } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import type { Workspace } from "../types/Workspace";
import BookmarkBar from "../components/workspace/BookmarkBar";
import EditorArea from "../components/workspace/EditorArea";
import TagInput from "../components/tags/TagInput";
import RightPanel, { type TagRow } from "../components/right/RightPanel";
import { useSemanticTags } from "../hooks/useSemanticTags";

interface Props {
  workspaces: Workspace[];
}

const WorkspacePage: React.FC<Props> = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [bookmarkAnchor, setBookmarkAnchor] = useState<HTMLElement | null>(
    null
  );

  const {
    text,
    setText,
    combinedTags,
    customTagInput,
    setCustomTagInput,
    addCustomTag,
    deleteTag,
    runClassify,
    runNer,
    nerSpans, // spans from NER (each has .entity)
  } = useSemanticTags();

  // Multi-select categories for notations (bubbles)
  const [activeCategories, setActiveCategories] = useState<string[]>([]);

  const openBookmarkMenu = (e: React.MouseEvent<HTMLElement>) =>
    setBookmarkAnchor(e.currentTarget);
  const closeBookmarkMenu = () => setBookmarkAnchor(null);
  const handleBookmarkSelect = (lang: string) => {
    if (!bookmarks.includes(lang)) setBookmarks([...bookmarks, lang]);
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

  // RightPanel expects TagRow[]
  const tagRows: TagRow[] = useMemo(
    () => combinedTags.map((t) => ({ name: t.name, source: t.source })),
    [combinedTags]
  );

  // Distinct categories from current NER spans (or provide a fixed list)
  const categories = useMemo(
    () =>
      Array.from(
        new Set((nerSpans ?? []).map((s) => String(s.entity || "").trim()))
      ).filter(Boolean),
    [nerSpans]
  );

  // Contents inside the NotationsPanel scroll area (you can replace later)
  const notationsContent = (
    <Typography sx={{ color: "#5A6A7A", fontSize: 13 }}>
      Toggle one or more categories above to highlight all matching notations in
      the editor.
    </Typography>
  );

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
      {/* Left column: bookmarks + editor */}
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
          text={text}
          setText={setText}
          onUpload={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const content = await file.text();
            setText(content);
          }}
          onClassify={runClassify}
          onNer={runNer}
          spans={nerSpans}
          highlightedCategories={activeCategories} // ← multi-select highlight for editor
        />
      </Box>

      {/* Right column: switchable panel (Tags ⟷ Notations) */}
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
          overflow: "visible", // allow glass shadow to render
          ml: { xs: 0, sm: 2 }, // subtle gap from the editor
        }}
      >
        {!isMobile ? (
          <RightPanel
            tags={tagRows}
            onDeleteTag={deleteTag}
            tagInputField={tagInputField}
            notations={notationsContent}
            notationsProps={{
              categories,
              selectedCategories: activeCategories,
              onChangeSelected: setActiveCategories,
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
                notations={notationsContent}
                notationsProps={{
                  categories,
                  selectedCategories: activeCategories,
                  onChangeSelected: setActiveCategories,
                }}
              />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default WorkspacePage;
