import type { Workspace as WorkspaceDTO } from "../types/Workspace";
import { getWorkspaceRepository } from "../infrastructure/providers/repositories";
import { WorkspaceApplicationService } from "../application/services/WorkspaceApplicationService";

export class WorkspaceService {
  private static applicationService: WorkspaceApplicationService | null = null;

  private static getService(): WorkspaceApplicationService {
    if (!WorkspaceService.applicationService) {
      WorkspaceService.applicationService = new WorkspaceApplicationService({
        workspaceRepository: getWorkspaceRepository(),
      });
    }
    return WorkspaceService.applicationService;
  }

  static seedForUser(owner: string): WorkspaceDTO[] {
    return WorkspaceService.getService().seedForOwner(owner);
  }

  static async loadForUser(username: string): Promise<WorkspaceDTO[] | null> {
    const results = await WorkspaceService.getService().loadForOwner(username);
    return results.length ? results : null;
  }

  static async saveForUser(username: string, workspaces: WorkspaceDTO[]): Promise<void> {
    await WorkspaceService.getService().replaceAllForOwner(username, workspaces);
  }

  static createWorkspace(owner: string, name: string): WorkspaceDTO {
    return WorkspaceService.getService().createWorkspaceDraft(owner, name);
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
}
