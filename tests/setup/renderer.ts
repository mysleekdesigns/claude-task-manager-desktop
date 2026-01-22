/**
 * Vitest Setup for Renderer Process Tests
 *
 * This file configures the test environment for React components and browser-side code.
 * It sets up React Testing Library, mocks browser APIs, and provides Electron preload mocks.
 */

import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// ---------------------------------------------------------------------------
// Automatic cleanup after each test
// ---------------------------------------------------------------------------
afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Mock ResizeObserver (not available in jsdom)
// ---------------------------------------------------------------------------
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

// ---------------------------------------------------------------------------
// Mock IntersectionObserver (not available in jsdom)
// ---------------------------------------------------------------------------
class IntersectionObserverMock {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);

// ---------------------------------------------------------------------------
// Mock window.matchMedia (for responsive design and theme detection)
// ---------------------------------------------------------------------------
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---------------------------------------------------------------------------
// Mock scrollTo (not implemented in jsdom)
// ---------------------------------------------------------------------------
window.scrollTo = vi.fn();
Element.prototype.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

// ---------------------------------------------------------------------------
// Mock Electron preload API (window.electron)
// ---------------------------------------------------------------------------
interface MockElectronAPI {
  invoke: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

const mockElectronAPI: MockElectronAPI = {
  invoke: vi.fn().mockResolvedValue(undefined),
  on: vi.fn().mockReturnValue(vi.fn()), // Returns cleanup function
  off: vi.fn(),
  send: vi.fn(),
};

Object.defineProperty(window, 'electron', {
  writable: true,
  value: mockElectronAPI,
});

// ---------------------------------------------------------------------------
// Mock localStorage and sessionStorage
// ---------------------------------------------------------------------------
const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length;
    },
  };
};

Object.defineProperty(window, 'localStorage', {
  value: createStorageMock(),
});

Object.defineProperty(window, 'sessionStorage', {
  value: createStorageMock(),
});

// ---------------------------------------------------------------------------
// Mock URL.createObjectURL and revokeObjectURL
// ---------------------------------------------------------------------------
URL.createObjectURL = vi.fn(() => 'blob:mock-url');
URL.revokeObjectURL = vi.fn();

// ---------------------------------------------------------------------------
// Mock clipboard API
// ---------------------------------------------------------------------------
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
});

// ---------------------------------------------------------------------------
// Mock requestAnimationFrame and cancelAnimationFrame
// ---------------------------------------------------------------------------
vi.stubGlobal(
  'requestAnimationFrame',
  vi.fn((callback: FrameRequestCallback) => {
    return setTimeout(() => callback(Date.now()), 0);
  })
);

vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => clearTimeout(id)));

// ---------------------------------------------------------------------------
// Export helpers for test files
// ---------------------------------------------------------------------------

/**
 * Helper to get the mocked Electron API for test assertions
 */
export function getMockElectronAPI(): MockElectronAPI {
  return mockElectronAPI;
}

/**
 * Helper to reset all Electron API mocks
 */
export function resetElectronMocks(): void {
  mockElectronAPI.invoke.mockReset().mockResolvedValue(undefined);
  mockElectronAPI.on.mockReset().mockReturnValue(vi.fn());
  mockElectronAPI.off.mockReset();
  mockElectronAPI.send.mockReset();
}

/**
 * Helper to mock a specific IPC invoke response
 */
export function mockIPCInvoke<T>(channel: string, response: T): void {
  mockElectronAPI.invoke.mockImplementation(
    async (invokeChannel: string, ...args: unknown[]) => {
      if (invokeChannel === channel) {
        return typeof response === 'function'
          ? (response as (...args: unknown[]) => T)(...args)
          : response;
      }
      return undefined;
    }
  );
}

/**
 * Helper to mock multiple IPC invoke responses
 */
export function mockIPCInvokeMultiple(
  responses: Record<string, unknown>
): void {
  mockElectronAPI.invoke.mockImplementation(
    async (channel: string, ..._args: unknown[]) => {
      return responses[channel];
    }
  );
}
