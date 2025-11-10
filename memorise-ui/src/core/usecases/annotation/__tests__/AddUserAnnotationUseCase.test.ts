import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddUserAnnotationUseCase } from '../AddUserAnnotationUseCase';
import type { AnnotationRepository } from '../../../interfaces/repositories/AnnotationRepository';
import type { NerSpan } from '../../../../types/NotationEditor';

describe('AddUserAnnotationUseCase', () => {
  let useCase: AddUserAnnotationUseCase;
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

    useCase = new AddUserAnnotationUseCase(mockRepository);
  });

  describe('Success cases', () => {
    it('should add a valid user annotation', async () => {
      const span: NerSpan = {
        start: 0,
        end: 10,
        entity: 'PERSON',
      };

      await useCase.execute({
        workspaceId: 'workspace-1',
        span,
      });

      expect(mockRepository.addUserSpan).toHaveBeenCalledWith('workspace-1', span);
      expect(mockRepository.addUserSpan).toHaveBeenCalledTimes(1);
    });

    it('should add annotation with score', async () => {
      const span: NerSpan = {
        start: 5,
        end: 15,
        entity: 'LOCATION',
        score: 0.95,
      };

      await useCase.execute({
        workspaceId: 'workspace-2',
        span,
      });

      expect(mockRepository.addUserSpan).toHaveBeenCalledWith('workspace-2', span);
    });

    it('should handle multiple annotations in sequence', async () => {
      const spans: NerSpan[] = [
        { start: 0, end: 5, entity: 'PERSON' },
        { start: 10, end: 20, entity: 'ORG' },
        { start: 25, end: 30, entity: 'DATE' },
      ];

      for (const span of spans) {
        await useCase.execute({
          workspaceId: 'workspace-1',
          span,
        });
      }

      expect(mockRepository.addUserSpan).toHaveBeenCalledTimes(3);
    });
  });

  describe('Validation errors', () => {
    it('should throw error if workspaceId is missing', async () => {
      const span: NerSpan = {
        start: 0,
        end: 10,
        entity: 'PERSON',
      };

      await expect(
        useCase.execute({
          workspaceId: '',
          span,
        })
      ).rejects.toThrow('Workspace ID is required');

      expect(mockRepository.addUserSpan).not.toHaveBeenCalled();
    });

    it('should throw error if span start is negative', async () => {
      const span: NerSpan = {
        start: -1,
        end: 10,
        entity: 'PERSON',
      };

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          span,
        })
      ).rejects.toThrow('Invalid annotation span');

      expect(mockRepository.addUserSpan).not.toHaveBeenCalled();
    });

    it('should throw error if span end is less than or equal to start', async () => {
      const span: NerSpan = {
        start: 10,
        end: 10,
        entity: 'PERSON',
      };

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          span,
        })
      ).rejects.toThrow('Invalid annotation span');

      expect(mockRepository.addUserSpan).not.toHaveBeenCalled();
    });

    it('should throw error if span is missing', async () => {
      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          span: null as any,
        })
      ).rejects.toThrow('Invalid annotation span');
    });

    it('should throw error if entity is empty', async () => {
      const span: NerSpan = {
        start: 0,
        end: 10,
        entity: '',
      };

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          span,
        })
      ).rejects.toThrow('Annotation entity type is required');

      expect(mockRepository.addUserSpan).not.toHaveBeenCalled();
    });

    it('should throw error if entity is only whitespace', async () => {
      const span: NerSpan = {
        start: 0,
        end: 10,
        entity: '   ',
      };

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          span,
        })
      ).rejects.toThrow('Annotation entity type is required');

      expect(mockRepository.addUserSpan).not.toHaveBeenCalled();
    });
  });

  describe('Repository failures', () => {
    it('should propagate repository errors', async () => {
      const span: NerSpan = {
        start: 0,
        end: 10,
        entity: 'PERSON',
      };

      const repoError = new Error('Database connection failed');
      vi.mocked(mockRepository.addUserSpan).mockRejectedValue(repoError);

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          span,
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle repository timeout errors', async () => {
      const span: NerSpan = {
        start: 0,
        end: 10,
        entity: 'PERSON',
      };

      vi.mocked(mockRepository.addUserSpan).mockRejectedValue(
        new Error('Operation timeout')
      );

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          span,
        })
      ).rejects.toThrow('Operation timeout');
    });
  });

  describe('Edge cases', () => {
    it('should accept annotation at position 0', async () => {
      const span: NerSpan = {
        start: 0,
        end: 1,
        entity: 'PERSON',
      };

      await useCase.execute({
        workspaceId: 'workspace-1',
        span,
      });

      expect(mockRepository.addUserSpan).toHaveBeenCalledWith('workspace-1', span);
    });

    it('should accept large position values', async () => {
      const span: NerSpan = {
        start: 100000,
        end: 100010,
        entity: 'LOCATION',
      };

      await useCase.execute({
        workspaceId: 'workspace-1',
        span,
      });

      expect(mockRepository.addUserSpan).toHaveBeenCalledWith('workspace-1', span);
    });

    it('should accept annotation with score of 0', async () => {
      const span: NerSpan = {
        start: 0,
        end: 5,
        entity: 'PERSON',
        score: 0,
      };

      await useCase.execute({
        workspaceId: 'workspace-1',
        span,
      });

      expect(mockRepository.addUserSpan).toHaveBeenCalledWith('workspace-1', span);
    });

    it('should accept annotation with score of 1', async () => {
      const span: NerSpan = {
        start: 0,
        end: 5,
        entity: 'PERSON',
        score: 1,
      };

      await useCase.execute({
        workspaceId: 'workspace-1',
        span,
      });

      expect(mockRepository.addUserSpan).toHaveBeenCalledWith('workspace-1', span);
    });
  });
});

