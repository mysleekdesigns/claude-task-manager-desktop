/**
 * Default Vitest Configuration
 *
 * This file re-exports the renderer configuration as the default.
 * For running both renderer and main process tests, use:
 *   npm test
 *
 * For running specific test suites:
 *   npm run test:renderer  - React/browser tests (jsdom)
 *   npm run test:main      - Electron main process tests (Node.js)
 */
export { default } from './vitest.config.renderer';
