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

  // scroll container ref for the right table
  const tagTableRef = useRef<HTMLDivElement>(null);

  const combinedTags: TagItem[] = useMemo(() => {
    return [
      ...customTags.map((t) => ({ name: t, source: "custom" as const })),
      ...(classificationResults?.map((r: any) => ({
        name: r.name,
        source: "api" as const,
      })) || []),
    ];
  }, [customTags, classificationResults]);

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

  const runClassify = useCallback(async () => {
    const data = await apiClassify(text);
    setClassificationResults(data.results || []);
    // scroll to top after content updates
    setTimeout(
      () => tagTableRef.current?.scrollTo({ top: 0, behavior: "smooth" }),
      100
    );
  }, [text]);

  const [nerSpans, setNerSpans] = useState<NerSpan[]>([]);

  const runNer = useCallback(async () => {
    if (!text.trim()) return;
    const data = await apiNer(text);
    // transform API to spans
    console.log(data);
    setNerSpans(
      (data.results ?? []).map((r: any) => ({
        start: r.start,
        end: r.end,
        entity: r.entity,
        score: r.score,
      }))
    );
  }, [text]);

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

    // actions
    addCustomTag,
    deleteTag,
    runClassify,
    runNer,
    nerSpans,
  };
}
