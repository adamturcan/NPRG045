/**
 * Storage Service interface
 * Defines the contract for client-side storage
 */
export interface StorageService {
  /**
   * Get an item from storage
   */
  getItem<T>(key: string): Promise<T | null>;

  /**
   * Set an item in storage
   */
  setItem<T>(key: string, value: T): Promise<void>;

  /**
   * Remove an item from storage
   */
  removeItem(key: string): Promise<void>;

  /**
   * Clear all items from storage
   */
  clear(): Promise<void>;

  /**
   * Check if a key exists in storage
   */
  has(key: string): Promise<boolean>;
}

