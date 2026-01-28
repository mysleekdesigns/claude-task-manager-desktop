/**
 * Review Service
 *
 * High-level service for managing AI code reviews on tasks.
 * Coordinates between the activity logger, review agent pool, and database.
 */

import { BrowserWindow } from 'electron';
import { databaseService } from './database.js';
import { reviewAgentPool, type ReviewType } from './review-agent-pool.js';
import { activityLogger } from './activity-logger.js';
import { createIPCLogger } from '../utils/ipc-logger.js';
import type { TaskReview } from '@prisma/client';

const logger = createIPCLogger('ReviewService');

/**
 * Review progress response returned to renderer
 */
export interface ReviewProgressResponse {
  /** Task ID */
  taskId: string;
  /** Overall status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  /** Individual review statuses */
  reviews: Array<{
    /** Review type */
    reviewType: ReviewType;
    /** Review status */
    status: string;
    /** Score if completed */
    score?: number | undefined;
    /** Summary if available */
    summary?: string | undefined;
    /** Count of findings */
    findingsCount: number;
  }>;
  /** Overall aggregate score */
  overallScore?: number | undefined;
}

/**
 * Activity entry for history response
 */
interface HistoryActivityEntry {
  id: string;
  type: string;
  toolName?: string | undefined;
  summary: string;
  details?: Record<string, unknown> | undefined;
  duration?: number | undefined;
  createdAt: string;
}

/**
 * Task history response returned to renderer
 */
export interface TaskHistoryResponse {
  /** Task ID */
  taskId: string;
  /** Activity entries */
  activities: HistoryActivityEntry[];
  /** Task summary if available */
  summary?: {
    summary: string;
    keyChanges: string[];
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
  };
}

/**
 * Valid review types that the system supports.
 * Any TaskReview records with reviewType not in this list will be cleaned up.
 */
const VALID_REVIEW_TYPES: ReviewType[] = ['security', 'quality', 'performance', 'documentation', 'research'];

/**
 * ReviewService provides a high-level interface for AI code reviews.
 *
 * Features:
 * - Start reviews for a task
 * - Track review progress
 * - Cancel running reviews
 * - Retrieve task history and activities
 * - Aggregate review results
 */
class ReviewService {
  /** Reference to main window for IPC events */
  private mainWindow: BrowserWindow | null = null;

  /** Whether cleanup has been performed this session */
  private cleanupPerformed = false;

  /**
   * Set the main window for IPC events.
   *
   * @param window - The main BrowserWindow instance
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    reviewAgentPool.setMainWindow(window);

    // Perform one-time database cleanup on startup
    if (!this.cleanupPerformed) {
      this.cleanupPerformed = true;
      void this.cleanupInvalidReviewTypes();
    }
  }

  /**
   * Clean up TaskReview records with invalid review types.
   * This handles legacy records from old review type configurations.
   */
  private async cleanupInvalidReviewTypes(): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      const result = await prisma.taskReview.deleteMany({
        where: {
          reviewType: {
            notIn: VALID_REVIEW_TYPES,
          },
        },
      });

