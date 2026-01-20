/**
 * Export all Electron main process services
 */

export { databaseService, getPrismaClient } from './database';
export { initializeDatabase, cleanupDatabase } from './init-database';
export { terminalManager } from './terminal';
export { gitService } from './git';
export type { WorktreeInfo, BranchInfo, GitStatus } from './git';
