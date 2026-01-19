import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * System tray service for Claude Tasks
 * Provides tray icon with context menu and window management
 */
export class TrayService {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private isQuitting = false;

  /**
   * Initialize the tray service
   * @param mainWindow - The main BrowserWindow instance
   */
  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    this.createTray();
  }

  /**
   * Create the system tray icon and menu
   */
  private createTray(): void {
    const iconPath = this.getTrayIconPath();
    const icon = nativeImage.createFromPath(iconPath);

    // On macOS, use template images for proper dark/light mode support
    if (process.platform === 'darwin') {
      icon.setTemplateImage(true);
    }

    this.tray = new Tray(icon);

    // Set tooltip
    this.tray.setToolTip('Claude Tasks');

    // Build context menu
    this.updateContextMenu();

    // Handle tray click events
    this.setupTrayClickHandlers();
  }

  /**
   * Get the appropriate tray icon path based on platform
   */
  private getTrayIconPath(): string {
    // In development, icons are in project root
    // In production, they're in the resources directory
    const isDev = !app.isPackaged;
    let basePath: string;

    if (isDev) {
      // Go up from dist-electron to project root
      basePath = path.join(__dirname, '..', '..', 'resources', 'icons');
    } else {
      // In packaged app, use process.resourcesPath
      basePath = path.join(process.resourcesPath, 'icons');
    }

    // macOS uses template images that adapt to dark/light mode
    if (process.platform === 'darwin') {
      return path.join(basePath, 'tray-iconTemplate.png');
    }

    return path.join(basePath, 'tray-icon.png');
  }

  /**
   * Build and set the context menu
   */
  private updateContextMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Claude Tasks',
        click: (): void => {
          this.showWindow();
        },
      },
      { type: 'separator' },
      {
        label: 'New Task',
        click: (): void => {
          // Placeholder - will be implemented when task creation is added
          this.showWindow();
          // TODO: Send IPC message to open new task dialog
          console.log('New Task clicked');
        },
      },
      {
        label: 'Recent Projects',
        submenu: [
          {
            label: 'No recent projects',
            enabled: false,
          },
          // TODO: Populate with actual recent projects
        ],
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: (): void => {
          this.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Setup click handlers for the tray icon
   */
  private setupTrayClickHandlers(): void {
    if (!this.tray) return;

    // Single click on tray icon
    this.tray.on('click', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isVisible()) {
          this.mainWindow.hide();
        } else {
          this.showWindow();
        }
      }
    });

    // Double click on tray icon (Windows)
    this.tray.on('double-click', () => {
      this.showWindow();
    });
  }

  /**
   * Show and focus the main window
   */
  showWindow(): void {
    if (!this.mainWindow) return;

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }

    this.mainWindow.show();
    this.mainWindow.focus();
  }

  /**
   * Hide the main window to tray
   */
  hideWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.hide();
    }
  }

  /**
   * Check if window is visible
   */
  isWindowVisible(): boolean {
    return this.mainWindow?.isVisible() ?? false;
  }

  /**
   * Set the quitting flag (used to differentiate close vs quit)
   */
  setQuitting(value: boolean): void {
    this.isQuitting = value;
  }

  /**
   * Check if the app is quitting
   */
  getIsQuitting(): boolean {
    return this.isQuitting;
  }

  /**
   * Quit the application
   */
  quit(): void {
    this.isQuitting = true;
    app.quit();
  }

  /**
   * Update the main window reference (e.g., if window is recreated)
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Destroy the tray icon
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  /**
   * Update the tray icon (e.g., to show notifications badge)
   */
  setIcon(iconPath: string): void {
    if (this.tray) {
      const icon = nativeImage.createFromPath(iconPath);
      if (process.platform === 'darwin') {
        icon.setTemplateImage(true);
      }
      this.tray.setImage(icon);
    }
  }

  /**
   * Update the tooltip text
   */
  setTooltip(text: string): void {
    if (this.tray) {
      this.tray.setToolTip(text);
    }
  }
}

// Export singleton instance
export const trayService = new TrayService();
