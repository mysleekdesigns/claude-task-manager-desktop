/**
 * Fix Store - Zustand State Management
 *
 * Manages fix operation workflow state for tasks.
 * Tracks active fixes and their progress across the application.
 *
 * Fix events are emitted from the main process via:
 * - fix:progress:${taskId}:${fixType} - progress updates with current activity
 * - fix:complete:${taskId} - completion notification
 */

import { create } from 'zustand';
import type { FixType, FixStatus } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

/**
 * Verification result data for a fix operation
 */
export interface FixVerification {
  /** Score before the fix was applied */
  preFixScore: number;
  /** Score after the fix was applied */
  postFixScore: number;
  /** Improvement in score (postFixScore - preFixScore) */
  scoreImprovement: number;
  /** Number of findings remaining after the fix */
  remainingFindingsCount: number;
  /** Whether the verification passed */
  passed: boolean;
  /** Human-readable summary of the verification */
  summary: string;
}

/**
 * Current phase of the fix workflow
 */
export type FixPhase = 'research' | 'fix' | 'verify';

/**
 * State for an individual fix operation
 */
export interface FixOperationState {
  /** Current status of the fix */
  status: FixStatus;
  /** Current activity message */
  currentActivity?: string;
  /** Timestamp when the fix started */
  startedAt: number;
  /** Error message if fix failed */
  error?: string;
  /** Current phase of the fix workflow */
  phase?: FixPhase;
  /** Verification result data */
  verification?: FixVerification;
  /** Number of retry attempts made */
  retryCount?: number;
  /** Whether another retry is allowed */
  canRetry?: boolean;
}

/**
 * Key format for tracking fixes: `${taskId}:${fixType}`
 */
export type FixKey = `${string}:${FixType}`;

/**
 * Helper to create a fix key
 */
export function createFixKey(taskId: string, fixType: FixType): FixKey {
  return `${taskId}:${fixType}`;
}

/**
 * Fix store state and actions
 */
interface FixState {
  /**
   * Active fixes being tracked (key: `${taskId}:${fixType}` -> state)
   */
  activeFixes: Map<FixKey, FixOperationState>;

  /**
   * Start tracking a new fix operation
   */
  startFix: (taskId: string, fixType: FixType) => void;

  /**
   * Set or update fix progress with a message
   */
  setFixProgress: (taskId: string, fixType: FixType, message: string) => void;

  /**
   * Mark a fix as completed successfully
   */
  setFixComplete: (taskId: string, fixType: FixType) => void;

  /**
   * Mark a fix as failed with an error message
   */
  setFixFailed: (taskId: string, fixType: FixType, error: string) => void;

  /**
   * Remove a fix from tracking
   */
  clearFix: (taskId: string, fixType: FixType) => void;

  /**
   * Clear all fixes for a specific task
   */
  clearTaskFixes: (taskId: string) => void;

  /**
   * Clear all active fixes
   */
  clearAll: () => void;

  /**
   * Check if a specific fix is currently active (in progress)
   */
  isFixing: (taskId: string, fixType: FixType) => boolean;

  /**
   * Check if any fix is active for a task
   */
  hasActiveFix: (taskId: string) => boolean;

  /**
   * Get the status for a specific fix operation
   */
  getFixStatus: (taskId: string, fixType: FixType) => FixOperationState | undefined;

  /**
   * Get all active fixes for a specific task
   */
  getTaskFixes: (taskId: string) => Array<{ fixType: FixType; state: FixOperationState }>;

  /**
   * Set the current phase of a fix operation
   */
  setFixPhase: (taskId: string, fixType: FixType, phase: FixPhase) => void;

