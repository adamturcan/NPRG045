import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetAnnotationsUseCase } from '../GetAnnotationsUseCase';
import type { AnnotationRepository } from '../../../interfaces/repositories/AnnotationRepository';
import type { NerSpan } from '../../../../types/NotationEditor';

describe('GetAnnotationsUseCase', () => {
  let useCase: GetAnnotationsUseCase;
  let mockRepository: AnnotationRepository;

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      getUserSpans: vi.fn(),
      getApiSpans: vi.fn(),
      getDeletedApiKeys: vi.fn(),
      getActiveAnnotations: vi.fn(),
      addUserSpan: vi.fn(),
      addApiSpans: vi.fn(),
      markApiSpanDeleted: vi.fn(),
      clearApiSpans: vi.fn(),
    };

    useCase = new GetAnnotationsUseCase(mockRepository);
  });

  describe('Success cases', () => {
    it('should retrieve all annotations for a workspace', async () => {
      const userSpans: NerSpan[] = [
        { start: 0, end: 5, entity: 'PERSON' },
      ];
      const apiSpans: NerSpan[] = [
        { start: 10, end: 15, entity: 'LOCATION', score: 0.9 },
      ];
      const activeSpans: NerSpan[] = [
        { start: 0, end: 5, entity: 'PERSON' },
        { start: 10, end: 15, entity: 'LOCATION', score: 0.9 },
      ];
      const deletedApiKeys: string[] = ['deleted-key-1'];

      vi.mocked(mockRepository.getUserSpans).mockResolvedValue(userSpans);
      vi.mocked(mockRepository.getApiSpans).mockResolvedValue(apiSpans);
      vi.mocked(mockRepository.getDeletedApiKeys).mockResolvedValue(deletedApiKeys);
      vi.mocked(mockRepository.getActiveAnnotations).mockResolvedValue(activeSpans);

      const result = await useCase.execute({
        workspaceId: 'workspace-1',
      });

      expect(result).toEqual({
        userSpans,
        apiSpans,
        activeSpans,
        deletedApiKeys,
      });

      expect(mockRepository.getUserSpans).toHaveBeenCalledWith('workspace-1');
      expect(mockRepository.getApiSpans).toHaveBeenCalledWith('workspace-1');
      expect(mockRepository.getDeletedApiKeys).toHaveBeenCalledWith('workspace-1');
      expect(mockRepository.getActiveAnnotations).toHaveBeenCalledWith('workspace-1');
    });

    it('should handle empty workspace with no annotations', async () => {
      vi.mocked(mockRepository.getUserSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getApiSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getDeletedApiKeys).mockResolvedValue([]);
      vi.mocked(mockRepository.getActiveAnnotations).mockResolvedValue([]);

      const result = await useCase.execute({
        workspaceId: 'empty-workspace',
      });

      expect(result).toEqual({
        userSpans: [],
        apiSpans: [],
        activeSpans: [],
        deletedApiKeys: [],
      });
    });

    it('should retrieve multiple user spans', async () => {
      const userSpans: NerSpan[] = [
        { start: 0, end: 5, entity: 'PERSON' },
        { start: 10, end: 15, entity: 'ORG' },
        { start: 20, end: 25, entity: 'DATE' },
      ];

      vi.mocked(mockRepository.getUserSpans).mockResolvedValue(userSpans);
      vi.mocked(mockRepository.getApiSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getDeletedApiKeys).mockResolvedValue([]);
      vi.mocked(mockRepository.getActiveAnnotations).mockResolvedValue(userSpans);

      const result = await useCase.execute({
        workspaceId: 'workspace-1',
      });

      expect(result.userSpans).toHaveLength(3);
      expect(result.userSpans).toEqual(userSpans);
    });

    it('should retrieve multiple API spans', async () => {
      const apiSpans: NerSpan[] = [
        { start: 0, end: 5, entity: 'PERSON', score: 0.95 },
        { start: 10, end: 15, entity: 'LOCATION', score: 0.88 },
      ];

      vi.mocked(mockRepository.getUserSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getApiSpans).mockResolvedValue(apiSpans);
      vi.mocked(mockRepository.getDeletedApiKeys).mockResolvedValue([]);
      vi.mocked(mockRepository.getActiveAnnotations).mockResolvedValue(apiSpans);

      const result = await useCase.execute({
        workspaceId: 'workspace-1',
      });

      expect(result.apiSpans).toHaveLength(2);
      expect(result.apiSpans).toEqual(apiSpans);
    });

    it('should call all repository methods in parallel', async () => {
      vi.mocked(mockRepository.getUserSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getApiSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getDeletedApiKeys).mockResolvedValue([]);
      vi.mocked(mockRepository.getActiveAnnotations).mockResolvedValue([]);

      await useCase.execute({
        workspaceId: 'workspace-1',
      });

      // All methods should be called (Promise.all ensures parallelism)
      expect(mockRepository.getUserSpans).toHaveBeenCalled();
      expect(mockRepository.getApiSpans).toHaveBeenCalled();
      expect(mockRepository.getDeletedApiKeys).toHaveBeenCalled();
      expect(mockRepository.getActiveAnnotations).toHaveBeenCalled();
    });
  });

  describe('Validation errors', () => {
    it('should throw error if workspaceId is missing', async () => {
      await expect(
        useCase.execute({
          workspaceId: '',
        })
      ).rejects.toThrow('Workspace ID is required');

      expect(mockRepository.getUserSpans).not.toHaveBeenCalled();
      expect(mockRepository.getApiSpans).not.toHaveBeenCalled();
    });

    it('should throw error if workspaceId is null', async () => {
      await expect(
        useCase.execute({
          workspaceId: null as any,
        })
      ).rejects.toThrow('Workspace ID is required');
    });

    it('should throw error if workspaceId is undefined', async () => {
      await expect(
        useCase.execute({
          workspaceId: undefined as any,
        })
      ).rejects.toThrow('Workspace ID is required');
    });
  });

  describe('Repository failures', () => {
    it('should propagate errors from getUserSpans', async () => {
      vi.mocked(mockRepository.getUserSpans).mockRejectedValue(
        new Error('getUserSpans failed')
      );

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
        })
      ).rejects.toThrow('getUserSpans failed');
    });

    it('should propagate errors from getApiSpans', async () => {
      vi.mocked(mockRepository.getUserSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getApiSpans).mockRejectedValue(
        new Error('getApiSpans failed')
      );

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
        })
      ).rejects.toThrow('getApiSpans failed');
    });

    it('should propagate errors from getDeletedApiKeys', async () => {
      vi.mocked(mockRepository.getUserSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getApiSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getDeletedApiKeys).mockRejectedValue(
        new Error('getDeletedApiKeys failed')
      );

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
        })
      ).rejects.toThrow('getDeletedApiKeys failed');
    });

    it('should propagate errors from getActiveAnnotations', async () => {
      vi.mocked(mockRepository.getUserSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getApiSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getDeletedApiKeys).mockResolvedValue([]);
      vi.mocked(mockRepository.getActiveAnnotations).mockRejectedValue(
        new Error('getActiveAnnotations failed')
      );

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
        })
      ).rejects.toThrow('getActiveAnnotations failed');
    });
  });

  describe('Edge cases', () => {
    it('should handle workspace with only user spans', async () => {
      const userSpans: NerSpan[] = [
        { start: 0, end: 5, entity: 'PERSON' },
      ];

      vi.mocked(mockRepository.getUserSpans).mockResolvedValue(userSpans);
      vi.mocked(mockRepository.getApiSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getDeletedApiKeys).mockResolvedValue([]);
      vi.mocked(mockRepository.getActiveAnnotations).mockResolvedValue(userSpans);

      const result = await useCase.execute({
        workspaceId: 'workspace-1',
      });

      expect(result.userSpans).toEqual(userSpans);
      expect(result.apiSpans).toEqual([]);
    });

    it('should handle workspace with only API spans', async () => {
      const apiSpans: NerSpan[] = [
        { start: 0, end: 5, entity: 'PERSON', score: 0.9 },
      ];

      vi.mocked(mockRepository.getUserSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getApiSpans).mockResolvedValue(apiSpans);
      vi.mocked(mockRepository.getDeletedApiKeys).mockResolvedValue([]);
      vi.mocked(mockRepository.getActiveAnnotations).mockResolvedValue(apiSpans);

      const result = await useCase.execute({
        workspaceId: 'workspace-1',
      });

      expect(result.userSpans).toEqual([]);
      expect(result.apiSpans).toEqual(apiSpans);
    });

    it('should handle multiple deleted API keys', async () => {
      const deletedApiKeys = ['key-1', 'key-2', 'key-3'];

      vi.mocked(mockRepository.getUserSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getApiSpans).mockResolvedValue([]);
      vi.mocked(mockRepository.getDeletedApiKeys).mockResolvedValue(deletedApiKeys);
      vi.mocked(mockRepository.getActiveAnnotations).mockResolvedValue([]);

      const result = await useCase.execute({
        workspaceId: 'workspace-1',
      });

      expect(result.deletedApiKeys).toEqual(deletedApiKeys);
    });
  });
});

