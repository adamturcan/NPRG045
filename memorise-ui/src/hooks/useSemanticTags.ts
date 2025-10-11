import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import type { TagItem } from "../types/Tag";
import { classify as apiClassify, ner as apiNer } from "../lib/api";
import type { NerSpan } from "../types/NotationEditor";

type Options = {
  initialTags?: TagItem[];
  /** changes when a different workspace is selected; used to trigger a one-time hydrate */
  hydrateKey?: string | null;
};

export function useSemanticTags(opts?: Options) {
  const [text, setText] = useState("");

  // separate sources
  const [userTags, setUserTags] = useState<TagItem[]>([]);
  const [apiTags, setApiTags] = useState<TagItem[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");

  // Right-panel scroll container (used to scroll to top after classify)
  const tagTableRef = useRef<HTMLDivElement>(null);

  // ---- Init from props (WorkspacePage hydration) ----------------------------
  // IMPORTANT: hydrate only when hydrateKey changes (workspace switched),
  // not whenever the parent re-renders or tags array identity changes.
  useEffect(() => {
    const tags = opts?.initialTags ?? [];
    const u = tags.filter((t) => t.source === "user");
    const a = tags.filter((t) => t.source === "api");
    setUserTags(u);
    setApiTags(a);
  }, [opts?.hydrateKey]);

  // ---- Derived: merged tags -------------------------------------------------
  const combinedTags: TagItem[] = useMemo(() => {
    const key = (t: TagItem) => `${t.source}:${t.name.toLowerCase()}`;
    const map = new Map<string, TagItem>();
    [...userTags, ...apiTags].forEach((t) => map.set(key(t), t));
    return Array.from(map.values());
  }, [userTags, apiTags]);

  // ---- Actions --------------------------------------------------------------
  const addCustomTag = useCallback(
    (name: string) => {
      const tag = name.trim();
      if (!tag) return;
      const exists = combinedTags.some(
        (t) => t.name.toLowerCase() === tag.toLowerCase()
      );
      if (!exists) {
        setUserTags((prev) => [{ name: tag, source: "user" }, ...prev]);
      }
    },
    [combinedTags]
  );

  const deleteTag = useCallback((name: string) => {
    setUserTags((prev) => prev.filter((t) => t.name !== name));
    setApiTags((prev) => prev.filter((t) => t.name !== name));
  }, []);

  const replaceAllTags = useCallback((tags: TagItem[]) => {
    const u = tags.filter((t) => t.source === "user");
    const a = tags.filter((t) => t.source === "api");
    setUserTags(u);
    setApiTags(a);
  }, []);

  // ---- Classify (API) -------------------------------------------------------
  const runClassify = useCallback(async () => {
    if (!text.trim()) return;
    const data = await apiClassify(text);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newTags: TagItem[] = (data.results || []).map((r: any) => ({
      name: r.name,
      source: "api" as const,
    }));
    setApiTags(newTags);
    setTimeout(
      () => tagTableRef.current?.scrollTo({ top: 0, behavior: "smooth" }),
      100
    );
  }, [text]);

  // ---- NER spans ------------------------------------------------------------
  const [nerSpans, setNerSpans] = useState<NerSpan[]>([]);

  const runNer = useCallback(async () => {
    if (!text.trim()) return;
    const data = await apiNer(text);
    setNerSpans(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data.results ?? []).map((r: any) => ({
        start: r.start,
        end: r.end,
        entity: r.entity,
        score: r.score,
      }))
    );
  }, [text]);

  const addNotationSpan = useCallback(
    (span: Pick<NerSpan, "start" | "end" | "entity">) => {
      const start = Math.min(span.start, span.end);
      const end = Math.max(span.start, span.end);
      if (start === end) return;
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

  const notationCategories = useMemo(
    () => Array.from(new Set(nerSpans.map((s) => s.entity))).filter(Boolean),
    [nerSpans]
  );

  return {
    // state
    text,
    setText,
    customTagInput,
    setCustomTagInput,

    // tags
    combinedTags,
    addCustomTag,
    deleteTag,
    replaceAllTags,
    runClassify,
    tagTableRef,

    // spans
    nerSpans,
    setNerSpans,
    runNer,
    addNotationSpan,
    deleteNotationSpan,
    notationCategories,
  };
}
