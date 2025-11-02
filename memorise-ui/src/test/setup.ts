// Test setup file for Vitest
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Suppress expected console.error messages during error handling tests
// These are intentional errors that are tested to ensure proper error handling
const originalError = console.error;
beforeAll(() => {
  console.error = vi.fn((...args) => {
    // Only suppress known error messages from error handling tests
    const message = args[0]?.toString() || '';
    if (
      message.includes('Translation failed:') ||
      message.includes('Translation update failed:') ||
      message.includes('NER failed:')
    ) {
      // Suppress expected error logs during tests
      return;
    }
    // Let other errors through for debugging
    originalError.call(console, ...args);
  });
});

afterAll(() => {
  console.error = originalError;
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

