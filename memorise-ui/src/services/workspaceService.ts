import type { Workspace as WorkspaceDTO } from "../types/Workspace";
import {
  getWorkspaceApplicationService,
  resetWorkspaceProvider,
  setWorkspaceProviderOverrides,
} from "../infrastructure/providers/repositories";

/**
 * @deprecated Prefer using the workspace provider (`getWorkspaceApplicationService`)
 * directly. This class remains a thin shim while the presentation layer migrates.
 */
export class WorkspaceService {
  static seedForUser(owner: string): WorkspaceDTO[] {
    return getWorkspaceApplicationService().seedForOwner(owner);
  }

  static async loadForUser(username: string): Promise<WorkspaceDTO[] | null> {
    const results = await getWorkspaceApplicationService().loadForOwner(username);
    return results.length ? results : null;
  }

  static async saveForUser(username: string, workspaces: WorkspaceDTO[]): Promise<void> {
    await getWorkspaceApplicationService().replaceAllForOwner(username, workspaces);
  }

  static createWorkspace(owner: string, name: string): WorkspaceDTO {
    return getWorkspaceApplicationService().createWorkspaceDraft(owner, name);
  }

  static updateWorkspace(
    id: string,
    updates: Partial<WorkspaceDTO>,
    workspaces: WorkspaceDTO[]
  ): WorkspaceDTO[] {
    return workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w));
  }

  static deleteWorkspace(id: string, workspaces: WorkspaceDTO[]): WorkspaceDTO[] {
    return workspaces.filter((w) => w.id !== id);
  }

  /**
   * Legacy test helpers for overriding provider dependencies.
   */
  static __unsafe_setOverrides = setWorkspaceProviderOverrides;

  static __unsafe_reset = resetWorkspaceProvider;
}
