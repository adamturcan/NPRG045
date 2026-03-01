import { useCallback, useState, useEffect } from "react";
import { translationWorkflowService } from "../../application/services/TranslationWorkflowService";
import { useSessionStore } from "../stores/sessionStore";
import type { Workspace } from "../../types/Workspace";

export function useTranslationOperations(
  currentId: string | null,
  session: Workspace | null,
  showNotice: (msg: string, opts?: { tone?: "success" | "error" | "info" }) => void,
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
    translationWorkflowService.getSupportedLanguages()
      .then((langs) => {
        if (mounted) {
          setLanguageOptions(langs.map(c => ({ code: c, label: c })));
          setIsLanguageListLoading(false);
        }
      })
      .catch(() => mounted && setIsLanguageListLoading(false));
    return () => { mounted = false; };
  }, []);

  const handleTabSwitch = useCallback((
    tab: string, 
    setText?: (text: string) => void, 
    setEditorInstanceKey?: (key: string) => void
  ) => {
    const newText = tab === "original" 
      ? session?.text || "" 
      : session?.translations?.find((t) => t.language === tab)?.text || "";
      
    const editorInstanceKey = `${currentId ?? "new"}:${tab}`;
    
    setActiveTab(tab);
    if (setText) setText(newText);
    if (setEditorInstanceKey) setEditorInstanceKey(editorInstanceKey);
  }, [session, currentId, setActiveTab]);

  const handleAddTranslation = useCallback(async (
    targetLang: string,
    setText?: (text: string) => void,
    activeSegmentId?: string,
    setEditorInstanceKey?: (key: string) => void
  ) => {
    if (!currentId) return showNotice("No workspace selected.", { tone: "error" });
    setIsUpdatingTranslation(true);
    
    try {
      const mockUpdateWorkspace = async (_id: string, updates: any) => {
        if (updates.translations) {
          updateTranslations(updates.translations);
        }
      };

      if (activeSegmentId) {
        const { translatedText, targetLang: lang } = await translationWorkflowService.executeAddSegmentTranslation(
          currentId,
          targetLang as any,
          activeSegmentId,
          session,
          mockUpdateWorkspace
        );
        
        setActiveTab(lang);
        if (setText) setText(translatedText);
        showNotice(`Translated segment to ${lang}.`, { tone: "success" });

      } else {
        const { translatedText, editorInstanceKey, targetLang: lang } = await translationWorkflowService.executeAddTranslation(
          currentId,
          targetLang as any,
          session,
          mockUpdateWorkspace
        );
        
        setActiveTab(lang);
        if (setText) setText(translatedText);
        if (setEditorInstanceKey && editorInstanceKey) setEditorInstanceKey(editorInstanceKey);
        showNotice(`Translated document to ${lang}.`, { tone: "success" });
      }

    } catch (err) {
      handleError(err);
    } finally {
      setIsUpdatingTranslation(false);
      setTranslationMenuAnchor(null);
    }
  }, [currentId, session, updateTranslations, handleError, showNotice, setActiveTab]);

  const handleUpdateTranslation = useCallback(async (
    targetLang: string,
    setText?: (text: string) => void,
    activeSegmentId?: string,
    setEditorInstanceKey?: (key: string) => void
  ) => {
    if (!currentId) return showNotice("No workspace selected.", { tone: "error" });
    setIsUpdatingTranslation(true);
    
    try {
      const mockUpdateWorkspace = async (_id: string, updates: any) => {
        if (updates.translations) {
          updateTranslations(updates.translations);
        }
      };
      
      if (activeSegmentId) {
         const { translatedText } = await translationWorkflowService.executeUpdateSegmentTranslation(
            currentId,
            targetLang as any,
            activeSegmentId,
            session,
            mockUpdateWorkspace
         );
         if (setText) setText(translatedText);
         showNotice(`Updated segment translation in ${targetLang}.`, { tone: "success" });

      } else {
         const { translatedText, editorInstanceKey, shouldUpdateEditor } = await translationWorkflowService.executeUpdateTranslation(
           currentId,
           targetLang as any,
           session,
           mockUpdateWorkspace,
           activeTab
         );
         
         if (shouldUpdateEditor) {
           if (setText) setText(translatedText);
           if (setEditorInstanceKey && editorInstanceKey) setEditorInstanceKey(editorInstanceKey);
         }
         showNotice(`Updated ${targetLang} translation.`, { tone: "success" });
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsUpdatingTranslation(false);
    }
  }, [currentId, session, updateTranslations, activeTab, handleError, showNotice]);

  const handleDeleteTranslation = useCallback(async (
    language: string,
    setText?: (text: string) => void,
    setEditorInstanceKey?: (key: string) => void
  ) => {
    if (!currentId || !session) return;
    
    const mockUpdateWorkspace = async (_id: string, updates: any) => {
      if (updates.translations) {
        updateTranslations(updates.translations);
      }
    };
    
    const { shouldResetToOriginal } = await translationWorkflowService.executeDeleteTranslation(
      currentId, language, session, mockUpdateWorkspace, activeTab
    );
    
    if (shouldResetToOriginal) {
      setActiveTab("original");
      if (setText) setText(session.text || "");
      if (setEditorInstanceKey) setEditorInstanceKey(`${currentId}:original:${Date.now()}`);
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