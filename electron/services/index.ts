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
export { syncQueueService } from './sync-queue';
export type { SyncChange, SyncStatus, SyncTable, SyncOperation } from './sync-queue';
export { realtimeService } from './realtime';
export type {
  SyncTableName,
  ChangeEventType,
  RealtimeChangePayload,
  SubscriptionStatus,
} from './realtime';
export { syncEngineService } from './sync-engine';
export type { SyncResult, SyncProgressCallback } from './sync-engine';
export { conflictResolverService } from './conflict-resolver';
export type {
  ConflictTable,
  ResolutionDecision,
  FieldConflict,
  ConflictDetectionResult,
  LocalRecord,
  RemoteRecord,
  ConflictEventPayload,
  ConflictLogEntry,
} from './conflict-resolver';
export { networkStatusService } from './network-status';
export type { NetworkStatus, NetworkStatusInfo } from './network-status';
export {
  softDeleteService,
  notDeleted,
  onlyDeleted,
  includeDeleted,
} from './soft-delete';
export type {
  SoftDeleteTable,
  SoftDeleteResult,
  RestoreResult,
  CleanupResult,
  ListDeletedOptions,
  DeletedRecordSummary,
} from './soft-delete';
export { claudeMdService } from './claudeMd';
export type { ClaudeMdDetectionResult } from './claudeMd';
