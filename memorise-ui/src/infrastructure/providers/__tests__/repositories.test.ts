import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getWorkspaceRepository,
  getWorkspaceUseCases,
  getWorkspaceApplicationService,
  setWorkspaceProviderOverrides,
  resetWorkspaceProvider,
  getAnnotationRepository,
  getAnnotationUseCases,
  setAnnotationProviderOverrides,
  resetAnnotationProvider,
  getTagRepository,
  getTagUseCases,
  setTagProviderOverrides,
  resetTagProvider,
} from '../repositories';
import { LocalStorageWorkspaceRepository } from '../../repositories/LocalStorageWorkspaceRepository';
import { LocalStorageAnnotationRepository } from '../../repositories/LocalStorageAnnotationRepository';
import { LocalStorageTagRepository } from '../../repositories/LocalStorageTagRepository';
import { WorkspaceApplicationService } from '../../../application/services/WorkspaceApplicationService';

describe('Repository Providers', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    resetWorkspaceProvider();
    resetAnnotationProvider();
    resetTagProvider();
  });

  afterEach(() => {
    resetWorkspaceProvider();
    resetAnnotationProvider();
    resetTagProvider();
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

    it('should respect repository overrides', () => {
      const overrideRepo = {
        findByOwner: vi.fn(),
        findById: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      } as unknown as LocalStorageWorkspaceRepository;

      setWorkspaceProviderOverrides({ repository: overrideRepo });
      expect(getWorkspaceRepository()).toBe(overrideRepo);
    });
  });

  describe('Workspace use cases and services', () => {
    it('should return singleton use cases', () => {
      const useCasesA = getWorkspaceUseCases();
      const useCasesB = getWorkspaceUseCases();
      expect(useCasesA).toEqual(useCasesB);
      expect(useCasesA.create).toBe(useCasesB.create);
      expect(useCasesA.update).toBe(useCasesB.update);
    });

    it('should allow overriding use cases', () => {
      const customUseCase = getWorkspaceUseCases().create;
      const fakeUseCase = Object.create(customUseCase);

      setWorkspaceProviderOverrides({
        useCases: {
          create: fakeUseCase,
        },
      });

      const overridden = getWorkspaceUseCases();
      expect(overridden.create).toBe(fakeUseCase);
      expect(overridden.update).not.toBe(fakeUseCase);
    });

    it('should return singleton application service and allow overrides', () => {
      const serviceA = getWorkspaceApplicationService();
      const serviceB = getWorkspaceApplicationService();

      expect(serviceA).toBeInstanceOf(WorkspaceApplicationService);
      expect(serviceA).toBe(serviceB);

      const overrideService = {} as WorkspaceApplicationService;
      setWorkspaceProviderOverrides({ applicationService: overrideService });
      expect(getWorkspaceApplicationService()).toBe(overrideService);
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

    it('should respect annotation repository overrides', () => {
      const overrideRepo = {
        getUserSpans: vi.fn(),
        getApiSpans: vi.fn(),
        getDeletedApiKeys: vi.fn(),
        addUserSpan: vi.fn(),
        removeUserSpan: vi.fn(),
        setApiSpans: vi.fn(),
        markApiSpanDeleted: vi.fn(),
        clearApiSpans: vi.fn(),
        getActiveAnnotations: vi.fn(),
      };

      setAnnotationProviderOverrides({ repository: overrideRepo });
      expect(getAnnotationRepository()).toBe(overrideRepo);
    });
  });

  describe('Annotation use cases', () => {
    it('should return singleton annotation use cases', () => {
      const useCasesA = getAnnotationUseCases();
      const useCasesB = getAnnotationUseCases();
      expect(useCasesA.addUserAnnotation).toBe(useCasesB.addUserAnnotation);
      expect(useCasesA.clearApiAnnotations).toBe(useCasesB.clearApiAnnotations);
    });

    it('should allow overriding annotation use cases', () => {
      const fakeUseCase = { execute: vi.fn() } as any;
      setAnnotationProviderOverrides({
        useCases: {
          addUserAnnotation: fakeUseCase,
        },
      });

      const useCases = getAnnotationUseCases();
      expect(useCases.addUserAnnotation).toBe(fakeUseCase);
      expect(useCases.clearApiAnnotations).not.toBe(fakeUseCase);
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

    it('should respect tag repository overrides', () => {
      const overrideRepo = {
        getTags: vi.fn(),
        getUserTags: vi.fn(),
        getApiTags: vi.fn(),
        addTag: vi.fn(),
        removeTag: vi.fn(),
        setApiTags: vi.fn(),
        clearTags: vi.fn(),
        hasTag: vi.fn(),
      };

      setTagProviderOverrides({ repository: overrideRepo });
      expect(getTagRepository()).toBe(overrideRepo);
    });
  });

  describe('Tag use cases', () => {
    it('should return singleton tag use cases', () => {
      const useCasesA = getTagUseCases();
      const useCasesB = getTagUseCases();
      expect(useCasesA.addTag).toBe(useCasesB.addTag);
    });

    it('should allow overriding tag use cases', () => {
      const fakeUseCase = { execute: vi.fn() } as any;
      setTagProviderOverrides({
        useCases: {
          addTag: fakeUseCase,
        },
      });

      const useCases = getTagUseCases();
      expect(useCases.addTag).toBe(fakeUseCase);
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

