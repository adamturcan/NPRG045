// src/hooks/__tests__/useThesaurusDisplay.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useThesaurusDisplay } from '@/presentation/hooks/useThesaurusDisplay';
import type { ThesaurusIndexItem } from '@/types/Thesaurus';
import * as thesaurusHelpers from '@/shared/utils/thesaurusHelpers';

// Mock the thesaurus helpers
vi.mock('../../../shared/utils/thesaurusHelpers', () => ({
  loadThesaurusIndex: vi.fn(),
}));

describe('useThesaurusDisplay', () => {
  const mockLoadThesaurusIndex = vi.mocked(thesaurusHelpers.loadThesaurusIndex);
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockThesaurusIndex: ThesaurusIndexItem[] = [
    {
      id: 1,
      label: 'culture',
      labelLower: 'culture',
      parentId: 0,
      isPreferred: true,
      path: ['Culture'],
      rootCategory: 'Culture',
    },
    {
      id: 2,
      label: 'society',
      labelLower: 'society',
      parentId: 0,
      isPreferred: true,
      path: ['Society'],
      rootCategory: 'Society',
    },
  ];

  const mockThesaurusWorker = {
    ready: false,
    search: vi.fn(),
    error: null,
  };

  it('should return undefined initially when worker is not ready', () => {
    const { result } = renderHook(() =>
      useThesaurusDisplay(mockThesaurusWorker)
    );

    expect(result.current).toBeUndefined();
  });

  it('should return undefined when worker is ready but index not loaded yet', async () => {
    const readyWorker = { ...mockThesaurusWorker, ready: true };
    mockLoadThesaurusIndex.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() =>
      useThesaurusDisplay(readyWorker)
    );

    // Should still be undefined while loading
    expect(result.current).toBeUndefined();
  });

  it('should load thesaurus index when worker becomes ready', async () => {
    const readyWorker = { ...mockThesaurusWorker, ready: true };
    mockLoadThesaurusIndex.mockResolvedValue(mockThesaurusIndex);

    const { result } = renderHook(() =>
      useThesaurusDisplay(readyWorker)
    );

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(mockLoadThesaurusIndex).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual(mockThesaurusIndex);
  });

  it('should not reload index if already loaded', async () => {
    const readyWorker = { ...mockThesaurusWorker, ready: true };
    mockLoadThesaurusIndex.mockResolvedValue(mockThesaurusIndex);

    const { result, rerender } = renderHook(() =>
      useThesaurusDisplay(readyWorker)
    );

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(mockLoadThesaurusIndex).toHaveBeenCalledTimes(1);

    // Rerender with same worker state
    rerender();

    // Should not reload
    expect(mockLoadThesaurusIndex).toHaveBeenCalledTimes(1);
  });

  it('should handle loading errors gracefully', async () => {
    const readyWorker = { ...mockThesaurusWorker, ready: true };
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockLoadThesaurusIndex.mockRejectedValue(new Error('Failed to load'));

    const { result } = renderHook(() =>
      useThesaurusDisplay(readyWorker)
    );

    await waitFor(() => {
      // Should still return undefined on error
      expect(result.current).toBeUndefined();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load thesaurus for display:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should not load index if worker becomes ready but already loaded', async () => {
    const readyWorker = { ...mockThesaurusWorker, ready: true };
    mockLoadThesaurusIndex.mockResolvedValue(mockThesaurusIndex);

    const { result, rerender } = renderHook(
      ({ worker }) => useThesaurusDisplay(worker),
      { initialProps: { worker: mockThesaurusWorker } }
    );

    // Worker not ready yet
    expect(result.current).toBeUndefined();
    expect(mockLoadThesaurusIndex).not.toHaveBeenCalled();

    // Worker becomes ready
    rerender({ worker: readyWorker });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(mockLoadThesaurusIndex).toHaveBeenCalledTimes(1);

    // Worker becomes ready again (should not reload)
    rerender({ worker: readyWorker });
    
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should still only be called once
    expect(mockLoadThesaurusIndex).toHaveBeenCalledTimes(1);
  });

  it('should return index as undefined type when not loaded', () => {
    const { result } = renderHook(() =>
      useThesaurusDisplay(mockThesaurusWorker)
    );

    // Type should be ThesaurusIndexItem[] | undefined
    expect(result.current).toBeUndefined();
  });
});

