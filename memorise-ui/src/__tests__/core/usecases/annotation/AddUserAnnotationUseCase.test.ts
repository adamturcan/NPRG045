import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddUserAnnotationUseCase } from '@/core/usecases/annotation/AddUserAnnotationUseCase';
import type { AnnotationRepository } from '@/core/interfaces/repositories/AnnotationRepository';
import type { NerSpan } from '@/types/NotationEditor';
import { errorHandlingService } from '@/infrastructure/services/ErrorHandlingService';

describe('AddUserAnnotationUseCase', () => {
  let useCase: AddUserAnnotationUseCase;
  let repository: AnnotationRepository;

  beforeEach(() => {
    repository = {
      getUserSpans: vi.fn(),
      getApiSpans: vi.fn(),
      getDeletedApiKeys: vi.fn(),
      getActiveAnnotations: vi.fn(),
      addUserSpan: vi.fn(),
      removeUserSpan: vi.fn(),
      setApiSpans: vi.fn(),
      markApiSpanDeleted: vi.fn(),
      clearApiSpans: vi.fn(),
    };

    useCase = new AddUserAnnotationUseCase(repository);
  });

  it('adds a valid user annotation', async () => {
    const span: NerSpan = { start: 0, end: 4, entity: 'PERSON' };

    await useCase.execute({ workspaceId: 'ws-1', span });

    expect(repository.addUserSpan).toHaveBeenCalledWith('ws-1', span);
  });

  it('throws AppError when workspaceId missing', async () => {
    const span: NerSpan = { start: 0, end: 4, entity: 'PERSON' };

    await expect(
      useCase.execute({ workspaceId: '', span })
    ).rejects.toMatchObject({ code: 'WORKSPACE_ID_REQUIRED' });

    expect(repository.addUserSpan).not.toHaveBeenCalled();
  });

  it('throws AppError for invalid span coordinates', async () => {
    const span: NerSpan = { start: -1, end: 4, entity: 'PERSON' };

    await expect(
      useCase.execute({ workspaceId: 'ws-1', span })
    ).rejects.toMatchObject({ code: 'ANNOTATION_SPAN_INVALID' });
  });

  it('throws AppError when span is missing', async () => {
    await expect(
      useCase.execute({ workspaceId: 'ws-1', span: undefined as unknown as NerSpan })
    ).rejects.toMatchObject({ code: 'ANNOTATION_SPAN_REQUIRED' });
  });

  it('wraps domain validation failures as AppError', async () => {
    const span: NerSpan = { start: 0, end: 4, entity: '' };

    try {
      await useCase.execute({ workspaceId: 'ws-1', span });
    } catch (error) {
      expect(errorHandlingService.isAppError(error)).toBe(true);
      expect(error).toMatchObject({
        code: 'ANNOTATION_VALIDATION_FAILED',
        context: expect.objectContaining({
          workspaceId: 'ws-1',
        }),
      });
    }
  });

  it('propagates repository errors', async () => {
    const span: NerSpan = { start: 0, end: 4, entity: 'PERSON' };
    vi.mocked(repository.addUserSpan).mockRejectedValue(new Error('db failed'));

    await expect(
      useCase.execute({ workspaceId: 'ws-1', span })
    ).rejects.toThrow('db failed');
  });
});

