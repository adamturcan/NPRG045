import type { TagItem } from '../../../types/Tag';
import type { TagRepository } from '../../interfaces/repositories/TagRepository';
import { Tag } from '../../entities/Tag';
import { errorHandlingService } from '../../../infrastructure/services/ErrorHandlingService';
import { requireWorkspaceId } from '../shared/validators';

export interface AddTagRequest {
  workspaceId: string;
  tag: TagItem;
}

/**
 * Use case for adding a tag to a workspace
 */
export class AddTagUseCase {
  private tagRepository: TagRepository;

  constructor(tagRepository: TagRepository) {
    this.tagRepository = tagRepository;
  }

  async execute(request: AddTagRequest): Promise<void> {
    const workspaceId = requireWorkspaceId(
      request.workspaceId,
      'AddTagUseCase'
    );

    if (!request.tag) {
      throw errorHandlingService.createAppError({
        message: 'Tag is required.',
        code: 'TAG_REQUIRED',
        severity: 'warn',
        context: {
          operation: 'AddTagUseCase',
          workspaceId,
        },
      });
    }

    let tag: Tag;
    try {
      tag = Tag.fromTagItem(request.tag);
    } catch (error) {
      throw errorHandlingService.createAppError({
        message:
          error instanceof Error ? error.message : 'Tag validation failed.',
        code: 'TAG_VALIDATION_FAILED',
        severity: 'warn',
        context: {
          operation: 'AddTagUseCase',
          workspaceId,
        },
        cause: error,
      });
    }

    // Check for duplicates
    const exists = await this.tagRepository.hasTag(workspaceId, tag.name);
    if (exists) {
      throw errorHandlingService.createAppError({
        message: `Tag "${tag.name}" already exists.`,
        code: 'TAG_ALREADY_EXISTS',
        severity: 'warn',
        context: {
          operation: 'AddTagUseCase',
          workspaceId,
          tagName: tag.name,
        },
      });
    }

    // Add the tag
    await this.tagRepository.addTag(workspaceId, request.tag);
  }
}

