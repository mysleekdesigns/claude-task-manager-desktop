/**
 * Conflict Resolution Types
 *
 * Type definitions for sync conflict detection and resolution.
 *
 * @module types/conflict
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Entity types that can have sync conflicts
 */
export type ConflictEntityType = 'task' | 'project' | 'memory';

/**
 * Status of a sync conflict
 */
export type ConflictStatus = 'pending' | 'resolved' | 'dismissed';

/**
 * How a conflict was resolved
 */
export type ConflictResolutionType = 'keep_local' | 'keep_server' | 'merged';

// ============================================================================
// Sync Conflict
// ============================================================================

/**
 * Represents a detected sync conflict between local and server versions
 */
export interface SyncConflict {
  /** Unique identifier for the conflict */
  id: string;
  /** Type of entity with the conflict */
  entityType: ConflictEntityType;
  /** ID of the entity with the conflict */
  entityId: string;
  /** Human-readable name of the entity */
  entityName: string;
  /** Local version of the data */
  localVersion: Record<string, unknown>;
  /** Server version of the data */
  serverVersion: Record<string, unknown>;
  /** List of field names that have conflicts */
  conflictFields: string[];
  /** When the conflict was detected */
  detectedAt: Date;
  /** Current status of the conflict */
  status: ConflictStatus;
}

// ============================================================================
// Conflict Resolution
// ============================================================================

/**
 * Record of how a conflict was resolved
 */
export interface ConflictResolution {
  /** ID of the conflict that was resolved */
  conflictId: string;
  /** How the conflict was resolved */
  resolution: ConflictResolutionType;
  /** Merged data if resolution was 'merged' */
  mergedData?: Record<string, unknown> | undefined;
  /** When the conflict was resolved */
  resolvedAt: Date;
  /** ID of the user who resolved it */
  resolvedBy: string;
}

// ============================================================================
// Field Difference
// ============================================================================

/**
 * Represents a difference in a single field between versions
 */
export interface FieldDifference {
  /** Name of the field */
  field: string;
  /** Local value */
  localValue: unknown;
  /** Server value */
  serverValue: unknown;
  /** Type of the field value */
  valueType: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'null';
}

// ============================================================================
// Conflict Store Types
// ============================================================================

/**
 * State for the conflict store
 */
export interface ConflictState {
  /** Active conflicts awaiting resolution */
  conflicts: SyncConflict[];
  /** History of resolved conflicts */
  resolutionHistory: ConflictResolution[];
  /** Currently selected conflict for resolution */
  activeConflictId: string | null;
  /** Whether the resolution modal is open */
  isResolutionModalOpen: boolean;
}

/**
 * Actions for the conflict store
 */
export interface ConflictActions {
  /** Add a new conflict to the queue */
  addConflict: (conflict: Omit<SyncConflict, 'id' | 'detectedAt' | 'status'>) => void;
  /** Remove a conflict by ID */
  removeConflict: (id: string) => void;
  /** Resolve a conflict */
  resolveConflict: (
    conflictId: string,
    resolution: ConflictResolutionType,
    mergedData?: Record<string, unknown>,
    resolvedBy?: string
  ) => void;
  /** Dismiss a conflict without resolving */
  dismissConflict: (conflictId: string) => void;
  /** Set the active conflict for resolution */
  setActiveConflict: (conflictId: string | null) => void;
  /** Open/close the resolution modal */
  setResolutionModalOpen: (open: boolean) => void;
  /** Clear all conflicts */
  clearAllConflicts: () => void;
  /** Get pending conflicts count */
  getPendingCount: () => number;
  /** Get a specific conflict by ID */
  getConflictById: (id: string) => SyncConflict | undefined;
}
