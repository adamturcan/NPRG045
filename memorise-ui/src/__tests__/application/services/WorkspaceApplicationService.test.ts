import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceApplicationService } from '@/application/services/WorkspaceApplicationService';
import type { WorkspaceRepository } from '@/core/interfaces/repositories/WorkspaceRepository';
import { Workspace } from '@/core/entities/Workspace';

class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private store = new Map<string, Workspace>();

  async findById(id: string) {
    return this.store.get(id) ?? null;
  }

  async findByOwner(ownerId: string) {
    return Array.from(this.store.values()).filter((ws) => ws.owner === ownerId);
  }

  async findAll() {
    return Array.from(this.store.values());
  }

  async save(workspace: Workspace) {
    this.store.set(workspace.id, workspace);
  }

  async delete(id: string) {
    this.store.delete(id);
  }

  async exists(id: string) {
    return this.store.has(id);
  }
}

describe('WorkspaceApplicationService', () => {
  let repository: InMemoryWorkspaceRepository;
  let service: WorkspaceApplicationService;

  beforeEach(() => {
    repository = new InMemoryWorkspaceRepository();
    service = new WorkspaceApplicationService({ workspaceRepository: repository });
  });

  it('creates and persists a workspace', async () => {
    const workspace = await service.createWorkspace({
      ownerId: 'owner-1',
      name: 'Workspace',
    });

    expect(workspace.id).toBeDefined();
    expect(await repository.findById(workspace.id)).not.toBeNull();
  });

  it('creates draft workspace without persistence', () => {
    const draft = service.createWorkspaceDraft('owner-1', 'Draft');
    expect(draft.id).toBeDefined();
    expect(repository.findById(draft.id)).resolves.toBeNull();
  });

  it('seeds default workspaces without persistence', () => {
    const seeds = service.seedForOwner('owner');
    expect(seeds).toHaveLength(3);
    seeds.forEach((seed) => {
      expect(repository.findById(seed.id)).resolves.toBeNull();
    });
  });

  it('loads workspaces for owner', async () => {
    const now = Date.now();
    await service.createWorkspace({
      ownerId: 'owner-1',
      name: 'A',
      workspaceId: 'a',
      updatedAt: now - 1000,
    });
    await service.createWorkspace({
      ownerId: 'owner-1',
      name: 'B',
      workspaceId: 'b',
      updatedAt: now,
    });
    await service.createWorkspace({ ownerId: 'owner-2', name: 'C', workspaceId: 'c' });

    const results = await service.loadForOwner('owner-1');
    expect(results).toHaveLength(2);
    expect(results[0]?.id).toBe('b');
    expect(results[1]?.id).toBe('a');
  });

  it('updates workspace through patch', async () => {
    await service.createWorkspace({ ownerId: 'owner-1', name: 'A', workspaceId: 'a' });
    const updated = await service.updateWorkspace({
      workspaceId: 'a',
      patch: { name: 'Updated', text: 'Content' },
    });

    expect(updated?.name).toBe('Updated');
    expect(updated?.text).toBe('Content');
  });

  it('replaces all workspaces for owner', async () => {
    await service.createWorkspace({ ownerId: 'owner-1', name: 'Original', workspaceId: 'old' });

    await service.replaceAllForOwner('owner-1', [
      {
        id: 'new',
        name: 'New Workspace',
        owner: 'owner-1',
        isTemporary: false,
        text: 'Text',
        userSpans: [],
        apiSpans: [],
        deletedApiKeys: [],
        tags: [],
        translations: [],
        updatedAt: Date.now(),
      },
    ]);

    expect(await repository.findById('old')).toBeNull();
    expect(await repository.findById('new')).not.toBeNull();
  });

  it('syncs translations', async () => {
    await service.createWorkspace({ ownerId: 'owner-1', name: 'A', workspaceId: 'a' });

    const updated = await service.syncWorkspaceTranslations({
      workspaceId: 'a',
      translations: [
        {
          language: 'en',
          text: 'Hello',
          sourceLang: 'en',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    });

    expect(updated?.translations).toHaveLength(1);
  });
});


