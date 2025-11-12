// src/hooks/__tests__/useAutoSave.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from '@/presentation/hooks/useAutoSave';
import type { Workspace } from '@/types/Workspace';
import type { NerSpan } from '@/types/NotationEditor';
import type { TagItem } from '@/types/Tag';

describe('useAutoSave', () => {
  let mockSetWorkspaces: ReturnType<typeof vi.fn>;
  let mockWorkspaces: Workspace[];

  beforeEach(() => {
    vi.useFakeTimers();
    mockSetWorkspaces = vi.fn((updater) => {
      if (typeof updater === 'function') {
        updater(mockWorkspaces);
      }
    });

    mockWorkspaces = [
      {
        id: 'ws-1',
        name: 'Test Workspace',
        owner: 'test-user',
        text: 'Original text',
        tags: [],
        userSpans: [],
        apiSpans: [],
        updatedAt: Date.now(),
      },
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const createTestData = (overrides = {}) => ({
    text: 'Test text',
    userSpans: [] as NerSpan[],
    apiSpans: [] as NerSpan[],
    deletedApiKeys: new Set<string>(),
    tags: [] as TagItem[],
    ...overrides,
  });

  it('should not save immediately on mount', () => {
    renderHook(() =>
      useAutoSave('ws-1', createTestData(), mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>)
    );

    expect(mockSetWorkspaces).not.toHaveBeenCalled();
  });

  it('should not save when workspaceId is null', async () => {
    const { result } = renderHook(() =>
      useAutoSave(null, createTestData(), mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>)
    );

    // Set as hydrated and wait for debounce
    act(() => {
      result.current.setHydrated(null);
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockSetWorkspaces).not.toHaveBeenCalled();
  });

  it('should not save when not hydrated', async () => {
    renderHook(() =>
      useAutoSave('ws-1', createTestData(), mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>)
    );

    // Don't set hydration - should not save
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockSetWorkspaces).not.toHaveBeenCalled();
  });

  it('should save after delay when hydrated', async () => {
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave('ws-1', data, mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>),
      { initialProps: { data: createTestData({ text: 'Old text' }) } }
    );

    // Mark as hydrated
    act(() => {
      result.current.setHydrated('ws-1');
    });

    // Change data to trigger autosave
    rerender({ data: createTestData({ text: 'New text' }) });

    // Wait for autosave delay
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(mockSetWorkspaces).toHaveBeenCalled();
  });

  it('should use custom delay option', async () => {
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave('ws-1', data, mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>, { delay: 1000 }),
      { initialProps: { data: createTestData({ text: 'Old text' }) } }
    );

    act(() => {
      result.current.setHydrated('ws-1');
    });

    // Change data to trigger autosave
    rerender({ data: createTestData({ text: 'New text' }) });

    // Should not save before custom delay
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(mockSetWorkspaces).not.toHaveBeenCalled();

    // Should save after custom delay
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(mockSetWorkspaces).toHaveBeenCalled();
  });

  it('should not save when disabled', async () => {
    const { result } = renderHook(() =>
      useAutoSave(
        'ws-1',
        createTestData({ text: 'New text' }),
        mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>,
        { enabled: false }
      )
    );

    act(() => {
      result.current.setHydrated('ws-1');
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockSetWorkspaces).not.toHaveBeenCalled();
  });

  it('should debounce multiple changes', async () => {
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave('ws-1', data, mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>),
      { initialProps: { data: createTestData({ text: 'Text 1' }) } }
    );

    act(() => {
      result.current.setHydrated('ws-1');
    });

    // Change 1
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Change 2 (should cancel previous timer)
    rerender({ data: createTestData({ text: 'Text 2' }) });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Change 3 (should cancel previous timer)
    rerender({ data: createTestData({ text: 'Text 3' }) });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(mockSetWorkspaces).not.toHaveBeenCalled();

    // Wait for final debounce to complete
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    // Should only save once with the final value
    expect(mockSetWorkspaces).toHaveBeenCalledTimes(1);
  });

  it('should save immediately with saveNow', () => {
    const mockOnNotice = vi.fn();
    const { result } = renderHook(() =>
      useAutoSave('ws-1', createTestData({ text: 'New text' }), mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>)
    );

    act(() => {
      result.current.saveNow(mockOnNotice);
    });

    expect(mockSetWorkspaces).toHaveBeenCalledTimes(1);
    expect(mockOnNotice).toHaveBeenCalledWith('Workspace saved.');
  });

  it('should not call onNotice if not provided to saveNow', () => {
    const { result } = renderHook(() =>
      useAutoSave('ws-1', createTestData({ text: 'New text' }), mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>)
    );

    act(() => {
      result.current.saveNow();
    });

    expect(mockSetWorkspaces).toHaveBeenCalledTimes(1);
    // Should not throw error
  });

  it('should not save with saveNow when workspaceId is null', () => {
    const mockOnNotice = vi.fn();
    const { result } = renderHook(() =>
      useAutoSave(null, createTestData(), mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>)
    );

    act(() => {
      result.current.saveNow(mockOnNotice);
    });

    expect(mockSetWorkspaces).not.toHaveBeenCalled();
    expect(mockOnNotice).not.toHaveBeenCalled();
  });

  it('should cancel pending autosave when saveNow is called', async () => {
    const { result } = renderHook(() =>
      useAutoSave('ws-1', createTestData({ text: 'New text' }), mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>)
    );

    act(() => {
      result.current.setHydrated('ws-1');
    });

    // Let autosave timer start
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Call saveNow (should cancel pending timer)
    act(() => {
      result.current.saveNow();
    });

    // Advance past autosave delay
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Should only have saved once (from saveNow, not autosave)
    expect(mockSetWorkspaces).toHaveBeenCalledTimes(1);
  });

  it('should save to original tab by default', async () => {
    const testData = createTestData({
      text: 'New text',
      tags: [{ name: 'test', source: 'user' }],
    });

    const { result } = renderHook(() =>
      useAutoSave('ws-1', testData, mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>)
    );

    act(() => {
      result.current.saveNow();
    });

    expect(mockSetWorkspaces).toHaveBeenCalledWith(expect.any(Function));
    
    // Verify the updater function is called
    const updaterFn = mockSetWorkspaces.mock.calls[0][0];
    const updatedWorkspaces = updaterFn(mockWorkspaces);
    
    expect(updatedWorkspaces[0].text).toBe('New text');
    expect(updatedWorkspaces[0].tags).toEqual(testData.tags);
  });

  it('should save to translation tab when activeTab is set', async () => {
    const mockWorkspacesWithTranslation: Workspace[] = [
      {
        ...mockWorkspaces[0],
        translations: [
          {
            language: 'ces',
            text: 'Old translation',
            sourceLang: 'en',
            userSpans: [],
            apiSpans: [],
            deletedApiKeys: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      },
    ];

    mockSetWorkspaces = vi.fn((updater) => {
      if (typeof updater === 'function') {
        return updater(mockWorkspacesWithTranslation);
      }
    });

    const testData = createTestData({ text: 'New translation text' });

    const { result } = renderHook(() =>
      useAutoSave('ws-1', testData, mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>, { activeTab: 'ces' })
    );

    act(() => {
      result.current.saveNow();
    });

    expect(mockSetWorkspaces).toHaveBeenCalled();
    
    const updaterFn = mockSetWorkspaces.mock.calls[0][0];
    const updatedWorkspaces = updaterFn(mockWorkspacesWithTranslation);
    
    // Original text should not change
    expect(updatedWorkspaces[0].text).toBe('Original text');
    
    // Translation text should update
    expect(updatedWorkspaces[0].translations?.[0].text).toBe('New translation text');
  });

  it('should handle deletedApiKeys Set correctly', async () => {
    const testData = createTestData({
      deletedApiKeys: new Set(['key1', 'key2']),
    });

    const { result } = renderHook(() =>
      useAutoSave('ws-1', testData, mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>)
    );

    act(() => {
      result.current.saveNow();
    });

    const updaterFn = mockSetWorkspaces.mock.calls[0][0];
    const updatedWorkspaces = updaterFn(mockWorkspaces);
    
    // Should convert Set to Array
    expect(Array.isArray(updatedWorkspaces[0].deletedApiKeys)).toBe(true);
    expect(updatedWorkspaces[0].deletedApiKeys).toEqual(
      expect.arrayContaining(['key1', 'key2'])
    );
  });

  it('should update timestamp when saving', async () => {
    const oldTimestamp = mockWorkspaces[0].updatedAt;
    
    // Advance time to ensure new timestamp
    vi.advanceTimersByTime(1000);

    const { result } = renderHook(() =>
      useAutoSave('ws-1', createTestData(), mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>)
    );

    act(() => {
      result.current.saveNow();
    });

    const updaterFn = mockSetWorkspaces.mock.calls[0][0];
    const updatedWorkspaces = updaterFn(mockWorkspaces);
    
    expect(updatedWorkspaces[0].updatedAt).toBeDefined();
    // @ts-expect-error - updatedAt is checked to be defined above
    expect(updatedWorkspaces[0].updatedAt).toBeGreaterThan(oldTimestamp);
  });

  it('should enable autosave after calling saveNow', async () => {
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave('ws-1', data, mockSetWorkspaces as React.Dispatch<React.SetStateAction<Workspace[]>>),
      { initialProps: { data: createTestData({ text: 'Text 1' }) } }
    );

    // Don't set hydrated initially
    
    // Call saveNow (should set hydrated)
    act(() => {
      result.current.saveNow();
    });

    expect(mockSetWorkspaces).toHaveBeenCalledTimes(1);
    mockSetWorkspaces.mockClear();

    // Now update data and autosave should work
    rerender({ data: createTestData({ text: 'Text 2' }) });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Autosave should work now
    expect(mockSetWorkspaces).toHaveBeenCalled();
  });
});

