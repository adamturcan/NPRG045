import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddTagUseCase } from '@/core/usecases/tag/AddTagUseCase';
import type { TagRepository } from '@/core/interfaces/repositories/TagRepository';
import type { TagItem } from '@/types/Tag';
import { errorHandlingService } from '@/infrastructure/services/ErrorHandlingService';

describe('AddTagUseCase', () => {
  let useCase: AddTagUseCase;
  let repository: TagRepository;

  beforeEach(() => {
    repository = {
      getTags: vi.fn(),
      getUserTags: vi.fn(),
      getApiTags: vi.fn(),
      addTag: vi.fn(),
      removeTag: vi.fn(),
      setApiTags: vi.fn(),
      clearTags: vi.fn(),
      hasTag: vi.fn(),
    };

    useCase = new AddTagUseCase(repository);
  });

  it('adds a new tag when no duplicate exists', async () => {
    const tag: TagItem = { name: 'culture', source: 'user' };
    vi.mocked(repository.hasTag).mockResolvedValue(false);

    await useCase.execute({ workspaceId: 'ws-1', tag });

    expect(repository.hasTag).toHaveBeenCalledWith('ws-1', 'culture');
    expect(repository.addTag).toHaveBeenCalledWith('ws-1', tag);
  });

  it('throws AppError when workspaceId missing', async () => {
    const tag: TagItem = { name: 'culture', source: 'user' };

    await expect(
      useCase.execute({ workspaceId: '', tag })
    ).rejects.toMatchObject({ code: 'WORKSPACE_ID_REQUIRED' });
  });

  it('throws AppError when tag payload missing', async () => {
    await expect(
      useCase.execute({
        workspaceId: 'ws-1',
        tag: undefined as unknown as TagItem,
      })
    ).rejects.toMatchObject({ code: 'TAG_REQUIRED' });
  });

  it('wraps tag validation failures as AppError', async () => {
    const tag: TagItem = { name: '', source: 'user' };

    try {
      await useCase.execute({ workspaceId: 'ws-1', tag });
    } catch (error) {
      expect(errorHandlingService.isAppError(error)).toBe(true);
      expect(error).toMatchObject({
        code: 'TAG_VALIDATION_FAILED',
      });
    }
  });

  it('throws AppError on duplicate tag', async () => {
    const tag: TagItem = { name: 'culture', source: 'user' };
    vi.mocked(repository.hasTag).mockResolvedValue(true);

    await expect(
      useCase.execute({ workspaceId: 'ws-1', tag })
    ).rejects.toMatchObject({ code: 'TAG_ALREADY_EXISTS' });
  });

  it('propagates repository errors', async () => {
    const tag: TagItem = { name: 'culture', source: 'user' };
    vi.mocked(repository.hasTag).mockResolvedValue(false);
    vi.mocked(repository.addTag).mockRejectedValue(new Error('storage down'));

    await expect(
      useCase.execute({ workspaceId: 'ws-1', tag })
    ).rejects.toThrow('storage down');
  });
});



