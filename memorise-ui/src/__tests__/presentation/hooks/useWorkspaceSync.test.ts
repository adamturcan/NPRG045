// src/hooks/__tests__/useWorkspaceSync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkspaceSync } from '@/presentation/hooks/useWorkspaceSync';
import { useWorkspaceStore } from '@/presentation/stores/workspaceStore';
import type { Workspace } from '@/types/Workspace';

// Mock the workspace store
const mockStore = {
  workspaces: [] as Workspace[],
  updateWorkspace: vi.fn(),
  getState: vi.fn(),
};

vi.mock('@/presentation/stores/workspaceStore', () => ({
  useWorkspaceStore: vi.fn((selector) => {
    const state = {
      workspaces: mockStore.workspaces,
      updateWorkspace: mockStore.updateWorkspace,
    };
    return selector(state);
  }),
}));

describe('useWorkspaceSync', () => {
  const mockUpdateWorkspace = vi.fn();
  let mockWorkspaces: Workspace[];

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockWorkspaces = [
      {
        id: 'ws-1',
        name: 'Workspace 1',
        owner: 'user-1',
        text: 'Text 1',
        tags: [],
        updatedAt: Date.now(),
      },
      {
        id: 'ws-2',
        name: 'Workspace 2',
        owner: 'user-1',
        text: 'Text 2',
        tags: [],
        updatedAt: Date.now(),
      },
    ];

    // Update mock store state
    mockStore.workspaces = mockWorkspaces;
    mockStore.updateWorkspace = mockUpdateWorkspace;
    mockStore.getState = vi.fn(() => ({
      workspaces: mockWorkspaces,
      updateWorkspace: mockUpdateWorkspace,
    }));

    // Setup mock store hook
    (useWorkspaceStore as any).mockImplementation((selector: any) => {
      const state = {
        workspaces: mockStore.workspaces,
        updateWorkspace: mockStore.updateWorkspace,
      };
      return selector(state);
    });

    // Mock getState on the store object
    (useWorkspaceStore as any).getState = mockStore.getState;
  });

  it('should return a function that updates workspaces', () => {
    const { result } = renderHook(() => useWorkspaceSync());

    expect(typeof result.current).toBe('function');
  });

  it('should sync workspace updates to Zustand store', () => {
    const { result } = renderHook(() => useWorkspaceSync());

    const updatedWorkspace: Workspace = {
      id: 'ws-1',
      name: 'Updated Workspace 1',
      owner: 'user-1',
      text: 'Updated Text 1',
      tags: [],
      updatedAt: Date.now(),
    };

    act(() => {
      result.current([updatedWorkspace]);
    });

    expect(mockUpdateWorkspace).toHaveBeenCalledWith('ws-1', updatedWorkspace);
  });

  it('should handle function updater', () => {
    const { result } = renderHook(() => useWorkspaceSync());

    act(() => {
      result.current((prev) => {
        return prev.map((w) =>
          w.id === 'ws-1'
            ? { ...w, text: 'Modified Text 1', updatedAt: Date.now() }
            : w
        );
      });
    });

    // Should call updateWorkspace for the modified workspace
    expect(mockUpdateWorkspace).toHaveBeenCalled();
    const callArgs = mockUpdateWorkspace.mock.calls[0];
    expect(callArgs[0]).toBe('ws-1');
    expect(callArgs[1].text).toBe('Modified Text 1');
  });

  it('should only update changed workspaces', () => {
    const { result } = renderHook(() => useWorkspaceSync());

    // Update only one workspace
    act(() => {
      result.current((prev) => {
        return prev.map((w) =>
          w.id === 'ws-1'
            ? { ...w, text: 'New Text', updatedAt: Date.now() }
            : w
        );
      });
    });

    // Should only call updateWorkspace once for the changed workspace
    expect(mockUpdateWorkspace).toHaveBeenCalledTimes(1);
    expect(mockUpdateWorkspace).toHaveBeenCalledWith('ws-1', expect.objectContaining({
      text: 'New Text',
    }));
  });

  it('should update multiple workspaces if multiple changed', () => {
    const { result } = renderHook(() => useWorkspaceSync());

    act(() => {
      result.current((prev) => {
        return prev.map((w) => ({
          ...w,
          text: `Updated ${w.name}`,
          updatedAt: Date.now(),
        }));
      });
    });

    // Should call updateWorkspace for both workspaces
    expect(mockUpdateWorkspace).toHaveBeenCalledTimes(2);
    expect(mockUpdateWorkspace).toHaveBeenCalledWith('ws-1', expect.any(Object));
    expect(mockUpdateWorkspace).toHaveBeenCalledWith('ws-2', expect.any(Object));
  });

  it('should handle new workspaces', () => {
    const { result } = renderHook(() => useWorkspaceSync());

    const newWorkspace: Workspace = {
      id: 'ws-3',
      name: 'New Workspace',
      owner: 'user-1',
      text: 'New Text',
      tags: [],
      updatedAt: Date.now(),
    };

    act(() => {
      result.current([...mockWorkspaces, newWorkspace]);
    });

    // Should call updateWorkspace for the new workspace
    expect(mockUpdateWorkspace).toHaveBeenCalledWith('ws-3', newWorkspace);
  });

  it('should get fresh state from Zustand on each call', () => {
    const { result } = renderHook(() => useWorkspaceSync());

    // First update
    act(() => {
      result.current((prev) => {
        return prev.map((w) =>
          w.id === 'ws-1'
            ? { ...w, text: 'First Update', updatedAt: Date.now() }
            : w
        );
      });
    });

    mockUpdateWorkspace.mockClear();

    // Second update should use fresh state
    act(() => {
      result.current((prev) => {
        // Should see the original state, not the first update
        // (because we're mocking getState to return original mockWorkspaces)
        return prev.map((w) =>
          w.id === 'ws-1'
            ? { ...w, text: 'Second Update', updatedAt: Date.now() }
            : w
        );
      });
    });

    // Should still call updateWorkspace
    expect(mockUpdateWorkspace).toHaveBeenCalled();
  });

  it('should handle empty workspace array', () => {
    const { result } = renderHook(() => useWorkspaceSync());

    act(() => {
      result.current([]);
    });

    // Should not crash
    expect(mockUpdateWorkspace).not.toHaveBeenCalled();
  });

  it('should memoize the returned function', () => {
    const { result, rerender } = renderHook(() => useWorkspaceSync());

    const firstFn = result.current;
    rerender();
    const secondFn = result.current;

    // Function reference should be the same (memoized)
    expect(firstFn).toBe(secondFn);
  });
});

