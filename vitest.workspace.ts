import { defineWorkspace } from 'vitest/config';

/**
 * Vitest Workspace Configuration
 *
 * This workspace enables running tests for both Electron main process (Node.js)
 * and renderer process (React/jsdom) in a single test suite.
 *
 * Run all tests: npm test
 * Run renderer tests only: npm test -- --project=renderer
 * Run main process tests only: npm test -- --project=main
 */
export default defineWorkspace([
  // Reference separate config files for each project
  './vitest.config.renderer.ts',
  './vitest.config.main.ts',
]);
