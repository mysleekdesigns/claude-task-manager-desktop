import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Get the user data directory path.
 * This is platform-specific:
 * - macOS: ~/Library/Application Support/claude-task-manager-desktop
 * - Windows: %APPDATA%/claude-task-manager-desktop
 * - Linux: ~/.config/claude-task-manager-desktop
 */
export function getUserDataPath(): string {
  return app.getPath('userData');
}

/**
 * Get the database file path.
 * Returns the full path to the SQLite database file.
 */
export function getDatabasePath(): string {
  const userDataPath = getUserDataPath();
  return path.join(userDataPath, 'claude-tasks.db');
}

/**
 * Get the backups directory path.
 */
export function getBackupsPath(): string {
  const userDataPath = getUserDataPath();
  const backupsPath = path.join(userDataPath, 'backups');

  // Ensure backups directory exists
  if (!fs.existsSync(backupsPath)) {
    fs.mkdirSync(backupsPath, { recursive: true });
  }

  return backupsPath;
}

/**
 * Get the logs directory path.
 */
export function getLogsPath(): string {
  const userDataPath = getUserDataPath();
  const logsPath = path.join(userDataPath, 'logs');

  // Ensure logs directory exists
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath, { recursive: true });
  }

  return logsPath;
}

/**
 * Normalize path for the current platform.
 * Handles path separators and resolves to absolute path.
 */
export function normalizePath(inputPath: string): string {
  return path.normalize(path.resolve(inputPath));
}

/**
 * Check if a path exists and is accessible.
 */
export function pathExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists, creating it if necessary.
 */
export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
