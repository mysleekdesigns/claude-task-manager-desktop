/**
 * Conflict Resolver Service
 *
 * Implements Last-Write-Wins (LWW) conflict resolution for sync operations
 * between local SQLite and Supabase cloud.
 *
 * Features:
 * - Detects conflicts by comparing sync_version on updates
 * - Compares updated_at timestamps for LWW resolution
 * - Identifies specific fields that are in conflict
 * - Logs all conflicts to ConflictLog for audit trail
 * - Emits conflict events to renderer for user notification
 *
 * @module electron/services/conflict-resolver
 * @phase 18.4 & 18.5 - Conflict Detection & Resolution
 */

import { BrowserWindow } from 'electron';
import { getPrismaClient } from './database';

// ============================================================================
// Types
// ============================================================================

/**
 * Supported table names for conflict resolution
 */
export type ConflictTable = 'Project' | 'Task';

/**
 * Resolution strategy result
 */
export type ResolutionDecision = 'local_wins' | 'remote_wins' | 'needs_merge';

/**
 * Field-level conflict information
 */
export interface FieldConflict {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
}

/**
 * Conflict detection result
 */
export interface ConflictDetectionResult {
  hasConflict: boolean;
  decision: ResolutionDecision;
  conflictingFields: FieldConflict[];
  localVersion: number;
  remoteVersion: number;
  localUpdatedAt: Date | null;
  remoteUpdatedAt: Date | null;
}

/**
 * Local record data structure (from Prisma)
 */
export interface LocalRecord {
  id: string;
  syncVersion: number;
  updatedAt: Date;
  [key: string]: unknown;
}

/**
 * Remote record data structure (from Supabase)
 */
export interface RemoteRecord {
  id: string;
  sync_version: number;
  updated_at: string;
  [key: string]: unknown;
}

/**
 * Conflict event payload sent to renderer
 */
export interface ConflictEventPayload {
  table: ConflictTable;
  recordId: string;
  localVersion: number;
  remoteVersion: number;
  decision: ResolutionDecision;
  conflictingFields: FieldConflict[];
  resolvedAt: Date;
}

/**
 * Conflict log entry for audit trail
 */
export interface ConflictLogEntry {
  table: ConflictTable;
  recordId: string;
  localVersion: number;
  remoteVersion: number;
  resolution: ResolutionDecision;
  localData: Record<string, unknown>;
  remoteData: Record<string, unknown>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Fields to exclude from conflict comparison (metadata fields)
 */
const EXCLUDED_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'syncVersion',
  'sync_version',
  'lastSyncedAt',
  'last_synced_at',
  'supabaseId',
  'created_at',
  'updated_at',
]);

/**
 * Field mapping from Supabase snake_case to Prisma camelCase
 */
const FIELD_MAPPING: Record<string, string> = {
  target_path: 'targetPath',
  github_repo: 'githubRepo',
  branch_name: 'branchName',
  project_id: 'projectId',
  assignee_id: 'assigneeId',
  parent_id: 'parentId',
  claude_session_id: 'claudeSessionId',
  claude_session_name: 'claudeSessionName',
  claude_terminal_id: 'claudeTerminalId',
  claude_started_at: 'claudeStartedAt',
  claude_completed_at: 'claudeCompletedAt',
  claude_status: 'claudeStatus',
  prd_phase_number: 'prdPhaseNumber',
  prd_phase_name: 'prdPhaseName',
  scoped_prd_content: 'scopedPrdContent',
};

// ============================================================================
// ConflictResolverService Class
// ============================================================================

/**
 * Service for detecting and resolving sync conflicts using Last-Write-Wins strategy
 *
 * Provides:
 * - Conflict detection based on version numbers
 * - LWW resolution using timestamps
 * - Field-level conflict identification
 * - Audit logging to ConflictLog table
 * - Event emission to renderer
 */
class ConflictResolverService {
  private mainWindow: BrowserWindow | null = null;

  // ============================================================================
  // Window Management
  // ============================================================================

  /**
   * Set the main window reference for IPC communication
   *
   * @param window - The main BrowserWindow instance
   */
  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Clear the main window reference
   */
  public clearMainWindow(): void {
    this.mainWindow = null;
  }

  // ============================================================================
  // Conflict Detection
  // ============================================================================

