/**
 * Vitest Setup for Main Process Tests
 *
 * This file configures the test environment for Electron main process code.
 * It mocks Electron APIs, Node.js modules, and provides utilities for testing
 * IPC handlers, services, and system integrations.
 */

import { vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Electron APIs
// ---------------------------------------------------------------------------

/**
 * Mock Electron app module
 */
export const mockApp = {
  getPath: vi.fn((name: string) => {
    const paths: Record<string, string> = {
      home: '/mock/home',
      userData: '/mock/userData',
      appData: '/mock/appData',
      temp: '/tmp/mock-electron',
      desktop: '/mock/home/Desktop',
      documents: '/mock/home/Documents',
      downloads: '/mock/home/Downloads',
    };
    return paths[name] ?? `/mock/${name}`;
  }),
  getName: vi.fn(() => 'claude-tasks-desktop'),
  getVersion: vi.fn(() => '0.1.0'),
  getLocale: vi.fn(() => 'en-US'),
  isPackaged: false,
  quit: vi.fn(),
  exit: vi.fn(),
  relaunch: vi.fn(),
  isReady: vi.fn(() => true),
  whenReady: vi.fn(() => Promise.resolve()),
  focus: vi.fn(),
  hide: vi.fn(),
  show: vi.fn(),
  setPath: vi.fn(),
  getAppPath: vi.fn(() => '/mock/app'),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
};

/**
 * Mock Electron BrowserWindow
 */
export class MockBrowserWindow {
  id = Math.random();
  webContents = {
    send: vi.fn(),
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    openDevTools: vi.fn(),
    closeDevTools: vi.fn(),
    isDevToolsOpened: vi.fn(() => false),
    reload: vi.fn(),
    getURL: vi.fn(() => 'http://localhost:5173'),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
  };

  loadURL = vi.fn().mockResolvedValue(undefined);
  loadFile = vi.fn().mockResolvedValue(undefined);
  show = vi.fn();
  hide = vi.fn();
  close = vi.fn();
  destroy = vi.fn();
  focus = vi.fn();
  blur = vi.fn();
  minimize = vi.fn();
  maximize = vi.fn();
  unmaximize = vi.fn();
  isMaximized = vi.fn(() => false);
  isMinimized = vi.fn(() => false);
  isVisible = vi.fn(() => true);
  isDestroyed = vi.fn(() => false);
  setTitle = vi.fn();
  getTitle = vi.fn(() => 'Claude Tasks');
  getBounds = vi.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 }));
  setBounds = vi.fn();
  setSize = vi.fn();
  getSize = vi.fn(() => [1200, 800]);
  setPosition = vi.fn();
  getPosition = vi.fn(() => [100, 100]);
  on = vi.fn();
  once = vi.fn();
  off = vi.fn();
  removeListener = vi.fn();
  removeAllListeners = vi.fn();

  static getAllWindows = vi.fn(() => []);
  static getFocusedWindow = vi.fn(() => null);
  static fromId = vi.fn(() => null);
  static fromWebContents = vi.fn(() => null);
}

/**
 * Mock Electron ipcMain
 */
export const mockIpcMain = {
  handle: vi.fn(),
  handleOnce: vi.fn(),
  removeHandler: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
};

/**
 * Mock Electron dialog
 */
export const mockDialog = {
  showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/mock/path'] }),
  showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/mock/save-path' }),
  showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  showErrorBox: vi.fn(),
};

/**
 * Mock Electron shell
 */
export const mockShell = {
  openExternal: vi.fn().mockResolvedValue(undefined),
  openPath: vi.fn().mockResolvedValue(''),
  showItemInFolder: vi.fn(),
  beep: vi.fn(),
  trashItem: vi.fn().mockResolvedValue(undefined),
};

/**
 * Mock Electron Notification
 */
export class MockNotification {
  title: string;
  body: string;

  constructor(options: { title: string; body: string }) {
    this.title = options.title;
    this.body = options.body;
  }

  show = vi.fn();
  close = vi.fn();
  on = vi.fn();
  once = vi.fn();

  static isSupported = vi.fn(() => true);
}

/**
 * Mock Electron Menu
 */
export const MockMenu = {
  buildFromTemplate: vi.fn(() => ({
    popup: vi.fn(),
    closePopup: vi.fn(),
  })),
  setApplicationMenu: vi.fn(),
  getApplicationMenu: vi.fn(() => null),
};

/**
 * Mock Electron Tray
 */
export class MockTray {
  constructor(_iconPath: string) {}

  setImage = vi.fn();
  setToolTip = vi.fn();
  setContextMenu = vi.fn();
  on = vi.fn();
  destroy = vi.fn();
}

/**
 * Mock Electron globalShortcut
 */
export const mockGlobalShortcut = {
  register: vi.fn(() => true),
  unregister: vi.fn(),
  unregisterAll: vi.fn(),
  isRegistered: vi.fn(() => false),
};

/**
 * Mock Electron clipboard
 */
