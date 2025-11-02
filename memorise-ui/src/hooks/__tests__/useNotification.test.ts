// src/hooks/__tests__/useNotification.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotification } from '../useNotification';

describe('useNotification', () => {
  it('should initialize with null notice', () => {
    const { result } = renderHook(() => useNotification());
    
    expect(result.current.notice).toBeNull();
  });

  it('should show notification when showNotice is called', () => {
    const { result } = renderHook(() => useNotification());
    
    act(() => {
      result.current.showNotice('Test message');
    });
    
    expect(result.current.notice).toBe('Test message');
  });

  it('should clear notification when clearNotice is called', () => {
    const { result } = renderHook(() => useNotification());
    
    // First show a notice
    act(() => {
      result.current.showNotice('Test message');
    });
    expect(result.current.notice).toBe('Test message');
    
    // Then clear it
    act(() => {
      result.current.clearNotice();
    });
    expect(result.current.notice).toBeNull();
  });

  it('should replace notification when showNotice is called multiple times', () => {
    const { result } = renderHook(() => useNotification());
    
    act(() => {
      result.current.showNotice('First message');
    });
    expect(result.current.notice).toBe('First message');
    
    act(() => {
      result.current.showNotice('Second message');
    });
    expect(result.current.notice).toBe('Second message');
  });

  it('should handle empty strings', () => {
    const { result } = renderHook(() => useNotification());
    
    act(() => {
      result.current.showNotice('');
    });
    
    expect(result.current.notice).toBe('');
  });

  it('should maintain function references across renders', () => {
    const { result, rerender } = renderHook(() => useNotification());
    
    const showNoticeFn1 = result.current.showNotice;
    const clearNoticeFn1 = result.current.clearNotice;
    
    rerender();
    
    const showNoticeFn2 = result.current.showNotice;
    const clearNoticeFn2 = result.current.clearNotice;
    
    // Functions should be the same reference (useCallback)
    expect(showNoticeFn1).toBe(showNoticeFn2);
    expect(clearNoticeFn1).toBe(clearNoticeFn2);
  });
});

