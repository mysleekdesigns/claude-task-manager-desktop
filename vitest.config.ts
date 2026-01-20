import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      'node_modules',
      'dist',
      'dist-electron',
      'electron/**/*.test.ts',
      'electron/**/*.test.js',
    ],
    globals: true,
    environment: 'node',
  },
});
