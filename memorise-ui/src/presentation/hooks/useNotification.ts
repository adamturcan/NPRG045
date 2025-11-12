// src/hooks/useNotification.ts
/**
 * useNotification - Hook for managing notification/snackbar state
 * 
 * Provides a simple notification system with state management.
 * Used for showing temporary success/info messages to the user.
 * 
 * @returns Object containing:
 *   - notice: Current notification message (null if none)
 *   - showNotice: Function to show a notification
 *   - clearNotice: Function to dismiss the notification
 * 
 * @example
 * ```tsx
 * const { notice, showNotice, clearNotice } = useNotification();
 * 
 * // Show a notification
 * showNotice("Workspace saved!");
 * 
 * // Clear manually if needed
 * clearNotice();
 * 
 * // Display in UI
 * <Snackbar open={!!notice} onClose={clearNotice}>
 *   <Alert onClose={clearNotice}>{notice}</Alert>
 * </Snackbar>
 * ```
 */
import { useState, useCallback } from "react";
import type { Notice, NoticeOptions } from "../../types/Notice";

/**
 * Hook for managing notification state
 */
export function useNotification() {
  const [notice, setNotice] = useState<Notice | null>(null);
  
  /**
   * Show a notification message
   * @param msg - The message to display
   */
  const showNotice = useCallback((msg: string, options?: NoticeOptions) => {
    setNotice({
      message: msg,
      tone: options?.tone,
      persistent: options?.persistent,
    });
  }, []);
  
  /**
   * Clear/dismiss the current notification
   */
  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);
  
  return { 
    notice, 
    showNotice, 
    clearNotice 
  };
}

