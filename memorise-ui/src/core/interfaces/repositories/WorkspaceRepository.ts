import { Workspace } from '../../entities/Workspace';

/**
 * Repository interface for Workspace persistence
 * Defines the contract for workspace data access
 */
export interface WorkspaceRepository {
  /**
   * Find a workspace by ID
   */
  findById(id: string): Promise<Workspace | null>;

  /**
   * Find all workspaces for a specific owner
   */
  findByOwner(ownerId: string): Promise<Workspace[]>;

  /**
   * Find all workspaces
   */
  findAll(): Promise<Workspace[]>;

  /**
   * Save a workspace (create or update)
   */
  save(workspace: Workspace): Promise<void>;

  /**
   * Delete a workspace by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a workspace exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Get raw persistence data for an owner (includes metadata like segments)
   * This is needed to preserve metadata that's not part of the domain entity
   */
  getRawPersistenceForOwner?(ownerId: string): Promise<Array<{ id: string; segments?: unknown }>>;
}

