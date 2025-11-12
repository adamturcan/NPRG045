import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClearApiAnnotationsUseCase } from '@/core/usecases/annotation/ClearApiAnnotationsUseCase';
import type { AnnotationRepository } from '@/core/interfaces/repositories/AnnotationRepository';

describe('ClearApiAnnotationsUseCase', () => {
  let useCase: ClearApiAnnotationsUseCase;
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

    useCase = new ClearApiAnnotationsUseCase(mockRepository);
  });

  describe('Success cases', () => {
    it('should clear API annotations for a workspace', async () => {
      await useCase.execute({
        workspaceId: 'workspace-1',
      });

      expect(mockRepository.clearApiSpans).toHaveBeenCalledWith('workspace-1');
      expect(mockRepository.clearApiSpans).toHaveBeenCalledTimes(1);
    });

    it('should clear API annotations for multiple workspaces in sequence', async () => {
      const workspaceIds = ['workspace-1', 'workspace-2', 'workspace-3'];

      for (const workspaceId of workspaceIds) {
        await useCase.execute({ workspaceId });
      }

      expect(mockRepository.clearApiSpans).toHaveBeenCalledTimes(3);
      expect(mockRepository.clearApiSpans).toHaveBeenCalledWith('workspace-1');
      expect(mockRepository.clearApiSpans).toHaveBeenCalledWith('workspace-2');
      expect(mockRepository.clearApiSpans).toHaveBeenCalledWith('workspace-3');
    });

    it('should work even if there are no API annotations', async () => {
      // Repository should handle empty state gracefully
      vi.mocked(mockRepository.clearApiSpans).mockResolvedValue();

      await useCase.execute({
        workspaceId: 'empty-workspace',
      });

      expect(mockRepository.clearApiSpans).toHaveBeenCalledWith('empty-workspace');
    });
  });

  describe('Validation errors', () => {
    it('should throw error if workspaceId is missing', async () => {
      await expect(
        useCase.execute({
          workspaceId: '',
        })
      ).rejects.toThrow('Workspace ID is required');

      expect(mockRepository.clearApiSpans).not.toHaveBeenCalled();
    });

    it('should throw error if workspaceId is null', async () => {
      await expect(
        useCase.execute({
          workspaceId: null as any,
        })
      ).rejects.toThrow('Workspace ID is required');

      expect(mockRepository.clearApiSpans).not.toHaveBeenCalled();
    });

    it('should throw error if workspaceId is undefined', async () => {
      await expect(
        useCase.execute({
          workspaceId: undefined as any,
        })
      ).rejects.toThrow('Workspace ID is required');

      expect(mockRepository.clearApiSpans).not.toHaveBeenCalled();
    });
  });

  describe('Repository failures', () => {
    it('should propagate repository errors', async () => {
      const repoError = new Error('Storage error');
      vi.mocked(mockRepository.clearApiSpans).mockRejectedValue(repoError);

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
        })
      ).rejects.toThrow('Storage error');
    });

    it('should handle repository timeout errors', async () => {
      vi.mocked(mockRepository.clearApiSpans).mockRejectedValue(
        new Error('Operation timeout')
      );

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
        })
      ).rejects.toThrow('Operation timeout');
    });

    it('should handle repository not found errors', async () => {
      vi.mocked(mockRepository.clearApiSpans).mockRejectedValue(
        new Error('Workspace not found')
      );

      await expect(
        useCase.execute({
          workspaceId: 'nonexistent-workspace',
        })
      ).rejects.toThrow('Workspace not found');
    });
  });

  describe('Edge cases', () => {
    it('should accept workspace ID with special characters', async () => {
      await useCase.execute({
        workspaceId: 'workspace-123-abc-xyz',
      });

      expect(mockRepository.clearApiSpans).toHaveBeenCalledWith('workspace-123-abc-xyz');
    });

    it('should accept UUID format workspace IDs', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      
      await useCase.execute({
        workspaceId: uuid,
      });

      expect(mockRepository.clearApiSpans).toHaveBeenCalledWith(uuid);
    });
  });
});

