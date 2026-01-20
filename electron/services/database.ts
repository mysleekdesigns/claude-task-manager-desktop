// Note: PrismaClient will be available after running 'npx prisma generate'
// This is a type-only import for now - the actual Prisma client is generated
import type { PrismaClient as PrismaClientType } from '@prisma/client';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import { getDatabasePath, getBackupsPath, ensureDirectory } from '../utils/paths';

/**
 * DatabaseService handles all database operations including:
 * - Prisma client initialization
 * - Connection management
 * - Migration execution
 * - Backup and restore operations
 */
class DatabaseService {
  private prisma: PrismaClientType | null = null;
  private databaseUrl: string = '';

  /**
   * Get the database file path in the user data directory.
   */
  getDatabasePath(): string {
    return getDatabasePath();
  }

  /**
   * Get the database URL for Prisma.
   */
  private getDatabaseUrl(): string {
    if (this.databaseUrl) {
      return this.databaseUrl;
    }

    const dbPath = this.getDatabasePath();
    this.databaseUrl = `file:${dbPath}`;
    return this.databaseUrl;
  }

  /**
   * Initialize the database connection.
   * This should be called when the Electron app starts.
   *
   * For Prisma 6: Uses DATABASE_URL environment variable
   * For Prisma 7+: Uses the adapter pattern with better-sqlite3
   *
   * @returns The initialized Prisma client
   */
  async initialize(): Promise<PrismaClientType> {
    if (this.prisma) {
      return this.prisma;
    }

    try {
      // Dynamically import PrismaClient to work with Vite bundling
      const { PrismaClient } = await import('@prisma/client');

      // Ensure the user data directory exists
      const userDataPath = app.getPath('userData');
      ensureDirectory(userDataPath);

      // Get the database path
      const dbPath = this.getDatabasePath();

      // Initialize Prisma client
      const logLevels = process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'];

      // Try to use adapter pattern (Prisma 7+)
      let adapter: unknown = undefined;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PrismaSqlite } = require('@prisma/adapter-sqlite');
        const sqliteClient = new Database(dbPath);
        adapter = new PrismaSqlite(sqliteClient);
        console.log('[Database] Using Prisma 7+ adapter pattern');
      } catch {
        // Fallback to Prisma 6 style with DATABASE_URL
        process.env['DATABASE_URL'] = `file:${dbPath}`;
        console.log('[Database] Using Prisma 6 environment variable pattern');
      }

      const clientConfig = adapter
        ? { log: logLevels, adapter }
        : { log: logLevels };

      this.prisma = new PrismaClient(clientConfig as any) as PrismaClientType;

      // Test the connection
      await this.prisma.$connect();

      console.log('[Database] Connected successfully to:', dbPath);

      return this.prisma;
    } catch (error) {
      console.error('[Database] Initialization failed:', error);
      throw new Error(`Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the Prisma client instance.
   * Throws an error if the database has not been initialized.
   *
   * @returns The Prisma client
   */
  getClient(): PrismaClientType {
    if (!this.prisma) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.prisma;
  }

  /**
   * Run pending migrations.
   * This is typically called on app startup in production to apply
   * any new migrations from updates.
   *
   * @throws Error if migrations fail
   */
  async runMigrations(): Promise<void> {
    try {
      console.log('[Database] Running migrations...');

      const databaseUrl = this.getDatabaseUrl();

      // Run prisma migrate deploy to apply pending migrations
      execSync('npx prisma migrate deploy', {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
        },
        stdio: 'inherit',
      });

      console.log('[Database] Migrations completed successfully');
    } catch (error) {
      console.error('[Database] Migration failed:', error);
      throw new Error(`Failed to run migrations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a backup of the database.
   *
   * @param backupPath - Optional custom backup path. If not provided, uses default backup directory with timestamp.
   * @returns The path to the created backup file
   */
  async backup(backupPath?: string): Promise<string> {
    try {
      const dbPath = this.getDatabasePath();

      // Check if database exists
      if (!fs.existsSync(dbPath)) {
        throw new Error('Database file does not exist');
      }

      // Generate backup path if not provided
      let targetPath: string;
      if (backupPath) {
        targetPath = backupPath;
      } else {
        const backupsDir = getBackupsPath();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        targetPath = path.join(backupsDir, `claude-tasks-${timestamp}.db`);
      }

      // Ensure backup directory exists
      const backupDir = path.dirname(targetPath);
      ensureDirectory(backupDir);

      // Disconnect to ensure all writes are flushed
      if (this.prisma) {
        await this.prisma.$disconnect();
      }

      // Copy database file
      fs.copyFileSync(dbPath, targetPath);

      // Reconnect
      if (this.prisma) {
        await this.prisma.$connect();
      }

      console.log('[Database] Backup created:', targetPath);
      return targetPath;
    } catch (error) {
      console.error('[Database] Backup failed:', error);
      throw new Error(`Failed to backup database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore the database from a backup file.
   *
   * @param backupPath - Path to the backup file to restore from
   */
  async restore(backupPath: string): Promise<void> {
    try {
      const dbPath = this.getDatabasePath();

      // Check if backup file exists
      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file does not exist');
      }

      // Disconnect from database
      if (this.prisma) {
        await this.prisma.$disconnect();
      }

      // Create a backup of current database before restoring (safety measure)
      if (fs.existsSync(dbPath)) {
        const safetyBackup = `${dbPath}.before-restore`;
        fs.copyFileSync(dbPath, safetyBackup);
        console.log('[Database] Created safety backup:', safetyBackup);
      }

      // Restore from backup
      fs.copyFileSync(backupPath, dbPath);

      // Reconnect to database
      if (this.prisma) {
        await this.prisma.$connect();
      }

      console.log('[Database] Restored from backup:', backupPath);
    } catch (error) {
      console.error('[Database] Restore failed:', error);
      throw new Error(`Failed to restore database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get database statistics and information.
   *
   * @returns Database stats including size and table counts
   */
  async getStats(): Promise<{
    path: string;
    size: number;
    sizeFormatted: string;
    exists: boolean;
  }> {
    const dbPath = this.getDatabasePath();
    const exists = fs.existsSync(dbPath);

    let size = 0;
    if (exists) {
      const stats = fs.statSync(dbPath);
      size = stats.size;
    }

    return {
      path: dbPath,
      size,
      sizeFormatted: this.formatBytes(size),
      exists,
    };
  }

  /**
   * Format bytes to human-readable string.
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Disconnect from the database.
   * This should be called when the app is closing.
   */
  async disconnect(): Promise<void> {
    if (this.prisma) {
      try {
        await this.prisma.$disconnect();
        console.log('[Database] Disconnected successfully');
        this.prisma = null;
      } catch (error) {
        console.error('[Database] Disconnect failed:', error);
        throw new Error(`Failed to disconnect from database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Check if the database is initialized and connected.
   */
  isConnected(): boolean {
    return this.prisma !== null;
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();

// Export prisma getter for convenience
export const getPrismaClient = (): PrismaClientType => {
  return databaseService.getClient();
};
