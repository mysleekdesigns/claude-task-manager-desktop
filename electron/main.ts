// Load environment variables from .env file FIRST (before any other imports)
import dotenv from 'dotenv';
dotenv.config();

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import http from 'node:http';
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
import { performStartupCleanup } from './services/startup-cleanup.js';
import { terminalManager } from './services/terminal.js';
import { claudeCodeService } from './services/claude-code.js';
import { fixAgentPool } from './services/fix-agent-pool.js';
import { supabaseService } from './services/supabase.js';
import { isValidOAuthCallbackUrl } from './services/deep-link.js';

const logger = createIPCLogger('Main');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Module-level flag to track shutdown state
let isQuitting = false;

/**
 * Check if the app is currently shutting down
 * Other modules can use this to check shutdown state
 */
export function getIsQuitting(): boolean {
  return isQuitting;
}

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
 * Wait for the Vite dev server to be ready by polling it
 */
async function waitForDevServer(
  url: string,
  timeout: number = 30000
): Promise<void> {
  const startTime = Date.now();
  const parsedUrl = new URL(url);

  return new Promise((resolve, reject) => {
    const checkServer = () => {
      const elapsed = Date.now() - startTime;

      if (elapsed > timeout) {
        reject(
          new Error(`Dev server at ${url} did not respond within ${timeout}ms`)
        );
        return;
      }

      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 80,
          path: '/',
          method: 'HEAD',
          timeout: 1000,
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
            logger.info(`Dev server ready after ${elapsed}ms`);
            resolve();
          } else {
            setTimeout(checkServer, 200);
          }
        }
      );

      req.on('error', () => setTimeout(checkServer, 200));
      req.on('timeout', () => {
        req.destroy();
        setTimeout(checkServer, 200);
      });
      req.end();
    };

    logger.info(`Waiting for dev server at ${url}...`);
    checkServer();
  });
}

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
    backgroundColor: '#0f0f23', // Dark background matching the app theme
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

  // Initialize IPC handlers BEFORE loading URL to prevent race conditions
  // This ensures handlers are available when the React app starts
  initializeIPC(mainWindow);

  // Load the app
  if (isDev && VITE_DEV_SERVER_URL) {
    try {
      await waitForDevServer(VITE_DEV_SERVER_URL);
      await mainWindow.loadURL(VITE_DEV_SERVER_URL);
    } catch (error) {
      logger.error('Failed to connect to dev server:', error);
      // Show error page as fallback
      await mainWindow.loadURL(`data:text/html,
        <html><body style="background:#1a1a2e;color:white;font-family:system-ui;padding:20px;">
          <h1>Dev Server Connection Failed</h1>
          <p>Could not connect to Vite dev server at ${VITE_DEV_SERVER_URL}</p>
          <pre style="color:#ff6b6b">${error instanceof Error ? error.message : error}</pre>
        </body></html>
      `);
    }
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
 * Handle deep link URLs (OAuth callbacks)
 *
 * Routes OAuth callback URLs to the auth handler for processing.
 * Notifies the renderer of success or error via IPC events.
 */
function handleDeepLink(url: string): void {
  // Log full URL for debugging (hash fragment may contain tokens)
  const hasHash = url.includes('#');
  const hasQuery = url.includes('?');
  logger.info(`Received deep link: ${url.split('#')[0]} (hasHash: ${hasHash}, hasQuery: ${hasQuery})`);
  if (hasHash) {
    logger.info(`Deep link hash fragment length: ${url.split('#')[1]?.length || 0}`);
  }

  if (!isValidOAuthCallbackUrl(url)) {
    logger.warn('Invalid deep link URL received, ignoring');
    return;
  }

  // Import and call the OAuth callback handler
  // This will be implemented in the auth IPC handlers
  void import('./ipc/auth.js').then(({ handleOAuthCallback }) => {
    handleOAuthCallback(url, mainWindow);
  }).catch((error) => {
    logger.error('Failed to handle OAuth callback:', error);
    if (mainWindow) {
      mainWindow.webContents.send('auth:oauth-error', {
        error: 'callback_failed',
        errorDescription: 'Failed to process OAuth callback',
        provider: 'unknown' as const,
      });
    }
  });
}

/**
 * Initialize the application
 * - Initialize database connection
 * - Run database migrations to create/update schema
 * - Clean up stale states from previous session
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

    // Step 2.5: Initialize Supabase (optional - if configured)
    logger.info('Initializing Supabase...');
    supabaseService.initialize();
    if (supabaseService.isInitialized()) {
      logger.info('Supabase initialized successfully');
    } else {
      logger.info('Supabase not configured - using local auth only');
    }

    // Step 3: Clean up stale states from previous session (crash recovery)
    // This resets tasks that were RUNNING/STARTING to FAILED, removes orphaned terminals,
    // and marks orphaned reviews as FAILED
    logger.info('Running startup cleanup...');
    const cleanupResult = await performStartupCleanup();
    if (cleanupResult.staleTasks > 0 || cleanupResult.orphanedTerminals > 0 || cleanupResult.orphanedReviews > 0) {
      logger.info(
        `Startup cleanup completed: ${cleanupResult.staleTasks} stale task(s), ${cleanupResult.orphanedTerminals} orphaned terminal(s), ${cleanupResult.orphanedReviews} orphaned review(s)`
      );
    } else {
      logger.info('Startup cleanup completed: no stale states found');
    }

    // Step 4: Register as default protocol handler for OAuth callbacks
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('claude-tasks', process.execPath, [path.resolve(process.argv[1]!)]);
      }
    } else {
      app.setAsDefaultProtocolClient('claude-tasks');
    }

    // Step 5: Create main window and register IPC handlers
    // Note: IPC handlers are now initialized inside createWindow() BEFORE loadURL
    // to prevent race conditions where React app starts before handlers are ready
    await createWindow();

    if (!mainWindow) {
      throw new Error('Main window not created');
    }
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

// Handle OAuth callback URLs on macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Handle before-quit (set quitting flag to allow window close and cleanup)
app.on('before-quit', async (event) => {
  // If already quitting, allow the quit to proceed
  if (isQuitting) {
    return;
  }

  // Prevent the default quit to handle async cleanup
  event.preventDefault();

  // Set quitting flags
  isQuitting = true;
  trayService.setQuitting(true);

  try {
    // Kill all active fix agents first (they have database operations in exit handlers)
    // This MUST happen before database disconnect to avoid race conditions
    try {
      logger.info('Cleaning up fix agent processes...');
      fixAgentPool.cleanup();
      logger.info('Fix agent processes cleaned up successfully');
    } catch (error) {
      logger.error('Error cleaning up fix agent processes:', error);
    }

    // Kill all active Claude Code processes (spawn-based)
    try {
      logger.info('Cleaning up Claude Code processes...');
      claudeCodeService.killAllProcesses();
      logger.info('Claude Code processes cleaned up successfully');
    } catch (error) {
      logger.error('Error cleaning up Claude Code processes:', error);
    }

    // Kill all active terminal processes (PTY-based)
    try {
      logger.info('Cleaning up terminal processes...');
      terminalManager.killAll();
      logger.info('Terminal processes cleaned up successfully');
    } catch (error) {
      logger.error('Error cleaning up terminal processes:', error);
    }

    // Disconnect from database with a 5-second timeout
    if (databaseService.isConnected()) {
      logger.info('Disconnecting from database...');
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Database disconnect timeout')), 5000);
      });

      try {
        await Promise.race([databaseService.disconnect(), timeoutPromise]);
        logger.info('Database disconnected successfully');
      } catch (error) {
        logger.error('Error disconnecting from database:', error);
      }
    }
  } catch (error) {
    logger.error('Error during shutdown cleanup:', error);
  } finally {
    // Exit the app after cleanup completes (or fails)
    logger.info('Shutdown cleanup complete, exiting...');
    app.exit(0);
  }
});

// Backup cleanup in case before-quit didn't fully clean up
app.on('will-quit', () => {
  fixAgentPool.cleanup(); // Backup cleanup for fix agent processes
  claudeCodeService.killAllProcesses(); // Backup cleanup for Claude processes
  terminalManager.killAll(); // Backup cleanup for terminal processes
  void supabaseService.cleanup(); // Cleanup Supabase subscriptions
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

// Handle second instance (focus existing window AND handle deep links on Windows/Linux)
app.on('second-instance', (_event, commandLine) => {
  if (mainWindow) {
    trayService.showWindow();
  }

  // On Windows/Linux, the deep link URL is passed in the command line
  const deepLinkUrl = commandLine.find((arg) => arg.startsWith('claude-tasks://'));
  if (deepLinkUrl) {
    handleDeepLink(deepLinkUrl);
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
