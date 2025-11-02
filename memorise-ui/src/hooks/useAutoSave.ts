import { useEffect, useRef, useCallback, useMemo } from "react";
import type { Workspace } from "../types/Workspace";
import type { NerSpan } from "../types/NotationEditor";
import type { TagItem } from "../types/Tag";

/**
 * Options for useAutoSave hook
 */
interface AutoSaveOptions {
  /** Delay in milliseconds before saving (default: 350) */
  delay?: number;
  /** Whether autosave is enabled (default: true) */
  enabled?: boolean;
  /** Active tab ID - "original" or language code (e.g., "ces", "dan") */
  activeTab?: string;
}

/**
 * Data structure for autosave
 */
interface AutoSaveData {
  /** Text content being edited */
  text: string;
  /** User-created NER spans */
  userSpans: NerSpan[];
  /** API-generated NER spans */
  apiSpans: NerSpan[];
  /** Set of soft-deleted API span keys */
  deletedApiKeys: Set<string>;
  /** Combined tags (user + API) */
  tags: TagItem[];
}

/**
 * Hook for managing automatic and manual workspace saving
 * 
 * Provides debounced autosave and immediate manual save functionality.
 * Guards against saving during workspace hydration.
 * 
 * @param workspaceId - Current workspace ID (null if none selected)
 * @param data - Workspace data to save (text, spans, tags)
 * @param setWorkspaces - Workspace state setter from parent
 * @param options - Configuration options
 * @returns Object with saveNow function and setHydrated function
 */
export function useAutoSave(
  workspaceId: string | null,
  data: AutoSaveData,
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>,
  options: AutoSaveOptions = {}
) {
  const { delay = 350, enabled = true, activeTab = "original" } = options;
  
  /**
   * Hydration guard - prevents saving while workspace is loading
   * Set to null during hydration, then set to workspace ID when complete
   */
  const hydratedIdRef = useRef<string | null>(null);
  
  /**
   * Timer reference for debounced autosave
   */
  const saveTimer = useRef<number | null>(null);

  /**
   * Serialize deletedApiKeys Set to sorted string for stable dependency comparison.
   * Sets are compared by reference, so we serialize to detect actual content changes.
   * This prevents infinite loops when Set reference changes but contents are the same.
   */
  const deletedApiKeysSerialized = useMemo(() => {
    return Array.from(data.deletedApiKeys).sort().join(',');
  }, [data.deletedApiKeys]);

  /**
   * Serialize spans arrays for stable dependency comparison
   * Use JSON.stringify length + content hash to avoid re-triggering on shallow reference changes
   */
  const spansHash = useMemo(
    () => JSON.stringify(data.userSpans) + JSON.stringify(data.apiSpans),
    [data.userSpans, data.apiSpans]
  );

  /**
   * Serialize tags array for stable dependency comparison
   */
  const tagsHash = useMemo(
    () => JSON.stringify(data.tags),
    [data.tags]
  );

  /**
   * Autosave effect: Debounced automatic saving
   * 
   * Automatically saves workspace changes after delay when user stops editing.
   * 
   * Guards:
   * - Only saves after hydration complete (hydratedIdRef check)
   * - Cancels previous timer if user is still editing
   * 
   * What gets saved:
   * - Text content (original or translation based on activeTab)
   * - User and API NER spans
   * - Deleted span keys (soft deletes)
   * - Combined tags
   * - Updated timestamp
   */
  useEffect(() => {
    // Don't save if no workspace selected
    if (!workspaceId) return;
    
    // Don't save if disabled
    if (!enabled) return;
    
    // Don't save if still loading workspace (hydration in progress)
    if (hydratedIdRef.current !== workspaceId) return;

    // Cancel previous save timer
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    
    // Schedule save for delay milliseconds from now
    saveTimer.current = window.setTimeout(() => {
      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== workspaceId) return w;

          // If on original tab, save text and spans to workspace root
          if (activeTab === "original") {
            return {
              ...w,
              text: data.text,
              userSpans: data.userSpans,
              apiSpans: data.apiSpans,
              deletedApiKeys: Array.from(data.deletedApiKeys),
              tags: data.tags,
              updatedAt: Date.now(),
            };
          }

          // If on translation tab, save text and spans to that translation
          return {
            ...w,
            translations: (w.translations || []).map((t) =>
              t.language === activeTab
                ? { 
                    ...t, 
                    text: data.text, 
                    userSpans: data.userSpans,
                    apiSpans: data.apiSpans,
                    deletedApiKeys: Array.from(data.deletedApiKeys),
                    updatedAt: Date.now() 
                  }
                : t
            ),
            tags: data.tags,
            updatedAt: Date.now(),
          };
        })
      );
    }, delay);

    // Cleanup: cancel timer if component unmounts or dependencies change
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
    // Using serialized values instead of direct array/Set references to avoid infinite loops
    // when references change but content is the same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    workspaceId,
    activeTab,
    data.text,
    spansHash,
    deletedApiKeysSerialized,
    tagsHash,
    delay,
    enabled,
    setWorkspaces,
  ]);

  /**
   * Manual save function: Immediately saves all workspace data (no debounce)
   * 
   * Called by EditorArea when user presses Cmd+S/Ctrl+S or clicks save button.
   * 
   * Ensures hydratedIdRef is set (enables autosave after manual save).
   * 
   * @param onNotice - Optional callback to show notification after save
   */
  const saveNow = useCallback(
    (onNotice?: (msg: string) => void) => {
      if (!workspaceId) return;
      
      // Mark as hydrated (enables autosave)
      hydratedIdRef.current = workspaceId;
      
      // Cancel any pending autosave
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      
      // Save workspace data immediately
      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== workspaceId) return w;

          // If on original tab, save text and spans to workspace root
          if (activeTab === "original") {
            return {
              ...w,
              text: data.text,
              userSpans: data.userSpans,
              apiSpans: data.apiSpans,
              deletedApiKeys: Array.from(data.deletedApiKeys),
              tags: data.tags,
              updatedAt: Date.now(),
            };
          }

          // If on translation tab, save text and spans to that translation
          return {
            ...w,
            translations: (w.translations || []).map((t) =>
              t.language === activeTab
                ? { 
                    ...t, 
                    text: data.text, 
                    userSpans: data.userSpans,
                    apiSpans: data.apiSpans,
                    deletedApiKeys: Array.from(data.deletedApiKeys),
                    updatedAt: Date.now() 
                  }
                : t
            ),
            tags: data.tags,
            updatedAt: Date.now(),
          };
        })
      );
      
      // Show confirmation if callback provided
      if (onNotice) {
        onNotice("Workspace saved.");
      }
    },
    // Using serialized values instead of direct array/Set references to avoid infinite loops
    // when references change but content is the same
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      workspaceId,
      activeTab,
      data.text,
      spansHash,
      deletedApiKeysSerialized,
      tagsHash,
      setWorkspaces,
    ]
  );

  /**
   * Set hydration state (called from parent component)
   * Used to indicate when workspace hydration is complete
   */
  const setHydrated = useCallback((id: string | null) => {
    hydratedIdRef.current = id;
  }, []);

  return {
    saveNow,
    setHydrated,
  };
}

