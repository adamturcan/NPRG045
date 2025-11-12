import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageAnnotationRepository } from '@/infrastructure/repositories/LocalStorageAnnotationRepository';
import type { NerSpan } from '@/types/NotationEditor';

const span = (overrides: Partial<NerSpan> = {}): NerSpan => ({
  start: 0,
  end: 4,
  entity: "PERSON",
  score: 1,
  ...overrides,
});

describe("LocalStorageAnnotationRepository", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("adds and retrieves user spans", async () => {
    const repository = new LocalStorageAnnotationRepository();
    await repository.addUserSpan("ws-1", span());
    const spans = await repository.getUserSpans("ws-1");
    expect(spans).toHaveLength(1);
    expect(spans[0].entity).toBe("PERSON");
  });

  it("marks API spans as deleted", async () => {
    const repository = new LocalStorageAnnotationRepository();
    const apiSpans = [span({ start: 5, end: 10, entity: "ORG" })];
    await repository.setApiSpans("ws-1", apiSpans);

    await repository.markApiSpanDeleted("ws-1", "5:10:ORG");
    const active = await repository.getActiveAnnotations("ws-1");
    expect(active).toHaveLength(0);
    const deleted = await repository.getDeletedApiKeys("ws-1");
    expect(deleted).toContain("5:10:ORG");
  });

  it("clears API spans", async () => {
    const repository = new LocalStorageAnnotationRepository();
    await repository.setApiSpans("ws-1", [span()]);
    await repository.clearApiSpans("ws-1");
    const apiSpans = await repository.getApiSpans("ws-1");
    expect(apiSpans).toHaveLength(0);
  });
});


