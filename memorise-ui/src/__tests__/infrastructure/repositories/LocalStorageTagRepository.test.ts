import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageTagRepository } from '@/infrastructure/repositories/LocalStorageTagRepository';
import type { TagItem } from '@/types/Tag';

const tag = (overrides: Partial<TagItem> = {}): TagItem => ({
  name: "culture",
  source: "user",
  ...overrides,
});

describe("LocalStorageTagRepository", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("adds tags by source", async () => {
    const repository = new LocalStorageTagRepository();
    await repository.addTag("ws-1", tag({ source: "user" }));
    await repository.addTag("ws-1", tag({ name: "api-tag", source: "api" }));

    const all = await repository.getTags("ws-1");
    expect(all).toHaveLength(2);
    const userTags = await repository.getUserTags("ws-1");
    expect(userTags).toHaveLength(1);
    const apiTags = await repository.getApiTags("ws-1");
    expect(apiTags).toHaveLength(1);
  });

  it("removes tags by name across sources", async () => {
    const repository = new LocalStorageTagRepository();
    await repository.addTag("ws-1", tag());
    await repository.addTag("ws-1", tag({ name: "culture", source: "api" }));

    await repository.removeTag("ws-1", "culture");
    const all = await repository.getTags("ws-1");
    expect(all).toHaveLength(0);
  });

  it("sets API tags and clears previous ones", async () => {
    const repository = new LocalStorageTagRepository();
    await repository.addTag("ws-1", tag({ name: "old", source: "api" }));

    await repository.setApiTags("ws-1", [
      tag({ name: "new", source: "api" }),
      tag({ name: "new", source: "api" }), // duplicate to ensure dedupe
    ]);

    const apiTags = await repository.getApiTags("ws-1");
    expect(apiTags).toHaveLength(1);
    expect(apiTags[0].name).toBe("new");
  });
});


