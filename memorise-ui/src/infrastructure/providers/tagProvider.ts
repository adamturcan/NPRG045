import { LocalStorageTagRepository } from '../repositories/LocalStorageTagRepository';
import type { TagRepository } from '../../core/interfaces/repositories/TagRepository';
import { AddTagUseCase } from '../../core/usecases/tag/AddTagUseCase';

export interface TagUseCases {
  addTag: AddTagUseCase;
}

export interface TagProviderOverrides {
  repository?: TagRepository;
  useCases?: Partial<TagUseCases>;
}

let repositorySingleton: TagRepository | null = null;
let useCasesSingleton: TagUseCases | null = null;
let overrides: TagProviderOverrides | null = null;

export function setTagProviderOverrides(next: TagProviderOverrides): void {
  overrides = next;

  if (next.repository) {
    repositorySingleton = null;
    useCasesSingleton = null;
  }

  if (next.useCases) {
    useCasesSingleton = null;
  }
}

export function resetTagProvider(): void {
  overrides = null;
  repositorySingleton = null;
  useCasesSingleton = null;
}

function ensureRepository(): TagRepository {
  if (overrides?.repository) {
    return overrides.repository;
  }

  if (!repositorySingleton) {
    repositorySingleton = new LocalStorageTagRepository();
  }

  return repositorySingleton;
}

export function getTagRepository(): TagRepository {
  return ensureRepository();
}

function createDefaultUseCases(): TagUseCases {
  const repository = ensureRepository();
  return {
    addTag: new AddTagUseCase(repository),
  };
}

export function getTagUseCases(): TagUseCases {
  if (!useCasesSingleton) {
    useCasesSingleton = createDefaultUseCases();
  }

  const overrideUseCases = overrides?.useCases ?? {};

  return {
    addTag: overrideUseCases.addTag ?? useCasesSingleton.addTag,
  };
}