      if (result.count > 0) {
        logger.info(`Cleaned up ${String(result.count)} TaskReview records with invalid review types`);
      }
    } catch (error) {
      logger.error('Failed to cleanup invalid review types:', error);
    }
  }

  /**
   * Start AI reviews for a task.
   *
   * This will:
   * 1. Flush any pending activities for the task
   * 2. Update the task status to AI_REVIEW
   * 3. Start review agents for each requested review type
   * 4. Conditionally add research review if CrawlForge MCP is configured
   *
   * @param taskId - The task ID to review
   * @param reviewTypes - Types of reviews to run (default: security, quality, performance)
   */
  async startReview(
    taskId: string,
    reviewTypes?: ReviewType[]
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

    // Determine review types - use provided types or default to security, quality, performance
    const finalReviewTypes: ReviewType[] = reviewTypes || ['security', 'quality', 'performance'];

    // Flush any pending activities before starting review
    if (activityLogger.hasPendingActivities(taskId)) {
      await activityLogger.flushActivities(taskId);
      logger.info(`Flushed pending activities for task ${taskId}`);
    }

    // Update task status and reset claudeStatus to prevent stale "Completed" badge
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'AI_REVIEW', claudeStatus: 'IDLE' },
    });

    // Ensure we have a main window
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      throw new Error('No main window available for review events');
    }

    // Start all review agents
    await reviewAgentPool.startAllReviews(
      taskId,
      task.project.targetPath,
      task.description || task.title,
      this.mainWindow,
      finalReviewTypes
    );

    logger.info(`Started reviews for task ${taskId}`);
  }

  /**
   * Get the progress of reviews for a task.
   *
   * @param taskId - The task ID to query
   * @returns Review progress response
   */
  async getReviewProgress(taskId: string): Promise<ReviewProgressResponse> {
    const prisma = databaseService.getClient();

    // Get all TaskReview records for this task
    const reviews = await prisma.taskReview.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });

    // Determine overall status
    let status: ReviewProgressResponse['status'] = 'pending';
    if (reviews.length > 0) {
      const hasRunning = reviews.some((r: TaskReview) => r.status === 'IN_PROGRESS');
      const hasFailed = reviews.some((r: TaskReview) => r.status === 'FAILED');
      const allCompleted = reviews.every(
        (r: TaskReview) => r.status === 'COMPLETED' || r.status === 'FAILED'
      );

      if (hasRunning) {
        status = 'in_progress';
      } else if (allCompleted) {
        status = hasFailed ? 'failed' : 'completed';
      }
    }

    // Calculate overall score from completed reviews
    const completedReviews = reviews.filter(
      (r: TaskReview) => r.status === 'COMPLETED' && r.score !== null
    );
    let overallScore: number | undefined;
    if (completedReviews.length > 0) {
      const totalScore = completedReviews.reduce(
        (sum: number, r: TaskReview) => sum + (r.score || 0),
        0
      );
      overallScore = Math.round(totalScore / completedReviews.length);
    }

    return {
      taskId,
      status,
      reviews: reviews.map((r: TaskReview) => ({
        reviewType: r.reviewType as ReviewType,
        status: r.status,
        score: r.score ?? undefined,
        summary: r.summary ?? undefined,
        findingsCount: JSON.parse(r.findings || '[]').length,
      })),
      overallScore,
    };
  }

  /**
   * Cancel all running reviews for a task.
   *
   * @param taskId - The task ID to cancel reviews for
   */
  async cancelReview(taskId: string): Promise<void> {
    const prisma = databaseService.getClient();

    // Cancel running agents
    reviewAgentPool.cancelReviews(taskId);

    // Update any IN_PROGRESS reviews to FAILED
    await prisma.taskReview.updateMany({
      where: {
        taskId,
        status: 'IN_PROGRESS',
      },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
    });

    // Update task status back to IN_PROGRESS
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'IN_PROGRESS' },
    });

    logger.info(`Cancelled reviews for task ${taskId}`);
  }

  /**
   * Get the activity history and summary for a task.
   *
   * @param taskId - The task ID to query
   * @returns Task history response
   */
  async getTaskHistory(taskId: string): Promise<TaskHistoryResponse> {
    const prisma = databaseService.getClient();

    // Get activities
    const activities = await activityLogger.getActivities(taskId, { limit: 100 });

    // Get task summary if available
    const taskSummary = await prisma.taskSummary.findUnique({
      where: { taskId },
    });

    const response: TaskHistoryResponse = {
      taskId,
      activities: activities.map((a) => ({
        id: a.id,
        type: a.type,
        toolName: a.toolName,
        summary: a.summary,
        details: a.details,
        duration: a.duration,
        createdAt: a.createdAt.toISOString(),
      })),
    };

    if (taskSummary) {
      response.summary = {
        summary: taskSummary.summary,
        keyChanges: JSON.parse(taskSummary.keyChanges || '[]') as string[],
        filesChanged: taskSummary.filesChanged,
        linesAdded: taskSummary.linesAdded,
        linesRemoved: taskSummary.linesRemoved,
      };
    }

    return response;
  }

  /**
   * Handle completion of a single review.
   *
   * Called by the review agent pool when a review finishes.
   *
   * @param taskId - Task ID
   * @param reviewType - Type of review completed
   * @param score - Score from the review (0-100)
   * @param findings - Array of findings
   */
  async handleReviewComplete(
    taskId: string,
    reviewType: ReviewType,
    score: number,
    findings: unknown[]
  ): Promise<void> {
    const prisma = databaseService.getClient();

    // Update the TaskReview record
    await prisma.taskReview.update({
      where: {
        taskId_reviewType: { taskId, reviewType },
      },
      data: {
        status: 'COMPLETED',
        score,
        summary: `Found ${String(findings.length)} issue(s)`,
        findings: JSON.stringify(findings),
        completedAt: new Date(),
      },
    });

    logger.info(
      `${reviewType} review completed for task ${taskId} (score: ${String(score)})`
    );

    // Check if all reviews are complete
    if (reviewAgentPool.areAllReviewsComplete(taskId)) {
      await this.aggregateReviews(taskId);
    }
  }

  /**
   * Aggregate all reviews for a task and update task status.
   *
   * Called when all reviews for a task are complete.
   *
   * @param taskId - Task ID to aggregate reviews for
   */
  async aggregateReviews(taskId: string): Promise<void> {
    const prisma = databaseService.getClient();

    // Get all completed reviews
    const reviews = await prisma.taskReview.findMany({
      where: {
        taskId,
        status: 'COMPLETED',
      },
    });

    if (reviews.length === 0) {
      logger.warn(`No completed reviews found for task ${taskId}`);
      return;
    }

    // Calculate overall score
    const totalScore = reviews.reduce(
      (sum: number, r: TaskReview) => sum + (r.score || 0),
      0
    );
    const overallScore = Math.round(totalScore / reviews.length);

    // Count critical and high severity findings
    let criticalCount = 0;
    let highCount = 0;

    for (const review of reviews) {
      const findings = JSON.parse(review.findings || '[]') as Array<{
        severity?: string;
      }>;
      for (const finding of findings) {
        if (finding.severity === 'critical') criticalCount++;
        if (finding.severity === 'high') highCount++;
      }
    }

    // Determine next status based on findings
    // If there are critical findings, require human review
    // If score is below 70 or has high findings, suggest human review
    let nextStatus: 'COMPLETED' | 'HUMAN_REVIEW';
    if (criticalCount > 0 || overallScore < 50) {
      nextStatus = 'HUMAN_REVIEW';
    } else if (highCount > 2 || overallScore < 70) {
      nextStatus = 'HUMAN_REVIEW';
    } else {
      nextStatus = 'COMPLETED';
    }

    // Update task status
    await prisma.task.update({
      where: { id: taskId },
      data: { status: nextStatus },
    });

    logger.info(
      `Aggregated reviews for task ${taskId}: score=${String(overallScore)}, ` +
        `critical=${String(criticalCount)}, high=${String(highCount)}, status=${nextStatus}`
    );

    // Emit completion event
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`review:complete:${taskId}`, {
        taskId,
        overallScore,
        criticalCount,
        highCount,
        nextStatus,
      });
    }
  }

  /**
   * Get review findings for a specific review.
   *
   * @param taskId - Task ID
   * @param reviewType - Type of review
   * @returns Array of findings or null if not found
   */
  async getReviewFindings(
    taskId: string,
    reviewType: ReviewType
  ): Promise<unknown[] | null> {
    const prisma = databaseService.getClient();

    const review = await prisma.taskReview.findUnique({
      where: {
        taskId_reviewType: { taskId, reviewType },
      },
    });

    if (!review) {
      return null;
    }

    return JSON.parse(review.findings || '[]') as unknown[];
  }
}

// Export singleton instance
export const reviewService = new ReviewService();
