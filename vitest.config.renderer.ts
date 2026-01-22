import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest Configuration for Renderer Process Tests
 *
 * This configuration is used for testing React components, hooks, and utilities
 * that run in the Electron renderer process (browser environment).
 *
 * Uses jsdom to simulate browser APIs.
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  test: {
    // Project name for workspace identification
    name: 'renderer',

    // Use jsdom for browser-like environment
    environment: 'jsdom',

    // Include only renderer process tests
    include: ['src/**/*.{test,spec}.{ts,tsx}'],

    // Exclude main process and build artifacts
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/electron/**',
      '**/e2e/**',
    ],

    // Setup file for React Testing Library and browser mocks
    setupFiles: ['./tests/setup/renderer.ts'],

    // Enable global test APIs (describe, it, expect, vi)
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/renderer',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/__tests__/**',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
      ],
    },

    // Mock external dependencies that don't work in jsdom
    deps: {
      optimizer: {
        web: {
          include: ['@radix-ui/*'],
        },
      },
    },

    // Isolate tests to prevent state leakage
    isolate: true,

    // Reporter configuration
    reporters: ['default'],
  },
});
