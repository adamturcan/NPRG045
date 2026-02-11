import { getWorkspaceApplicationService } from "../../infrastructure/providers/workspaceProvider";
import { useNotificationStore } from "../stores/notificationStore";
import { useSessionStore } from "../stores/sessionStore";
import { type UpdateWorkspacePatch } from "../../core/usecases/workspace/UpdateWorkspaceUseCase";

// src/presentation/hooks/useWorkspaceActions.ts
export const useWorkspaceActions = () => {
    const store = useSessionStore();
    const enqueueNotification = useNotificationStore((state) => state.enqueue);
    const workspaceService = getWorkspaceApplicationService();
  
    const save = async () => {
      const { workingSet, setDirty } = store;
      if (!workingSet.workspaceId) return;

      const patch: UpdateWorkspacePatch = {
        text: workingSet.text,
        userSpans: workingSet.userSpans,
        apiSpans: workingSet.apiSpans,
        deletedApiKeys: workingSet.deletedApiKeys,
        tags: workingSet.tags,
        translations: workingSet.translations,
        updatedAt: Date.now(),
      };
  
      try {
        await workspaceService.updateWorkspace({ workspaceId: workingSet.workspaceId, patch });
        setDirty(false); 
        enqueueNotification({ message: 'Saved successfully', tone: 'success' });
      } catch (error) {
        console.log(error)
        enqueueNotification({ message: 'Save failed', tone: 'error' });
      }
    };
  
    return { save };
  };