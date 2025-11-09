import type { Workspace } from "../types/Workspace";
import type { Workspace as DomainWorkspace } from "../domain/Workspace";
import { getWorkspaceRepository } from "../infrastructure/providers/repositories";

export class WorkspaceService {
  static seedForUser(owner: string): Workspace[] {
    return [
      {
        id: crypto.randomUUID(),
        name: "Workspace A",
        isTemporary: false,
        text: "",
        userSpans: [],
        updatedAt: Date.now(),
        owner,
      },
      {
        id: crypto.randomUUID(),
        name: "Workspace B",
        isTemporary: false,
        text: "",
        userSpans: [],
        updatedAt: Date.now(),
        owner,
      },
      {
        id: crypto.randomUUID(),
        name: "Workspace C",
        isTemporary: false,
        text: "",
        userSpans: [],
        updatedAt: Date.now(),
        owner,
      },
    ];
  }

  static async loadForUser(username: string): Promise<Workspace[] | null> {
    const repository = getWorkspaceRepository();
    const results = await repository.findByOwner(username);

    if (!results.length) {
      return null;
    }

    return results.map((workspace) => ({
      ...workspace,
      owner: workspace.owner ?? username,
    }));
  }

  static async saveForUser(username: string, workspaces: Workspace[]): Promise<void> {
    const repository = getWorkspaceRepository();
    const existing = await repository.findByOwner(username);
    const incomingIds = new Set(workspaces.map((ws) => ws.id));

    await Promise.all(
      existing
        .filter((workspace) => !incomingIds.has(workspace.id))
        .map((workspace) => repository.delete(workspace.id))
    );

    for (const workspace of workspaces) {
      await repository.save(this.toDomainWorkspace(workspace, username));
    }
  }

  static createWorkspace(owner: string, name: string): Workspace {
    return {
      id: crypto.randomUUID(),
      name,
      isTemporary: true,
      text: "",
      userSpans: [],
      tags: [], // Initialize empty tags array for new workspaces
      updatedAt: Date.now(),
      owner,
    };
  }

  static updateWorkspace(
    id: string,
    updates: Partial<Workspace>,
    workspaces: Workspace[]
  ): Workspace[] {
    return workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w));
  }

  static deleteWorkspace(id: string, workspaces: Workspace[]): Workspace[] {
    return workspaces.filter((w) => w.id !== id);
  }

  private static toDomainWorkspace(workspace: Workspace, owner: string): DomainWorkspace {
    return {
      id: workspace.id,
      name: workspace.name,
      owner: workspace.owner ?? owner,
      text: workspace.text ?? "",
      isTemporary: Boolean(workspace.isTemporary),
      updatedAt: workspace.updatedAt ?? Date.now(),
      userSpans: workspace.userSpans ?? [],
      apiSpans: workspace.apiSpans ?? [],
      deletedApiKeys: workspace.deletedApiKeys ?? [],
      tags: workspace.tags ?? [],
      translations: workspace.translations ?? [],
    } as unknown as DomainWorkspace;
  }
}