  /**
   * Detect if there is a conflict between local and remote records
   *
   * A conflict exists when:
   * 1. Both local and remote have been modified (versions differ)
   * 2. The remote version is newer (indicates concurrent modification)
   *
   * @param local - Local record from SQLite
   * @param remote - Remote record from Supabase
   * @param comparableFields - Optional list of fields to compare for conflicts
   * @returns Conflict detection result with resolution decision
   */
  public detectConflict(
    local: LocalRecord,
    remote: RemoteRecord,
    comparableFields?: string[]
  ): ConflictDetectionResult {
    const localVersion = local.syncVersion;
    const remoteVersion = remote.sync_version;
    const localUpdatedAt = new Date(local.updatedAt);
    const remoteUpdatedAt = remote.updated_at ? new Date(remote.updated_at) : null;

    // No conflict if versions match or local is ahead
    if (remoteVersion <= localVersion) {
      return {
        hasConflict: false,
        decision: 'local_wins',
        conflictingFields: [],
        localVersion,
        remoteVersion,
        localUpdatedAt,
        remoteUpdatedAt: remoteUpdatedAt ?? null,
      };
    }

    // Remote version is higher - check for actual field conflicts
    const conflictingFields = this.identifyConflictingFields(
      local,
      remote,
      comparableFields
    );

    // If no fields actually differ, remote wins without conflict
    if (conflictingFields.length === 0) {
      return {
        hasConflict: false,
        decision: 'remote_wins',
        conflictingFields: [],
        localVersion,
        remoteVersion,
        localUpdatedAt,
        remoteUpdatedAt: remoteUpdatedAt ?? null,
      };
    }

    // We have actual conflicting fields - apply LWW
    const decision = this.applyLastWriteWins(localUpdatedAt, remoteUpdatedAt);

    return {
      hasConflict: true,
      decision,
      conflictingFields,
      localVersion,
      remoteVersion,
      localUpdatedAt,
      remoteUpdatedAt: remoteUpdatedAt ?? null,
    };
  }

  /**
   * Apply Last-Write-Wins resolution strategy
   *
   * Compares updated_at timestamps to determine the winner.
   * In case of equal timestamps, remote wins (server authority).
   *
   * @param localUpdatedAt - Local record's updated_at timestamp
   * @param remoteUpdatedAt - Remote record's updated_at timestamp
   * @returns Resolution decision
   */
  private applyLastWriteWins(
    localUpdatedAt: Date | null,
    remoteUpdatedAt: Date | null
  ): ResolutionDecision {
    // If either timestamp is missing, favor the one that exists
    if (!localUpdatedAt && !remoteUpdatedAt) {
      return 'remote_wins'; // Server authority when no timestamps
    }

    if (!localUpdatedAt) {
      return 'remote_wins';
    }

    if (!remoteUpdatedAt) {
      return 'local_wins';
    }

    // Compare timestamps - most recent write wins
    const localTime = localUpdatedAt.getTime();
    const remoteTime = remoteUpdatedAt.getTime();

    if (localTime > remoteTime) {
      return 'local_wins';
    }

    if (remoteTime > localTime) {
      return 'remote_wins';
    }

    // Equal timestamps - remote wins (server authority)
    return 'remote_wins';
  }

  /**
   * Identify which fields are in conflict between local and remote records
   *
   * @param local - Local record
   * @param remote - Remote record
   * @param comparableFields - Optional list of fields to compare
   * @returns Array of field conflicts
   */
  private identifyConflictingFields(
    local: LocalRecord,
    remote: RemoteRecord,
    comparableFields?: string[]
  ): FieldConflict[] {
    const conflicts: FieldConflict[] = [];

    // Build a normalized remote record with camelCase keys
    const normalizedRemote: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(remote)) {
      const normalizedKey = FIELD_MAPPING[key] ?? key;
      normalizedRemote[normalizedKey] = value;
    }

    // Determine which fields to compare
    const fieldsToCompare = comparableFields ?? Object.keys(local);

    for (const field of fieldsToCompare) {
      // Skip excluded fields
      if (EXCLUDED_FIELDS.has(field)) {
        continue;
      }

      const localValue = local[field];
      const remoteValue = normalizedRemote[field];

      // Skip if remote doesn't have this field
      if (remoteValue === undefined) {
        continue;
      }

      // Compare values
      if (!this.valuesAreEqual(localValue, remoteValue)) {
        conflicts.push({
          field,
          localValue,
          remoteValue,
        });
      }
    }

