import { LocalStorageWorkspaceRepository } from '../repositories/LocalStorageWorkspaceRepository';
import type { WorkspaceRepository } from '../../core/interfaces/repositories/WorkspaceRepository';
import { CreateWorkspaceUseCase } from '../../core/usecases/workspace/CreateWorkspaceUseCase';
import { UpdateWorkspaceUseCase } from '../../core/usecases/workspace/UpdateWorkspaceUseCase';
import { DeleteWorkspaceUseCase } from '../../core/usecases/workspace/DeleteWorkspaceUseCase';
import { LoadWorkspacesUseCase } from '../../core/usecases/workspace/LoadWorkspacesUseCase';
import { SyncWorkspaceTranslationsUseCase } from '../../core/usecases/workspace/SyncWorkspaceTranslationsUseCase';
import { WorkspaceApplicationService } from '../../application/services/WorkspaceApplicationService';

export interface WorkspaceUseCases {
  create: CreateWorkspaceUseCase;
  update: UpdateWorkspaceUseCase;
  delete: DeleteWorkspaceUseCase;
  load: LoadWorkspacesUseCase;
  syncTranslations: SyncWorkspaceTranslationsUseCase;
}

export interface WorkspaceProviderOverrides {
  repository?: WorkspaceRepository;
  useCases?: Partial<WorkspaceUseCases>;
  applicationService?: WorkspaceApplicationService;
}

let repositorySingleton: WorkspaceRepository | null = null;
let useCasesSingleton: WorkspaceUseCases | null = null;
let applicationServiceSingleton: WorkspaceApplicationService | null = null;
let overrides: WorkspaceProviderOverrides | null = null;

export function setWorkspaceProviderOverrides(next: WorkspaceProviderOverrides): void {
  overrides = next;
  if (next.repository) {
    repositorySingleton = null;
    useCasesSingleton = null;
    applicationServiceSingleton = null;
  }
  if (next.useCases) {
    useCasesSingleton = null;
    applicationServiceSingleton = null;
  }
  if (next.applicationService) {
    applicationServiceSingleton = null;
  }
}

export function resetWorkspaceProvider(): void {
  overrides = null;
  repositorySingleton = null;
  useCasesSingleton = null;
  applicationServiceSingleton = null;
}

function createDefaultRepository(): WorkspaceRepository {
  return new LocalStorageWorkspaceRepository();
}

function ensureRepository(): WorkspaceRepository {
  if (overrides?.repository) {
    return overrides.repository;
  }

  if (!repositorySingleton) {
    repositorySingleton = createDefaultRepository();
  }

  return repositorySingleton;
}

export function getWorkspaceRepository(): WorkspaceRepository {
  return ensureRepository();
}

function createDefaultUseCases(): WorkspaceUseCases {
  const repository = ensureRepository();
  return {
    create: new CreateWorkspaceUseCase(repository),
    update: new UpdateWorkspaceUseCase(repository),
    delete: new DeleteWorkspaceUseCase(repository),
    load: new LoadWorkspacesUseCase(repository),
    syncTranslations: new SyncWorkspaceTranslationsUseCase(repository),
  };
}

export function getWorkspaceUseCases(): WorkspaceUseCases {
  if (!useCasesSingleton) {
    useCasesSingleton = createDefaultUseCases();
  }

  const overrideUseCases = overrides?.useCases ?? {};

  return {
    create: overrideUseCases.create ?? useCasesSingleton.create,
    update: overrideUseCases.update ?? useCasesSingleton.update,
    delete: overrideUseCases.delete ?? useCasesSingleton.delete,
    load: overrideUseCases.load ?? useCasesSingleton.load,
    syncTranslations: overrideUseCases.syncTranslations ?? useCasesSingleton.syncTranslations,
  };
}

export function getWorkspaceApplicationService(): WorkspaceApplicationService {
  if (overrides?.applicationService) {
    return overrides.applicationService;
  }

  if (!applicationServiceSingleton) {
    applicationServiceSingleton = new WorkspaceApplicationService({
      workspaceRepository: ensureRepository(),
    });
  }

  return applicationServiceSingleton;
}


