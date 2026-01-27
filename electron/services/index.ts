/**
 * Export all Electron main process services
 */

export { databaseService, getPrismaClient } from './database';
export { initializeDatabase, cleanupDatabase } from './init-database';
export { performStartupCleanup, hasStaleStates } from './startup-cleanup';
export type { StartupCleanupResult } from './startup-cleanup';
export { terminalManager } from './terminal';
export { gitService } from './git';
export type { WorktreeInfo, BranchInfo, GitStatus } from './git';
export { claudeHooksService } from './claude-hooks';
export { supabaseService } from './supabase';
export type { ConnectionStatus, Session, AuthChangeEvent } from './supabase';
export {
  isValidOAuthCallbackUrl,
  parseOAuthCallback,
  isDeepLink,
  getDeepLinkPath,
} from './deep-link';
export type { OAuthTokens, OAuthError, OAuthCallbackResult } from './deep-link';
