import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import BookmarkBar from "../workspace/BookmarkBar";
import { useSessionStore } from "../../stores/sessionStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useTranslationOperations } from "../../hooks/useTranslationOperations";
import { useNotificationStore } from "../../stores/notificationStore";
import { presentError } from "../../../application/errors/errorPresenter";
import { errorHandlingService } from "../../../infrastructure/services/ErrorHandlingService";

/**
 * BookmarkContainer - Autonomous container handling translation operations
 * Zero props - all state managed via Zustand stores
 */
const BookmarkContainer: React.FC = () => {
  const { id: routeId } = useParams();
  
  // Zustand stores
  const enqueueNotification = useNotificationStore((state) => state.enqueue);
  
  // Session store
  const session = useSessionStore((state) => state.session);
  const sessionTranslations = useSessionStore((state) => state.session?.translations ?? []);
  const activeTab = useSessionStore((state) => state.activeTab);
  const setDraftText = useSessionStore((state) => state.setDraftText);
  
  // Determine current workspace ID
  const currentId = routeId ?? session?.id ?? null;

  // Read translation languages from session
  const translationLanguages = sessionTranslations.map(t => t.language);

  const showNotice = useCallback((msg: string, opts?: { tone?: "success" | "error" | "info" | "default" | "warning"; persistent?: boolean }) => {
    enqueueNotification({ message: msg, tone: opts?.tone, persistent: opts?.persistent });
  }, [enqueueNotification]);

  const handleError = useCallback((err: unknown) => {
    const appError = errorHandlingService.isAppError(err) ? err : errorHandlingService.handleApiError(err);
    const notice = presentError(appError);
    showNotice(notice.message, { tone: notice.tone, persistent: notice.persistent });
  }, [showNotice]);

  const translationOps = useTranslationOperations(currentId, session, showNotice, handleError);

  return (
    <BookmarkBar
      translationLanguages={translationLanguages}
      activeTab={activeTab}
      onTabClick={(tab) => translationOps.handleTabSwitch(tab, setDraftText, () => {})}
      onAddClick={(e) => translationOps.setTranslationMenuAnchor(e.currentTarget)}
      anchorEl={translationOps.translationMenuAnchor}
      onClose={() => translationOps.setTranslationMenuAnchor(null)}
      onSelectLanguage={(lang) => translationOps.handleAddTranslation(lang, setDraftText, () => {})}
      onDeleteTranslation={(lang) => translationOps.handleDeleteTranslation(lang, setDraftText, () => {})}
      onUpdateTranslation={(lang) => translationOps.handleUpdateTranslation(lang, setDraftText, () => {})}
      isUpdating={translationOps.isUpdatingTranslation}
      languageOptions={translationOps.languageOptions}
      isLanguageListLoading={translationOps.isLanguageListLoading}
    />
  );
};

export default BookmarkContainer;
