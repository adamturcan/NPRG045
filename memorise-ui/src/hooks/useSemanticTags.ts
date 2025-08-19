// src/hooks/useSemanticTags.ts
import { useCallback, useMemo, useRef, useState } from "react";
import type { TagItem } from "../types/Tag";
import { classify as apiClassify, ner as apiNer } from "../lib/api";

import type { NerSpan } from "../components/editor/NotationEditor";

export function useSemanticTags() {
  const [text, setText] = useState("");
  const [classificationResults, setClassificationResults] = useState<
    any[] | null
  >(null);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");

  // Right-panel scroll container (used to scroll to top after classify)
  const tagTableRef = useRef<HTMLDivElement>(null);

  // ── Derived: merged tags (custom first) ─────────────────────────────────────
  const combinedTags: TagItem[] = useMemo(() => {
    return [
      ...customTags.map((t) => ({ name: t, source: "custom" as const })),
      ...(classificationResults?.map((r: any) => ({
        name: r.name,
        source: "api" as const,
      })) || []),
    ];
  }, [customTags, classificationResults]);

  // ── Tag actions ────────────────────────────────────────────────────────────
  const addCustomTag = useCallback(
    (name: string) => {
      const tag = name.trim();
      if (!tag) return;
      const exists =
        customTags.includes(tag) ||
        classificationResults?.some((r) => r.name === tag);
      if (!exists) setCustomTags((prev) => [tag, ...prev]);
    },
    [customTags, classificationResults]
  );

  const deleteTag = useCallback((name: string) => {
    setCustomTags((prev) => prev.filter((t) => t !== name));
    setClassificationResults(
      (prev) => prev?.filter((r: any) => r.name !== name) || null
    );
  }, []);

  // ── Classify (semantic tags) ───────────────────────────────────────────────
  const runClassify = useCallback(async () => {
    const data = await apiClassify(text);
    setClassificationResults(data.results || []);
    // scroll to top after content updates
    setTimeout(
      () => tagTableRef.current?.scrollTo({ top: 0, behavior: "smooth" }),
      100
    );
  }, [text]);

  // ── NER spans (notations) ──────────────────────────────────────────────────
  const [nerSpans, setNerSpans] = useState<NerSpan[]>([]);

  const runNer = useCallback(async () => {
    if (!text.trim()) return;
    const data = await apiNer(text);
    setNerSpans(
      (data.results ?? []).map((r: any) => ({
        start: r.start,
        end: r.end,
        entity: r.entity,
        score: r.score,
      }))
    );
  }, [text]);

  /**
   * Append a new notation span (e.g., from current editor selection).
   * Ensures start < end and prevents exact duplicates.
   */
  const addNotationSpan = useCallback(
    (span: Pick<NerSpan, "start" | "end" | "entity">) => {
      const start = Math.min(span.start, span.end);
      const end = Math.max(span.start, span.end);
      if (start === end) return; // ignore empty
      setNerSpans((prev) => {
        const dup = prev.some(
          (s) => s.start === start && s.end === end && s.entity === span.entity
        );
        if (dup) return prev;
        return [{ start, end, entity: span.entity }, ...prev];
      });
    },
    []
  );

  /**
   * Remove a notation span by identity.
   */
  const deleteNotationSpan = useCallback((span: NerSpan) => {
    setNerSpans((prev) =>
      prev.filter(
        (s) =>
          !(
            s.start === span.start &&
            s.end === span.end &&
            s.entity === span.entity
          )
      )
    );
  }, []);

  // Provide a handy list of distinct categories from current spans.
  const notationCategories = useMemo(
    () => Array.from(new Set(nerSpans.map((s) => s.entity))).filter(Boolean),
    [nerSpans]
  );

  return {
    // state
    text,
    setText,
    classificationResults,
    customTags,
    setCustomTags,
    customTagInput,
    setCustomTagInput,

    // derived
    combinedTags,
    tagTableRef,

    // semantic tag actions
    addCustomTag,
    deleteTag,
    runClassify,

    // NER / notations
    nerSpans,
    setNerSpans, // ← exposed for editor/panel integration
    runNer,
    addNotationSpan, // ← use to add selection as a span
    deleteNotationSpan, // ← optional helper
    notationCategories, // ← distinct entities for bubbles
  };
}
