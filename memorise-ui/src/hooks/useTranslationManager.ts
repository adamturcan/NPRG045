import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { Workspace } from "../types/Workspace";
import type { NerSpan } from "../types/NotationEditor";
import type { LanguageCode } from "../lib/translation";
import { getLanguageName } from "../lib/translation";
import type { NoticeOptions } from "../types/Notice";
import { errorHandlingService } from "../infrastructure/services/ErrorHandlingService";
import { getApiService } from "../infrastructure/providers/apiProvider";

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

  const {
    workspaceId,
    workspace,
    getCurrentText,
    annotationsRef,
    setText,
    setEditorInstanceKey,
    setWorkspaces,
    onNotice,
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
   * Deduplicated to handle any existing duplicates in workspace data
   */
  const translationLanguages = useMemo(() => {
    const languages = (workspace?.translations || []).map((t) => t.language);
    // Remove duplicates while preserving order
    return Array.from(new Set(languages));
  }, [workspace?.translations]); // Only depend on translations array, not entire workspace object

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
        const appError = errorHandlingService.handleApiError(error, {
          operation: "load supported languages",
          hook: "useTranslationManager",
        });
        errorHandlingService.logError(appError, {
          hook: "useTranslationManager",
          action: "loadSupportedLanguages",
        });
        if (!cancelled) {
          setSupportedLanguages([]);
          onNotice(appError.message, {
            tone: "error",
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
  }, [apiService, onNotice]);

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

      if (tabId === "original") {
        // Load original text from updated workspace
        newText = updatedWorkspace?.text || currentWorkspace.text || "";
      } else {
        // Load translation text from updated workspace
        const translation = updatedWorkspace?.translations?.find(
          (t) => t.language === tabId
        ) || currentWorkspace.translations?.find(
          (t) => t.language === tabId
        );
        newText = translation?.text || "";
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
    ]
  );

  /**
   * Add a new translation language
   * Creates translation via API and adds to workspace
   */
  const handleAddTranslation = useCallback(
    async (targetLang: string) => {
      closeMenu();

      if (!workspaceId || !workspace) return;

      if (isUpdating) {
        return;
      }

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

      // Capture the current workspace ID and original text at this moment
      // This prevents race conditions if user switches workspaces during translation
      const capturedWorkspaceId = workspaceId;
      const originalText = workspace.text || "";
      
      if (!originalText.trim()) {
        onNotice("Add some text before creating translation.", {
          tone: "warning",
        });
        return;
      }

      try {
        // Import translation API lazily to keep bundle size low
        setIsUpdating(true);
        onNotice(`Translating to ${targetLang}...`, {
          tone: "info",
          persistent: true,
        });

        // Call translation API with the captured original text
        const result = await apiService.translate({
          text: originalText,
          targetLang: targetLang as LanguageCode,
        });

        // Create new translation object (persist auto-detected source if provided)
        const newTranslation = {
          language: targetLang,
          text: result.translatedText,
          sourceLang: result.sourceLang ?? "auto",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // Add to workspace (use captured workspaceId)
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
        const appError = errorHandlingService.handleApiError(error, {
          operation: `translate text to ${targetLang}`,
          hook: "useTranslationManager",
          workspaceId: capturedWorkspaceId,
        });
        errorHandlingService.logError(appError, {
          hook: "useTranslationManager",
          action: "handleAddTranslation",
        });
        onNotice(appError.message, { tone: "error" });
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
    ]
  );

  /**
   * Update a translation by re-translating from current original text
   * Useful when original text has been edited
   */
  const handleUpdateTranslation = useCallback(
    async (targetLang: string) => {
      if (!workspaceId || !workspace) return;

      // Capture state at the moment user clicks update
      // This prevents race conditions if user switches tabs during translation
      const capturedWorkspaceId = workspaceId;
      const capturedActiveTab = activeTab;
      const originalText = workspace.text || "";
      
      if (!originalText.trim()) {
        onNotice("Add some text before updating translation.", {
          tone: "warning",
        });
        return;
      }

      setIsUpdating(true);

      try {
        // Import translation API lazily to keep bundle size low
        onNotice(`Updating ${targetLang} translation...`, {
          tone: "info",
          persistent: true,
        });

        // Call translation API with the captured original text
        const result = await apiService.translate({
          text: originalText,
          targetLang: targetLang as LanguageCode,
        });

        // Update existing translation in workspace
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

        // Only update editor if user is still on the same tab that triggered the update
        if (workspaceId === capturedWorkspaceId && capturedActiveTab === targetLang) {
          // User is still on the same tab - update editor with new translation
          // Don't call handleTabSwitch as it would save the old text first
          const translatedContent = result.translatedText || "";
          setText(translatedContent);
          // Force editor remount for clean state
          setEditorInstanceKey(`${capturedWorkspaceId}:${targetLang}:${Date.now()}`);
        }

        onNotice(`Translation "${targetLang}" updated!`, { tone: "success" });
      } catch (error) {
        const appError = errorHandlingService.handleApiError(error, {
          operation: `update translation ${targetLang}`,
          hook: "useTranslationManager",
          workspaceId: capturedWorkspaceId,
        });
        errorHandlingService.logError(appError, {
          hook: "useTranslationManager",
          action: "handleUpdateTranslation",
        });
        onNotice(appError.message, { tone: "error" });
      } finally {
        setIsUpdating(false);
      }
    },
    /* eslint-disable react-hooks/exhaustive-deps */
    // workspace is intentionally excluded - we only depend on workspace?.id to avoid infinite loops
    [
      apiService,
      workspaceId,
      workspace?.id, // Use ID only to avoid infinite loops
      activeTab,
      setWorkspaces,
      onNotice,
      handleTabSwitch,
      setText,
      setEditorInstanceKey
    ]
    /* eslint-enable react-hooks/exhaustive-deps */
  );

  /**
   * Delete a translation language
   * If deleting the active tab, switch to "original" first
   */
  const handleDeleteTranslation = useCallback(
    (targetLang: string) => {
      if (!workspaceId || !workspace) return;

      // If deleting the currently active tab, switch to original first
      if (activeTab === targetLang) {
        setActiveTab("original");
        // Ensure text is always a string
        setText(workspace.text || "");
        setEditorInstanceKey(`${workspaceId}:original:${Date.now()}`);
      }

      // Remove translation from workspace
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

      onNotice(`Translation "${targetLang}" deleted.`);
    },
    [workspaceId, workspace, activeTab, setText, setEditorInstanceKey, setWorkspaces, onNotice]
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
    isUpdating,
    languageOptions,
    isLanguageListLoading,
    // Expose setter for external control if needed
    setActiveTab,
  };
}

