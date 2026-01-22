/// <reference types="vitest" />
/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

/**
 * Vitest Global Type Declarations
 *
 * This file provides TypeScript type declarations for the global test APIs
 * enabled by `globals: true` in vitest configuration.
 */

import 'vitest/globals';
import '@testing-library/jest-dom';

// Extend Window interface with Electron preload API
declare global {
  interface Window {
    electron: {
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
      off: (channel: string) => void;
      send: (channel: string, ...args: unknown[]) => void;
    };
  }
}

export {};
