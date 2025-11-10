// Test setup file for Vitest
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Suppress noisy console output during tests for cleaner output
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

beforeAll(() => {
  // Suppress console.error
  console.error = vi.fn((...args) => {
    const message = args[0]?.toString() || '';
    
    // Suppress React act() warnings (expected in async tests)
    if (message.includes('not wrapped in act')) return;
    
    // Suppress known error messages from tests
    if (message.includes('Translation failed:')) return;
    if (message.includes('Translation update failed:')) return;
    if (message.includes('NER failed:')) return;
    if (message.includes('[ErrorHandlingService]')) return;
    
    // Let other errors through for debugging
    originalError.call(console, ...args);
  });
  
  // Suppress console.warn
  console.warn = vi.fn((...args) => {
    const message = args[0]?.toString() || '';
    
    // Suppress React warnings
    if (message.includes('React')) return;
    
    // Let other warnings through
    originalWarn.call(console, ...args);
  });
  
  // Suppress console.log from application code
  console.log = vi.fn((...args) => {
    const message = args[0]?.toString() || '';
    
    // Suppress thesaurus worker messages
    if (message.includes('Thesaurus worker')) return;
    if (message.includes('✅') || message.includes('❌')) return;
    
    // Let test output through
    originalLog.call(console, ...args);
  });
});

afterAll(() => {
  // Restore original console methods
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

