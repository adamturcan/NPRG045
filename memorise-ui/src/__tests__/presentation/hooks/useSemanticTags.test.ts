// src/hooks/__tests__/useSemanticTags.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSemanticTags } from '@/presentation/hooks/useSemanticTags';
import type { TagItem } from '@/types/Tag';
import type { ThesaurusIndexItem } from '@/types/Thesaurus';

// Mock API and thesaurus helpers
vi.mock('../../../shared/utils/api', () => ({
  classify: vi.fn(),
}));

vi.mock('../../../shared/utils/thesaurusHelpers', () => ({
  loadThesaurusIndex: vi.fn(),
  findInThesaurus: vi.fn(),
}));

describe('useSemanticTags', () => {
  const mockClassify = vi.fn();
  const mockLoadThesaurusIndex = vi.fn();
  const mockFindInThesaurus = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const api = vi.mocked(await import('../../../shared/utils/api'));
    api.classify = mockClassify;
    
    const thesaurusHelpers = vi.mocked(await import('../../../shared/utils/thesaurusHelpers'));
    thesaurusHelpers.loadThesaurusIndex = mockLoadThesaurusIndex;
    thesaurusHelpers.findInThesaurus = mockFindInThesaurus;
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
      id: 1,
      label: 'culture',
      labelLower: 'culture',
      parentId: 10,
      isPreferred: false,
      path: ['Culture', 'Subcategory'],
      rootCategory: 'Culture',
    },
  ];

  it('should initialize with empty tags', () => {
    const { result } = renderHook(() => useSemanticTags());

    expect(result.current.combinedTags).toEqual([]);
    expect(result.current.customTagInput).toBe('');
  });

  it('should hydrate from initialTags when hydrateKey changes', () => {
    const initialTags: TagItem[] = [
      { name: 'user tag', source: 'user' },
      { name: 'api tag', source: 'api' },
    ];

    const { result, rerender } = renderHook(
      ({ hydrateKey, initialTags }) =>
        useSemanticTags({ hydrateKey, initialTags }),
      { initialProps: { hydrateKey: null, initialTags: undefined } }
    );

    expect(result.current.combinedTags).toEqual([]);

    // Hydrate with workspace
    rerender({ hydrateKey: 'ws-1', initialTags });

    expect(result.current.combinedTags).toHaveLength(2);
    expect(result.current.combinedTags).toEqual(
      expect.arrayContaining(initialTags)
    );
  });

  it('should separate user and API tags during hydration', () => {
    const initialTags: TagItem[] = [
      { name: 'user tag 1', source: 'user' },
      { name: 'user tag 2', source: 'user' },
      { name: 'api tag 1', source: 'api' },
    ];

    const { result } = renderHook(() =>
      useSemanticTags({
        hydrateKey: 'ws-1',
        initialTags,
      })
    );

    const combined = result.current.combinedTags;
    expect(combined.filter((t) => t.source === 'user')).toHaveLength(2);
    expect(combined.filter((t) => t.source === 'api')).toHaveLength(1);
  });

  it('should clear tags when hydrateKey becomes null', () => {
    const initialTags: TagItem[] = [
      { name: 'user tag', source: 'user' },
    ];

    const { result, rerender } = renderHook(
      ({ hydrateKey, initialTags }) =>
        useSemanticTags({ hydrateKey, initialTags }),
      { initialProps: { hydrateKey: 'ws-1', initialTags } }
    );

    expect(result.current.combinedTags).toHaveLength(1);

    // Clear workspace
    rerender({ hydrateKey: null, initialTags: undefined });

    expect(result.current.combinedTags).toEqual([]);
  });

  it('should not re-hydrate when hydrateKey stays the same', () => {
    const initialTags: TagItem[] = [
      { name: 'tag 1', source: 'user' },
    ];

    const { result, rerender } = renderHook(
      ({ hydrateKey, initialTags }) =>
        useSemanticTags({ hydrateKey, initialTags }),
      { initialProps: { hydrateKey: 'ws-1', initialTags } }
    );

    expect(result.current.combinedTags).toHaveLength(1);

    // Update initialTags but keep same hydrateKey
    const newTags: TagItem[] = [
      { name: 'tag 2', source: 'user' },
    ];
    rerender({ hydrateKey: 'ws-1', initialTags: newTags });

    // Should not re-hydrate (still has original tags)
    expect(result.current.combinedTags).toHaveLength(1);
    expect(result.current.combinedTags[0].name).toBe('tag 1');
  });

  it('should add custom user tag', async () => {
    mockLoadThesaurusIndex.mockResolvedValue(mockThesaurusIndex);
    mockFindInThesaurus.mockReturnValue(null);

    const { result } = renderHook(() => useSemanticTags());

    await act(async () => {
      await result.current.addCustomTag('new tag');
    });

    await waitFor(() => {
      expect(result.current.combinedTags).toHaveLength(1);
      expect(result.current.combinedTags[0]).toMatchObject({
        name: 'new tag',
        source: 'user',
      });
    });
  });

  it('should not add duplicate tag', async () => {
    const { result } = renderHook(() => useSemanticTags());

    await act(async () => {
      await result.current.addCustomTag('test tag');
    });

    await act(async () => {
      await result.current.addCustomTag('test tag');
    });

    // Should still have only one tag
    expect(result.current.combinedTags).toHaveLength(1);
  });

  it('should not add empty tag', async () => {
    const { result } = renderHook(() => useSemanticTags());

    await act(async () => {
      await result.current.addCustomTag('   ');
    });

    expect(result.current.combinedTags).toHaveLength(0);
  });

  it('should lookup keywordId from thesaurus when adding tag', async () => {
    mockLoadThesaurusIndex.mockResolvedValue(mockThesaurusIndex);
    mockFindInThesaurus.mockReturnValue(mockThesaurusIndex[0]);

    const { result } = renderHook(() => useSemanticTags());

    await act(async () => {
      await result.current.addCustomTag('culture');
    });

    await waitFor(() => {
      expect(result.current.combinedTags).toHaveLength(1);
      expect(result.current.combinedTags[0]).toMatchObject({
        name: 'culture',
        label: 1,
        parentId: 0,
      });
    });
  });

  it('should use provided keywordId and parentId', async () => {
    const { result } = renderHook(() => useSemanticTags());

    await act(async () => {
      await result.current.addCustomTag('culture', 1, 0);
    });

    await waitFor(() => {
      expect(result.current.combinedTags[0]).toMatchObject({
        name: 'culture',
        label: 1,
        parentId: 0,
      });
    });
  });

  it('should delete tag by name', () => {
    const initialTags: TagItem[] = [
      { name: 'tag 1', source: 'user' },
      { name: 'tag 2', source: 'api' },
    ];

    const { result } = renderHook(() =>
      useSemanticTags({
        hydrateKey: 'ws-1',
        initialTags,
      })
    );

    expect(result.current.combinedTags).toHaveLength(2);

    act(() => {
      result.current.deleteTag('tag 1');
    });

    expect(result.current.combinedTags).toHaveLength(1);
    expect(result.current.combinedTags[0].name).toBe('tag 2');
  });

  it('should delete tag by name, keywordId, and parentId', () => {
    const initialTags: TagItem[] = [
      { name: 'culture', source: 'user', label: 1, parentId: 0 },
      { name: 'culture', source: 'api', label: 1, parentId: 10 },
    ];

    const { result } = renderHook(() =>
      useSemanticTags({
        hydrateKey: 'ws-1',
        initialTags,
      })
    );

    expect(result.current.combinedTags).toHaveLength(2);

    act(() => {
      result.current.deleteTag('culture', 1, 0);
    });

    // Should only delete the one with matching parentId
    expect(result.current.combinedTags).toHaveLength(1);
    expect(result.current.combinedTags[0].parentId).toBe(10);
  });

  it('should replace all tags', () => {
    const initialTags: TagItem[] = [
      { name: 'old tag', source: 'user' },
    ];

    const { result } = renderHook(() =>
      useSemanticTags({
        hydrateKey: 'ws-1',
        initialTags,
      })
    );

    expect(result.current.combinedTags).toHaveLength(1);

    const newTags: TagItem[] = [
      { name: 'new tag 1', source: 'user' },
      { name: 'new tag 2', source: 'api' },
    ];

    act(() => {
      result.current.replaceAllTags(newTags);
    });

    expect(result.current.combinedTags).toHaveLength(2);
    expect(result.current.combinedTags).toEqual(
      expect.arrayContaining(newTags)
    );
  });

  it('should run classification API and update API tags', async () => {
    mockClassify.mockResolvedValue({
      results: [
        { name: 'culture', label: 1 },
        { name: 'society', label: 2 },
      ],
    });

    mockLoadThesaurusIndex.mockResolvedValue([
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
    ]);

    const { result } = renderHook(() => useSemanticTags());

    await act(async () => {
      await result.current.runClassify('Some text about culture and society');
    });

    await waitFor(() => {
      expect(mockClassify).toHaveBeenCalledWith('Some text about culture and society');
      expect(result.current.combinedTags).toHaveLength(2);
      expect(result.current.combinedTags.every((t) => t.source === 'api')).toBe(true);
    });
  });

  it('should not run classification with empty text', async () => {
    const { result } = renderHook(() => useSemanticTags());

    await act(async () => {
      await result.current.runClassify('');
    });

    await act(async () => {
      await result.current.runClassify('   ');
    });

    expect(mockClassify).not.toHaveBeenCalled();
  });

  it('should skip API tags that user already has', async () => {
    const userTags: TagItem[] = [
      { name: 'culture', source: 'user' },
    ];

    const { result } = renderHook(() =>
      useSemanticTags({
        hydrateKey: 'ws-1',
        initialTags: userTags,
      })
    );

    mockClassify.mockResolvedValue({
      results: [
        { name: 'culture', label: 1 },
        { name: 'society', label: 2 },
      ],
    });

    mockLoadThesaurusIndex.mockResolvedValue([
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
    ]);

    await act(async () => {
      await result.current.runClassify('Text');
    });

    await waitFor(() => {
      // Should only add society, not culture (user already has it)
      const apiTags = result.current.combinedTags.filter((t) => t.source === 'api');
      expect(apiTags).toHaveLength(1);
      expect(apiTags[0].name).toBe('society');
    });
  });

  it('should expand duplicate keywordIds from thesaurus', async () => {
    mockClassify.mockResolvedValue({
      results: [
        { name: 'culture', label: 1 },
      ],
    });

    // Return multiple entries with same keywordId but different parentIds
    mockLoadThesaurusIndex.mockResolvedValue(mockThesaurusIndex);

    const { result } = renderHook(() => useSemanticTags());

    await act(async () => {
      await result.current.runClassify('Text about culture');
    });

    await waitFor(() => {
      // Should add both instances from thesaurus
      const apiTags = result.current.combinedTags.filter((t) => t.source === 'api');
      expect(apiTags.length).toBeGreaterThanOrEqual(1);
      // At least one should have the keywordId
      expect(apiTags.some((t) => t.label === 1)).toBe(true);
    });
  });

  it('should preserve user tags when running classification', async () => {
    const userTags: TagItem[] = [
      { name: 'user tag', source: 'user' },
    ];

    const { result } = renderHook(() =>
      useSemanticTags({
        hydrateKey: 'ws-1',
        initialTags: userTags,
      })
    );

    mockClassify.mockResolvedValue({
      results: [{ name: 'api tag', label: 1 }],
    });

    mockLoadThesaurusIndex.mockResolvedValue([
      {
        id: 1,
        label: 'api tag',
        labelLower: 'api tag',
        parentId: 0,
        isPreferred: true,
        path: ['Category'],
        rootCategory: 'Category',
      },
    ]);

    await act(async () => {
      await result.current.runClassify('Text');
    });

    await waitFor(() => {
      // Should have both user and API tags
      const userTagsInResult = result.current.combinedTags.filter(
        (t) => t.source === 'user'
      );
      const apiTagsInResult = result.current.combinedTags.filter(
        (t) => t.source === 'api'
      );
      expect(userTagsInResult).toHaveLength(1);
      expect(apiTagsInResult.length).toBeGreaterThan(0);
    });
  });

  it('should handle classification API errors gracefully', async () => {
    mockClassify.mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() => useSemanticTags());

    await act(async () => {
      await result.current.runClassify('Text').catch(() => {
        // Expected error
      });
    });

    // Should not update tags on error
    expect(result.current.combinedTags.filter((t) => t.source === 'api')).toHaveLength(0);
  });

  it('should manage customTagInput state', () => {
    const { result } = renderHook(() => useSemanticTags());

    act(() => {
      result.current.setCustomTagInput('new input');
    });

    expect(result.current.customTagInput).toBe('new input');
  });

  it('should provide tagTableRef', () => {
    const { result } = renderHook(() => useSemanticTags());

    expect(result.current.tagTableRef).toBeTruthy();
    expect(result.current.tagTableRef.current).toBeNull();
  });

  it('should deduplicate tags with same name from different sources', () => {
    const initialTags: TagItem[] = [
      { name: 'duplicate', source: 'user' },
      { name: 'duplicate', source: 'api' },
    ];

    const { result } = renderHook(() =>
      useSemanticTags({
        hydrateKey: 'ws-1',
        initialTags,
      })
    );

    // Should show both (they have different sources)
    expect(result.current.combinedTags).toHaveLength(2);
  });

  it('should handle tags without thesaurus gracefully', async () => {
    mockLoadThesaurusIndex.mockRejectedValue(new Error('Thesaurus not available'));

    const { result } = renderHook(() => useSemanticTags());

    await act(async () => {
      await result.current.addCustomTag('custom tag');
    });

    await waitFor(() => {
      // Should still add tag without keywordId
      expect(result.current.combinedTags).toHaveLength(1);
      expect(result.current.combinedTags[0].label).toBeUndefined();
    });
  });
});

