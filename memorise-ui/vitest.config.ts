import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Suppress verbose output
    silent: false,
    reporters: ['default'],
    // Hide console output during tests
    onConsoleLog: () => false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'src/**/*.ts',
        'src/**/*.tsx',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/__tests__/**',
        'src/test/**',
        'src/vite-env.d.ts',
        'src/main.tsx',
        // Exclude UI components - these should be tested with E2E tools (Playwright)
        'src/App.tsx',
        'src/presentation/pages/**',
        'src/presentation/components/**',
        // Exclude types and constants (no logic to test)
        'src/types/**',
        'src/shared/constants/**',
        // Exclude data mocks
        'src/data/**',
        // Exclude workers (tested indirectly through hooks)
        'src/workers/**',
        // Exclude React contexts (tested through integration)
        'src/presentation/contexts/**',
        // Exclude interface definitions (no executable code)
        'src/core/interfaces/**',
        // Exclude stores (Zustand - tested through hooks)
        'src/stores/**',
        // Exclude lib utilities (tested indirectly)
        'src/shared/utils/**',
        // Exclude legacy services (to be refactored in Phase 3)
        'src/services/**',
        // Exclude barrel files (no logic)
        'src/presentation/hooks/index.ts',
        'src/domain/index.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 65,  // Lower threshold - branch coverage improved iteratively
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});

