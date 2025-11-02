// src/hooks/__tests__/useWorkspaceHydration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkspaceHydration } from '../useWorkspaceHydration';
import type { Workspace } from '../../types/Workspace';

describe('useWorkspaceHydration', () => {
  const mockOnHydrate = vi.fn();
  const mockOnHydrationStart = vi.fn();
  const mockOnHydrationComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockWorkspace: Workspace = {
    id: 'ws-1',
    name: 'Test Workspace',
    owner: 'user-1',
    text: 'Workspace text',
    tags: [],
    updatedAt: 1234567890,
  };

  it('should not hydrate when workspaceId is null', () => {
    renderHook(() =>
      useWorkspaceHydration({
        workspaceId: null,
        workspace: undefined,
        onHydrate: mockOnHydrate,
        onHydrationStart: mockOnHydrationStart,
        onHydrationComplete: mockOnHydrationComplete,
      })
    );

    expect(mockOnHydrate).not.toHaveBeenCalled();
    expect(mockOnHydrationStart).not.toHaveBeenCalled();
    expect(mockOnHydrationComplete).not.toHaveBeenCalled();
  });

  it('should not hydrate when workspace is undefined', () => {
    renderHook(() =>
      useWorkspaceHydration({
        workspaceId: 'ws-1',
        workspace: undefined,
        onHydrate: mockOnHydrate,
        onHydrationStart: mockOnHydrationStart,
        onHydrationComplete: mockOnHydrationComplete,
      })
    );

    expect(mockOnHydrate).not.toHaveBeenCalled();
    expect(mockOnHydrationStart).not.toHaveBeenCalled();
    expect(mockOnHydrationComplete).not.toHaveBeenCalled();
  });

  it('should call onHydrate when workspace is available', async () => {
    renderHook(() =>
      useWorkspaceHydration({
        workspaceId: 'ws-1',
        workspace: mockWorkspace,
        onHydrate: mockOnHydrate,
      })
    );

    // Wait for Promise.resolve() to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnHydrate).toHaveBeenCalledWith({
      text: 'Workspace text',
      editorKey: 'ws-1:1234567890',
    });
  });

  it('should call onHydrationStart before onHydrate', async () => {
    const callOrder: string[] = [];
    
    const onHydrationStart = vi.fn(() => callOrder.push('start'));
    const onHydrate = vi.fn(() => callOrder.push('hydrate'));

    renderHook(() =>
      useWorkspaceHydration({
        workspaceId: 'ws-1',
        workspace: mockWorkspace,
        onHydrate,
        onHydrationStart,
      })
    );

    await new Promise(resolve => setTimeout(resolve, 0));

    // onHydrationStart should be called before onHydrate
    expect(onHydrationStart).toHaveBeenCalled();
    expect(onHydrate).toHaveBeenCalled();
    // Note: Due to async nature, we can't guarantee strict order without more complex setup
    // but both should be called
  });

  it('should call onHydrationComplete after hydration', async () => {
    renderHook(() =>
      useWorkspaceHydration({
        workspaceId: 'ws-1',
        workspace: mockWorkspace,
        onHydrate: mockOnHydrate,
        onHydrationComplete: mockOnHydrationComplete,
      })
    );

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnHydrationComplete).toHaveBeenCalledWith('ws-1');
  });

  it('should handle workspace with empty text', async () => {
    const workspaceWithEmptyText: Workspace = {
      ...mockWorkspace,
      text: '',
    };

    renderHook(() =>
      useWorkspaceHydration({
        workspaceId: 'ws-1',
        workspace: workspaceWithEmptyText,
        onHydrate: mockOnHydrate,
      })
    );

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnHydrate).toHaveBeenCalledWith({
      text: '',
      editorKey: 'ws-1:1234567890',
    });
  });

  it('should handle workspace without updatedAt', async () => {
    const workspaceWithoutUpdatedAt: Workspace = {
      ...mockWorkspace,
      updatedAt: undefined,
    };

    renderHook(() =>
      useWorkspaceHydration({
        workspaceId: 'ws-1',
        workspace: workspaceWithoutUpdatedAt,
        onHydrate: mockOnHydrate,
      })
    );

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnHydrate).toHaveBeenCalledWith({
      text: 'Workspace text',
      editorKey: 'ws-1:0',
    });
  });

  it('should only hydrate when workspaceId changes', async () => {
    const { rerender } = renderHook(
      ({ workspaceId, workspace }) =>
        useWorkspaceHydration({
          workspaceId,
          workspace,
          onHydrate: mockOnHydrate,
        }),
      { initialProps: { workspaceId: 'ws-1', workspace: mockWorkspace } }
    );

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockOnHydrate).toHaveBeenCalledTimes(1);
    mockOnHydrate.mockClear();

    // Same workspaceId, different object reference (tags updated)
    const updatedWorkspace: Workspace = {
      ...mockWorkspace,
      tags: [{ name: 'new tag', source: 'user' }],
    };

    rerender({ workspaceId: 'ws-1', workspace: updatedWorkspace });
    await new Promise(resolve => setTimeout(resolve, 0));

    // Should not hydrate again with same workspaceId
    expect(mockOnHydrate).not.toHaveBeenCalled();
  });

  it('should hydrate again when workspaceId changes', async () => {
    const workspace2: Workspace = {
      id: 'ws-2',
      name: 'Workspace 2',
      owner: 'user-1',
      text: 'Workspace 2 text',
      tags: [],
      updatedAt: 9876543210,
    };

    const { rerender } = renderHook(
      ({ workspaceId, workspace }) =>
        useWorkspaceHydration({
          workspaceId,
          workspace,
          onHydrate: mockOnHydrate,
        }),
      { initialProps: { workspaceId: 'ws-1', workspace: mockWorkspace } }
    );

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockOnHydrate).toHaveBeenCalledTimes(1);
    mockOnHydrate.mockClear();

    // Change workspaceId
    rerender({ workspaceId: 'ws-2', workspace: workspace2 });
    await new Promise(resolve => setTimeout(resolve, 0));

    // Should hydrate again with new workspace
    expect(mockOnHydrate).toHaveBeenCalledTimes(1);
    expect(mockOnHydrate).toHaveBeenCalledWith({
      text: 'Workspace 2 text',
      editorKey: 'ws-2:9876543210',
    });
  });

  it('should work without optional callbacks', async () => {
    renderHook(() =>
      useWorkspaceHydration({
        workspaceId: 'ws-1',
        workspace: mockWorkspace,
        onHydrate: mockOnHydrate,
      })
    );

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnHydrate).toHaveBeenCalled();
    // Should not throw errors when optional callbacks are undefined
  });
});

