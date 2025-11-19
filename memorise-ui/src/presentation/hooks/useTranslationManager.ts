import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { Workspace } from "../../types/Workspace";
import type { NerSpan } from "../../types/NotationEditor";
import type { LanguageCode } from "../../shared/utils/translation";
import { getLanguageName } from "../../shared/utils/translation";
import type { NoticeOptions } from "../../types/Notice";
import { presentError } from "../../application/errors/errorPresenter";
import { useErrorLogger } from "./useErrorLogger";
import { getApiService } from "../../infrastructure/providers/apiProvider";
import { getSegmentText } from "../../types/Segment";

/**
 * Options for useTranslationManager hook
 */
interface AnnotationsRef {
  userSpans: NerSpan[];
  apiSpans: NerSpan[];
  deletedApiKeys: Set<string>;
}

interface TranslationManagerOptions {
  /** Current workspace ID */
  workspaceId: string | null;
  /** Current workspace data */
  workspace: Workspace | undefined;
  /** Function to get current text content (allows dynamic access) */
  getCurrentText: () => string;
  /** Ref to current annotations (allows dynamic access without recreating callbacks) */
  annotationsRef: React.MutableRefObject<AnnotationsRef | null>;
  /** Setter for text content */
  setText: (text: string) => void;
  /** Setter for editor instance key (for remounting) */
  setEditorInstanceKey: (key: string) => void;
  /** Workspace setter */
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>;
  /** Callback to show notifications */
  onNotice: (msg: string, options?: NoticeOptions) => void;
  /** View mode: "document" or "segments" */
  viewMode?: "document" | "segments";
  /** Currently selected segment ID (for segment view) */
  selectedSegmentId?: string | null;
}

/**
 * Hook for managing translation tabs and translations
 * 
 * Manages:
 * - Active tab state (original vs translation languages)
 * - Translation menu anchor (for adding translations)
 * - Tab switching (saves current, loads new)
 * - Adding translations (with language detection)
 * - Updating translations (re-translation from original)
 * - Deleting translations
 * 
 * Each translation tab maintains its own text and NER spans.
 * 
 * @param options - Configuration options
 * @returns Object with translation state and handlers
 */
