/**
 * Global Keyboard Shortcuts Service
 *
 * Manages application-wide keyboard shortcuts using Electron's globalShortcut API.
 * Shortcuts work even when the app is not focused.
 */

import { globalShortcut, app, type BrowserWindow } from 'electron';
import { trayService } from './tray.js';
import { createIPCLogger } from '../utils/ipc-logger.js';

const logger = createIPCLogger('Shortcuts');

export interface ShortcutConfig {
  key: string;
  action: () => void;
  description: string;
}

export class ShortcutService {
  private mainWindow: BrowserWindow | null = null;
  private registeredShortcuts = new Map<string, string>();

  /**
   * Initialize the shortcut service with the main window
   */
  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    this.registerDefaultShortcuts();
    logger.info('Shortcut service initialized');
  }

  /**
   * Register default application shortcuts
   */
  private registerDefaultShortcuts(): void {
    // Show/hide app shortcut (Cmd/Ctrl+Shift+T)
    const toggleKey = process.platform === 'darwin' ? 'Command+Shift+T' : 'Control+Shift+T';
    this.register(toggleKey, () => { this.toggleWindow(); }, 'Toggle application window');

    // New task shortcut (Cmd/Ctrl+Shift+N)
    const newTaskKey = process.platform === 'darwin' ? 'Command+Shift+N' : 'Control+Shift+N';
    this.register(newTaskKey, () => { this.openNewTaskDialog(); }, 'Create new task');
  }

  /**
   * Register a global keyboard shortcut
   */
  register(accelerator: string, callback: () => void, description: string): boolean {
    try {
      const result = globalShortcut.register(accelerator, callback);

      if (result) {
        this.registeredShortcuts.set(accelerator, description);
        logger.info(`Registered shortcut: ${accelerator} - ${description}`);
        return true;
      } else {
        logger.warn(`Failed to register shortcut: ${accelerator} (already in use?)`);
        return false;
      }
    } catch (error) {
      logger.error(`Error registering shortcut ${accelerator}:`, error);
      return false;
    }
  }

  /**
   * Unregister a specific shortcut
   */
  unregister(accelerator: string): void {
    globalShortcut.unregister(accelerator);
    this.registeredShortcuts.delete(accelerator);
    logger.info(`Unregistered shortcut: ${accelerator}`);
  }

  /**
   * Unregister all shortcuts
   */
  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.registeredShortcuts.clear();
    logger.info('Unregistered all shortcuts');
  }

  /**
   * Check if a shortcut is registered
   */
  isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator);
  }

  /**
   * Get all registered shortcuts
   */
  getRegisteredShortcuts(): { key: string; description: string }[] {
    return Array.from(this.registeredShortcuts.entries()).map(([key, description]) => ({
      key,
      description,
    }));
  }

  /**
   * Toggle window visibility (show/hide)
   */
  private toggleWindow(): void {
    if (!this.mainWindow) {
      logger.warn('Cannot toggle window - main window not available');
      return;
    }

    if (this.mainWindow.isVisible()) {
      if (this.mainWindow.isFocused()) {
        // If visible and focused, hide it
        this.mainWindow.hide();
        logger.info('Window hidden via shortcut');
      } else {
        // If visible but not focused, focus it
        this.mainWindow.show();
        this.mainWindow.focus();
        logger.info('Window focused via shortcut');
      }
    } else {
      // If hidden, show and focus it
      trayService.showWindow();
      logger.info('Window shown via shortcut');
    }
  }

  /**
   * Open new task dialog by sending IPC message to renderer
   */
  private openNewTaskDialog(): void {
    if (!this.mainWindow) {
      logger.warn('Cannot open new task dialog - main window not available');
      return;
    }

    // First, ensure window is visible
    if (!this.mainWindow.isVisible()) {
      trayService.showWindow();
    }

    // Send IPC event to renderer to open new task modal
    this.mainWindow.webContents.send('shortcuts:new-task');
    logger.info('New task dialog triggered via shortcut');
  }

  /**
   * Update the main window reference
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Cleanup on app quit
   */
  destroy(): void {
    this.unregisterAll();
    this.mainWindow = null;
    logger.info('Shortcut service destroyed');
  }
}

// Export singleton instance
export const shortcutService = new ShortcutService();

// Cleanup shortcuts when app is quitting
app.on('will-quit', () => {
  shortcutService.destroy();
});