  /**
   * Mark a fix as verified with verification results
   */
  setFixVerified: (
    taskId: string,
    fixType: FixType,
    verification: FixVerification,
    canRetry: boolean
  ) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useFixStore = create<FixState>((set, get) => ({
  activeFixes: new Map(),

  startFix: (taskId, fixType) =>
    set((state) => {
      const key = createFixKey(taskId, fixType);
      const newMap = new Map(state.activeFixes);
      newMap.set(key, {
        status: 'IN_PROGRESS',
        startedAt: Date.now(),
      });
      return { activeFixes: newMap };
    }),

  setFixProgress: (taskId, fixType, message) =>
    set((state) => {
      const key = createFixKey(taskId, fixType);
      const existing = state.activeFixes.get(key);
      const newMap = new Map(state.activeFixes);
      newMap.set(key, {
        status: 'IN_PROGRESS',
        currentActivity: message,
        startedAt: existing?.startedAt ?? Date.now(),
      });
      return { activeFixes: newMap };
    }),

  setFixComplete: (taskId, fixType) =>
    set((state) => {
      const key = createFixKey(taskId, fixType);
      const existing = state.activeFixes.get(key);
      if (!existing) return state;

      const newMap = new Map(state.activeFixes);
      newMap.set(key, {
        status: 'COMPLETED',
        startedAt: existing.startedAt,
      });
      return { activeFixes: newMap };
    }),

  setFixFailed: (taskId, fixType, error) =>
    set((state) => {
      const key = createFixKey(taskId, fixType);
      const existing = state.activeFixes.get(key);
      if (!existing) return state;

      const newMap = new Map(state.activeFixes);
      newMap.set(key, {
        status: 'FAILED',
        startedAt: existing.startedAt,
        error,
      });
      return { activeFixes: newMap };
    }),

  clearFix: (taskId, fixType) =>
    set((state) => {
      const key = createFixKey(taskId, fixType);
      const newMap = new Map(state.activeFixes);
      newMap.delete(key);
      return { activeFixes: newMap };
    }),

  clearTaskFixes: (taskId) =>
    set((state) => {
      const newMap = new Map(state.activeFixes);
      // Remove all fixes that start with this taskId
      for (const key of newMap.keys()) {
        if (key.startsWith(`${taskId}:`)) {
          newMap.delete(key);
        }
      }
      return { activeFixes: newMap };
    }),

  clearAll: () => set({ activeFixes: new Map() }),

  isFixing: (taskId, fixType) => {
    const key = createFixKey(taskId, fixType);
    const state = get().activeFixes.get(key);
    return state?.status === 'IN_PROGRESS';
  },

  hasActiveFix: (taskId) => {
    const activeFixes = get().activeFixes;
    for (const [key, state] of activeFixes.entries()) {
      if (key.startsWith(`${taskId}:`) && state.status === 'IN_PROGRESS') {
        return true;
      }
    }
    return false;
  },

  getFixStatus: (taskId, fixType) => {
    const key = createFixKey(taskId, fixType);
    return get().activeFixes.get(key);
  },

  getTaskFixes: (taskId) => {
    const result: Array<{ fixType: FixType; state: FixOperationState }> = [];
    const activeFixes = get().activeFixes;

    for (const [key, state] of activeFixes.entries()) {
      if (key.startsWith(`${taskId}:`)) {
        // Extract fixType from key (format: `${taskId}:${fixType}`)
        const fixType = key.split(':').pop() as FixType;
        result.push({ fixType, state });
      }
    }

    return result;
  },

  setFixPhase: (taskId, fixType, phase) =>
    set((state) => {
      const key = createFixKey(taskId, fixType);
      const existing = state.activeFixes.get(key);
      if (!existing) return state;

      const newMap = new Map(state.activeFixes);
      newMap.set(key, {
        ...existing,
        phase,
      });
      return { activeFixes: newMap };
    }),

  setFixVerified: (taskId, fixType, verification, canRetry) =>
    set((state) => {
      const key = createFixKey(taskId, fixType);
      const existing = state.activeFixes.get(key);
      if (!existing) return state;

      const newMap = new Map(state.activeFixes);
      newMap.set(key, {
        ...existing,
        status: verification.passed ? 'VERIFIED_SUCCESS' : 'VERIFIED_FAILED',
        verification,
        canRetry,
        retryCount: existing.retryCount ?? 0,
      });
      return { activeFixes: newMap };
    }),
}));
