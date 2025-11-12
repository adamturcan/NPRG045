// src/hooks/__tests__/useAnnotationManager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnnotationManager } from '@/presentation/hooks/useAnnotationManager';
import type { Workspace } from '@/types/Workspace';
import type { NerSpan } from '@/types/NotationEditor';
import {
  setApiProviderOverrides,
  resetApiProvider,
  } from '@/infrastructure/providers/apiProvider';
import type { ApiService } from '@/core/interfaces/services/ApiService';

const createApiServiceStub = () => {
  const stub = {
    classify: vi.fn<ApiService['classify']>(),
    ner: vi.fn<ApiService['ner']>(),
    translate: vi.fn<ApiService['translate']>(),
    getSupportedLanguages: vi.fn<ApiService['getSupportedLanguages']>(),
  };
  stub.ner.mockResolvedValue([]);
  return stub as ApiService & typeof stub;
};

let apiServiceStub = createApiServiceStub();

describe('useAnnotationManager', () => {
  const mockNerSpan1: NerSpan = {
    start: 0,
    end: 5,
    entity: 'PERSON',
    score: 0.9,
  };

  const mockNerSpan2: NerSpan = {
    start: 10,
    end: 15,
    entity: 'LOCATION',
    score: 0.8,
  };

  const mockWorkspace: Workspace = {
    id: 'ws-1',
    name: 'Test Workspace',
    owner: 'test-user',
    text: 'Test text',
    tags: [],
    userSpans: [mockNerSpan1],
    apiSpans: [mockNerSpan2],
    deletedApiKeys: [],
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiServiceStub = createApiServiceStub();
    setApiProviderOverrides({ apiService: apiServiceStub });
  });

  afterEach(() => {
    resetApiProvider();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useAnnotationManager());

    expect(result.current.userSpans).toEqual([]);
    expect(result.current.apiSpans).toEqual([]);
    expect(result.current.deletedApiKeys).toEqual(new Set());
  });

  it('should initialize with provided initial values', () => {
    const { result } = renderHook(() =>
      useAnnotationManager({
        initialUserSpans: [mockNerSpan1],
        initialApiSpans: [mockNerSpan2],
        initialDeletedKeys: ['0:5:PERSON'],
      })
    );

    expect(result.current.userSpans).toEqual([mockNerSpan1]);
    expect(result.current.apiSpans).toEqual([mockNerSpan2]);
    expect(result.current.deletedApiKeys).toEqual(new Set(['0:5:PERSON']));
  });

  it('should add a new span', () => {
    const { result } = renderHook(() => useAnnotationManager());

    act(() => {
      result.current.addSpan(mockNerSpan1);
    });

    expect(result.current.userSpans).toContainEqual(mockNerSpan1);
  });

  it('should not add duplicate span', () => {
    const { result } = renderHook(() =>
      useAnnotationManager({
        initialUserSpans: [mockNerSpan1],
      })
    );

    act(() => {
      result.current.addSpan(mockNerSpan1);
    });

    // Should still have only one span
    expect(result.current.userSpans).toHaveLength(1);
  });

  it('should undelete soft-deleted API span when adding it', () => {
    const { result } = renderHook(() =>
      useAnnotationManager({
        initialApiSpans: [mockNerSpan1],
        initialDeletedKeys: ['0:5:PERSON'],
      })
    );

    expect(result.current.deletedApiKeys.has('0:5:PERSON')).toBe(true);

    act(() => {
      result.current.addSpan(mockNerSpan1);
    });

    // Should remove from deletedApiKeys
    expect(result.current.deletedApiKeys.has('0:5:PERSON')).toBe(false);
  });

  it('should hard delete user span', () => {
    const { result } = renderHook(() =>
      useAnnotationManager({
        initialUserSpans: [mockNerSpan1, mockNerSpan2],
      })
    );

    act(() => {
      result.current.deleteSpan(mockNerSpan1);
    });

    expect(result.current.userSpans).not.toContainEqual(mockNerSpan1);
    expect(result.current.userSpans).toContainEqual(mockNerSpan2);
  });

  it('should soft delete API span', () => {
    const { result } = renderHook(() =>
      useAnnotationManager({
        initialApiSpans: [mockNerSpan1, mockNerSpan2],
      })
    );

    act(() => {
      result.current.deleteSpan(mockNerSpan1);
    });

    // API span should still be in apiSpans
    expect(result.current.apiSpans).toContainEqual(mockNerSpan1);
    
    // But key should be in deletedApiKeys
    expect(result.current.deletedApiKeys.has('0:5:PERSON')).toBe(true);
  });

  it('should compute filteredApiSpans correctly', () => {
    const { result } = renderHook(() =>
      useAnnotationManager({
        initialApiSpans: [mockNerSpan1, mockNerSpan2],
        initialDeletedKeys: ['0:5:PERSON'],
      })
    );

    // Should only include mockNerSpan2 (not deleted)
    expect(result.current.filteredApiSpans).toEqual([mockNerSpan2]);
    expect(result.current.filteredApiSpans).not.toContainEqual(mockNerSpan1);
  });

  it('should compute combinedSpans correctly', () => {
    const { result } = renderHook(() =>
      useAnnotationManager({
        initialUserSpans: [mockNerSpan1],
        initialApiSpans: [mockNerSpan2],
      })
    );

    // Should combine both user and API spans
    expect(result.current.combinedSpans).toHaveLength(2);
    expect(result.current.combinedSpans).toContainEqual(mockNerSpan1);
    expect(result.current.combinedSpans).toContainEqual(mockNerSpan2);
  });

  it('should compute deletableKeys correctly', () => {
    const { result } = renderHook(() =>
      useAnnotationManager({
        initialApiSpans: [mockNerSpan1, mockNerSpan2],
        initialDeletedKeys: ['0:5:PERSON'],
      })
    );

    // Should only include keys of non-deleted API spans
    expect(result.current.deletableKeys).toContain('10:15:LOCATION');
    expect(result.current.deletableKeys).not.toContain('0:5:PERSON');
  });

  it('should hydrate from workspace when hydrateKey changes', () => {
    const { result, rerender } = renderHook(
      ({ hydrateKey, workspace }) =>
        useAnnotationManager({ hydrateKey, workspace }),
      { initialProps: { hydrateKey: null, workspace: undefined } }
    );

    expect(result.current.userSpans).toEqual([]);

    // Trigger hydration
    // @ts-expect-error - Test requires non-null values, types are correct at runtime
    rerender({ hydrateKey: 'ws-1', workspace: mockWorkspace });

    expect(result.current.userSpans).toEqual(mockWorkspace.userSpans);
    expect(result.current.apiSpans).toEqual(mockWorkspace.apiSpans);
  });

  it('should load original tab spans when activeTab is "original"', () => {
    const { result } = renderHook(() =>
      useAnnotationManager({
        hydrateKey: 'ws-1',
        workspace: mockWorkspace,
        activeTab: 'original',
      })
    );

    expect(result.current.userSpans).toEqual(mockWorkspace.userSpans);
    expect(result.current.apiSpans).toEqual(mockWorkspace.apiSpans);
  });

  it('should load translation tab spans when activeTab is language code', () => {
    const workspaceWithTranslation: Workspace = {
      ...mockWorkspace,
      translations: [
        {
          language: 'ces',
          text: 'Translation text',
          sourceLang: 'en',
          userSpans: [mockNerSpan2],
          apiSpans: [],
          deletedApiKeys: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };

    const { result } = renderHook(() =>
      useAnnotationManager({
        hydrateKey: 'ws-1',
        workspace: workspaceWithTranslation,
        activeTab: 'ces',
      })
    );

    // Should load translation spans, not original spans
    expect(result.current.userSpans).toEqual([mockNerSpan2]);
    expect(result.current.apiSpans).toEqual([]);
  });

  it('should call onNotice when runNer is called with empty text', async () => {
    const mockOnNotice = vi.fn();
    const { result } = renderHook(() =>
      useAnnotationManager({ onNotice: mockOnNotice })
    );

    await act(async () => {
      await result.current.runNer('', 'ws-1');
    });

    expect(mockOnNotice).toHaveBeenCalledWith('Paste some text before running NER.');
  });

  it('should call NER API and update apiSpans on success', async () => {
    const mockOnNotice = vi.fn();
    const mockApiResponse = {
      result: [
        { start: 0, end: 5, type: 'PERSON' },
        { start: 10, end: 15, type: 'LOCATION' },
      ],
    };

    apiServiceStub.ner.mockResolvedValue(
      mockApiResponse.result?.map((span) => ({
        start: span.start,
        end: span.end,
        entity: span.type,
        score: 1,
      })) ?? []
    );

    const { result } = renderHook(() =>
      useAnnotationManager({ onNotice: mockOnNotice })
    );

    await act(async () => {
      await result.current.runNer('Test text with entities', 'ws-1');
    });

    await waitFor(() => {
      // Should update apiSpans
      expect(result.current.apiSpans).toHaveLength(2);
      expect(result.current.apiSpans[0]).toMatchObject({
        start: 0,
        end: 5,
        entity: 'PERSON',
      });
    });

    expect(mockOnNotice).toHaveBeenCalledWith('NER completed.');
  });

  it('should clear deletedApiKeys when running new NER', async () => {
    const mockApiResponse = {
      result: [{ start: 0, end: 5, type: 'PERSON' }],
    };

    apiServiceStub.ner.mockResolvedValue(
      mockApiResponse.result?.map((span) => ({
        start: span.start,
        end: span.end,
        entity: span.type,
        score: 1,
      })) ?? []
    );

    const { result } = renderHook(() =>
      useAnnotationManager({
        initialDeletedKeys: ['0:5:PERSON', '10:15:LOCATION'],
      })
    );

    expect(result.current.deletedApiKeys.size).toBe(2);

    await act(async () => {
      await result.current.runNer('New text', 'ws-1');
    });

    await waitFor(() => {
      // Should clear deleted keys when running new NER
      expect(result.current.deletedApiKeys.size).toBe(0);
    });
  });

  it('should call onNotice with error message when NER fails', async () => {
    const mockOnNotice = vi.fn();

    apiServiceStub.ner.mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() =>
      useAnnotationManager({ onNotice: mockOnNotice })
    );

    await act(async () => {
      await result.current.runNer('Test text', 'ws-1');
    });

    await waitFor(() => {
      expect(mockOnNotice).toHaveBeenCalled();
      expect(mockOnNotice.mock.calls[0]?.[1]).toMatchObject({ tone: 'error' });
    });
  });

  it('should update workspace when runNer succeeds with setWorkspaces provided', async () => {
    const mockSetWorkspaces = vi.fn();
    const mockApiResponse = {
      result: [{ start: 0, end: 5, type: 'PERSON' }],
    };

    apiServiceStub.ner.mockResolvedValue(
      mockApiResponse.result?.map((span) => ({
        start: span.start,
        end: span.end,
        entity: span.type,
        score: 1,
      })) ?? []
    );

    const { result } = renderHook(() =>
      useAnnotationManager({
        workspace: mockWorkspace,
        setWorkspaces: mockSetWorkspaces,
        activeTab: 'original',
      })
    );

    await act(async () => {
      await result.current.runNer('Test text', 'ws-1');
    });

    await waitFor(() => {
      expect(mockSetWorkspaces).toHaveBeenCalled();
    });
  });

  it('should handle missing translation gracefully', () => {
    const { result } = renderHook(() =>
      useAnnotationManager({
        hydrateKey: 'ws-1',
        workspace: mockWorkspace,
        activeTab: 'nonexistent-language',
      })
    );

    // Should fallback to empty arrays
    expect(result.current.userSpans).toEqual([]);
    expect(result.current.apiSpans).toEqual([]);
  });

  it('should expose setters for external control', () => {
    const { result } = renderHook(() => useAnnotationManager());

    expect(typeof result.current.setUserSpans).toBe('function');
    expect(typeof result.current.setApiSpans).toBe('function');
    expect(typeof result.current.setDeletedApiKeys).toBe('function');

    // Test that setters work
    act(() => {
      result.current.setUserSpans([mockNerSpan1]);
    });

    expect(result.current.userSpans).toEqual([mockNerSpan1]);
  });

  it('should deduplicate spans with same position and entity', () => {
    const duplicateSpan: NerSpan = { ...mockNerSpan1 };
    
    const { result } = renderHook(() =>
      useAnnotationManager({
        initialUserSpans: [mockNerSpan1],
      })
    );

    act(() => {
      result.current.addSpan(duplicateSpan);
    });

    // Should not add duplicate
    expect(result.current.userSpans).toHaveLength(1);
  });
});

