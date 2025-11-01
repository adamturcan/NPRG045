import type { TagItem } from '../../../types/Tag';

/**
 * Repository interface for Tag persistence
 * Manages semantic tags for workspaces
 */
export interface TagRepository {
  /**
   * Get all tags for a workspace
   */
  getTags(workspaceId: string): Promise<TagItem[]>;

  /**
   * Get only user-created tags
   */
  getUserTags(workspaceId: string): Promise<TagItem[]>;

  /**
   * Get only API-generated tags
   */
  getApiTags(workspaceId: string): Promise<TagItem[]>;

  /**
   * Add a tag to a workspace
   */
  addTag(workspaceId: string, tag: TagItem): Promise<void>;

  /**
   * Remove a tag from a workspace
   */
  removeTag(workspaceId: string, tagName: string): Promise<void>;

  /**
   * Set API-generated tags (replaces all API tags)
   */
  setApiTags(workspaceId: string, tags: TagItem[]): Promise<void>;

  /**
   * Clear all tags for a workspace
   */
  clearTags(workspaceId: string): Promise<void>;

  /**
   * Check if a tag exists in a workspace
   */
  hasTag(workspaceId: string, tagName: string): Promise<boolean>;
}

