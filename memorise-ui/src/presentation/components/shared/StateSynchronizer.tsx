import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSessionStore } from '../../stores/sessionStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { getWorkspaceApplicationService } from '../../../infrastructure/providers/workspaceProvider';
// import { useWorkspaceActions } from '../../hooks/useWorkspacerActions';

interface StateSynchronizerProps {
  username: string | null;
  children?: React.ReactNode;
}

/**
 * StateSynchronizer Component
 * 
 * Manages the application lifecycle by orchestrating:
 * 1. Metadata hydration (workspaceStore) when username changes
 * 2. Active session hydration (sessionStore) when workspace route changes
 * 3. Tab-close guard to prevent data loss when isDirty
 * 4. (Optional) Auto-save functionality (commented out per strategy)
 */
export const StateSynchronizer: React.FC<StateSynchronizerProps> = ({ username, children }) => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const isDirty = useSessionStore((state) => state.isDirty);
  const loadWorkspaces = useWorkspaceStore((state) => state.loadWorkspaces);
  const loadWorkingSet = useSessionStore((state) => state.loadWorkingSet);
  const resetSession = useSessionStore((state) => state.resetSession);
  const enqueueNotification = useNotificationStore((state) => state.enqueue);

  // HYDRATION (Metadata): Load workspace list when username changes
  useEffect(() => {
    if (!username) {
      console.log('[StateSynchronizer] No username, skipping workspace metadata load');
      return;
    }

    const hydrateMetadata = async () => {
      try {
        console.log(`[StateSynchronizer] Loading workspace metadata for user: ${username}`);
        await loadWorkspaces(username);
      } catch (error) {
        console.error('[StateSynchronizer] Failed to load workspace metadata:', error);
        enqueueNotification({
          message: 'Failed to load workspaces',
          tone: 'error',
        });
      }
    };

    void hydrateMetadata();
  }, [username, loadWorkspaces, enqueueNotification]);

  // HYDRATION (Active Session): Load full workspace aggregate when workspaceId changes
  useEffect(() => {
    if (!workspaceId) {
      console.log('[StateSynchronizer] No workspaceId in route, skipping session hydration');
      return;
    }

    const hydrateActiveSession = async () => {
      resetSession();

      try {
        console.log(`[StateSynchronizer] Loading active workspace: ${workspaceId}`);
        const service = getWorkspaceApplicationService();
        const workspace = await service.getWorkspaceById(workspaceId);

        if (!workspace) {
          throw new Error(`Workspace ${workspaceId} not found`);
        }
      
        // Load the full workspace data into the active session
        loadWorkingSet(workspaceId, {
          text: workspace.text,
          userSpans: workspace.userSpans,
          apiSpans: workspace.apiSpans,
          deletedApiKeys: workspace.deletedApiKeys,
          tags: workspace.tags,
          translations: workspace.translations,
        });

        console.log(`[StateSynchronizer] Successfully hydrated session for workspace: ${workspace.name}`);
      } catch (error) {
        console.error('[StateSynchronizer] Failed to load workspace session:', error);
        enqueueNotification({
          message: 'Failed to load workspace',
          tone: 'error',
        });
      }
    };

    void hydrateActiveSession();
  }, [workspaceId, loadWorkingSet, enqueueNotification, resetSession]);

  // TAB-CLOSE GUARD: Prevent navigation/close when unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  
  // const { save } = useWorkspaceActions();
  // const autoSaveEnabled = false;
  //
  // const debouncedSave = useMemo(
  //   () => debounceAsync(save, 1000),
  //   [save]
  // );
  //
  // useEffect(() => {
  //   if (isDirty && workspaceId && autoSaveEnabled) {
  //     void debouncedSave();
  //   }
  // }, [isDirty, workspaceId, autoSaveEnabled, debouncedSave]);

  return <>{children}</>;
};