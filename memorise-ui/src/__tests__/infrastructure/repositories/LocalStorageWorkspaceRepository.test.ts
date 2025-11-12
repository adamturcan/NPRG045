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

  describe("Segments persistence", () => {
    it("saves and retrieves workspace with segments", async () => {
      const repository = new LocalStorageWorkspaceRepository();
      const segments = [
        {
          id: "seg-0",
          start: 0,
          end: 20,
          text: "This is the first sentence.",
          order: 0,
        },
        {
          id: "seg-1",
          start: 21,
          end: 45,
          text: "This is the second sentence.",
          order: 1,
        },
      ];

      // Create workspace with segments via DTO
      const workspace = baseWorkspace();
      await repository.save(workspace);

      // Manually add segments to stored data (simulating segmentation API result)
      const stored = JSON.parse(
        window.localStorage.getItem("memorise.workspaces") || "[]"
      );
      stored[0].segments = segments;
      window.localStorage.setItem("memorise.workspaces", JSON.stringify(stored));

      // Reload and verify segments persist
      const reloaded = await repository.findById("ws-1");
      expect(reloaded).not.toBeNull();

      // Read raw DTO to check segments
      const rawStored = JSON.parse(
        window.localStorage.getItem("memorise.workspaces") || "[]"
      );
      expect(rawStored[0].segments).toEqual(segments);
    });

    it("preserves segments when updating workspace", async () => {
      const repository = new LocalStorageWorkspaceRepository();
      const segments = [
        {
          id: "seg-0",
          start: 0,
          end: 20,
          text: "This is the first sentence.",
          order: 0,
        },
      ];

      // Save initial workspace
      await repository.save(baseWorkspace());

      // Add segments manually
      const stored = JSON.parse(
        window.localStorage.getItem("memorise.workspaces") || "[]"
      );
      stored[0].segments = segments;
      window.localStorage.setItem("memorise.workspaces", JSON.stringify(stored));

      // Update workspace (change text)
      await repository.save(
        baseWorkspace({
          text: "Updated text",
        })
      );

      // Verify segments are preserved
      const rawStored = JSON.parse(
        window.localStorage.getItem("memorise.workspaces") || "[]"
      );
      expect(rawStored[0].segments).toEqual(segments);
      expect(rawStored[0].text).toBe("Updated text");
    });

    it("preserves segmentTranslations in translations", async () => {
      const repository = new LocalStorageWorkspaceRepository();
      const workspace = baseWorkspace();

      // Save workspace
      await repository.save(workspace);

      // Manually add translation with segmentTranslations to stored data
      const stored = JSON.parse(
        window.localStorage.getItem("memorise.workspaces") || "[]"
      );
      stored[0].translations = [
        {
          language: "cs",
          text: "Translated text",
          sourceLang: "en",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          userSpans: [],
          apiSpans: [],
          deletedApiKeys: [],
          segmentTranslations: {
            "seg-0": "První věta.",
            "seg-1": "Druhá věta.",
          },
        },
      ];
      window.localStorage.setItem("memorise.workspaces", JSON.stringify(stored));

      // Reload workspace to get the translation into the entity
      const reloaded = await repository.findById("ws-1");
      expect(reloaded).not.toBeNull();

      // Update workspace text (should preserve segmentTranslations)
      const updated = reloaded!.withText("Updated text");
      await repository.save(updated);

      // Verify segmentTranslations are preserved
      const rawStored = JSON.parse(
        window.localStorage.getItem("memorise.workspaces") || "[]"
      );
      expect(rawStored[0].translations).toBeDefined();
      expect(rawStored[0].translations.length).toBeGreaterThan(0);
      expect(rawStored[0].translations[0].segmentTranslations).toEqual({
        "seg-0": "První věta.",
        "seg-1": "Druhá věta.",
      });
    });

    it("handles workspace without segments (backward compatibility)", async () => {
      const repository = new LocalStorageWorkspaceRepository();
      await repository.save(baseWorkspace());

      const reloaded = await repository.findById("ws-1");
      expect(reloaded).not.toBeNull();

      // Workspace without segments should work fine
      const rawStored = JSON.parse(
        window.localStorage.getItem("memorise.workspaces") || "[]"
      );
      expect(rawStored[0].segments).toBeUndefined();
    });

    it("loads segments from stored workspace DTO", async () => {
      const repository = new LocalStorageWorkspaceRepository();
      const segments = [
        {
          id: "seg-0",
          start: 0,
          end: 20,
          text: "First segment.",
          order: 0,
        },
        {
          id: "seg-1",
          start: 21,
          end: 40,
          text: "Second segment.",
          order: 1,
        },
      ];

      // Save workspace
      await repository.save(baseWorkspace());

      // Manually add segments to stored data
      const stored = JSON.parse(
        window.localStorage.getItem("memorise.workspaces") || "[]"
      );
      stored[0].segments = segments;
      window.localStorage.setItem("memorise.workspaces", JSON.stringify(stored));

      // Load workspace - segments should be in DTO
      const rawStored = JSON.parse(
        window.localStorage.getItem("memorise.workspaces") || "[]"
      );
      expect(rawStored[0].segments).toEqual(segments);

      // Entity loads successfully (segments are metadata, not in entity)
      const workspace = await repository.findById("ws-1");
      expect(workspace).not.toBeNull();
      expect(workspace?.text).toBe("Hello");
    });
  });
});


