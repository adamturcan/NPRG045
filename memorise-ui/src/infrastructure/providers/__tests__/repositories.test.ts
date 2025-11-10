import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWorkspaceRepository,
  getAnnotationRepository,
  getTagRepository,
} from '../repositories';
import { LocalStorageWorkspaceRepository } from '../../repositories/LocalStorageWorkspaceRepository';
import { LocalStorageAnnotationRepository } from '../../repositories/LocalStorageAnnotationRepository';
import { LocalStorageTagRepository } from '../../repositories/LocalStorageTagRepository';

describe('Repository Providers', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('getWorkspaceRepository', () => {
    it('should return a WorkspaceRepository instance', () => {
      const repo = getWorkspaceRepository();
      expect(repo).toBeInstanceOf(LocalStorageWorkspaceRepository);
    });

    it('should return the same instance on subsequent calls (singleton)', () => {
      const repo1 = getWorkspaceRepository();
      const repo2 = getWorkspaceRepository();
      expect(repo1).toBe(repo2);
    });

    it('should have all required repository methods', () => {
      const repo = getWorkspaceRepository();
      expect(repo.findByOwner).toBeDefined();
      expect(repo.findById).toBeDefined();
      expect(repo.save).toBeDefined();
      expect(repo.delete).toBeDefined();
    });
  });

  describe('getAnnotationRepository', () => {
    it('should return an AnnotationRepository instance', () => {
      const repo = getAnnotationRepository();
      expect(repo).toBeInstanceOf(LocalStorageAnnotationRepository);
    });

    it('should return the same instance on subsequent calls (singleton)', () => {
      const repo1 = getAnnotationRepository();
      const repo2 = getAnnotationRepository();
      expect(repo1).toBe(repo2);
    });

    it('should have all required repository methods', () => {
      const repo = getAnnotationRepository();
      expect(repo.getUserSpans).toBeDefined();
      expect(repo.getApiSpans).toBeDefined();
      expect(repo.getDeletedApiKeys).toBeDefined();
      expect(repo.getActiveAnnotations).toBeDefined();
      expect(repo.addUserSpan).toBeDefined();
      expect(repo.removeUserSpan).toBeDefined();
      expect(repo.setApiSpans).toBeDefined();
      expect(repo.markApiSpanDeleted).toBeDefined();
      expect(repo.clearApiSpans).toBeDefined();
    });
  });

  describe('getTagRepository', () => {
    it('should return a TagRepository instance', () => {
      const repo = getTagRepository();
      expect(repo).toBeInstanceOf(LocalStorageTagRepository);
    });

    it('should return the same instance on subsequent calls (singleton)', () => {
      const repo1 = getTagRepository();
      const repo2 = getTagRepository();
      expect(repo1).toBe(repo2);
    });

    it('should have all required repository methods', () => {
      const repo = getTagRepository();
      expect(repo.getTags).toBeDefined();
      expect(repo.getUserTags).toBeDefined();
      expect(repo.getApiTags).toBeDefined();
      expect(repo.addTag).toBeDefined();
      expect(repo.removeTag).toBeDefined();
      expect(repo.setApiTags).toBeDefined();
      expect(repo.clearTags).toBeDefined();
      expect(repo.hasTag).toBeDefined();
    });
  });

  describe('Singleton pattern', () => {
    it('should maintain separate instances for each repository type', () => {
      const workspaceRepo = getWorkspaceRepository();
      const annotationRepo = getAnnotationRepository();
      const tagRepo = getTagRepository();

      // All should be different instances
      expect(workspaceRepo).not.toBe(annotationRepo);
      expect(workspaceRepo).not.toBe(tagRepo);
      expect(annotationRepo).not.toBe(tagRepo);
    });
  });
});

