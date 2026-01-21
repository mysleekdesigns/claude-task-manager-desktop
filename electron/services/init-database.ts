/**
 * Database initialization utility
 * Call this when the Electron app starts to set up the database
 */

import { databaseService } from './database';

/**
 * Initialize the database for the application.
 * This should be called in the main process when the app is ready.
 *
 * @param runMigrations - Whether to run migrations (typically true in production)
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeDatabase(runMigrations = false): Promise<void> {
  try {
    console.log('[Database] Starting initialization...');

    // Initialize the database connection
    await databaseService.initialize();
    console.log('[Database] Connection established');

    // Run migrations if requested (production mode)
    if (runMigrations) {
      console.log('[Database] Running migrations...');
      databaseService.runMigrations();
      console.log('[Database] Migrations completed');
    }

    // Log database stats
    const stats = databaseService.getStats();
    console.log(`[Database] Ready at: ${stats.path}`);
    console.log(`[Database] Size: ${stats.sizeFormatted}`);
  } catch (error) {
    console.error('[Database] Initialization failed:', error);
    throw error;
  }
}

/**
 * Cleanup database connection.
 * This should be called when the app is quitting.
 */
export async function cleanupDatabase(): Promise<void> {
  try {
    console.log('[Database] Cleaning up...');
    await databaseService.disconnect();
    console.log('[Database] Disconnected successfully');
  } catch (error) {
    console.error('[Database] Cleanup failed:', error);
    // Don't throw - app is quitting anyway
  }
}
