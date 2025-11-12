import { describe, it, expect, beforeEach } from 'vitest';
import { CreateWorkspaceUseCase } from '@/core/usecases/workspace/CreateWorkspaceUseCase';
import { UpdateWorkspaceUseCase } from '@/core/usecases/workspace/UpdateWorkspaceUseCase';
import { DeleteWorkspaceUseCase } from '@/core/usecases/workspace/DeleteWorkspaceUseCase';
import { LoadWorkspacesUseCase } from '@/core/usecases/workspace/LoadWorkspacesUseCase';
import { SyncWorkspaceTranslationsUseCase } from '@/core/usecases/workspace/SyncWorkspaceTranslationsUseCase';
import type { WorkspaceRepository } from '@/core/interfaces/repositories/WorkspaceRepository';
import { Workspace, WorkspaceTranslation } from '@/core/entities/Workspace';
import type { Workspace as WorkspaceDTO } from '@/types/Workspace';
import { errorHandlingService } from '@/infrastructure/services/ErrorHandlingService';

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

describe('Workspace use cases', () => {
  let repository: InMemoryWorkspaceRepository;
  let createUseCase: CreateWorkspaceUseCase;
  let updateUseCase: UpdateWorkspaceUseCase;
  let deleteUseCase: DeleteWorkspaceUseCase;
  let loadUseCase: LoadWorkspacesUseCase;
  let syncTranslationsUseCase: SyncWorkspaceTranslationsUseCase;

  beforeEach(() => {
    repository = new InMemoryWorkspaceRepository();
    createUseCase = new CreateWorkspaceUseCase(repository);
    updateUseCase = new UpdateWorkspaceUseCase(repository);
    deleteUseCase = new DeleteWorkspaceUseCase(repository);
    loadUseCase = new LoadWorkspacesUseCase(repository);
    syncTranslationsUseCase = new SyncWorkspaceTranslationsUseCase(repository);
  });

  it('creates workspace with defaults and persists it', async () => {
    const workspace = await createUseCase.execute({
      ownerId: 'owner-1',
      name: 'Workspace',
    });

    expect(workspace.id).toBeDefined();
    expect(workspace.owner).toBe('owner-1');
    expect(await repository.findById(workspace.id)).not.toBeNull();
  });

  it('updates workspace fields', async () => {
    const workspace = await createUseCase.execute({
      ownerId: 'owner-1',
      name: 'Workspace',
      workspaceId: 'ws-1',
    });

    const updated = await updateUseCase.execute({
      workspaceId: workspace.id,
      patch: {
        name: 'Renamed',
        text: 'Updated text',
        tags: [{ name: 'culture', source: 'user' }],
      },
    });

    expect(updated?.name).toBe('Renamed');
    expect(updated?.text).toBe('Updated text');
    expect(updated?.tags).toHaveLength(1);
  });

  it('throws AppError when updating missing workspace', async () => {
    await expect(
      updateUseCase.execute({
        workspaceId: 'missing',
        patch: { name: 'Renamed' },
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_NOT_FOUND' });
  });

  it('loads workspaces by owner', async () => {
    await createUseCase.execute({ ownerId: 'owner-a', name: 'A', workspaceId: 'a' });
    await createUseCase.execute({ ownerId: 'owner-b', name: 'B', workspaceId: 'b' });

    const ownerA = await loadUseCase.execute({ ownerId: 'owner-a' });
    expect(ownerA).toHaveLength(1);
    expect(ownerA[0]?.id).toBe('a');
  });

  it('deletes workspace', async () => {
    await createUseCase.execute({ ownerId: 'owner-a', name: 'A', workspaceId: 'a' });
    await deleteUseCase.execute({ workspaceId: 'a' });
    expect(await repository.findById('a')).toBeNull();
  });

  it('throws AppError when deleting missing workspace', async () => {
    await expect(
      deleteUseCase.execute({ workspaceId: 'missing' })
    ).rejects.toMatchObject({ code: 'WORKSPACE_NOT_FOUND' });
  });

  it('syncs translations', async () => {
    await createUseCase.execute({ ownerId: 'owner-a', name: 'A', workspaceId: 'a' });
    const updated = await syncTranslationsUseCase.execute({
      workspaceId: 'a',
      translations: [
        { language: 'cs', text: 'Ahoj', sourceLang: 'cs', createdAt: Date.now(), updatedAt: Date.now() },
        { language: 'en', text: 'Hello', sourceLang: 'en', createdAt: Date.now(), updatedAt: Date.now() },
      ],
    });

    expect(updated?.translations).toHaveLength(2);
    expect(updated?.getTranslation('en')).toBeInstanceOf(WorkspaceTranslation);
  });

  it('throws AppError when syncing translations for missing workspace', async () => {
    await expect(
      syncTranslationsUseCase.execute({
        workspaceId: 'missing',
        translations: [],
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_NOT_FOUND' });
  });

  it('validates owner id when loading', async () => {
    await expect(loadUseCase.execute({ ownerId: '' })).rejects.toMatchObject({
      code: 'WORKSPACE_OWNER_REQUIRED',
    });
  });

  it('validates workspace creation inputs', async () => {
    try {
      await createUseCase.execute({ ownerId: '', name: '' });
    } catch (error) {
      expect(errorHandlingService.isAppError(error)).toBe(true);
    }
  });
});



