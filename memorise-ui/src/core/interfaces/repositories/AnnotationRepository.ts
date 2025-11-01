import type { NerSpan } from '../../../types/NotationEditor';

/**
 * Repository interface for Annotation persistence
 * Manages NER annotation spans for workspaces
 */
export interface AnnotationRepository {
  /**
   * Get all user annotations for a workspace
   */
  getUserSpans(workspaceId: string): Promise<NerSpan[]>;

  /**
   * Get all API-generated annotations for a workspace
   */
  getApiSpans(workspaceId: string): Promise<NerSpan[]>;

  /**
   * Get deleted API annotation keys for a workspace
   */
  getDeletedApiKeys(workspaceId: string): Promise<string[]>;

  /**
   * Add a user annotation
   */
  addUserSpan(workspaceId: string, span: NerSpan): Promise<void>;

  /**
   * Remove a user annotation
   */
  removeUserSpan(workspaceId: string, spanKey: string): Promise<void>;

  /**
   * Set API-generated annotations (replaces all)
   */
  setApiSpans(workspaceId: string, spans: NerSpan[]): Promise<void>;

  /**
   * Mark an API annotation as deleted (soft delete)
   */
  markApiSpanDeleted(workspaceId: string, spanKey: string): Promise<void>;

  /**
   * Clear all API annotations for a workspace
   */
  clearApiSpans(workspaceId: string): Promise<void>;

  /**
   * Get all active annotations (user + non-deleted API)
   */
  getActiveAnnotations(workspaceId: string): Promise<NerSpan[]>;
}

