import React, { useCallback, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import BookmarkBar from "../translationPanel/BookmarkBar";
import { useSessionStore } from "../../stores/sessionStore";
import { useTranslationOperations } from "../../hooks/useTranslationOperations";
import { useNotificationStore } from "../../stores/notificationStore";
import { presentError } from "../../../application/errors/errorPresenter";
import { errorHandlingService } from "../../../infrastructure/services/ErrorHandlingService";

const BookmarkContainer: React.FC = () => {
  const { id: routeId } = useParams();
  const enqueueNotification = useNotificationStore((state) => state.enqueue);
  
  const session = useSessionStore((state) => state.session);
  const sessionTranslations = useSessionStore((state) => state.session?.translations ?? []);
  
  const activeTab = useSessionStore((state) => state.activeTab);
  const setActiveTab = useSessionStore((state) => state.setActiveTab);
  const viewMode = useSessionStore((state) => state.viewMode);
  const activeSegmentId = useSessionStore((state) => state.activeSegmentId);
  const setDraftText = useSessionStore((state) => state.setDraftText);
  
  const currentId = routeId ?? session?.id ?? null;

  
  const translationLanguages = useMemo(() => {
    const totalSegments = session?.segments?.length || 0;

    if (viewMode === "segments" && activeSegmentId) {  
      return sessionTranslations
        .filter((t) => {
          const segText = t.segmentTranslations?.[activeSegmentId];
          return segText !== undefined && segText.trim() !== "";
        })
        .map((t) => t.language);
    }
    
    return sessionTranslations
      .filter((t) => {
        if (totalSegments === 0) return false;
        const translatedCount = Object.keys(t.segmentTranslations || {}).length;
        return translatedCount === totalSegments;
      })
      .map((t) => t.language);
  }, [sessionTranslations, viewMode, activeSegmentId, session?.segments?.length]);

  useEffect(() => {
    if (activeTab !== "original" && !translationLanguages.includes(activeTab)) {
      setActiveTab("original");
      
      if (viewMode === "document") {
         setDraftText(session?.text || "");
      } else {
         const originalSeg = session?.segments?.find(s => s.id === activeSegmentId);
         setDraftText(originalSeg?.text || "");
      }
    }
  }, [activeTab, translationLanguages, setActiveTab, setDraftText, session, viewMode, activeSegmentId]);

  const showNotice = useCallback((msg: string, opts?: { tone?: "success" | "error" | "info" | "default" | "warning"; persistent?: boolean }) => {
    enqueueNotification({ message: msg, tone: opts?.tone, persistent: opts?.persistent });
  }, [enqueueNotification]);

  const handleError = useCallback((err: unknown) => {
    const appError = errorHandlingService.isAppError(err) ? err : errorHandlingService.handleApiError(err);
    const notice = presentError(appError);
    showNotice(notice.message, { tone: notice.tone, persistent: notice.persistent });
  }, [showNotice]);

  const translationOps = useTranslationOperations(currentId, session, showNotice, handleError);

  const handleTabClick = useCallback((tab: string) => {
    translationOps.handleTabSwitch(tab, setDraftText);
  }, [translationOps, setDraftText]);

  const handleSelectLanguage = useCallback((lang: string) => {
    const isSegmentTranslation = viewMode === "segments" && activeSegmentId;
    const msg = isSegmentTranslation 
      ? `Translating segment to ${lang}...` 
      : `Translating document to ${lang}...`;
      
    showNotice(msg, { tone: "info" });
    translationOps.handleAddTranslation(lang, setDraftText, activeSegmentId);
  }, [translationOps, setDraftText, showNotice, viewMode, activeSegmentId]);

  const handleDeleteTranslation = useCallback((lang: string) => {
    translationOps.handleDeleteTranslation(lang, setDraftText);
  }, [translationOps, setDraftText]);

  const handleUpdateTranslation = useCallback((lang: string) => {
    translationOps.handleUpdateTranslation(lang, setDraftText, activeSegmentId);
  }, [translationOps, setDraftText, activeSegmentId]);

  return (
    <BookmarkBar
      translationLanguages={translationLanguages}
      activeTab={activeTab}
      onTabClick={handleTabClick}
      onAddClick={(e) => translationOps.setTranslationMenuAnchor(e.currentTarget)}
      anchorEl={translationOps.translationMenuAnchor}
      onClose={() => translationOps.setTranslationMenuAnchor(null)}
      onSelectLanguage={handleSelectLanguage}
      onDeleteTranslation={handleDeleteTranslation}
      onUpdateTranslation={handleUpdateTranslation}
      isUpdating={translationOps.isUpdatingTranslation}
      isDisabled={translationOps.isUpdatingTranslation} 
      languageOptions={translationOps.languageOptions}
      isLanguageListLoading={translationOps.isLanguageListLoading}
    />
  );
};

export default BookmarkContainer;