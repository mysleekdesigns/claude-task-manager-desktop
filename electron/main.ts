import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadWindowState,
  trackWindowState,
  getCloseToTray,
  getMinimizeToTray,
  setCloseToTray,
  setMinimizeToTray,
  type WindowStateDefaults,
} from './utils/window-state.js';
import { trayService } from './services/tray.js';
import { shortcutService } from './services/shortcuts.js';
import { registerIPCHandlers, createIPCLogger } from './ipc/index.js';
import { databaseService } from './services/database.js';
import { terminalManager } from './services/terminal.js';

const logger = createIPCLogger('Main');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disable GPU Acceleration for Windows 7
if (
  process.platform === 'win32' &&
  process.getSystemVersion().startsWith('6.1')
) {
  app.disableHardwareAcceleration();
}

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') {
  app.setAppUserModelId(app.getName());
}

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Environment variables
const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

let mainWindow: BrowserWindow | null = null;

/**
 * Window defaults configuration
 */
const WINDOW_DEFAULTS: WindowStateDefaults = {
  defaultWidth: 1280,
  defaultHeight: 800,
  minWidth: 800,
  minHeight: 600,
};

/**
 * Create the main application window
 */
async function createWindow(): Promise<void> {
  const preloadPath = path.join(__dirname, 'preload.cjs');

  // Load saved window state (position, size, maximized)
  const windowState = loadWindowState(WINDOW_DEFAULTS);

  // Build window options
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: WINDOW_DEFAULTS.minWidth,
    minHeight: WINDOW_DEFAULTS.minHeight,
    title: 'Claude Tasks',
    show: false, // Don't show until ready-to-show
    frame: true, // Keep native frame
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
  };

  // macOS specific: add traffic light position
  if (process.platform === 'darwin') {
    windowOptions.trafficLightPosition = { x: 15, y: 15 };
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Track window state changes (position, size, maximized)
  trackWindowState(mainWindow);

  // Restore maximized state if applicable
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Gracefully show window once ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  // Handle minimize event - optionally minimize to tray
  // Note: The 'minimize' event doesn't support preventDefault, so we restore and hide
  mainWindow.on('minimize', () => {
    if (getMinimizeToTray() && mainWindow) {
      mainWindow.restore();
      mainWindow.hide();
    }
  });

  // Handle close event - optionally close to tray instead of quitting
  mainWindow.on('close', (event) => {
    // Allow close if we're actually quitting
    if (trayService.getIsQuitting()) {
      return;
    }

    // On macOS or if closeToTray is enabled, hide to tray instead of quitting
    if (process.platform === 'darwin' || getCloseToTray()) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
    trayService.setMainWindow(null);
  });

  // Initialize tray after window is created
  trayService.initialize(mainWindow);

  // Initialize global keyboard shortcuts
  shortcutService.initialize(mainWindow);

  // Load the app
  if (isDev && VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // Load the built index.html in production
    const indexPath = path.join(__dirname, '../dist/index.html');
    await mainWindow.loadFile(indexPath);
  }
}

/**
 * Initialize IPC handlers
 * @param window - The main BrowserWindow instance for terminal output streaming
 */
function initializeIPC(window: BrowserWindow): void {
  logger.info('Initializing IPC handlers...');

  // Register type-safe IPC handlers from the centralized system
  // This handles: app:getVersion, app:getPlatform, app:getPath, dialog:openDirectory, terminal operations
  registerIPCHandlers(window);

  // Window management IPC handlers (these remain here as they need mainWindow reference)
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  // Tray preferences IPC handlers
  ipcMain.handle('preferences:getMinimizeToTray', () => {
    return getMinimizeToTray();
  });

  ipcMain.handle('preferences:setMinimizeToTray', (_, value: boolean) => {
    setMinimizeToTray(value);
  });

  ipcMain.handle('preferences:getCloseToTray', () => {
    return getCloseToTray();
  });

  ipcMain.handle('preferences:setCloseToTray', (_, value: boolean) => {
    setCloseToTray(value);
  });

  logger.info('IPC handlers initialized successfully.');
}

/**
 * Initialize the application
 * - Initialize database connection
 * - Run database migrations to create/update schema
 * - Create main window
 * - Register IPC handlers (depend on database and window being ready)
 */
async function initializeApp(): Promise<void> {
  try {
    // Step 1: Initialize database (MUST be first - IPC handlers depend on it)
    logger.info('Initializing database...');
    await databaseService.initialize();
    logger.info('Database initialized successfully');

    // Step 2: Run database migrations to ensure schema is up to date
    logger.info('Running database migrations...');
    databaseService.runMigrations();
    logger.info('Database migrations completed successfully');

    // Step 3: Create main window (needed for terminal IPC handlers)
    await createWindow();

    // Step 4: Register IPC handlers (depend on database and window being ready)
    if (!mainWindow) {
      throw new Error('Main window not created');
    }
    initializeIPC(mainWindow);
  } catch (error) {
    logger.error('Failed to initialize application:', error);

    // Show error dialog to user
    const { dialog } = await import('electron');
    dialog.showErrorBox(
      'Initialization Error',
      `Failed to start Claude Tasks: ${error instanceof Error ? error.message : 'Unknown error'}\n\nThe application will now exit.`
    );

    // Exit the application
    app.quit();
  }
}

// App lifecycle events
app.on('ready', () => {
  void initializeApp();
});

// Handle before-quit (set quitting flag to allow window close and cleanup)
app.on('before-quit', () => {
  trayService.setQuitting(true);

  // Kill all active terminal processes
  try {
    logger.info('Cleaning up terminal processes...');
    terminalManager.killAll();
    logger.info('Terminal processes cleaned up successfully');
  } catch (error) {
    logger.error('Error cleaning up terminal processes:', error);
  }

  // Disconnect from database
  try {
    if (databaseService.isConnected()) {
      logger.info('Disconnecting from database...');
      await databaseService.disconnect();
      logger.info('Database disconnected successfully');
    }
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
  }
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay open until explicitly quit
  if (process.platform !== 'darwin') {
    // On other platforms, quit if not using close-to-tray
    if (!getCloseToTray()) {
      app.quit();
    }
  }
});

app.on('activate', () => {
  // On macOS, re-create or show window when dock icon is clicked
  if (mainWindow === null) {
    // Re-initialize the entire app if window was closed
    void initializeApp();
  } else {
    trayService.showWindow();
  }
});

// Handle second instance (focus existing window)
app.on('second-instance', () => {
  if (mainWindow) {
    trayService.showWindow();
  }
});

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    // Only allow navigation to the same origin in dev mode
    if (isDev && VITE_DEV_SERVER_URL) {
      const devUrl = new URL(VITE_DEV_SERVER_URL);
      if (parsedUrl.origin !== devUrl.origin) {
        event.preventDefault();
      }
    } else {
      // In production, prevent all navigation
      event.preventDefault();
    }
  });

  // Prevent opening new windows
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
