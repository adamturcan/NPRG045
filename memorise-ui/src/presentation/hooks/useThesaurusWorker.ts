/**
 * useThesaurusWorker - Hook to interact with thesaurus Web Worker
 * 
 * This hook manages communication with the background worker that
 * handles searching the massive 750k keyword thesaurus.
 * 
 * Features:
 * - Initializes worker on mount
 * - Tracks ready state (worker finished loading index)
 * - Provides async search function
 * - Cleans up worker on unmount
 * 
 * Usage:
 *   const thesaurus = useThesaurusWorker();
 *   const results = await thesaurus.search("culture", 20);
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ThesaurusIndexItem } from '../../types/Thesaurus';

export function useThesaurusWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Initialize worker on mount
   */
  useEffect(() => {
    // Create worker (Vite handles the import)
    const worker = new Worker(
      new URL('../../workers/thesaurusWorker.ts', import.meta.url),
      { type: 'module' }
    );
    
    // Handle messages from worker
    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'READY') {
        setReady(true);
        console.log('✅ Thesaurus worker ready');
      } else if (e.data.type === 'ERROR') {
        setError(e.data.error);
        console.error('❌ Thesaurus worker error:', e.data.error);
      }
    };
    
    worker.onerror = (err) => {
      setError(err.message);
      console.error('❌ Worker error:', err);
    };
    
    workerRef.current = worker;
    
    // Cleanup on unmount
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);
  
  /**
   * Search function - sends request to worker and waits for results
   */
  const search = useCallback(
    (query: string, limit = 20): Promise<ThesaurusIndexItem[]> => {
      return new Promise((resolve) => {
        // Worker not ready or errored
        if (!workerRef.current || !ready || error) {
          resolve([]);
          return;
        }
        
        // Set up one-time listener for results
        const handler = (e: MessageEvent) => {
          if (e.data.type === 'RESULTS') {
            workerRef.current?.removeEventListener('message', handler);
            resolve(e.data.results || []);
          }
        };
        
        workerRef.current.addEventListener('message', handler);
        
        // Send search request to worker
        workerRef.current.postMessage({ 
          type: 'SEARCH', 
          query, 
          limit 
        });
        
        // Timeout fallback (if worker doesn't respond in 5s)
        setTimeout(() => {
          workerRef.current?.removeEventListener('message', handler);
          resolve([]);
        }, 5000);
      });
    },
    [ready, error]
  );
  
  return { 
    search,      // Async search function
    ready,       // Boolean: is worker initialized?
    error,       // Error message if failed to load
  };
}



