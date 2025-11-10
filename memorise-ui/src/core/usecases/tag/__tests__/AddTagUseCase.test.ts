import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddTagUseCase } from '../AddTagUseCase';
import type { TagRepository } from '../../../interfaces/repositories/TagRepository';
import type { TagItem } from '../../../../types/Tag';

describe('AddTagUseCase', () => {
  let useCase: AddTagUseCase;
  let mockRepository: TagRepository;

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      getUserTags: vi.fn(),
      getApiTags: vi.fn(),
      addTag: vi.fn(),
      removeTag: vi.fn(),
      replaceApiTags: vi.fn(),
      hasTag: vi.fn(),
    };

    useCase = new AddTagUseCase(mockRepository);
  });

  describe('Success cases', () => {
    it('should add a valid user tag', async () => {
      const tag: TagItem = {
        name: 'culture',
        source: 'user',
      };

      vi.mocked(mockRepository.hasTag).mockResolvedValue(false);

      await useCase.execute({
        workspaceId: 'workspace-1',
        tag,
      });

      expect(mockRepository.hasTag).toHaveBeenCalledWith('workspace-1', 'culture');
      expect(mockRepository.addTag).toHaveBeenCalledWith('workspace-1', tag);
      expect(mockRepository.addTag).toHaveBeenCalledTimes(1);
    });

    it('should add an API tag with label', async () => {
      const tag: TagItem = {
        name: 'education',
        source: 'api',
        label: 12345,
      };

      vi.mocked(mockRepository.hasTag).mockResolvedValue(false);

      await useCase.execute({
        workspaceId: 'workspace-2',
        tag,
      });

      expect(mockRepository.hasTag).toHaveBeenCalledWith('workspace-2', 'education');
      expect(mockRepository.addTag).toHaveBeenCalledWith('workspace-2', tag);
    });

    it('should add an API tag with label and parentId', async () => {
      const tag: TagItem = {
        name: 'history',
        source: 'api',
        label: 67890,
        parentId: 11111,
      };

      vi.mocked(mockRepository.hasTag).mockResolvedValue(false);

      await useCase.execute({
        workspaceId: 'workspace-3',
        tag,
      });

      expect(mockRepository.addTag).toHaveBeenCalledWith('workspace-3', tag);
    });

    it('should add multiple tags in sequence', async () => {
      const tags: TagItem[] = [
        { name: 'tag1', source: 'user' },
        { name: 'tag2', source: 'user' },
        { name: 'tag3', source: 'api', label: 123 },
      ];

      vi.mocked(mockRepository.hasTag).mockResolvedValue(false);

      for (const tag of tags) {
        await useCase.execute({
          workspaceId: 'workspace-1',
          tag,
        });
      }

      expect(mockRepository.addTag).toHaveBeenCalledTimes(3);
    });
  });

  describe('Validation errors', () => {
    it('should throw error if workspaceId is missing', async () => {
      const tag: TagItem = {
        name: 'culture',
        source: 'user',
      };

      await expect(
        useCase.execute({
          workspaceId: '',
          tag,
        })
      ).rejects.toThrow('Workspace ID is required');

      expect(mockRepository.hasTag).not.toHaveBeenCalled();
      expect(mockRepository.addTag).not.toHaveBeenCalled();
    });

    it('should throw error if tag name is empty', async () => {
      const tag: TagItem = {
        name: '',
        source: 'user',
      };

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          tag,
        })
      ).rejects.toThrow('Tag name is required');

      expect(mockRepository.addTag).not.toHaveBeenCalled();
    });

    it('should throw error if tag name is only whitespace', async () => {
      const tag: TagItem = {
        name: '   ',
        source: 'user',
      };

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          tag,
        })
      ).rejects.toThrow('Tag name is required');

      expect(mockRepository.addTag).not.toHaveBeenCalled();
    });

    it('should throw error if tag is missing', async () => {
      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          tag: null as any,
        })
      ).rejects.toThrow('Tag name is required');
    });

    it('should throw error if tag object is missing name property', async () => {
      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          tag: { source: 'user' } as any,
        })
      ).rejects.toThrow('Tag name is required');
    });
  });

  describe('Duplicate tag detection', () => {
    it('should throw error if tag already exists', async () => {
      const tag: TagItem = {
        name: 'existing-tag',
        source: 'user',
      };

      vi.mocked(mockRepository.hasTag).mockResolvedValue(true);

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          tag,
        })
      ).rejects.toThrow('Tag "existing-tag" already exists');

      expect(mockRepository.hasTag).toHaveBeenCalledWith('workspace-1', 'existing-tag');
      expect(mockRepository.addTag).not.toHaveBeenCalled();
    });

    it('should check for duplicates before adding', async () => {
      const tag: TagItem = {
        name: 'new-tag',
        source: 'user',
      };

      vi.mocked(mockRepository.hasTag).mockResolvedValue(false);

      await useCase.execute({
        workspaceId: 'workspace-1',
        tag,
      });

      // Verify hasTag was called before addTag
      expect(mockRepository.hasTag).toHaveBeenCalledBefore(
        mockRepository.addTag as any
      );
    });

    it('should handle tag names with special characters in duplicate check', async () => {
      const tag: TagItem = {
        name: 'AI/ML',
        source: 'user',
      };

      vi.mocked(mockRepository.hasTag).mockResolvedValue(true);

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          tag,
        })
      ).rejects.toThrow('Tag "AI/ML" already exists');
    });
  });

  describe('Repository failures', () => {
    it('should propagate errors from hasTag check', async () => {
      const tag: TagItem = {
        name: 'culture',
        source: 'user',
      };

      vi.mocked(mockRepository.hasTag).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          tag,
        })
      ).rejects.toThrow('Database error');

      expect(mockRepository.addTag).not.toHaveBeenCalled();
    });

    it('should propagate errors from addTag', async () => {
      const tag: TagItem = {
        name: 'culture',
        source: 'user',
      };

      vi.mocked(mockRepository.hasTag).mockResolvedValue(false);
      vi.mocked(mockRepository.addTag).mockRejectedValue(
        new Error('Storage failed')
      );

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          tag,
        })
      ).rejects.toThrow('Storage failed');
    });

    it('should handle repository timeout errors', async () => {
      const tag: TagItem = {
        name: 'culture',
        source: 'user',
      };

      vi.mocked(mockRepository.hasTag).mockResolvedValue(false);
      vi.mocked(mockRepository.addTag).mockRejectedValue(
        new Error('Operation timeout')
      );

      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          tag,
        })
      ).rejects.toThrow('Operation timeout');
    });
  });

  describe('Domain validation', () => {
    it('should validate tag using domain model', async () => {
      const validTag: TagItem = {
        name: 'science',
        source: 'user',
      };

      vi.mocked(mockRepository.hasTag).mockResolvedValue(false);

      // Should not throw - domain model validates successfully
      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          tag: validTag,
        })
      ).resolves.not.toThrow();
    });

    it('should catch domain validation errors', async () => {
      const invalidTag: TagItem = {
        name: '   ',  // Will be trimmed to empty
        source: 'user',
      };

      // Domain model validation happens before repository check
      await expect(
        useCase.execute({
          workspaceId: 'workspace-1',
          tag: invalidTag,
        })
      ).rejects.toThrow('Tag name is required');

      expect(mockRepository.hasTag).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should trim whitespace from tag name', async () => {
      const tag: TagItem = {
        name: '  culture  ',
        source: 'user',
      };

      vi.mocked(mockRepository.hasTag).mockResolvedValue(false);

      await useCase.execute({
        workspaceId: 'workspace-1',
        tag,
      });

      // hasTag should be called with trimmed name
      expect(mockRepository.hasTag).toHaveBeenCalledWith('workspace-1', 'culture');
    });

    it('should accept tag with numbers', async () => {
      const tag: TagItem = {
        name: 'Web3.0',
        source: 'user',
      };

      vi.mocked(mockRepository.hasTag).mockResolvedValue(false);

      await useCase.execute({
        workspaceId: 'workspace-1',
        tag,
      });

      expect(mockRepository.addTag).toHaveBeenCalledWith('workspace-1', tag);
    });

    it('should accept tag with hyphens', async () => {
      const tag: TagItem = {
        name: 'machine-learning',
        source: 'user',
      };

      vi.mocked(mockRepository.hasTag).mockResolvedValue(false);

      await useCase.execute({
        workspaceId: 'workspace-1',
        tag,
      });

      expect(mockRepository.addTag).toHaveBeenCalledWith('workspace-1', tag);
    });

    it('should accept tag with label of 0', async () => {
      const tag: TagItem = {
        name: 'test',
        source: 'api',
        label: 0,
      };

      vi.mocked(mockRepository.hasTag).mockResolvedValue(false);

      await useCase.execute({
        workspaceId: 'workspace-1',
        tag,
      });

      expect(mockRepository.addTag).toHaveBeenCalledWith('workspace-1', tag);
    });
  });
});

