import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Project root directory
 */
const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * Path to the built Electron main process entry
 */
const MAIN_JS_PATH = path.join(PROJECT_ROOT, 'dist-electron/main.js');

/**
 * Custom test fixtures for Electron E2E testing
 */
export interface ElectronTestFixtures {
  /**
   * The Electron application instance
   */
  electronApp: ElectronApplication;

  /**
   * The main window page instance
   */
  window: Page;

  /**
   * Helper to wait for the app to be fully loaded
   */
  waitForAppReady: () => Promise<void>;

  /**
   * Helper to get the app version
   */
  getAppVersion: () => Promise<string>;

  /**
   * Helper to take a screenshot with a descriptive name
   */
  takeScreenshot: (name: string) => Promise<void>;
}

/**
 * Extended test with Electron fixtures
 */
export const test = base.extend<ElectronTestFixtures>({
  /**
   * Launch the Electron application
   */
  electronApp: async ({}, use) => {
    // Launch Electron app
    const electronApp = await electron.launch({
      args: [MAIN_JS_PATH],
      cwd: PROJECT_ROOT,
      env: {
        ...process.env as { [key: string]: string },
        // Force test mode
        NODE_ENV: 'test',
        // Disable hardware acceleration for consistent rendering in CI
        ELECTRON_DISABLE_GPU: '1',
      },
      // Timeout for app launch
      timeout: 30_000,
    });

    // Use the app in the test
    await use(electronApp);

    // Cleanup: close the app after the test
    await electronApp.close();
  },

  /**
   * Get the main window
   */
  window: async ({ electronApp }, use) => {
    // Wait for the first window to open
    const window = await electronApp.firstWindow();

    // Wait for the window to be ready
    await window.waitForLoadState('domcontentloaded');

    // Use the window in the test
    await use(window);
  },

  /**
   * Helper to wait for the app to be fully loaded
   */
  waitForAppReady: async ({ window }, use) => {
    const waitForAppReady = async () => {
      // Wait for the main content to be visible
      // Adjust the selector based on your app's root element
      await window.waitForSelector('[data-testid="app-root"], #root', {
        state: 'visible',
        timeout: 30_000,
      });

      // Additional wait for React to hydrate
      await window.waitForFunction(() => {
        const root = document.querySelector('#root');
        return root && root.children.length > 0;
      }, { timeout: 30_000 });
    };

    await use(waitForAppReady);
  },

  /**
   * Helper to get the app version
   */
  getAppVersion: async ({ electronApp }, use) => {
    const getAppVersion = async (): Promise<string> => {
      return electronApp.evaluate(async ({ app }) => {
        return app.getVersion();
      });
    };

    await use(getAppVersion);
  },

  /**
   * Helper to take a screenshot with a descriptive name
   */
  takeScreenshot: async ({ window }, use, testInfo) => {
    const takeScreenshot = async (name: string) => {
      const screenshotPath = path.join(
        PROJECT_ROOT,
        'e2e/screenshots',
        `${testInfo.title.replace(/\s+/g, '-')}-${name}.png`
      );
      await window.screenshot({ path: screenshotPath });
    };

    await use(takeScreenshot);
  },
});

/**
 * Re-export expect for convenience
 */
export { expect } from '@playwright/test';

/**
 * Page object helpers for common operations
 */
export class AppPageHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to a route using React Router
   */
  async navigateTo(route: string): Promise<void> {
    // Use evaluate to trigger navigation via React Router
    await this.page.evaluate((routePath) => {
      globalThis.history.pushState({}, '', routePath);
      globalThis.dispatchEvent(new PopStateEvent('popstate'));
    }, route);

    // Wait for navigation to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Click a navigation item in the sidebar
   */
  async clickNavItem(label: string): Promise<void> {
    await this.page.click(`[data-testid="nav-${label.toLowerCase()}"], text="${label}"`);
  }

  /**
   * Wait for a toast notification
   */
  async waitForToast(message: string): Promise<void> {
    await this.page.waitForSelector(`text="${message}"`, { timeout: 10_000 });
  }

  /**
   * Get the current route path
   */
  async getCurrentRoute(): Promise<string> {
    return this.page.evaluate(() => globalThis.location.pathname);
  }

  /**
   * Check if a dialog is open
   */
  async isDialogOpen(): Promise<boolean> {
    const dialog = await this.page.$('[role="dialog"], [data-state="open"]');
    return dialog !== null;
  }

  /**
   * Close any open dialog
   */
  async closeDialog(): Promise<void> {
    // Try pressing Escape first
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);

    // If dialog is still open, try clicking the close button
    const closeButton = await this.page.$('[data-testid="dialog-close"], button[aria-label="Close"]');
    if (closeButton) {
      await closeButton.click();
    }
  }

  /**
   * Wait for loading state to complete
   */
  async waitForLoadingComplete(): Promise<void> {
    // Wait for any loading spinners to disappear
    await this.page.waitForSelector('[data-testid="loading"], .loading-spinner', {
      state: 'hidden',
      timeout: 30_000,
    }).catch(() => {
      // Ignore if no loading indicator found
    });
  }
}

/**
 * Create page helpers for a window
 */
export function createPageHelpers(page: Page): AppPageHelpers {
  return new AppPageHelpers(page);
}
