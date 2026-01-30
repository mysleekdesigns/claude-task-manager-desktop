/**
 * CLAUDE.md Detection Service
 *
 * Detects and reads CLAUDE.md files from project directories.
 * Supports both standard (CLAUDE.md) and hidden (.claude.md) variants.
 */

import fs from 'fs/promises';
import path from 'path';
import { createIPCLogger } from '../utils/ipc-logger.js';

const logger = createIPCLogger('ClaudeMdService');

/**
 * Possible CLAUDE.md file names to check (in priority order)
 */
const CLAUDE_MD_FILENAMES = ['CLAUDE.md', '.claude.md'] as const;

/**
 * Result of detecting a CLAUDE.md file
 */
export interface ClaudeMdDetectionResult {
  /** Whether a CLAUDE.md file was found */
  found: boolean;
  /** The path to the found file (if any) */
  filePath: string | null;
  /** The content of the file (if found) */
  content: string | null;
  /** Which variant was found ('CLAUDE.md' or '.claude.md') */
  variant: string | null;
}

/**
 * ClaudeMdService handles detection and reading of CLAUDE.md files
 * from project directories.
 *
 * Features:
 * - Detects CLAUDE.md in project root
 * - Also checks for hidden .claude.md variant
 * - Graceful error handling for missing files or permission issues
 */
class ClaudeMdService {
  /**
   * Detect and read a CLAUDE.md file from the given project path.
   *
   * Checks for both CLAUDE.md and .claude.md in the project root,
   * returning the content of the first one found.
   *
   * @param projectPath - Path to the project directory
   * @returns The content of the CLAUDE.md file, or null if not found
   */
  async detectClaudeMd(projectPath: string): Promise<string | null> {
    if (!projectPath) {
      logger.warn('detectClaudeMd called with empty project path');
      return null;
    }

    logger.info(`Detecting CLAUDE.md in: ${projectPath}`);

    for (const filename of CLAUDE_MD_FILENAMES) {
      const filePath = path.join(projectPath, filename);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        logger.info(`Found ${filename} at: ${filePath}`);
        return content;
      } catch (error) {
        // File not found is expected, only log other errors
        if (error instanceof Error && 'code' in error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code !== 'ENOENT') {
            logger.warn(
              `Error reading ${filename}: ${error.message} (code: ${code})`
            );
          }
        }
        // Continue to next filename variant
      }
    }

    logger.debug(`No CLAUDE.md found in: ${projectPath}`);
    return null;
  }

  /**
   * Detect a CLAUDE.md file and return detailed information about it.
   *
   * Similar to detectClaudeMd but returns more metadata about the found file.
   *
   * @param projectPath - Path to the project directory
   * @returns Detection result with file path, content, and variant information
   */
  async detectClaudeMdWithDetails(
    projectPath: string
  ): Promise<ClaudeMdDetectionResult> {
    if (!projectPath) {
      logger.warn('detectClaudeMdWithDetails called with empty project path');
      return {
        found: false,
        filePath: null,
        content: null,
        variant: null,
      };
    }

    logger.info(`Detecting CLAUDE.md with details in: ${projectPath}`);

    for (const filename of CLAUDE_MD_FILENAMES) {
      const filePath = path.join(projectPath, filename);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        logger.info(`Found ${filename} at: ${filePath}`);
        return {
          found: true,
          filePath,
          content,
          variant: filename,
        };
      } catch (error) {
        // File not found is expected, only log other errors
        if (error instanceof Error && 'code' in error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code !== 'ENOENT') {
            logger.warn(
              `Error reading ${filename}: ${error.message} (code: ${code})`
            );
          }
        }
        // Continue to next filename variant
      }
    }

    logger.debug(`No CLAUDE.md found in: ${projectPath}`);
    return {
      found: false,
      filePath: null,
      content: null,
      variant: null,
    };
  }

  /**
   * Check if a CLAUDE.md file exists in the given project path.
   *
   * This is a lightweight check that doesn't read the file content.
   *
   * @param projectPath - Path to the project directory
   * @returns true if a CLAUDE.md file exists, false otherwise
   */
  async exists(projectPath: string): Promise<boolean> {
    if (!projectPath) {
      return false;
    }

    for (const filename of CLAUDE_MD_FILENAMES) {
      const filePath = path.join(projectPath, filename);

      try {
        await fs.access(filePath, fs.constants.R_OK);
        return true;
      } catch {
        // File not accessible, try next variant
      }
    }

    return false;
  }
}

/**
 * Export a singleton instance of ClaudeMdService
 */
export const claudeMdService = new ClaudeMdService();
