/**
 * Fix Service
 *
 * High-level service for managing automated code fixes on tasks.
 * Coordinates between the fix agent pool and database.
 */

import { BrowserWindow } from 'electron';
import { databaseService } from './database.js';
import { fixAgentPool } from './fix-agent-pool.js';
import { createIPCLogger } from '../utils/ipc-logger.js';
import type {
  FixType,
  FixStatus,
  FixProgressResponse,
  ReviewFinding,
} from '../../src/types/ipc.js';

const logger = createIPCLogger('FixService');

/**
 * FixService provides a high-level interface for automated code fixes.
 *
 * Features:
 * - Start fixes for specific review findings
 * - Track fix progress
 * - Cancel running fixes
 * - Handle fix completion and results
 */
class FixService {
  /** Reference to main window for IPC events */
  private mainWindow: BrowserWindow | null = null;

  /**
   * Set the main window for IPC events.
   *
   * @param window - The main BrowserWindow instance
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    fixAgentPool.setMainWindow(window);
  }

  /**
   * Start a fix for a specific type of findings.
   *
   * This will:
   * 1. Validate the task exists
   * 2. Get the project path from the task
   * 3. Create a TaskFix record in the database
   * 4. Start the fix agent
   *
   * @param taskId - The task ID to fix
   * @param fixType - Type of fix to perform (security, quality, testing)
   * @param findings - Array of findings to fix
   */
  async startFix(
    taskId: string,
    fixType: FixType,
    findings: ReviewFinding[]
  ): Promise<void> {
    const prisma = databaseService.getClient();

    // Get task details
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: { id: true, targetPath: true },
        },
      },
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!task.project?.targetPath) {
      throw new Error(`Task's project has no target path: ${taskId}`);
    }

    // Create or update TaskFix record with IN_PROGRESS status
    const existingFix = await prisma.taskFix.findUnique({
      where: {
        taskId_fixType: { taskId, fixType },
      },
    });

    if (existingFix) {
      await prisma.taskFix.update({
        where: { id: existingFix.id },
        data: {
          status: 'IN_PROGRESS',
          findings: JSON.stringify(findings),
          summary: null,
          patch: null,
          researchNotes: null,
          startedAt: new Date(),
          completedAt: null,
        },
      });
    } else {
      await prisma.taskFix.create({
        data: {
          taskId,
          fixType,
          status: 'IN_PROGRESS',
          findings: JSON.stringify(findings),
          startedAt: new Date(),
        },
      });
    }

    // Ensure we have a main window
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      throw new Error('No main window available for fix events');
    }

    // Get the TaskFix record we just created/updated
    const taskFix = await prisma.taskFix.findUnique({
      where: {
        taskId_fixType: { taskId, fixType },
      },
    });

    if (!taskFix) {
      throw new Error(`TaskFix record not found for ${taskId}:${fixType}`);
    }

    // Start the fix agent
    await fixAgentPool.startFix({
      taskId,
      fixType,
      fixId: taskFix.id,
      projectPath: task.project.targetPath,
      findings,
    });

    logger.info(`Started ${fixType} fix for task ${taskId}`);
  }

  /**
   * Start fixes for multiple types of findings.
   *
   * This will create TaskFix records for each type and start all fix agents.
   *
   * @param taskId - The task ID to fix
   * @param findingsByType - Map of fix types to their findings
   */
  async startAllFixes(
    taskId: string,
    findingsByType: Map<FixType, ReviewFinding[]>
  ): Promise<void> {
    const prisma = databaseService.getClient();

    // Get task details
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: { id: true, targetPath: true },
        },
      },
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!task.project?.targetPath) {
      throw new Error(`Task's project has no target path: ${taskId}`);
    }

    // Create TaskFix records for each type
    for (const [fixType, findings] of findingsByType) {
      const existingFix = await prisma.taskFix.findUnique({
        where: {
          taskId_fixType: { taskId, fixType },
        },
      });

      if (existingFix) {
        await prisma.taskFix.update({
          where: { id: existingFix.id },
          data: {
            status: 'IN_PROGRESS',
            findings: JSON.stringify(findings),
            summary: null,
            patch: null,
            researchNotes: null,
            startedAt: new Date(),
            completedAt: null,
          },
        });
      } else {
        await prisma.taskFix.create({
          data: {
            taskId,
            fixType,
            status: 'IN_PROGRESS',
            findings: JSON.stringify(findings),
            startedAt: new Date(),
          },
        });
      }
    }

    // Ensure we have a main window
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      throw new Error('No main window available for fix events');
    }

    // Convert Map to FindingsByType object
    const findingsObj: {
      security?: ReviewFinding[];
      quality?: ReviewFinding[];
      performance?: ReviewFinding[];
    } = {};
    for (const [fixType, findings] of findingsByType) {
      findingsObj[fixType] = findings;
    }

    // Start all fix agents
    await fixAgentPool.startAllFixes(
      taskId,
      task.project.targetPath,
      findingsObj
    );

    logger.info(
      `Started ${String(findingsByType.size)} fixes for task ${taskId}`
    );
  }

  /**
   * Get the progress of a fix for a task.
   *
   * @param taskId - The task ID to query
   * @param fixType - Type of fix to query
   * @returns Fix progress response or null if not found
   */
  async getFixProgress(
    taskId: string,
    fixType: FixType
  ): Promise<FixProgressResponse | null> {
    const prisma = databaseService.getClient();

    // Get TaskFix record
    const taskFix = await prisma.taskFix.findUnique({
      where: {
        taskId_fixType: { taskId, fixType },
      },
    });

    if (!taskFix) {
      return null;
    }

    // Get current activity from the agent pool if running
    const currentActivity = fixAgentPool.getCurrentActivity(taskId, fixType);

    const response: FixProgressResponse = {
      taskId,
      fixType: taskFix.fixType as FixType,
      status: taskFix.status as FixStatus,
    };

    // Only include optional properties if they have values
    if (taskFix.summary) {
      response.summary = taskFix.summary;
    }

    if (currentActivity) {
      response.currentActivity = currentActivity;
    }

    return response;
  }

  /**
   * Cancel a running fix for a task.
   *
   * @param taskId - The task ID to cancel fix for
   * @param fixType - Type of fix to cancel
   */
  async cancelFix(taskId: string, fixType: FixType): Promise<void> {
    const prisma = databaseService.getClient();

    // Cancel the agent
    fixAgentPool.cancelFix(taskId, fixType);

    // Update TaskFix status to FAILED
    await prisma.taskFix.updateMany({
      where: {
        taskId,
        fixType,
        status: 'IN_PROGRESS',
      },
      data: {
        status: 'FAILED',
        summary: 'Cancelled by user',
        completedAt: new Date(),
      },
    });

    logger.info(`Cancelled ${fixType} fix for task ${taskId}`);
  }

  /**
   * Handle completion of a fix.
   *
   * Called by the fix agent pool when a fix finishes.
   *
   * @param taskId - Task ID
   * @param fixType - Type of fix completed
   * @param result - Result of the fix operation
   */
  async handleFixComplete(
    taskId: string,
    fixType: FixType,
    result: {
      success: boolean;
      summary?: string;
      patch?: string;
      researchNotes?: string;
    }
  ): Promise<void> {
    const prisma = databaseService.getClient();

    // Update the TaskFix record
    await prisma.taskFix.update({
      where: {
        taskId_fixType: { taskId, fixType },
      },
      data: {
        status: result.success ? 'COMPLETED' : 'FAILED',
        summary: result.summary ?? (result.success ? 'Fix completed' : 'Fix failed'),
        patch: result.patch ?? null,
        researchNotes: result.researchNotes ?? null,
        completedAt: new Date(),
      },
    });

    logger.info(
      `${fixType} fix ${result.success ? 'completed' : 'failed'} for task ${taskId}`
    );

    // Emit completion event
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`fix:complete:${taskId}`, {
        taskId,
        fixType,
        success: result.success,
        summary: result.summary,
      });
    }
  }
}

// Export singleton instance
export const fixService = new FixService();
