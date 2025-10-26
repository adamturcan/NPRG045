/**
 * useNerAnnotations - Custom hook for managing NER (Named Entity Recognition) annotations
 * 
 * This hook handles text annotation spans that highlight entities like:
 * - PERSON (names of people)
 * - LOCATION (places, countries, cities)
 * - ORGANIZATION (companies, institutions)
 * - DATE, MONEY, etc.
 * 
 * These spans are rendered as colored underlines in the NotationEditor.
 * Users can manually annotate text or use the NER API for automatic detection.
 */
import { useCallback, useMemo, useState } from "react";
import { ner as apiNer } from "../lib/api";
import type { NerSpan } from "../types/NotationEditor";

export function useNerAnnotations() {
  // Array of all annotation spans (start/end positions + entity type)
  const [nerSpans, setNerSpans] = useState<NerSpan[]>([]);

  /**
   * Call the NER API to automatically detect and annotate entities in the text
   * Replaces all spans with new results from the API
   */
  const runNer = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    const data = await apiNer(text);
    
    // Transform API response into NerSpan array
    // The API returns { result: [...] } with fields: type, name, start, end
    const spans = (data.result ?? []).map((r: any) => ({
      start: r.start,
      end: r.end,
      entity: r.type, // API returns 'type' field, map to 'entity'
      score: 1.0, // API doesn't provide score, use default
    }));
    
    setNerSpans(spans);
  }, []);

  /**
   * Add a new annotation span (user manually annotated text)
   * Prevents duplicates and zero-length spans
   */
  const addNotationSpan = useCallback(
    (span: Pick<NerSpan, "start" | "end" | "entity">) => {
      // Normalize start/end (ensure start <= end)
      const start = Math.min(span.start, span.end);
      const end = Math.max(span.start, span.end);
      
      // Ignore zero-length spans
      if (start === end) return;
      
      setNerSpans((prev) => {
        // Check for duplicate
        const dup = prev.some(
          (s) => s.start === start && s.end === end && s.entity === span.entity
        );
        if (dup) return prev;
        
        // Add new span to beginning of array
        return [{ start, end, entity: span.entity }, ...prev];
      });
    },
    []
  );

  /**
   * Delete an annotation span
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

  /**
   * Get unique list of entity categories present in current annotations
   * Used for filtering/highlighting in the editor
   */
  const notationCategories = useMemo(
    () => Array.from(new Set(nerSpans.map((s) => s.entity))).filter(Boolean),
    [nerSpans]
  );

  return {
    nerSpans,              // All annotation spans
    setNerSpans,           // Direct setter (for loading from workspace)
    runNer,                // Call NER API for automatic detection
    addNotationSpan,       // Add span manually
    deleteNotationSpan,    // Delete span
    notationCategories,    // Unique entity types in spans
  };
}

