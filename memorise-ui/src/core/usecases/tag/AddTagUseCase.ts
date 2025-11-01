import type { TagItem } from '../../../types/Tag';
import type { TagRepository } from '../../interfaces/repositories/TagRepository';
import { Tag } from '../../../domain/Tag';

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
    if (!request.workspaceId) {
      throw new Error('Workspace ID is required');
    }

    if (!request.tag || !request.tag.name || request.tag.name.trim().length === 0) {
      throw new Error('Tag name is required');
    }

    // Create domain object for validation
    const tag = Tag.fromTagItem(request.tag);

    // Check for duplicates
    const exists = await this.tagRepository.hasTag(request.workspaceId, tag.name);
    if (exists) {
      throw new Error(`Tag "${tag.name}" already exists`);
    }

    // Add the tag
    await this.tagRepository.addTag(request.workspaceId, request.tag);
  }
}

