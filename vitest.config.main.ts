import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest Configuration for Main Process Tests
 *
 * This configuration is used for testing Electron main process code including:
 * - IPC handlers
 * - Database services
 * - System integrations (terminal, git, file operations)
 *
 * Uses Node.js environment since main process code runs in Node.js, not browser.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Allow main process code to import from electron/ directory
      '@electron': path.resolve(__dirname, './electron'),
    },
  },

  test: {
    // Project name for workspace identification
    name: 'main',

    // Use Node.js environment for main process tests
    environment: 'node',

    // Include only main process tests (TypeScript source files only)
    include: ['electron/**/*.{test,spec}.ts'],

    // Exclude build artifacts and other directories
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/src/**',
      '**/e2e/**',
    ],

    // Setup file for Electron mocks
    setupFiles: ['./tests/setup/main.ts'],

    // Enable global test APIs (describe, it, expect, vi)
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/main',
      include: ['electron/**/*.ts'],
      exclude: [
        'electron/**/*.{test,spec}.ts',
        'electron/**/__tests__/**',
        'electron/**/*.d.ts',
      ],
    },

    // Isolate tests to prevent state leakage
    isolate: true,

    // Reporter configuration
    reporters: ['default'],

    // Increased timeout for file I/O and database operations
    testTimeout: 10000,

    // Mock configuration for Node.js modules
    deps: {
      interopDefault: true,
    },
  },
});
