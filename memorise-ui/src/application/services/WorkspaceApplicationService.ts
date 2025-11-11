import type { WorkspaceRepository } from '../../core/interfaces/repositories/WorkspaceRepository';
import { workspaceToDto } from '../../core/entities/mappers';
import type { Workspace as WorkspaceDTO } from '../../types/Workspace';
import type { TagItem } from '../../types/Tag';
import type { Translation } from '../../types/Workspace';
import type { NerSpan } from '../../types/NotationEditor';
import { CreateWorkspaceUseCase } from '../../core/usecases/workspace/CreateWorkspaceUseCase';
import { DeleteWorkspaceUseCase } from '../../core/usecases/workspace/DeleteWorkspaceUseCase';
import {
  UpdateWorkspaceUseCase,
  type UpdateWorkspacePatch,
} from '../../core/usecases/workspace/UpdateWorkspaceUseCase';
import { LoadWorkspacesUseCase } from '../../core/usecases/workspace/LoadWorkspacesUseCase';
import { SyncWorkspaceTranslationsUseCase } from '../../core/usecases/workspace/SyncWorkspaceTranslationsUseCase';
import { Workspace } from '../../core/entities/Workspace';
import { requireOwnerId, requireWorkspaceName } from '../../core/usecases/shared/validators';

interface WorkspaceApplicationServiceDeps {
  workspaceRepository: WorkspaceRepository;
}

export class WorkspaceApplicationService {
  private readonly deps: WorkspaceApplicationServiceDeps;
  private readonly createUseCase: CreateWorkspaceUseCase;
  private readonly updateUseCase: UpdateWorkspaceUseCase;
  private readonly deleteUseCase: DeleteWorkspaceUseCase;
  private readonly loadUseCase: LoadWorkspacesUseCase;
  private readonly syncTranslationsUseCase: SyncWorkspaceTranslationsUseCase;

  constructor(deps: WorkspaceApplicationServiceDeps) {
    this.deps = deps;
    this.createUseCase = new CreateWorkspaceUseCase(deps.workspaceRepository);
    this.updateUseCase = new UpdateWorkspaceUseCase(deps.workspaceRepository);
    this.deleteUseCase = new DeleteWorkspaceUseCase(deps.workspaceRepository);
    this.loadUseCase = new LoadWorkspacesUseCase(deps.workspaceRepository);
    this.syncTranslationsUseCase = new SyncWorkspaceTranslationsUseCase(
      deps.workspaceRepository
    );
  }

  async loadForOwner(ownerId: string): Promise<WorkspaceDTO[]> {
    const workspaces = await this.loadUseCase.execute({ ownerId });
    workspaces.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return workspaces.map((workspace) => workspaceToDto(workspace));
  }

  async createWorkspace(params: {
    ownerId: string;
    name: string;
    workspaceId?: string;
    text?: string;
    isTemporary?: boolean;
    userSpans?: NerSpan[];
    apiSpans?: NerSpan[];
    deletedApiKeys?: string[];
    tags?: TagItem[];
    translations?: Translation[];
    updatedAt?: number;
  }): Promise<WorkspaceDTO> {
    const workspace = await this.createUseCase.execute(params);
    return workspaceToDto(workspace);
  }

  async updateWorkspace(params: {
    workspaceId: string;
    patch: UpdateWorkspacePatch;
  }): Promise<WorkspaceDTO | null> {
    const workspace = await this.updateUseCase.execute(params);
    return workspace ? workspaceToDto(workspace) : null;
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    await this.deleteUseCase.execute({ workspaceId });
  }

  async replaceAllForOwner(ownerId: string, workspaces: WorkspaceDTO[]): Promise<void> {
    const existing = await this.deps.workspaceRepository.findByOwner(ownerId);
    const existingIds = new Set(existing.map((ws) => ws.id));
    const incomingIds = new Set(workspaces.map((ws) => ws.id));

    // Delete workspaces not present in incoming list
    for (const id of existingIds) {
      if (!incomingIds.has(id)) {
        await this.deleteUseCase.execute({ workspaceId: id });
      }
    }

    for (const dto of workspaces) {
      if (!dto.id) continue;
      if (existingIds.has(dto.id)) {
        await this.updateUseCase.execute({
          workspaceId: dto.id,
          patch: this.dtoToPatch(dto),
        });
      } else {
        await this.createUseCase.execute({
          ownerId: dto.owner ?? ownerId,
          workspaceId: dto.id,
          name: dto.name,
          text: dto.text,
          isTemporary: dto.isTemporary,
          userSpans: dto.userSpans,
          apiSpans: dto.apiSpans,
          deletedApiKeys: dto.deletedApiKeys,
          tags: dto.tags,
          translations: dto.translations,
          updatedAt: dto.updatedAt,
        });
      }
    }
  }

  async syncWorkspaceTranslations(params: {
    workspaceId: string;
    translations: Translation[];
  }): Promise<WorkspaceDTO | null> {
    const workspace = await this.syncTranslationsUseCase.execute(params);
    return workspace ? workspaceToDto(workspace) : null;
  }

  createWorkspaceDraft(ownerId: string, name: string): WorkspaceDTO {
    const validatedOwner = requireOwnerId(ownerId, 'WorkspaceApplicationService');
    const validatedName = requireWorkspaceName(name, 'WorkspaceApplicationService');

    const workspace = Workspace.create({
      id: crypto.randomUUID(),
      owner: validatedOwner,
      name: validatedName,
      isTemporary: true,
    });

    return workspaceToDto(workspace);
  }

  seedForOwner(ownerId: string): WorkspaceDTO[] {
    const validatedOwner = requireOwnerId(ownerId, 'WorkspaceApplicationService');
    const now = Date.now();

    return ['Workspace A', 'Workspace B', 'Workspace C'].map((name) =>
      workspaceToDto(
        Workspace.create({
          id: crypto.randomUUID(),
          owner: validatedOwner,
          name,
          isTemporary: false,
          text: '',
          userSpans: [],
          updatedAt: now,
        })
      )
    );
  }

  private dtoToPatch(dto: WorkspaceDTO): UpdateWorkspacePatch {
    return {
      name: dto.name,
      text: dto.text,
      isTemporary: dto.isTemporary,
      userSpans: dto.userSpans,
      apiSpans: dto.apiSpans,
      deletedApiKeys: dto.deletedApiKeys,
      tags: dto.tags,
      translations: dto.translations,
      updatedAt: dto.updatedAt,
    };
  }
}


