import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for Electron E2E testing
 * @see https://playwright.dev/docs/api/class-electron
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Test file pattern
  testMatch: '**/*.spec.ts',

  // Global timeout for each test (Electron apps can be slow to start)
  timeout: 60_000,

  // Timeout for expect() assertions
  expect: {
    timeout: 10_000,
  },

  // Run tests sequentially - Electron tests often conflict when parallel
  fullyParallel: false,
  workers: 1,

  // Retry configuration
  retries: process.env.CI ? 1 : 0,

  // Reporter configuration
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }], ['list']],

  // Global setup/teardown
  globalTimeout: 10 * 60 * 1000, // 10 minutes max for entire test run

  // Output directory for test artifacts
  outputDir: 'e2e/test-results',

  // Shared settings for all projects
  use: {
    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording
    video: {
      mode: 'retain-on-failure',
      size: { width: 1280, height: 720 },
    },

    // Trace recording for debugging
    trace: 'retain-on-failure',

    // Timeout for actions like click, fill, etc.
    actionTimeout: 15_000,

    // Timeout for navigation
    navigationTimeout: 30_000,
  },

  // Projects - we only have Electron, but this is extensible
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts',
    },
  ],

  // Output directories for artifacts
  snapshotDir: 'e2e/snapshots',
});
