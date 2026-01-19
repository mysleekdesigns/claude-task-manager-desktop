import Store from 'electron-store';
import { screen, BrowserWindow, Rectangle } from 'electron';

/**
 * Window state configuration stored in electron-store
 */
export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

/**
 * Default window configuration
 */
export interface WindowStateDefaults {
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
}

/**
 * Store schema for type safety
 */
interface StoreSchema {
  windowState: WindowState;
  minimizeToTray: boolean;
  closeToTray: boolean;
}

const DEFAULT_STATE: WindowState = {
  x: 0,
  y: 0,
  width: 1280,
  height: 800,
  isMaximized: false,
};

const store = new Store<StoreSchema>({
  name: 'window-state',
  defaults: {
    windowState: DEFAULT_STATE,
    minimizeToTray: process.platform === 'darwin',
    closeToTray: process.platform === 'darwin',
  },
});

/**
 * Check if window bounds are visible on any available display
 */
function windowBoundsAreVisible(bounds: Rectangle): boolean {
  const displays = screen.getAllDisplays();

  // Check if at least a portion of the window is visible on any display
  return displays.some((display) => {
    const displayBounds = display.workArea;
    const minVisibleArea = 100; // At least 100px should be visible

    const horizontalOverlap = Math.max(
      0,
      Math.min(bounds.x + bounds.width, displayBounds.x + displayBounds.width) -
        Math.max(bounds.x, displayBounds.x)
    );

    const verticalOverlap = Math.max(
      0,
      Math.min(
        bounds.y + bounds.height,
        displayBounds.y + displayBounds.height
      ) - Math.max(bounds.y, displayBounds.y)
    );

    return (
      horizontalOverlap >= minVisibleArea && verticalOverlap >= minVisibleArea
    );
  });
}

/**
 * Get centered window bounds for the primary display
 */
function getCenteredBounds(
  width: number,
  height: number
): { x: number; y: number } {
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
  };
}

/**
 * Load saved window state from storage
 * Returns validated state or defaults if invalid
 */
export function loadWindowState(defaults: WindowStateDefaults): WindowState {
  const savedState = store.get('windowState', DEFAULT_STATE);

  // Ensure minimum dimensions
  const width = Math.max(savedState.width, defaults.minWidth);
  const height = Math.max(savedState.height, defaults.minHeight);

  // Create bounds object for validation
  const bounds: Rectangle = {
    x: savedState.x,
    y: savedState.y,
    width,
    height,
  };

  // If bounds are not visible on any display, center on primary display
  if (!windowBoundsAreVisible(bounds)) {
    const centered = getCenteredBounds(
      defaults.defaultWidth,
      defaults.defaultHeight
    );
    return {
      ...centered,
      width: defaults.defaultWidth,
      height: defaults.defaultHeight,
      isMaximized: false,
    };
  }

  return {
    ...savedState,
    width,
    height,
  };
}

/**
 * Save current window state to storage
 */
export function saveWindowState(window: BrowserWindow): void {
  if (!window || window.isDestroyed()) return;

  const isMaximized = window.isMaximized();

  // Only save position/size if not maximized
  // (otherwise we'd lose the normal window position)
  if (!isMaximized) {
    const bounds = window.getBounds();
    store.set('windowState', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: false,
    });
  } else {
    // Just update the maximized flag
    const currentState = store.get('windowState', DEFAULT_STATE);
    store.set('windowState', {
      ...currentState,
      isMaximized: true,
    });
  }
}

/**
 * Get preference: minimize to tray
 */
export function getMinimizeToTray(): boolean {
  return store.get('minimizeToTray', process.platform === 'darwin');
}

/**
 * Set preference: minimize to tray
 */
export function setMinimizeToTray(value: boolean): void {
  store.set('minimizeToTray', value);
}

/**
 * Get preference: close to tray (instead of quitting)
 */
export function getCloseToTray(): boolean {
  return store.get('closeToTray', process.platform === 'darwin');
}

/**
 * Set preference: close to tray
 */
export function setCloseToTray(value: boolean): void {
  store.set('closeToTray', value);
}

/**
 * Manage window state tracking (save on resize/move events)
 * Call this after creating the window
 */
export function trackWindowState(window: BrowserWindow): void {
  // Debounce save to avoid excessive disk writes during resize/move
  let saveTimeout: NodeJS.Timeout | null = null;

  const debouncedSave = (): void => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      saveWindowState(window);
    }, 500);
  };

  window.on('resize', debouncedSave);
  window.on('move', debouncedSave);
  window.on('maximize', debouncedSave);
  window.on('unmaximize', debouncedSave);

  // Save immediately on close
  window.on('close', () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveWindowState(window);
  });
}
