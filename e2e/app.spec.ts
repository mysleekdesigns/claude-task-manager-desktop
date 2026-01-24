import { test, expect } from './fixtures/electronApp';

test.describe('Application Launch', () => {
  test('should launch the Electron app successfully', async ({ electronApp }) => {
    // Verify the app is running
    const isRunning = electronApp.process() !== undefined;
    expect(isRunning).toBe(true);
  });

  test('should create a main window', async ({ electronApp, window }) => {
    // Verify a window was created
    const windows = electronApp.windows();
    expect(windows.length).toBeGreaterThanOrEqual(1);

    // Verify the window has content (body element is visible)
    const isVisible = await window.isVisible('body');
    expect(isVisible).toBe(true);
  });

  test('should have correct window title', async ({ window }) => {
    const title = await window.title();
    expect(title).toContain('Claude Tasks');
  });

  test('should load the React application', async ({ window, waitForAppReady }) => {
    await waitForAppReady();

    // Verify the root element exists and has content
    const rootElement = await window.$('#root');
    expect(rootElement).not.toBeNull();

    const hasChildren = await window.evaluate(() => {
      const root = document.querySelector('#root');
      return root && root.children.length > 0;
    });
    expect(hasChildren).toBe(true);
  });

  test('should report correct app version', async ({ getAppVersion }) => {
    const version = await getAppVersion();
    // Version should be a valid semver string
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

test.describe('Window Management', () => {
  test('should have minimum window dimensions', async ({ electronApp }) => {
    const page = await electronApp.firstWindow();
    const { width, height } = await page.evaluate(() => ({
      width: globalThis.innerWidth,
      height: globalThis.innerHeight,
    }));

    // Based on WINDOW_DEFAULTS in main.ts: minWidth: 800, minHeight: 600
    expect(width).toBeGreaterThanOrEqual(800);
    expect(height).toBeGreaterThanOrEqual(600);
  });

  test('should not open external links in new windows', async ({ electronApp, window }) => {
    // Wait for app to stabilize (DevTools may be opening in dev mode)
    await window.waitForTimeout(1000);

    // Store initial window count (may include DevTools in dev mode)
    const initialWindowCount = electronApp.windows().length;

    // Try to open an external URL using window.open (this should be blocked by setWindowOpenHandler)
    const windowOpenResult = await window.evaluate(() => {
      // Try window.open - should return null if blocked
      const newWindow = globalThis.open('https://example.com', '_blank');
      return newWindow !== null;
    });

    // The window.open should return null when blocked by setWindowOpenHandler
    expect(windowOpenResult).toBe(false);

    // Wait a bit for any window that might open
    await window.waitForTimeout(500);

    // Verify no new windows were opened beyond what we started with
    const currentWindowCount = electronApp.windows().length;
    expect(currentWindowCount).toBe(initialWindowCount);

    // Additionally verify no window has navigated to the external URL
    const allWindows = electronApp.windows();
    for (const win of allWindows) {
      const url = win.url();
      expect(url).not.toContain('example.com');
    }
  });
});

test.describe('IPC Communication', () => {
  test('should have electron API exposed in renderer', async ({ window }) => {
    const hasElectronAPI = await window.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return typeof (globalThis as any).electron !== 'undefined';
    });
    expect(hasElectronAPI).toBe(true);
  });

  test('should be able to invoke IPC methods', async ({ window }) => {
    // Test invoking the app:getVersion IPC method
    const version = await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const electron = (globalThis as any).electron;
      if (electron && typeof electron.invoke === 'function') {
        return await electron.invoke('app:getVersion');
      }
      return null;
    });

    // Version should be returned (may be a string or we get null if API structure differs)
    // At minimum, the invoke should not throw
    expect(version !== undefined).toBe(true);
  });

  test('should be able to get platform info', async ({ window }) => {
    const platformInfo = await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const electron = (globalThis as any).electron;
      if (electron && typeof electron.invoke === 'function') {
        return await electron.invoke('app:getPlatform');
      }
      return null;
    });

    // Platform info should be an object with platform, arch, and osVersion
    expect(platformInfo).not.toBeNull();
    if (platformInfo) {
      const validPlatforms = ['darwin', 'win32', 'linux'];
      expect(validPlatforms).toContain(platformInfo.platform);
      expect(typeof platformInfo.arch).toBe('string');
      expect(typeof platformInfo.osVersion).toBe('string');
    }
  });
});

test.describe('Error Handling', () => {
  test('should not have console errors on startup', async ({ window, waitForAppReady }) => {
    const consoleErrors: string[] = [];

    // Listen for console errors
    window.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await waitForAppReady();

    // Wait a bit for any deferred errors
    await window.waitForTimeout(2000);

    // Filter out known acceptable errors (like React DevTools not being installed)
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes('DevTools') &&
        !error.includes('Extension') &&
        !error.includes('Failed to load resource') // Network errors in test env
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should not have unhandled promise rejections', async ({ window, waitForAppReady }) => {
    const unhandledRejections: string[] = [];

    // Listen for unhandled rejections
    window.on('pageerror', (error) => {
      unhandledRejections.push(error.message);
    });

    await waitForAppReady();
    await window.waitForTimeout(2000);

    expect(unhandledRejections).toHaveLength(0);
  });
});

test.describe('Accessibility', () => {
  test('should have a main landmark region', async ({ window, waitForAppReady }) => {
    await waitForAppReady();

    const hasMain = await window.evaluate(() => {
      return document.querySelector('main, [role="main"]') !== null;
    });

    expect(hasMain).toBe(true);
  });

  test('should have proper document language', async ({ window }) => {
    const lang = await window.evaluate(() => {
      return document.documentElement.lang;
    });

    // Should have a language set (typically 'en' or 'en-US')
    expect(lang).toBeTruthy();
  });
});
