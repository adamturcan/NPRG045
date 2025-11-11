// src/hooks/__tests__/useTranslationManager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTranslationManager } from '../useTranslationManager';
import type { Workspace } from '../../types/Workspace';
import type { NerSpan } from '../../types/NotationEditor';
import {
  setApiProviderOverrides,
  resetApiProvider,
} from '../../infrastructure/providers/apiProvider';
import type { ApiService } from '../../core/interfaces/services/ApiService';

const createApiServiceStub = () => {
  const stub = {
    classify: vi.fn<ApiService['classify']>(),
    ner: vi.fn<ApiService['ner']>(),
    translate: vi.fn<ApiService['translate']>(),
    getSupportedLanguages: vi.fn<ApiService['getSupportedLanguages']>(),
  };
  return stub as ApiService & typeof stub;
};

let apiServiceStub = createApiServiceStub();

describe('useTranslationManager', () => {
  const mockGetCurrentText = vi.fn(() => 'Current text');
  const mockSetText = vi.fn();
  const mockSetEditorInstanceKey = vi.fn();
  const mockSetWorkspaces = vi.fn();
  const mockOnNotice = vi.fn();

  const mockAnnotationsRef = {
    current: {
      userSpans: [] as NerSpan[],
      apiSpans: [] as NerSpan[],
      deletedApiKeys: new Set<string>(),
    },
  };

  const mockWorkspace: Workspace = {
    id: 'ws-1',
    name: 'Test Workspace',
    owner: 'user-1',
    text: 'Original text',
    tags: [],
    updatedAt: Date.now(),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    apiServiceStub = createApiServiceStub();
    apiServiceStub.getSupportedLanguages.mockResolvedValue(['en', 'cs', 'da']);
    apiServiceStub.translate.mockResolvedValue({
      translatedText: 'Translated text',
      targetLang: 'cs',
    });

    setApiProviderOverrides({ apiService: apiServiceStub });

    mockGetCurrentText.mockReturnValue('Current text');
    mockSetText.mockReset();
    mockSetEditorInstanceKey.mockReset();
    mockSetWorkspaces.mockReset();
    mockOnNotice.mockReset();
  });

  afterEach(() => {
    resetApiProvider();
  });

  const defaultOptions = {
    workspaceId: 'ws-1',
    workspace: mockWorkspace,
    getCurrentText: mockGetCurrentText,
    annotationsRef: mockAnnotationsRef as React.MutableRefObject<{
      userSpans: NerSpan[];
      apiSpans: NerSpan[];
      deletedApiKeys: Set<string>;
    } | null>,
    setText: mockSetText,
    setEditorInstanceKey: mockSetEditorInstanceKey,
    setWorkspaces: mockSetWorkspaces,
    onNotice: mockOnNotice,
  };

  it('should initialize with activeTab as "original"', () => {
    const { result } = renderHook(() =>
      useTranslationManager(defaultOptions)
    );

    expect(result.current.activeTab).toBe('original');
    expect(result.current.translationLanguages).toEqual([]);
  });

  it('should compute translationLanguages from workspace', () => {
    const workspaceWithTranslations: Workspace = {
      ...mockWorkspace,
      translations: [
        {
          language: 'cs',
          text: 'Czech text',
          sourceLang: 'en',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          language: 'da',
          text: 'Danish text',
          sourceLang: 'en',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };

    const { result } = renderHook(() =>
      useTranslationManager({
        ...defaultOptions,
        workspace: workspaceWithTranslations,
      })
    );

    expect(result.current.translationLanguages).toEqual(['cs', 'da']);
  });

  it('should deduplicate translation languages', () => {
    const workspaceWithDuplicates: Workspace = {
      ...mockWorkspace,
      translations: [
        {
          language: 'cs',
          text: 'Text 1',
          sourceLang: 'en',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          language: 'cs',
          text: 'Text 2',
          sourceLang: 'en',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };

    const { result } = renderHook(() =>
      useTranslationManager({
        ...defaultOptions,
        workspace: workspaceWithDuplicates,
      })
    );

    expect(result.current.translationLanguages).toEqual(['cs']);
  });

  it('should open and close menu', () => {
    const { result } = renderHook(() =>
      useTranslationManager(defaultOptions)
    );

    expect(result.current.menuAnchor).toBeNull();

    act(() => {
      result.current.openMenu({ currentTarget: document.createElement('div') } as any);
    });

    expect(result.current.menuAnchor).toBeTruthy();

    act(() => {
      result.current.closeMenu();
    });

    expect(result.current.menuAnchor).toBeNull();
  });

  it('should switch tabs and save current content', () => {
    const workspaceWithTranslation: Workspace = {
      ...mockWorkspace,
      translations: [
        {
          language: 'cs',
          text: 'Czech text',
          sourceLang: 'en',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };

    const { result } = renderHook(() =>
      useTranslationManager({
        ...defaultOptions,
        workspace: workspaceWithTranslation,
      })
    );

    act(() => {
      result.current.onTabSwitch('cs');
    });

    expect(result.current.activeTab).toBe('cs');
    expect(mockSetWorkspaces).toHaveBeenCalled();
    expect(mockSetText).toHaveBeenCalledWith('Czech text');
  });

  it('should not switch if already on same tab', () => {
    const { result } = renderHook(() =>
      useTranslationManager(defaultOptions)
    );

    act(() => {
      result.current.onTabSwitch('original');
    });

    // Should not call setWorkspaces since already on original tab
    expect(mockSetWorkspaces).not.toHaveBeenCalled();
  });

  it('should add new translation', async () => {
    const { result } = renderHook(() =>
      useTranslationManager(defaultOptions)
    );

    await act(async () => {
      await result.current.onAddTranslation('cs');
    });

    await waitFor(() => {
      expect(apiServiceStub.translate).toHaveBeenCalled();
      expect(mockSetWorkspaces).toHaveBeenCalled();
      expect(result.current.activeTab).toBe('cs');
      expect(mockSetText).toHaveBeenCalledWith('Translated text');
    });
  });

  it('should not add translation if text is empty', async () => {
    const workspaceWithEmptyText: Workspace = {
      ...mockWorkspace,
      text: '',
    };

    const { result } = renderHook(() =>
      useTranslationManager({
        ...defaultOptions,
        workspace: workspaceWithEmptyText,
      })
    );

    await act(async () => {
      await result.current.onAddTranslation('cs');
    });

    expect(apiServiceStub.translate).not.toHaveBeenCalled();
    expect(mockOnNotice).toHaveBeenCalledWith('Add some text before creating translation.', { tone: 'warning' });
  });

  it('should not add duplicate translation', async () => {
    const workspaceWithTranslation: Workspace = {
      ...mockWorkspace,
      translations: [
        {
          language: 'cs',
          text: 'Existing',
          sourceLang: 'en',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };

    const { result } = renderHook(() =>
      useTranslationManager({
        ...defaultOptions,
        workspace: workspaceWithTranslation,
      })
    );

    await act(async () => {
      await result.current.onAddTranslation('cs');
    });

    expect(apiServiceStub.translate).not.toHaveBeenCalled();
    expect(mockOnNotice).toHaveBeenCalledWith('Translation to cs already exists. Use update instead.', { tone: 'warning' });
  });

  it('should handle translation error', async () => {
    apiServiceStub.translate.mockRejectedValue(new Error('Translation failed'));

    const { result } = renderHook(() =>
      useTranslationManager(defaultOptions)
    );

    await act(async () => {
      await result.current.onAddTranslation('cs');
    });

    await waitFor(() => {
      expect(mockOnNotice).toHaveBeenCalled();
      const hadErrorNotice = mockOnNotice.mock.calls.some(
        (call) => call[1]?.tone === 'error'
      );
      expect(hadErrorNotice).toBe(true);
    });
  });

  it('should update existing translation', async () => {
    const workspaceWithTranslation: Workspace = {
      ...mockWorkspace,
      translations: [
        {
          language: 'cs',
          text: 'Old translation',
          sourceLang: 'en',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };

    apiServiceStub.translate.mockResolvedValue({
      translatedText: 'New translation',
      targetLang: 'cs',
    });

    const { result } = renderHook(() =>
      useTranslationManager({
        ...defaultOptions,
        workspace: workspaceWithTranslation,
      })
    );

    await act(async () => {
      await result.current.onUpdateTranslation('cs');
    });

    await waitFor(() => {
      expect(apiServiceStub.translate).toHaveBeenCalled();
      expect(mockSetWorkspaces).toHaveBeenCalled();
      expect(mockOnNotice).toHaveBeenCalledWith('Translation "cs" updated!', { tone: 'success' });
    });
  });

  it('should update editor when updating active translation tab', async () => {
    const workspaceWithTranslation: Workspace = {
      ...mockWorkspace,
      translations: [
        {
          language: 'cs',
          text: 'Old',
          sourceLang: 'en',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };

    apiServiceStub.translate.mockResolvedValue({
      translatedText: 'New',
      targetLang: 'cs',
    });

    // First switch to cs tab
    const { result } = renderHook(() =>
      useTranslationManager({
        ...defaultOptions,
        workspace: workspaceWithTranslation,
      })
    );

    act(() => {
      result.current.onTabSwitch('cs');
    });

    await waitFor(() => {
      expect(result.current.activeTab).toBe('cs');
    });

    // Now update the translation
    await act(async () => {
      await result.current.onUpdateTranslation('cs');
    });

    await waitFor(() => {
      // Should update editor since we're on that tab
      expect(mockSetText).toHaveBeenCalledWith('New');
      expect(mockSetEditorInstanceKey).toHaveBeenCalled();
    });
  });

  it('should delete translation', () => {
    const workspaceWithTranslation: Workspace = {
      ...mockWorkspace,
      translations: [
        {
          language: 'cs',
          text: 'Czech text',
          sourceLang: 'en',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };

    const { result, rerender } = renderHook(
      ({ workspace }) =>
        useTranslationManager({
          ...defaultOptions,
          workspace,
        }),
      { initialProps: { workspace: workspaceWithTranslation } }
    );

    expect(result.current.translationLanguages).toContain('cs');

    // Capture the updated workspace from setWorkspaces call
    let updatedWorkspace: Workspace | undefined;
    mockSetWorkspaces.mockImplementation((updater) => {
      if (typeof updater === 'function') {
        const updated = updater([workspaceWithTranslation]);
        updatedWorkspace = updated[0];
        return updated;
      }
    });

    act(() => {
      result.current.onDeleteTranslation('cs');
    });

    expect(mockSetWorkspaces).toHaveBeenCalled();
    expect(mockOnNotice).toHaveBeenCalledWith('Translation "cs" deleted.');

    // Rerender with updated workspace (simulating state update)
    if (updatedWorkspace) {
      rerender({ workspace: updatedWorkspace });
      expect(result.current.translationLanguages).not.toContain('cs');
    }
  });

  it('should switch to original when deleting active translation tab', () => {
    const workspaceWithTranslation: Workspace = {
      ...mockWorkspace,
      translations: [
        {
          language: 'cs',
          text: 'Czech text',
          sourceLang: 'en',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };

    const { result } = renderHook(() =>
      useTranslationManager({
        ...defaultOptions,
        workspace: workspaceWithTranslation,
      })
    );

    // Switch to cs tab
    act(() => {
      result.current.onTabSwitch('cs');
    });

    expect(result.current.activeTab).toBe('cs');

    // Delete cs translation
    act(() => {
      result.current.onDeleteTranslation('cs');
    });

    expect(result.current.activeTab).toBe('original');
    expect(mockSetText).toHaveBeenCalledWith('Original text');
  });

  it('should save NER spans when switching tabs', () => {
    const mockSpans: NerSpan[] = [
      { start: 0, end: 5, entity: 'PERSON', score: 0.9 },
    ];

    mockAnnotationsRef.current = {
      userSpans: mockSpans,
      apiSpans: [],
      deletedApiKeys: new Set(),
    };

    const workspaceWithTranslation: Workspace = {
      ...mockWorkspace,
      translations: [
        {
          language: 'cs',
          text: 'Czech text',
          sourceLang: 'en',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };

    const { result } = renderHook(() =>
      useTranslationManager({
        ...defaultOptions,
        workspace: workspaceWithTranslation,
        annotationsRef: mockAnnotationsRef as any,
      })
    );

    act(() => {
      result.current.onTabSwitch('cs');
    });

    // Verify that setWorkspaces was called with spans saved
    expect(mockSetWorkspaces).toHaveBeenCalled();
    const updaterFn = mockSetWorkspaces.mock.calls[0][0];
    if (typeof updaterFn === 'function') {
      const updatedWorkspaces = updaterFn([workspaceWithTranslation]);
      // Should have saved userSpans
      expect(updatedWorkspaces[0].userSpans).toEqual(mockSpans);
    }
  });

  it('should expose setActiveTab for external control', () => {
    const { result } = renderHook(() =>
      useTranslationManager(defaultOptions)
    );

    expect(typeof result.current.setActiveTab).toBe('function');

    act(() => {
      result.current.setActiveTab('cs');
    });

    expect(result.current.activeTab).toBe('cs');
  });
});

