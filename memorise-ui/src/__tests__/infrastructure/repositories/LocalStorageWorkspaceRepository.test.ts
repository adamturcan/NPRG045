import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageWorkspaceRepository } from '@/infrastructure/repositories/LocalStorageWorkspaceRepository';
import { Workspace, type WorkspaceInput } from '@/core/entities/Workspace';

const baseWorkspace = (overrides: Partial<WorkspaceInput> = {}): Workspace =>
  Workspace.create({
    id: "ws-1",
    name: "Workspace 1",
    owner: "user-1",
    text: "Hello",
    isTemporary: false,
    updatedAt: Date.now(),
    userSpans: [],
    apiSpans: [],
    deletedApiKeys: [],
    tags: [],
    translations: [],
    ...overrides,
  });

describe("LocalStorageWorkspaceRepository", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves and retrieves workspaces by owner", async () => {
    const repository = new LocalStorageWorkspaceRepository();
    await repository.save(baseWorkspace());
    await repository.save(
      baseWorkspace({
        id: "ws-2",
        name: "Workspace 2",
      })
    );
    await repository.save(
      baseWorkspace({
        id: "ws-3",
        owner: "user-2",
        name: "Other User Workspace",
      })
    );

    const userOne = await repository.findByOwner("user-1");
    expect(userOne).toHaveLength(2);
    expect(userOne.map((ws) => ws.id)).toEqual(expect.arrayContaining(["ws-1", "ws-2"]));

    const userTwo = await repository.findByOwner("user-2");
    expect(userTwo).toHaveLength(1);
    expect(userTwo[0].id).toBe("ws-3");
  });

  it("updates existing workspace", async () => {
    const repository = new LocalStorageWorkspaceRepository();
    await repository.save(baseWorkspace());

    await repository.save(
      baseWorkspace({
        name: "Updated Workspace",
        text: "Updated text",
      })
    );

    const result = await repository.findById("ws-1");
    expect(result?.name).toBe("Updated Workspace");
    expect(result?.text).toBe("Updated text");
  });

  it("deletes workspace", async () => {
    const repository = new LocalStorageWorkspaceRepository();
    await repository.save(baseWorkspace());
    await repository.save(
      baseWorkspace({
        id: "ws-2",
        name: "Workspace 2",
      })
    );

    await repository.delete("ws-1");
    const all = await repository.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("ws-2");
  });

  it("migrates legacy data", async () => {
    const legacyKey = "memorise.workspaces.v1:user-legacy";
    window.localStorage.setItem(
      legacyKey,
      JSON.stringify([
        {
          id: "legacy-1",
          name: "Legacy Workspace",
          text: "Legacy Text",
        },
      ])
    );

    const repository = new LocalStorageWorkspaceRepository();
    const migrated = await repository.findByOwner("user-legacy");

    expect(migrated).toHaveLength(1);
    expect(migrated[0].id).toBe("legacy-1");
    expect(migrated[0].owner).toBe("user-legacy");
    expect(window.localStorage.getItem(legacyKey)).toBeNull();
  });
});


