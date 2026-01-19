/**
 * Database Service Type Definitions
 *
 * This file defines the expected interface for the database service.
 * The actual implementation should be created in database.ts
 */

import type { PrismaClient } from '@prisma/client';

/**
 * Database service interface
 */
export interface DatabaseService {
  /**
   * Get the Prisma client instance
   */
  getClient(): PrismaClient;

  /**
   * Initialize the database
   */
  initialize(): Promise<void>;

  /**
   * Close the database connection
   */
  close(): Promise<void>;
}

/**
 * The database service singleton instance
 */
export declare const databaseService: DatabaseService;
