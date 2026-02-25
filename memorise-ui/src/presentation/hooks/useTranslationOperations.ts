import { useCallback, useState, useEffect } from "react";
import { workflowService } from "../../application/services/WorkflowApplicationService";
import { useSessionStore } from "../stores/sessionStore";

export function useTranslationOperations(
  currentId: string | null,
  session: { text?: string; translations?: Array<{ language: string; text: string }> } | null,
  showNotice: (msg: string, opts?: { tone?: "success" | "error" }) => void,
  handleError: (err: unknown) => void
) {
  const activeTab = useSessionStore((state) => state.activeTab);
  const setActiveTab = useSessionStore((state) => state.setActiveTab);
  const updateTranslations = useSessionStore((state) => state.updateTranslations);
  
  const [translationMenuAnchor, setTranslationMenuAnchor] = useState<HTMLElement | null>(null);
  const [isUpdatingTranslation, setIsUpdatingTranslation] = useState(false);
  const [languageOptions, setLanguageOptions] = useState<Array<{ code: string; label: string }>>([]);
  const [isLanguageListLoading, setIsLanguageListLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLanguageListLoading(true);
    workflowService.getSupportedLanguages()
      .then((langs) => {
        if (mounted) {
          setLanguageOptions(langs.map(c => ({ code: c, label: c })));
          setIsLanguageListLoading(false);
        }
      })
      .catch(() => mounted && setIsLanguageListLoading(false));
    return () => { mounted = false; };
  }, []);

  const handleTabSwitch = useCallback((tab: string, setText: (text: string) => void, setEditorInstanceKey: (key: string) => void) => {
    const { text: newText, editorInstanceKey } = workflowService.executeTabSwitch(tab, session, currentId);
    setActiveTab(tab);
    setText(newText);
    setEditorInstanceKey(editorInstanceKey);
  }, [session, currentId, setActiveTab]);

  const handleAddTranslation = useCallback(async (
    targetLang: string,
    setText: (text: string) => void,
    setEditorInstanceKey: (key: string) => void
  ) => {
    if (!currentId) return showNotice("No workspace selected.");
    setIsUpdatingTranslation(true);
    try {
      const mockUpdateWorkspace = async (_id: string, updates: any) => {
        if (updates.translations) {
          updateTranslations(updates.translations);
        }
      };
      
      const { translatedText, editorInstanceKey, targetLang: lang } = await workflowService.executeAddTranslation(
        currentId,
        targetLang as any,
        session,
        mockUpdateWorkspace
      );
      setActiveTab(lang);
      setText(translatedText);
      setEditorInstanceKey(editorInstanceKey);
      showNotice(`Translated to ${lang}.`, { tone: "success" });
    } catch (err) {
      handleError(err);
    } finally {
      setIsUpdatingTranslation(false);
      setTranslationMenuAnchor(null);
    }
  }, [currentId, session, updateTranslations, handleError, showNotice, setActiveTab]);

  const handleUpdateTranslation = useCallback(async (
    targetLang: string,
    setText: (text: string) => void,
    setEditorInstanceKey: (key: string) => void
  ) => {
    if (!currentId) return showNotice("No workspace selected.");
    setIsUpdatingTranslation(true);
    try {
      const mockUpdateWorkspace = async (_id: string, updates: any) => {
        if (updates.translations) {
          updateTranslations(updates.translations);
        }
      };
      
      const { translatedText, editorInstanceKey, shouldUpdateEditor } = await workflowService.executeUpdateTranslation(
        currentId,
        targetLang as any,
        session,
        mockUpdateWorkspace,
        activeTab
      );
      if (shouldUpdateEditor && editorInstanceKey) {
        setText(translatedText);
        setEditorInstanceKey(editorInstanceKey);
      }
      showNotice(`Updated ${targetLang}.`, { tone: "success" });
    } catch (err) {
      handleError(err);
    } finally {
      setIsUpdatingTranslation(false);
    }
  }, [currentId, session, updateTranslations, activeTab, handleError, showNotice]);

  const handleDeleteTranslation = useCallback(async (
    language: string,
    setText: (text: string) => void,
    setEditorInstanceKey: (key: string) => void
  ) => {
    if (!currentId || !session) return;
    
    const mockUpdateWorkspace = async (_id: string, updates: any) => {
      if (updates.translations) {
        updateTranslations(updates.translations);
      }
    };
    
    const { shouldResetToOriginal } = await workflowService.executeDeleteTranslation(
      currentId, language, session, mockUpdateWorkspace, activeTab
    );
    if (shouldResetToOriginal) {
      setActiveTab("original");
      setText(session.text || "");
      setEditorInstanceKey(`${currentId}:original:${Date.now()}`);
    }
    showNotice("Translation deleted.", { tone: "success" });
  }, [currentId, session, updateTranslations, activeTab, showNotice, setActiveTab]);

  return {
    handleTabSwitch,
    handleAddTranslation,
    handleUpdateTranslation,
    handleDeleteTranslation,
    translationMenuAnchor,
    setTranslationMenuAnchor,
    isUpdatingTranslation,
    languageOptions,
    isLanguageListLoading,
  };
}
