import { LocalStorageAnnotationRepository } from '../repositories/LocalStorageAnnotationRepository';
import type { AnnotationRepository } from '../../core/interfaces/repositories/AnnotationRepository';
import { AddUserAnnotationUseCase } from '../../core/usecases/annotation/AddUserAnnotationUseCase';
import { ClearApiAnnotationsUseCase } from '../../core/usecases/annotation/ClearApiAnnotationsUseCase';
import { GetAnnotationsUseCase } from '../../core/usecases/annotation/GetAnnotationsUseCase';

export interface AnnotationUseCases {
  addUserAnnotation: AddUserAnnotationUseCase;
  clearApiAnnotations: ClearApiAnnotationsUseCase;
  getAnnotations: GetAnnotationsUseCase;
}

export interface AnnotationProviderOverrides {
  repository?: AnnotationRepository;
  useCases?: Partial<AnnotationUseCases>;
}

let repositorySingleton: AnnotationRepository | null = null;
let useCasesSingleton: AnnotationUseCases | null = null;
let overrides: AnnotationProviderOverrides | null = null;

export function setAnnotationProviderOverrides(next: AnnotationProviderOverrides): void {
  overrides = next;

  if (next.repository) {
    repositorySingleton = null;
    useCasesSingleton = null;
  }

  if (next.useCases) {
    useCasesSingleton = null;
  }
}

export function resetAnnotationProvider(): void {
  overrides = null;
  repositorySingleton = null;
  useCasesSingleton = null;
}

function ensureRepository(): AnnotationRepository {
  if (overrides?.repository) {
    return overrides.repository;
  }

  if (!repositorySingleton) {
    repositorySingleton = new LocalStorageAnnotationRepository();
  }

  return repositorySingleton;
}

export function getAnnotationRepository(): AnnotationRepository {
  return ensureRepository();
}

function createDefaultUseCases(): AnnotationUseCases {
  const repository = ensureRepository();
  return {
    addUserAnnotation: new AddUserAnnotationUseCase(repository),
    clearApiAnnotations: new ClearApiAnnotationsUseCase(repository),
    getAnnotations: new GetAnnotationsUseCase(repository),
  };
}

export function getAnnotationUseCases(): AnnotationUseCases {
  if (!useCasesSingleton) {
    useCasesSingleton = createDefaultUseCases();
  }

  const overrideUseCases = overrides?.useCases ?? {};

  return {
    addUserAnnotation:
      overrideUseCases.addUserAnnotation ?? useCasesSingleton.addUserAnnotation,
    clearApiAnnotations:
      overrideUseCases.clearApiAnnotations ?? useCasesSingleton.clearApiAnnotations,
    getAnnotations: overrideUseCases.getAnnotations ?? useCasesSingleton.getAnnotations,
  };
}


