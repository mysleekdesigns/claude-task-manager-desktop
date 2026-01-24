/**
 * Startup cleanup service
 *
 * Handles recovery from stale states when the app restarts after a crash or
 * normal shutdown. This ensures tasks and terminals don't show as "running"
 * when no actual processes exist.
 */

import { getPrismaClient } from './database';

export interface StartupCleanupResult {
  staleTasks: number;
  orphanedTerminals: number;
}

/**
 * Clean up stale task and terminal states on app startup.
 *
 * When the app closes (crash or normal quit), tasks may still have
 * `claudeStatus: RUNNING` or `STARTING` in the database, and terminals
 * may have `status: running`. Since no actual processes exist after restart,
 * we need to reset these to appropriate states.
 *
 * This function should be called after database initialization but before
 * the main window is created.
 *
 * @returns Object containing counts of cleaned up items
 */
export async function performStartupCleanup(): Promise<StartupCleanupResult> {
  const prisma = getPrismaClient();
  const now = new Date();

  let staleTasks = 0;
  let orphanedTerminals = 0;

  try {
    // Step 1: Reset stale tasks (RUNNING or STARTING -> FAILED)
    // These tasks were interrupted and should be marked as failed
    const staleTaskResult = await prisma.task.updateMany({
      where: {
        claudeStatus: {
          in: ['RUNNING', 'STARTING'],
        },
      },
      data: {
        claudeStatus: 'FAILED',
        claudeCompletedAt: now,
      },
    });

    staleTasks = staleTaskResult.count;

    if (staleTasks > 0) {
      console.log(`[Startup Cleanup] Reset ${staleTasks} stale task(s) from RUNNING/STARTING to FAILED`);
    }

    // Step 2: Delete orphaned terminal records with status 'running'
    // These have no corresponding processes after restart
    const orphanedTerminalResult = await prisma.terminal.deleteMany({
      where: {
        status: 'running',
      },
    });

    orphanedTerminals = orphanedTerminalResult.count;

    if (orphanedTerminals > 0) {
      console.log(`[Startup Cleanup] Deleted ${orphanedTerminals} orphaned terminal record(s)`);
    }

    // Step 3: Also reset any tasks that were IN_PROGRESS (task status, not claudeStatus)
    // These may have been actively worked on when the app closed
    // Only reset tasks with active Claude statuses - don't overwrite COMPLETED/FAILED/IDLE
    const inProgressTaskResult = await prisma.task.updateMany({
      where: {
        status: 'IN_PROGRESS',
        claudeStatus: {
          notIn: ['COMPLETED', 'FAILED', 'IDLE'], // Don't overwrite completed/failed/idle tasks
        },
        // Only reset if Claude was involved (has a session or terminal)
        OR: [
          { claudeSessionId: { not: null } },
          { claudeTerminalId: { not: null } },
        ],
      },
      data: {
        // Keep as IN_PROGRESS but reset Claude-specific fields if needed
        claudeStatus: 'FAILED',
        claudeCompletedAt: now,
      },
    });

    if (inProgressTaskResult.count > 0) {
      console.log(`[Startup Cleanup] Reset Claude status on ${inProgressTaskResult.count} in-progress task(s) with active Claude sessions`);
      staleTasks += inProgressTaskResult.count;
    }

    // Log summary if any cleanup was performed
    if (staleTasks > 0 || orphanedTerminals > 0) {
      console.log(`[Startup Cleanup] Completed: cleaned up ${staleTasks} stale task(s) and ${orphanedTerminals} orphaned terminal(s)`);
    } else {
      console.log('[Startup Cleanup] No stale states found - database is clean');
    }

    return { staleTasks, orphanedTerminals };
  } catch (error) {
    // Log error but don't crash the app
    console.error('[Startup Cleanup] Error during cleanup:', error);

    // Return zeros to indicate no cleanup was performed
    // The app should continue to function even if cleanup fails
    return { staleTasks: 0, orphanedTerminals: 0 };
  }
}

/**
 * Check if there are any stale states that need cleanup.
 * This can be used to show a notification to the user if desired.
 *
 * @returns true if there are stale tasks or terminals
 */
export async function hasStaleStates(): Promise<boolean> {
  const prisma = getPrismaClient();

  try {
    const [staleTasks, runningTerminals] = await Promise.all([
      prisma.task.count({
        where: {
          claudeStatus: {
            in: ['RUNNING', 'STARTING'],
          },
        },
      }),
      prisma.terminal.count({
        where: {
          status: 'running',
        },
      }),
    ]);

    return staleTasks > 0 || runningTerminals > 0;
  } catch {
    return false;
  }
}
