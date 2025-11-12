// src/hooks/__tests__/useThesaurusWorker.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useThesaurusWorker } from '@/presentation/hooks/useThesaurusWorker';
import type { ThesaurusIndexItem } from '@/types/Thesaurus';

// Mock Worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((err: ErrorEvent) => void) | null = null;
  private messageHandlers: ((e: MessageEvent) => void)[] = [];

  postMessage(data: any) {
    // Simulate async worker response
    setTimeout(() => {
      if (data.type === 'SEARCH') {
        const handler = this.messageHandlers[this.messageHandlers.length - 1] || this.onmessage;
        if (handler) {
          handler({
            data: {
              type: 'RESULTS',
              results: [
                {
                  id: 1,
                  label: 'culture',
                  labelLower: 'culture',
                  parentId: 0,
                  parentLabel: '',
                  isPreferred: true,
                  path: ['Culture'],
                  pathString: 'Culture',
                  rootCategory: 'Culture',
                  depth: 0,
                },
              ],
            },
          } as MessageEvent);
        }
      }
    }, 10);
  }

  addEventListener(event: string, handler: (e: MessageEvent) => void) {
    if (event === 'message') {
      this.messageHandlers.push(handler);
    }
  }

  removeEventListener(event: string, handler: (e: MessageEvent) => void) {
    if (event === 'message') {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    }
  }

  terminate() {
    // Cleanup
  }

  // Helper to simulate worker messages
  simulateMessage(data: any) {
    const handler = this.messageHandlers[this.messageHandlers.length - 1] || this.onmessage;
    if (handler) {
      handler({ data } as MessageEvent);
    }
  }
}

// Mock Worker constructor
let mockWorkerInstance: MockWorker;

// Declare global for Worker
declare global {
  var Worker: typeof globalThis.Worker;
}

describe('useThesaurusWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerInstance = new MockWorker();
    
    // Replace Worker with a function that returns our mock instance
    globalThis.Worker = function(url: string | URL, options?: WorkerOptions) {
      return mockWorkerInstance as any;
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize worker on mount and return interface', () => {
    const { result } = renderHook(() => useThesaurusWorker());

    // Verify hook returns expected interface
    expect(result.current).toHaveProperty('search');
    expect(result.current).toHaveProperty('ready');
    expect(result.current).toHaveProperty('error');
    expect(typeof result.current.search).toBe('function');
    expect(typeof result.current.ready).toBe('boolean');
  });

  it('should start with ready=false', () => {
    const { result } = renderHook(() => useThesaurusWorker());

    expect(result.current.ready).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should set ready=true when worker sends READY message', async () => {
    const { result } = renderHook(() => useThesaurusWorker());

    // Simulate worker ready message
    await act(async () => {
      mockWorkerInstance.simulateMessage({ type: 'READY' });
    });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
  });

  it('should set error when worker sends ERROR message', async () => {
    const { result } = renderHook(() => useThesaurusWorker());

    await act(async () => {
      mockWorkerInstance.simulateMessage({ type: 'ERROR', error: 'Failed to load' });
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load');
    });
  });

  it('should handle worker error event', async () => {
    const { result } = renderHook(() => useThesaurusWorker());

    await act(async () => {
      if (mockWorkerInstance.onerror) {
        mockWorkerInstance.onerror({
          message: 'Worker error',
        } as ErrorEvent);
      }
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Worker error');
    });
  });

  it('should return empty array when searching before ready', async () => {
    const { result } = renderHook(() => useThesaurusWorker());

    const searchResults = await result.current.search('culture');

    expect(searchResults).toEqual([]);
  });

  it('should return empty array when searching with error', async () => {
    const { result } = renderHook(() => useThesaurusWorker());

    // Set error state
    await act(async () => {
      mockWorkerInstance.simulateMessage({ type: 'ERROR', error: 'Failed' });
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    const searchResults = await result.current.search('culture');
    expect(searchResults).toEqual([]);
  });

  it('should search and return results when ready', async () => {
    const { result } = renderHook(() => useThesaurusWorker());

    // Set worker ready
    await act(async () => {
      mockWorkerInstance.simulateMessage({ type: 'READY' });
    });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    // Setup mock response - capture the message handler
    const mockResults: ThesaurusIndexItem[] = [
      {
        id: 1,
        label: 'culture',
        labelLower: 'culture',
        parentId: 0,
        parentLabel: '',
        isPreferred: true,
        path: ['Culture'],
        pathString: 'Culture',
        rootCategory: 'Culture',
        depth: 0,
      },
    ];

    // Perform search
    const searchPromise = result.current.search('culture', 20);

    // Wait a bit for handler to be set up
    await new Promise(resolve => setTimeout(resolve, 10));

    // Simulate worker response
    await act(async () => {
      mockWorkerInstance.simulateMessage({
        type: 'RESULTS',
        results: mockResults,
      });
    });

    const searchResults = await searchPromise;
    expect(searchResults).toEqual(mockResults);
  });

  it('should handle search when worker not ready', async () => {
    // Don't set worker ready - should return empty array
    const { result } = renderHook(() => useThesaurusWorker());

    expect(result.current.ready).toBe(false);

    // Search before ready should return empty
    const searchResults = await result.current.search('culture');
    expect(searchResults).toEqual([]);
  });

  it('should use custom limit in search', async () => {
    const { result } = renderHook(() => useThesaurusWorker());

    await act(async () => {
      mockWorkerInstance.simulateMessage({ type: 'READY' });
    });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    const postMessageSpy = vi.spyOn(mockWorkerInstance, 'postMessage');

    // Start search with custom limit
    result.current.search('culture', 50);

    // Verify postMessage was called with the limit
    // Give it a moment to execute
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SEARCH',
        query: 'culture',
        limit: 50,
      })
    );
  });

  it('should cleanup worker on unmount', () => {
    // Create a new worker instance for this test
    const testWorker = new MockWorker();
    const terminateSpy = vi.spyOn(testWorker, 'terminate');
    
    // Replace global Worker to return our test worker
    globalThis.Worker = function(url: string | URL, options?: WorkerOptions) {
      return testWorker as any;
    } as any;

    const { unmount } = renderHook(() => useThesaurusWorker());

    unmount();

    expect(terminateSpy).toHaveBeenCalled();
  });
});