export function useTranslationManager(options: TranslationManagerOptions) {
  const apiService = useMemo(() => getApiService(), []);
  // Stabilize error logger dependency to avoid recreating callback every render (which can retrigger effects)
  const errorContext = useMemo(() => ({ hook: "useTranslationManager" }), []);
  const logError = useErrorLogger(errorContext);

  const {
    workspaceId,
    workspace,
    getCurrentText,
    annotationsRef,
    setText,
    setEditorInstanceKey,
    setWorkspaces,
    onNotice,
    viewMode = "document",
    selectedSegmentId = null,
  } = options;

  /**
   * Active tab: "original" or language code (e.g., "ces", "dan")
   * Determines which content is shown in the editor
   */
  const [activeTab, setActiveTab] = useState<string>("original");

  /**
   * Language selection menu anchor for adding translations
   */
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  /**
   * Track if a translation update is in progress
   * Used to disable tab switching during updates
   */
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  /**
   * Supported languages available in the translation service
   */
  const [supportedLanguages, setSupportedLanguages] = useState<LanguageCode[]>([]);
  const [isLanguageListLoading, setIsLanguageListLoading] = useState<boolean>(false);

  /**
   * Keep workspace ref to avoid infinite loops when workspace object reference changes
   * Update ref when workspace actually changes (by ID comparison)
   */
  const workspaceRef = useRef<Workspace | undefined>(workspace);
  const workspaceIdRef = useRef<string | null>(workspaceId);
  
  useEffect(() => {
    // Only update ref if workspace ID changed (actual workspace change)
    // Don't update if just the object reference changed but it's the same workspace
    if (workspaceId !== workspaceIdRef.current || 
        (workspace && workspace.id !== workspaceRef.current?.id)) {
      workspaceRef.current = workspace;
      workspaceIdRef.current = workspaceId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, workspace?.id]); // Only depend on workspace ID, not entire object to avoid infinite loops

  /**
   * Get list of existing translation languages for this workspace
   * In segment view, only show languages that have translations for the current segment
   * In document view, show all translation languages
   */
  const translationLanguages = useMemo(() => {
    if (viewMode === "segments" && selectedSegmentId) {
      // In segment view: only show languages that have translations for this segment
      const segment = workspace?.segments?.find(s => s.id === selectedSegmentId);
      if (segment?.translations) {
        return Object.keys(segment.translations);
      }
      // If no segment translations exist, only show "original"
      return [];
    } else {
      // In document view: show all translation languages
      const languages = (workspace?.translations || []).map((t) => t.language);
      // Remove duplicates while preserving order
      return Array.from(new Set(languages));
    }
  }, [workspace?.translations, workspace?.segments, viewMode, selectedSegmentId]);

  /**
   * Fetch supported languages on mount
   */
  useEffect(() => {
    let cancelled = false;

    const loadLanguages = async () => {
      setIsLanguageListLoading(true);
      try {
        const languages = await apiService.getSupportedLanguages();
        if (!cancelled) {
          setSupportedLanguages(languages);
        }
      } catch (error) {
        const appError = logError(error, {
          operation: "load supported languages",
        });
        if (!cancelled) {
          setSupportedLanguages([]);
          const notice = presentError(appError);
          onNotice(notice.message, {
            tone: notice.tone,
            persistent: notice.persistent,
          });
        }
      } finally {
        if (!cancelled) {
          setIsLanguageListLoading(false);
        }
      }
    };

    void loadLanguages();

    return () => {
      cancelled = true;
    };
  }, [apiService, logError, onNotice]);

  /**
   * Pre-compute language options (exclude already-added translations)
   */
  const languageOptions = useMemo(() => {
    const existingLanguages = new Set(
      translationLanguages.map((lang) => lang.toLowerCase())
    );

    return supportedLanguages
      .filter((code) => !existingLanguages.has(code.toLowerCase()))
      .map((code) => ({
        code,
        label: getLanguageName(code),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [supportedLanguages, translationLanguages]);

  /**
   * Open translation menu
   */
  const openMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(e.currentTarget);
  }, []);

  /**
   * Close translation menu
   */
  const closeMenu = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  /**
   * Handle switching between tabs
   * Save current content AND NER spans before switching
   * In segment view, save to segment.translations; in document view, save to workspace.translations
   */
  const handleTabSwitch = useCallback(
    (tabId: string) => {
      // Use refs to avoid dependency on changing workspace object
      const currentWorkspaceId = workspaceIdRef.current;
      const currentWorkspace = workspaceRef.current;
      
      if (!currentWorkspaceId || !currentWorkspace) return;
      
      // Don't do anything if already on this tab
      if (activeTab === tabId) return;

      // Step 1: Save current content AND spans to workspace
      // Get current values at save time (not at hook initialization)
      const currentText = getCurrentText();
      const currentUserSpans = annotationsRef.current?.userSpans ?? [];
      const currentApiSpans = annotationsRef.current?.apiSpans ?? [];
      const currentDeletedApiKeys = annotationsRef.current?.deletedApiKeys ?? new Set();
      
      // Step 2: Compute the updated workspace immediately (before state update)
      // This ensures we can read the correct new text after saving
      let updatedWorkspace: Workspace | undefined;
      
      setWorkspaces((prev) => {
        return prev.map((w) => {
          if (w.id !== currentWorkspaceId) return w;

          if (viewMode === "segments" && selectedSegmentId) {
            // Segment view: save to segment.translations
            if (activeTab === "original") {
              // Save original segment text (not spans, as spans are document-level)
              // Note: segment text is synced via handleTextChange in WorkspaceContainer
              updatedWorkspace = { ...w, updatedAt: Date.now() };
              return updatedWorkspace;
            } else {
              // Save translation text to segment.translations[languageCode]
              updatedWorkspace = {
                ...w,
                segments: (w.segments || []).map((seg) =>
                  seg.id === selectedSegmentId
                    ? {
                        ...seg,
                        translations: {
                          ...(seg.translations || {}),
                          [activeTab]: currentText,
                        },
                      }
                    : seg
                ),
                updatedAt: Date.now(),
              };
              return updatedWorkspace;
            }
          } else {
            // Document view: save to workspace.translations (existing logic)
            if (activeTab === "original") {
              // Save original text and spans
              updatedWorkspace = { 
                ...w, 
                text: currentText, 
                userSpans: currentUserSpans,
                apiSpans: currentApiSpans,
                deletedApiKeys: Array.from(currentDeletedApiKeys),
                updatedAt: Date.now() 
              };
              return updatedWorkspace;
            } else {
              // Save translation text and spans
              updatedWorkspace = {
                ...w,
                translations: (w.translations || []).map((t) =>
                  t.language === activeTab
                    ? { 
                        ...t, 
                        text: currentText, 
                        userSpans: currentUserSpans,
                        apiSpans: currentApiSpans,
                        deletedApiKeys: Array.from(currentDeletedApiKeys),
                        updatedAt: Date.now() 
                      }
                    : t
                ),
                updatedAt: Date.now(),
              };
              return updatedWorkspace;
            }
          }
        });
      });

      // Step 3: Update workspace ref immediately with saved data
      // This ensures the ref has the latest data when we read from it
      if (updatedWorkspace) {
        workspaceRef.current = updatedWorkspace;
      }

      // Step 4: Load new content from the updated workspace
      // Note: Spans will be automatically loaded by useAnnotationManager hook when activeTab changes
      let newText = "";

      if (viewMode === "segments" && selectedSegmentId) {
        // Segment view: load from segment.translations
        if (tabId === "original") {
          // Load original segment text
          const segment = updatedWorkspace?.segments?.find(s => s.id === selectedSegmentId) ||
                         currentWorkspace.segments?.find(s => s.id === selectedSegmentId);
          if (segment) {
            // Get full document text to derive segment text
            const fullDocText = currentWorkspace.text || "";
            newText = segment.text ?? getSegmentText(segment, fullDocText);
          }
        } else {
          // Load translation from segment.translations[languageCode]
          const segment = updatedWorkspace?.segments?.find(s => s.id === selectedSegmentId) ||
                         currentWorkspace.segments?.find(s => s.id === selectedSegmentId);
          newText = segment?.translations?.[tabId] || "";
        }
      } else {
        // Document view: load from workspace.translations (existing logic)
        if (tabId === "original") {
          newText = updatedWorkspace?.text || currentWorkspace.text || "";
        } else {
          const translation = updatedWorkspace?.translations?.find(
            (t) => t.language === tabId
          ) || currentWorkspace.translations?.find(
            (t) => t.language === tabId
          );
          newText = translation?.text || "";
        }
      }
      
      // Step 5: Update editor with new content
      setText(newText);

      // Step 6: Update UI state (this triggers hook hydration for spans)
      setActiveTab(tabId);
      setEditorInstanceKey(`${currentWorkspaceId}:${tabId}:${Date.now()}`);
    },
    [
      activeTab,
      getCurrentText,
      annotationsRef,
      setText,
      setEditorInstanceKey,
      setWorkspaces,
      viewMode,
      selectedSegmentId,
    ]
  );

  /**
   * Add a new translation language
   * In segment view: translates only the selected segment and stores in segment.translations
   * In document view: translates whole document and stores in workspace.translations
   */
  const handleAddTranslation = useCallback(
    async (targetLang: string) => {
      closeMenu();

      if (!workspaceId || !workspace) return;

      if (isUpdating) {
        return;
      }

      // Capture the current workspace ID at this moment
      const capturedWorkspaceId = workspaceId;
      
      // Determine text to translate based on view mode
      let textToTranslate: string;
      let isSegmentTranslation = false;
      
      if (viewMode === "segments" && selectedSegmentId) {
        // Segment view: use only the selected segment's text
        const segment = workspace.segments?.find(s => s.id === selectedSegmentId);
        if (!segment) {
          onNotice("No segment selected.", { tone: "warning" });
          return;
        }
        
        // Get segment text
        const fullDocText = workspace.text || "";
        textToTranslate = segment.text ?? getSegmentText(segment, fullDocText);
        isSegmentTranslation = true;
        
        // Check if translation already exists for this segment
        if (segment.translations?.[targetLang]) {
          onNotice(`Translation to ${targetLang} already exists for this segment. Use update instead.`, {
            tone: "warning",
          });
          return;
        }
      } else {
        // Document view: use whole document text
        textToTranslate = workspace.text || "";
        
        // Check if translation already exists for this language
        const existingTranslation = workspace.translations?.find(
          (t) => t.language === targetLang
        );
        if (existingTranslation) {
          onNotice(`Translation to ${targetLang} already exists. Use update instead.`, {
            tone: "warning",
          });
          return;
        }
      }
      
      if (!textToTranslate.trim()) {
        onNotice("Add some text before creating translation.", {
          tone: "warning",
        });
        return;
      }

      try {
        setIsUpdating(true);
        onNotice(`Translating to ${targetLang}...`, {
          tone: "info",
          persistent: true,
        });

        // Call translation API with the text to translate
        const result = await apiService.translate({
          text: textToTranslate,
          targetLang: targetLang as LanguageCode,
        });

        if (isSegmentTranslation) {
          // Segment view: store in segment.translations[languageCode]
          setWorkspaces((prev) =>
            prev.map((w) =>
              w.id === capturedWorkspaceId
                ? {
                    ...w,
                    segments: (w.segments || []).map((seg) =>
                      seg.id === selectedSegmentId
                        ? {
                            ...seg,
                            translations: {
                              ...(seg.translations || {}),
                              [targetLang]: result.translatedText,
                            },
                          }
                        : seg
                    ),
                    updatedAt: Date.now(),
                  }
                : w
            )
          );
        } else {
          // Document view: store in workspace.translations
          const newTranslation = {
            language: targetLang,
            text: result.translatedText,
            sourceLang: result.sourceLang ?? "auto",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          setWorkspaces((prev) =>
            prev.map((w) =>
              w.id === capturedWorkspaceId
                ? {
                    ...w,
                    translations: [...(w.translations || []), newTranslation],
                    updatedAt: Date.now(),
                  }
                : w
            )
          );
        }

        // Only switch tabs and update editor if still on the same workspace
        if (workspaceId === capturedWorkspaceId) {
          // Switch to the new translation tab and load its text
          setActiveTab(targetLang);
          
          // Ensure we have valid text (Slate editor breaks with undefined/null)
          const translatedContent = result.translatedText || "";
          setText(translatedContent);
          
          // Force editor remount for clean state
          setEditorInstanceKey(`${capturedWorkspaceId}:${targetLang}:${Date.now()}`);
        }

        // Show completion message
        onNotice(`Translation to ${targetLang} completed!`, { tone: "success" });
      } catch (error) {
        const appError = logError(error, {
          operation: `translate text to ${targetLang}`,
          workspaceId: capturedWorkspaceId,
        });
        const notice = presentError(appError);
        onNotice(notice.message, {
          tone: notice.tone,
          persistent: notice.persistent,
        });
      } finally {
        setIsUpdating(false);
      }
    },
    [
      apiService,
      workspaceId,
      workspace,
      closeMenu,
      setText,
      setEditorInstanceKey,
      setWorkspaces,
      onNotice,
      isUpdating,
      logError,
      viewMode,
      selectedSegmentId,
    ]
  );

  /**
   * Update a translation by re-translating from current original text
   * In segment view: updates segment translation
   * In document view: updates document translation
   */
  const handleUpdateTranslation = useCallback(
    async (targetLang: string) => {
      if (!workspaceId || !workspace) return;

      // Capture state at the moment user clicks update
      const capturedWorkspaceId = workspaceId;
      const capturedActiveTab = activeTab;
      
      // Determine text to translate based on view mode
      let textToTranslate: string;
      let isSegmentTranslation = false;
      
      if (viewMode === "segments" && selectedSegmentId) {
        // Segment view: use only the selected segment's original text
        const segment = workspace.segments?.find(s => s.id === selectedSegmentId);
        if (!segment) {
          onNotice("No segment selected.", { tone: "warning" });
          return;
        }
        
        // Get segment's original text (from full document)
        const fullDocText = workspace.text || "";
        textToTranslate = segment.text ?? getSegmentText(segment, fullDocText);
        isSegmentTranslation = true;
      } else {
        // Document view: use whole document text
        textToTranslate = workspace.text || "";
      }
      
      if (!textToTranslate.trim()) {
        onNotice("Add some text before updating translation.", {
          tone: "warning",
        });
        return;
      }

      setIsUpdating(true);

      try {
        onNotice(`Updating ${targetLang} translation...`, {
          tone: "info",
          persistent: true,
        });

        // Call translation API with the text to translate
        const result = await apiService.translate({
          text: textToTranslate,
          targetLang: targetLang as LanguageCode,
        });

        if (isSegmentTranslation) {
          // Segment view: update segment.translations[languageCode]
          setWorkspaces((prev) =>
            prev.map((w) =>
              w.id === capturedWorkspaceId
                ? {
                    ...w,
                    segments: (w.segments || []).map((seg) =>
                      seg.id === selectedSegmentId
                        ? {
                            ...seg,
                            translations: {
                              ...(seg.translations || {}),
                              [targetLang]: result.translatedText,
                            },
                          }
                        : seg
                    ),
                    updatedAt: Date.now(),
                  }
                : w
            )
          );
        } else {
          // Document view: update workspace.translations
          setWorkspaces((prev) =>
            prev.map((w) =>
              w.id === capturedWorkspaceId
                ? {
                    ...w,
                    translations: (w.translations || []).map((t) =>
                      t.language === targetLang
                        ? {
                            ...t,
                            text: result.translatedText,
                            sourceLang: result.sourceLang ?? t.sourceLang ?? "auto",
                            updatedAt: Date.now(),
                          }
                        : t
                    ),
                    updatedAt: Date.now(),
                  }
                : w
            )
          );
        }

        // Only update editor if user is still on the same tab that triggered the update
        if (workspaceId === capturedWorkspaceId && capturedActiveTab === targetLang) {
          const translatedContent = result.translatedText || "";
          setText(translatedContent);
          // Force editor remount for clean state
          setEditorInstanceKey(`${capturedWorkspaceId}:${targetLang}:${Date.now()}`);
        }

        onNotice(`Translation "${targetLang}" updated!`, { tone: "success" });
      } catch (error) {
        const appError = logError(error, {
          operation: `update translation ${targetLang}`,
          workspaceId: capturedWorkspaceId,
        });
        const notice = presentError(appError);
        onNotice(notice.message, {
          tone: notice.tone,
          persistent: notice.persistent,
        });
      } finally {
        setIsUpdating(false);
      }
    },
    [
      apiService,
      workspaceId,
      workspace?.id,
      activeTab,
      setWorkspaces,
      onNotice,
      logError,
      setText,
      setEditorInstanceKey,
      viewMode,
      selectedSegmentId,
    ]
  );

  /**
   * Delete a translation language
   * In segment view: deletes translation from segment.translations
   * In document view: deletes translation from workspace.translations
   */
  const handleDeleteTranslation = useCallback(
    (targetLang: string) => {
      if (!workspaceId || !workspace) return;

      // If deleting the currently active tab, switch to original first
      if (activeTab === targetLang) {
        setActiveTab("original");
        
        if (viewMode === "segments" && selectedSegmentId) {
          // Load original segment text
          const segment = workspace.segments?.find(s => s.id === selectedSegmentId);
          if (segment) {
            const fullDocText = workspace.text || "";
            const segmentText = segment.text ?? getSegmentText(segment, fullDocText);
            setText(segmentText);
          } else {
            setText("");
          }
        } else {
          // Load original document text
          setText(workspace.text || "");
        }
        
        setEditorInstanceKey(`${workspaceId}:original:${Date.now()}`);
      }

      // Remove translation from workspace
      if (viewMode === "segments" && selectedSegmentId) {
        // Segment view: remove from segment.translations
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === workspaceId
              ? {
                  ...w,
                  segments: (w.segments || []).map((seg) =>
                    seg.id === selectedSegmentId
                      ? {
                          ...seg,
                          translations: Object.fromEntries(
                            Object.entries(seg.translations || {}).filter(
                              ([lang]) => lang !== targetLang
                            )
                          ),
                        }
                      : seg
                  ),
                  updatedAt: Date.now(),
                }
              : w
          )
        );
      } else {
        // Document view: remove from workspace.translations
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === workspaceId
              ? {
                  ...w,
                  translations: (w.translations || []).filter(
                    (t) => t.language !== targetLang
                  ),
                  updatedAt: Date.now(),
                }
              : w
          )
        );
      }

      onNotice(`Translation "${targetLang}" deleted.`);
    },
    [
      workspaceId,
      workspace,
      activeTab,
      setText,
      setEditorInstanceKey,
      setWorkspaces,
      onNotice,
      viewMode,
      selectedSegmentId,
    ]
  );

  /**
   * Translate a single segment
   * Stores the translation in the current translation's segmentTranslations field
   * If translation doesn't exist for the target language, creates it automatically
   */
  const handleTranslateSegment = useCallback(
    async (segment: { id: string; text: string }, targetLang: string) => {
      if (!workspaceId || !workspace) return;

      const capturedWorkspaceId = workspaceId;
      const segmentId = segment.id;
      const segmentText = segment.text;

      if (!segmentText.trim()) {
        onNotice("Segment text is empty.", { tone: "warning" });
        return;
      }

      // Check if translation exists for this language, create if it doesn't
      let translation = workspace.translations?.find(
        (t) => t.language === targetLang
      );
      
      // If translation doesn't exist, create it with empty text (segment-only translation)
      if (!translation) {
        const newTranslation = {
          language: targetLang,
          text: "", // Empty text - this is a segment-only translation
          sourceLang: "auto",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          segmentTranslations: {},
        };
        
        // Add translation to workspace
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === capturedWorkspaceId
              ? {
                  ...w,
                  translations: [...(w.translations || []), newTranslation],
                  updatedAt: Date.now(),
                }
              : w
          )
        );
        
        translation = newTranslation;
        onNotice(`Created translation tab for ${targetLang}.`, {
          tone: "info",
        });
        
        // If we're on original tab, switch to the new translation tab
        if (activeTab === "original") {
          // Use setTimeout to ensure workspace state is updated first
          setTimeout(() => {
            setActiveTab(targetLang);
          }, 100);
        }
      }

      try {
        setIsUpdating(true);
        onNotice(`Translating segment ${segmentId}...`, {
          tone: "info",
          persistent: false,
        });

        // Call translation API for this segment
        const result = await apiService.translate({
          text: segmentText,
          targetLang: targetLang as LanguageCode,
        });

        // Update segment's translations field (new structure: segment.translations[languageCode])
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === capturedWorkspaceId
              ? {
                  ...w,
                  segments: (w.segments || []).map((seg) =>
                    seg.id === segmentId
                      ? {
                          ...seg,
                          translations: {
                            ...(seg.translations || {}),
                            [targetLang]: result.translatedText,
                          },
                        }
                      : seg
                  ),
                  // Also update translation tab's segmentTranslations for backward compatibility
                  translations: (w.translations || []).map((t) =>
                    t.language === targetLang
                      ? {
                          ...t,
                          segmentTranslations: {
                            ...(t.segmentTranslations || {}),
                            [segmentId]: result.translatedText,
                          },
                          updatedAt: Date.now(),
                        }
                      : t
                  ),
                  updatedAt: Date.now(),
                }
              : w
          )
        );

        onNotice(`Segment ${segmentId} translated!`, { tone: "success" });
      } catch (error) {
        const appError = logError(error, {
          operation: `translate segment ${segmentId} to ${targetLang}`,
          workspaceId: capturedWorkspaceId,
        });
        const notice = presentError(appError);
        onNotice(notice.message, {
          tone: notice.tone,
          persistent: notice.persistent,
        });
      } finally {
        setIsUpdating(false);
      }
    },
    [
      apiService,
      workspaceId,
      workspace,
      activeTab,
      setWorkspaces,
      onNotice,
      logError,
    ]
  );

  return {
    activeTab,
    translationLanguages,
    menuAnchor,
    openMenu,
    closeMenu,
    onTabSwitch: handleTabSwitch,
    onAddTranslation: handleAddTranslation,
    onUpdateTranslation: handleUpdateTranslation,
    onDeleteTranslation: handleDeleteTranslation,
    onTranslateSegment: handleTranslateSegment,
    isUpdating,
    languageOptions,
    isLanguageListLoading,
    // Expose setter for external control if needed
    setActiveTab,
  };
}