    return conflicts;
  }

  /**
   * Compare two values for equality, handling special cases
   *
   * @param local - Local value
   * @param remote - Remote value
   * @returns True if values are equal
   */
  private valuesAreEqual(local: unknown, remote: unknown): boolean {
    // Handle null/undefined
    if (local === null || local === undefined) {
      return remote === null || remote === undefined;
    }

    if (remote === null || remote === undefined) {
      return false;
    }

    // Handle dates
    if (local instanceof Date) {
      const remoteDate = remote instanceof Date ? remote : new Date(remote as string);
      return local.getTime() === remoteDate.getTime();
    }

    // Handle arrays (stored as JSON strings in SQLite)
    if (Array.isArray(local)) {
      const remoteArray = typeof remote === 'string' ? (JSON.parse(remote) as unknown[]) : remote;
      return JSON.stringify(local) === JSON.stringify(remoteArray);
    }

    if (typeof local === 'string' && local.startsWith('[')) {
      try {
        const localArray = JSON.parse(local) as unknown[];
        const remoteArray = typeof remote === 'string' ? (JSON.parse(remote) as unknown[]) : remote;
        return JSON.stringify(localArray) === JSON.stringify(remoteArray);
      } catch {
        // Not valid JSON, compare as strings
      }
    }

    // Handle objects
    if (typeof local === 'object' && typeof remote === 'object') {
      return JSON.stringify(local) === JSON.stringify(remote);
    }

    // Default comparison
    return local === remote;
  }

  // ============================================================================
  // Conflict Resolution
  // ============================================================================

  /**
   * Resolve a conflict and return the winning data
   *
   * @param local - Local record
   * @param remote - Remote record
   * @param decision - Resolution decision
   * @returns The winning record data (normalized to local format)
   */
  public resolveConflict(
    local: LocalRecord,
    remote: RemoteRecord,
    decision: ResolutionDecision
  ): Record<string, unknown> {
    if (decision === 'local_wins') {
      // Return local data with incremented version
      return {
        ...this.extractDataFields(local),
        syncVersion: Math.max(local.syncVersion || 0, remote.sync_version || 0) + 1,
      };
    }

    if (decision === 'remote_wins') {
      // Return remote data transformed to local format
      return {
        ...this.transformRemoteToLocal(remote),
        syncVersion: (remote.sync_version || 0) + 1,
        lastSyncedAt: new Date(),
      };
    }

    // For needs_merge, we should handle this case specially
    // For now, default to remote wins with a higher version
    console.warn(
      '[ConflictResolver] needs_merge not fully implemented, defaulting to remote_wins'
    );
    return {
      ...this.transformRemoteToLocal(remote),
      syncVersion: Math.max(local.syncVersion || 0, remote.sync_version || 0) + 1,
      lastSyncedAt: new Date(),
    };
  }

  /**
   * Extract data fields from a local record (excluding metadata)
   *
   * @param local - Local record
   * @returns Data fields only
   */
  private extractDataFields(local: LocalRecord): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(local)) {
      if (!EXCLUDED_FIELDS.has(key)) {
        data[key] = value;
      }
    }

    return data;
  }

  /**
   * Transform remote record from Supabase format to local Prisma format
   *
   * @param remote - Remote record with snake_case keys
   * @returns Transformed record with camelCase keys
   */
  private transformRemoteToLocal(remote: RemoteRecord): Record<string, unknown> {
    const transformed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(remote)) {
      // Skip excluded fields
      if (EXCLUDED_FIELDS.has(key)) {
        continue;
      }

      // Map snake_case to camelCase
      const localKey = FIELD_MAPPING[key] ?? key;
      transformed[localKey] = value;
    }

    return transformed;
  }

  // ============================================================================
  // Conflict Logging
  // ============================================================================

  /**
   * Log a conflict to the ConflictLog table for audit trail
   *
   * @param entry - Conflict log entry data
   * @returns The created ConflictLog record
   */
  public async logConflict(entry: ConflictLogEntry): Promise<void> {
    try {
      const prisma = getPrismaClient();

      await prisma.conflictLog.create({
        data: {
          table: entry.table,
          recordId: entry.recordId,
          localVersion: entry.localVersion,
          remoteVersion: entry.remoteVersion,
          resolution: entry.resolution,
          localData: JSON.stringify(entry.localData),
          remoteData: JSON.stringify(entry.remoteData),
        },
      });

      console.log(
        `[ConflictResolver] Logged conflict for ${entry.table}:${entry.recordId} - ${entry.resolution}`
      );
    } catch (error) {
      // Log error but don't throw - audit logging should not block sync
      console.error('[ConflictResolver] Error logging conflict:', error);
    }
  }

  /**
   * Get conflict history for a specific record
   *
   * @param table - Table name
   * @param recordId - Record ID
   * @param limit - Maximum number of entries to return
   * @returns Array of conflict log entries
   */
  public async getConflictHistory(
    table: ConflictTable,
    recordId: string,
    limit = 10
  ): Promise<{
    id: string;
    localVersion: number;
    remoteVersion: number;
    resolution: string;
    localData: string;
    remoteData: string;
    resolvedAt: Date;
    createdAt: Date;
  }[]> {
    const prisma = getPrismaClient();

    return prisma.conflictLog.findMany({
      where: {
        table,
        recordId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Get all recent conflicts across all tables
   *
   * @param limit - Maximum number of entries to return
   * @returns Array of conflict log entries
   */
  public async getRecentConflicts(limit = 50): Promise<{
    id: string;
    table: string;
    recordId: string;
    localVersion: number;
    remoteVersion: number;
    resolution: string;
    resolvedAt: Date;
    createdAt: Date;
  }[]> {
    const prisma = getPrismaClient();

    return prisma.conflictLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        table: true,
        recordId: true,
        localVersion: true,
        remoteVersion: true,
        resolution: true,
        resolvedAt: true,
        createdAt: true,
      },
    });
  }

  // ============================================================================
  // Event Emission
  // ============================================================================

  /**
   * Emit a conflict event to the renderer process
   *
   * @param payload - Conflict event payload
   */
  public emitConflictEvent(payload: ConflictEventPayload): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sync:conflict', payload);

      console.log(
        `[ConflictResolver] Emitted conflict event for ${payload.table}:${payload.recordId}`
      );
    }
  }

  /**
   * Emit a conflict resolved event to the renderer process
   *
   * @param table - Table name
   * @param recordId - Record ID
   * @param decision - Resolution decision
   */
  public emitConflictResolvedEvent(
    table: ConflictTable,
    recordId: string,
    decision: ResolutionDecision
  ): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sync:conflict-resolved', {
        table,
        recordId,
        decision,
        resolvedAt: new Date(),
      });
    }
  }

  // ============================================================================
  // High-Level Resolution Method
  // ============================================================================

  /**
   * Detect, resolve, and log a conflict in one operation
   *
   * This is the main entry point for conflict handling during sync operations.
   *
   * @param table - Table name
   * @param local - Local record
   * @param remote - Remote record
   * @returns Resolution result with winning data
   */
  public async handleConflict(
    table: ConflictTable,
    local: LocalRecord,
    remote: RemoteRecord
  ): Promise<{
    hasConflict: boolean;
    decision: ResolutionDecision;
    resolvedData: Record<string, unknown>;
  }> {
    // Detect conflict
    const detection = this.detectConflict(local, remote);

    // If there's a conflict, log it and emit event
    if (detection.hasConflict) {
      // Log to database
      await this.logConflict({
        table,
        recordId: local.id,
        localVersion: detection.localVersion,
        remoteVersion: detection.remoteVersion,
        resolution: detection.decision,
        localData: this.extractDataFields(local),
        remoteData: this.transformRemoteToLocal(remote),
      });

      // Emit event to renderer
      this.emitConflictEvent({
        table,
        recordId: local.id,
        localVersion: detection.localVersion,
        remoteVersion: detection.remoteVersion,
        decision: detection.decision,
        conflictingFields: detection.conflictingFields,
        resolvedAt: new Date(),
      });
    }

    // Resolve conflict and return winning data
    const resolvedData = this.resolveConflict(local, remote, detection.decision);

    // Emit resolution event
    if (detection.hasConflict) {
      this.emitConflictResolvedEvent(table, local.id, detection.decision);
    }

    return {
      hasConflict: detection.hasConflict,
      decision: detection.decision,
      resolvedData,
    };
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clean up old conflict logs (older than specified days)
   *
   * @param olderThanDays - Delete logs older than this many days (default: 30)
   */
  public async cleanupOldConflictLogs(olderThanDays = 30): Promise<number> {
    const prisma = getPrismaClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.conflictLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(
      `[ConflictResolver] Cleaned up ${String(result.count)} old conflict logs`
    );

    return result.count;
  }

  /**
   * Clean up resources on app quit
   */
  public cleanup(): void {
    this.mainWindow = null;
    console.log('[ConflictResolver] Cleanup complete');
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const conflictResolverService = new ConflictResolverService();