export const mockClipboard = {
  writeText: vi.fn(),
  readText: vi.fn(() => ''),
  writeHTML: vi.fn(),
  readHTML: vi.fn(() => ''),
  clear: vi.fn(),
};

/**
 * Mock Electron nativeTheme
 */
export const mockNativeTheme = {
  shouldUseDarkColors: false,
  themeSource: 'system' as 'system' | 'light' | 'dark',
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
};

// ---------------------------------------------------------------------------
// Apply mocks to modules
// ---------------------------------------------------------------------------
vi.mock('electron', () => ({
  app: mockApp,
  BrowserWindow: MockBrowserWindow,
  ipcMain: mockIpcMain,
  dialog: mockDialog,
  shell: mockShell,
  Notification: MockNotification,
  Menu: MockMenu,
  Tray: MockTray,
  globalShortcut: mockGlobalShortcut,
  clipboard: mockClipboard,
  nativeTheme: mockNativeTheme,
}));

// ---------------------------------------------------------------------------
// Mock node-pty (terminal emulation)
// ---------------------------------------------------------------------------
export const mockPty = {
  spawn: vi.fn(() => ({
    pid: 12345,
    cols: 80,
    rows: 24,
    process: 'bash',
    handleFlowControl: false,
    on: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    clear: vi.fn(),
  })),
};

vi.mock('node-pty', () => mockPty);

// ---------------------------------------------------------------------------
// Mock better-sqlite3 (for database tests)
// ---------------------------------------------------------------------------
export const mockBetterSqlite3 = vi.fn(() => ({
  pragma: vi.fn(),
  prepare: vi.fn(() => ({
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(() => []),
    iterate: vi.fn(() => [][Symbol.iterator]()),
  })),
  exec: vi.fn(),
  close: vi.fn(),
  transaction: vi.fn((fn: () => void) => fn),
}));

vi.mock('better-sqlite3', () => ({ default: mockBetterSqlite3 }));

// ---------------------------------------------------------------------------
// Mock electron-store
// ---------------------------------------------------------------------------
export class MockElectronStore<T extends Record<string, unknown>> {
  private store: Partial<T> = {};

  get = vi.fn(<K extends keyof T>(key: K): T[K] | undefined => {
    return this.store[key] as T[K] | undefined;
  });

  set = vi.fn(<K extends keyof T>(key: K, value: T[K]): void => {
    this.store[key] = value;
  });

  delete = vi.fn(<K extends keyof T>(key: K): void => {
    delete this.store[key];
  });

  has = vi.fn(<K extends keyof T>(key: K): boolean => {
    return key in this.store;
  });

  clear = vi.fn((): void => {
    this.store = {};
  });

  get size(): number {
    return Object.keys(this.store).length;
  }

  get store_data(): Partial<T> {
    return { ...this.store };
  }
}

vi.mock('electron-store', () => ({ default: MockElectronStore }));

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Clean up after each test
// ---------------------------------------------------------------------------
afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Export helpers for test files
// ---------------------------------------------------------------------------

/**
 * Create a mock IPC event object
 */
export function createMockIPCEvent(webContentsId = 1) {
  return {
    sender: {
      id: webContentsId,
      send: vi.fn(),
    },
    reply: vi.fn(),
    senderFrame: {
      url: 'http://localhost:5173',
    },
  };
}

/**
 * Helper to register and test an IPC handler
 */
export async function testIPCHandler<T>(
  handler: (event: unknown, ...args: unknown[]) => Promise<T>,
  ...args: unknown[]
): Promise<T> {
  const event = createMockIPCEvent();
  return handler(event, ...args);
}

/**
 * Helper to create a mock Prisma client for database tests
 */
export function createMockPrismaClient() {
  return {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn((fn: (prisma: unknown) => Promise<unknown>) => fn({})),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    project: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    task: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    mcpConfig: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    memory: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

/**
 * Helper to create a mock file system for use in tests.
 * Note: vi.mock() must be called at the top level, so this returns
 * a mock object that tests can configure.
 */
export function createMockFileSystem(files: Record<string, string> = {}) {
  return {
    files,
    existsSync: vi.fn((path: string) => path in files),
    readFileSync: vi.fn((path: string) => {
      if (path in files) return files[path];
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }),
    writeFileSync: vi.fn((path: string, content: string) => {
      files[path] = content;
    }),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(() => ({
      isFile: () => true,
      isDirectory: () => false,
    })),
    copyFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    rmdirSync: vi.fn(),
    promises: {
      readFile: vi.fn(async (path: string) => {
        if (path in files) return files[path];
        throw new Error(`ENOENT: no such file or directory: ${path}`);
      }),
      writeFile: vi.fn(async (path: string, content: string) => {
        files[path] = content;
      }),
      mkdir: vi.fn(),
      readdir: vi.fn(async () => []),
      stat: vi.fn(async () => ({
        isFile: () => true,
        isDirectory: () => false,
      })),
      unlink: vi.fn(),
      rmdir: vi.fn(),
    },
  };
}
