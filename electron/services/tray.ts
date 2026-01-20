import { app, Tray, Menu, nativeImage, BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { databaseService } from './database.js';

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

    // Get recent projects asynchronously
    void this.buildContextMenuAsync();
  }

  /**
   * Build context menu with recent projects (async)
   */
  private async buildContextMenuAsync(): Promise<void> {
    if (!this.tray) return;

    // Build menu items
    const menuItems: MenuItemConstructorOptions[] = [
      {
        label: this.isWindowVisible() ? 'Hide Claude Tasks' : 'Show Claude Tasks',
        click: (): void => {
          this.toggleWindow();
        },
      },
      { type: 'separator' },
      {
        label: 'New Task',
        accelerator: process.platform === 'darwin' ? 'Command+Shift+N' : 'Control+Shift+N',
        click: (): void => {
          this.openNewTaskDialog();
        },
      },
    ];

    // Add recent projects submenu
    const recentProjectsMenu = await this.buildRecentProjectsMenu();
    menuItems.push(recentProjectsMenu);

    // Add quit option
    menuItems.push(
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: process.platform === 'darwin' ? 'Command+Q' : 'Control+Q',
        click: (): void => {
          this.quit();
        },
      }
    );

    const contextMenu = Menu.buildFromTemplate(menuItems);
    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Build recent projects submenu
   */
  private async buildRecentProjectsMenu(): Promise<MenuItemConstructorOptions> {
    try {
      // Check if database is connected
      if (!databaseService.isConnected()) {
        return {
          label: 'Recent Projects',
          submenu: [
            {
              label: 'Database not connected',
              enabled: false,
            },
          ],
        };
      }

      const prisma = databaseService.getClient();

      // Get recent projects (limit to 5)
      const recentProjects = await prisma.project.findMany({
        take: 5,
        orderBy: {
          updatedAt: 'desc',
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (recentProjects.length === 0) {
        return {
          label: 'Recent Projects',
          submenu: [
            {
              label: 'No recent projects',
              enabled: false,
            },
          ],
        };
      }

      // Build submenu items for each project
      const projectMenuItems: MenuItemConstructorOptions[] = recentProjects.map((project) => ({
        label: project.name,
        click: (): void => {
          this.openProject(project.id);
        },
      }));

      return {
        label: 'Recent Projects',
        submenu: projectMenuItems,
      };
    } catch (error) {
      console.error('Failed to load recent projects for tray menu:', error);
      return {
        label: 'Recent Projects',
        submenu: [
          {
            label: 'Failed to load projects',
            enabled: false,
          },
        ],
      };
    }
  }

  /**
   * Toggle window visibility
   */
  private toggleWindow(): void {
    if (!this.mainWindow) return;

    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.showWindow();
    }

    // Update menu after toggle
    void this.buildContextMenuAsync();
  }

  /**
   * Open new task dialog by sending IPC message to renderer
   */
  private openNewTaskDialog(): void {
    if (!this.mainWindow) return;

    // First, ensure window is visible
    if (!this.mainWindow.isVisible()) {
      this.showWindow();
    }

    // Send IPC event to renderer to open new task modal
    this.mainWindow.webContents.send('tray:new-task');
  }

  /**
   * Open a specific project
   */
  private openProject(projectId: string): void {
    if (!this.mainWindow) return;

    // Ensure window is visible
    if (!this.mainWindow.isVisible()) {
      this.showWindow();
    }

    // Send IPC event to renderer to navigate to project
    this.mainWindow.webContents.send('tray:open-project', projectId);
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
   * Refresh the tray context menu (useful when projects change)
   */
  refreshMenu(): void {
    this.updateContextMenu();
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
