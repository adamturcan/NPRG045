// src/hooks/__tests__/useWorkspaceState.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkspaceState } from '../useWorkspaceState';
import type { Workspace } from '../../types/Workspace';

// Mock workspace data
const mockWorkspaces: Workspace[] = [
  {
    id: 'ws-1',
    name: 'Workspace 1',
    owner: 'test-user',
    text: 'Content 1',
    tags: [],
    userSpans: [],
    apiSpans: [],
    updatedAt: Date.now(),
  },
  {
    id: 'ws-2',
    name: 'Workspace 2',
    owner: 'test-user',
    text: 'Content 2',
    tags: [],
    userSpans: [],
    apiSpans: [],
    updatedAt: Date.now(),
  },
  {
    id: 'ws-3',
    name: 'Workspace 3',
    owner: 'test-user',
    text: 'Content 3',
    tags: [],
    userSpans: [],
    apiSpans: [],
    updatedAt: Date.now(),
  },
];

describe('useWorkspaceState', () => {
  it('should return the workspace matching routeId', () => {
    const { result } = renderHook(() => 
      useWorkspaceState(mockWorkspaces, 'ws-2')
    );
    
    expect(result.current.currentWorkspace).toBe(mockWorkspaces[1]);
    expect(result.current.currentId).toBe('ws-2');
    expect(result.current.isLoading).toBe(false);
  });

  it('should fallback to first workspace when routeId does not match', () => {
    const { result } = renderHook(() => 
      useWorkspaceState(mockWorkspaces, 'non-existent-id')
    );
    
    expect(result.current.currentWorkspace).toBe(mockWorkspaces[0]);
    expect(result.current.currentId).toBe('ws-1');
    expect(result.current.isLoading).toBe(false);
  });

  it('should fallback to first workspace when routeId is undefined', () => {
    const { result } = renderHook(() => 
      useWorkspaceState(mockWorkspaces, undefined)
    );
    
    expect(result.current.currentWorkspace).toBe(mockWorkspaces[0]);
    expect(result.current.currentId).toBe('ws-1');
    expect(result.current.isLoading).toBe(true); // No routeId = loading
  });

  it('should handle empty workspaces array', () => {
    const { result } = renderHook(() => 
      useWorkspaceState([], 'ws-1')
    );
    
    expect(result.current.currentWorkspace).toBeUndefined();
    expect(result.current.currentId).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('should handle empty workspaces array with no routeId', () => {
    const { result } = renderHook(() => 
      useWorkspaceState([], undefined)
    );
    
    expect(result.current.currentWorkspace).toBeUndefined();
    expect(result.current.currentId).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('should update when workspaces change', () => {
    const { result, rerender } = renderHook(
      ({ workspaces, routeId }) => useWorkspaceState(workspaces, routeId),
      { initialProps: { workspaces: mockWorkspaces, routeId: 'ws-1' } }
    );
    
    expect(result.current.currentId).toBe('ws-1');
    
    // Update to different workspace
    rerender({ workspaces: mockWorkspaces, routeId: 'ws-3' });
    
    expect(result.current.currentId).toBe('ws-3');
    expect(result.current.currentWorkspace).toBe(mockWorkspaces[2]);
  });

  it('should update when workspaces array changes', () => {
    const { result, rerender } = renderHook(
      ({ workspaces, routeId }) => useWorkspaceState(workspaces, routeId),
      { initialProps: { workspaces: mockWorkspaces.slice(0, 1), routeId: 'ws-1' } }
    );
    
    expect(result.current.currentWorkspace).toBe(mockWorkspaces[0]);
    
    // Add more workspaces
    rerender({ workspaces: mockWorkspaces, routeId: 'ws-2' });
    
    expect(result.current.currentId).toBe('ws-2');
    expect(result.current.currentWorkspace).toBe(mockWorkspaces[1]);
  });

  it('should set isLoading to false when routeId exists and workspaces is not empty', () => {
    const { result } = renderHook(() => 
      useWorkspaceState(mockWorkspaces, 'ws-1')
    );
    
    expect(result.current.isLoading).toBe(false);
  });

  it('should set isLoading to true when routeId is missing', () => {
    const { result } = renderHook(() => 
      useWorkspaceState(mockWorkspaces, undefined)
    );
    
    expect(result.current.isLoading).toBe(true);
  });

  it('should set isLoading to true when workspaces array is empty', () => {
    const { result } = renderHook(() => 
      useWorkspaceState([], 'ws-1')
    );
    
    expect(result.current.isLoading).toBe(true);
  });

  it('should memoize result based on workspaces and routeId', () => {
    const { result, rerender } = renderHook(
      ({ workspaces, routeId }) => useWorkspaceState(workspaces, routeId),
      { initialProps: { workspaces: mockWorkspaces, routeId: 'ws-1' } }
    );
    
    const firstWorkspace = result.current.currentWorkspace;
    
    // Rerender with same props
    rerender({ workspaces: mockWorkspaces, routeId: 'ws-1' });
    
    // Should return same workspace object (memoized)
    expect(result.current.currentWorkspace).toBe(firstWorkspace);
  });
});

