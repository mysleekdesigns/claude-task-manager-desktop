/**
 * Human Review IPC Handlers
 *
 * Handlers for human review workflow IPC channels.
 * These handle the assignment and management of human reviews for tasks
 * that have completed AI review.
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import type { HumanReview } from '@prisma/client';

/**
 * Status of a human review
 */
export type HumanReviewStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

/**
 * Input for assigning a reviewer to a human review
 */
export interface AssignReviewerInput {
  taskId: string;
  reviewerId: string | null;
}

/**
 * Input for completing a human review
 */
export interface CompleteReviewInput {
  taskId: string;
  notes?: string;
}

/**
 * Human review with relations for API responses
 */
export interface HumanReviewWithRelations extends HumanReview {
  reviewer?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  } | null;
  task?: {
    id: string;
    title: string;
    status: string;
  };
}

/**
 * AI review finding structure (matches ReviewFinding in ipc.ts)
 */
interface AIReviewFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  file?: string;
  line?: number;
}

/**
 * Individual AI review result
 */
interface AIReviewResult {
  reviewType: string;
  status: string;
  score: number | null;
  summary: string | null;
  findings: AIReviewFinding[];
}

/**
 * Formatted AI review data for human review workflow
 */
export interface FormattedAIReview {
  overallScore: number | null;
  reviews: AIReviewResult[];
  completedAt: string | null;
}

/**
 * Get or create a human review for a task
 */
async function getOrCreateHumanReview(taskId: string): Promise<HumanReview> {
  const prisma = databaseService.getClient();

  // Check if human review already exists
  let humanReview = await prisma.humanReview.findUnique({
    where: { taskId },
  });

  if (!humanReview) {
    // Create a new human review
    humanReview = await prisma.humanReview.create({
      data: {
        taskId,
        status: 'PENDING',
      },
    });
  }

  return humanReview;
}

/**
 * Get AI review data and cache it in the human review record
 */
async function cacheAIReviewData(taskId: string): Promise<FormattedAIReview | null> {
  const prisma = databaseService.getClient();

  // Get all AI reviews for this task
  const taskReviews = await prisma.taskReview.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
  });

  if (taskReviews.length === 0) {
    return null;
  }

  // Calculate overall score from individual review scores
  const completedReviews = taskReviews.filter(
    (r) => r.status === 'COMPLETED' && r.score !== null
  );
  const overallScore =
    completedReviews.length > 0
      ? Math.round(
          completedReviews.reduce((sum, r) => sum + (r.score || 0), 0) /
            completedReviews.length
        )
      : null;

  // Get the most recent completed timestamp
  const completedAt = completedReviews.length > 0
    ? completedReviews
        .filter((r) => r.completedAt)
        .sort((a, b) =>
          (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
        )[0]?.completedAt?.toISOString() || null
    : null;

  // Format reviews with their findings
  const reviews: AIReviewResult[] = taskReviews.map((review) => ({
    reviewType: review.reviewType,
    status: review.status,
    score: review.score,
    summary: review.summary,
    findings: JSON.parse(review.findings || '[]') as AIReviewFinding[],
  }));

  const formattedData: FormattedAIReview = {
    overallScore,
    reviews,
    completedAt,
  };

  // Cache the AI review data in the human review record
  await prisma.humanReview.update({
    where: { taskId },
    data: {
      aiReviewData: JSON.stringify(formattedData),
    },
  });

  return formattedData;
}

/**
 * Assign a reviewer to a task's human review
 * Pass null reviewerId to unassign the current reviewer
 */
async function handleAssignReviewer(
  _event: IpcMainInvokeEvent,
  data: AssignReviewerInput
): Promise<HumanReviewWithRelations> {
  if (!data.taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  const prisma = databaseService.getClient();

  // If reviewerId is provided, verify the reviewer exists
  if (data.reviewerId) {
    const reviewer = await prisma.user.findUnique({
      where: { id: data.reviewerId },
    });

    if (!reviewer) {
      throw IPCErrors.invalidArguments('Reviewer not found');
    }
  }

  // Get or create the human review
  await getOrCreateHumanReview(data.taskId);

  // Cache AI review data
  await cacheAIReviewData(data.taskId);

  // Update with reviewer assignment (or unassignment if null)
  const humanReview = await prisma.humanReview.update({
    where: { taskId: data.taskId },
    data: {
      reviewerId: data.reviewerId,
      assignedAt: data.reviewerId ? new Date() : null,
      status: 'PENDING',
    },
    include: {
      reviewer: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });

  return humanReview;
}

/**
 * Get human review details for a task (including cached AI review data)
 */
async function handleGetHumanReview(
  _event: IpcMainInvokeEvent,
  taskId: string
): Promise<HumanReviewWithRelations | null> {
  if (!taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  const prisma = databaseService.getClient();

  const humanReview = await prisma.humanReview.findUnique({
    where: { taskId },
    include: {
      reviewer: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });

  return humanReview;
}

/**
 * Mark human review as in-progress
 */
async function handleStartReview(
  _event: IpcMainInvokeEvent,
  taskId: string
): Promise<HumanReviewWithRelations> {
  if (!taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify human review exists
  const existingReview = await prisma.humanReview.findUnique({
    where: { taskId },
  });

  if (!existingReview) {
    throw IPCErrors.invalidArguments('Human review not found for this task');
  }

  if (existingReview.status === 'COMPLETED') {
    throw IPCErrors.invalidArguments('Human review is already completed');
  }

  // Update status to IN_PROGRESS
  const humanReview = await prisma.humanReview.update({
    where: { taskId },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
    include: {
      reviewer: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });

  return humanReview;
}

/**
 * Mark human review as completed
 */
async function handleCompleteReview(
  _event: IpcMainInvokeEvent,
  data: CompleteReviewInput
): Promise<HumanReviewWithRelations> {
  if (!data.taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  const prisma = databaseService.getClient();

  // Verify human review exists
  const existingReview = await prisma.humanReview.findUnique({
    where: { taskId: data.taskId },
  });

  if (!existingReview) {
    throw IPCErrors.invalidArguments('Human review not found for this task');
  }

  if (existingReview.status === 'COMPLETED') {
    throw IPCErrors.invalidArguments('Human review is already completed');
  }

  // Update status to COMPLETED
  const humanReview = await prisma.humanReview.update({
    where: { taskId: data.taskId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      notes: data.notes ?? null,
    },
    include: {
      reviewer: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });

  // Update task status to COMPLETED if it was in HUMAN_REVIEW
  const task = await prisma.task.findUnique({
    where: { id: data.taskId },
  });

  if (task && task.status === 'HUMAN_REVIEW') {
    await prisma.task.update({
      where: { id: data.taskId },
      data: { status: 'COMPLETED' },
    });
  }

  return humanReview;
}

/**
 * Get formatted AI review results for copying/display
 */
async function handleGetAIResults(
  _event: IpcMainInvokeEvent,
  taskId: string
): Promise<FormattedAIReview | null> {
  if (!taskId) {
    throw IPCErrors.invalidArguments('Task ID is required');
  }

  const prisma = databaseService.getClient();

  // First check if we have cached data
  const humanReview = await prisma.humanReview.findUnique({
    where: { taskId },
  });

  if (humanReview?.aiReviewData) {
    try {
      return JSON.parse(humanReview.aiReviewData) as FormattedAIReview;
    } catch {
      // If parsing fails, regenerate the data
    }
  }

  // Generate and cache the AI review data
  return cacheAIReviewData(taskId);
}

/**
 * Wrap a handler with logging
 */
function wrapWithLogging<TArgs extends unknown[], TReturn>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TReturn>
): (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TReturn> {
  return async (
    event: IpcMainInvokeEvent,
    ...args: TArgs
  ): Promise<TReturn> => {
    const startTime = performance.now();
    logIPCRequest(channel, args);

    try {
      const result = await handler(event, ...args);
      const duration = performance.now() - startTime;
      logIPCResponse(channel, result, duration, true);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logIPCError(channel, error, duration);
      throw error;
    }
  };
}

/**
 * Register all human review-related IPC handlers
 */
export function registerHumanReviewHandlers(): void {
  // humanReview:assign - Assign a reviewer to a task's human review
  ipcMain.handle(
    'humanReview:assign',
    wrapWithLogging('humanReview:assign', wrapHandler(handleAssignReviewer))
  );

  // humanReview:get - Get human review details for a task
  ipcMain.handle(
    'humanReview:get',
    wrapWithLogging('humanReview:get', wrapHandler(handleGetHumanReview))
  );

  // humanReview:start - Mark human review as in-progress
  ipcMain.handle(
    'humanReview:start',
    wrapWithLogging('humanReview:start', wrapHandler(handleStartReview))
  );

  // humanReview:complete - Mark human review as completed
  ipcMain.handle(
    'humanReview:complete',
    wrapWithLogging('humanReview:complete', wrapHandler(handleCompleteReview))
  );

  // humanReview:getAIResults - Get formatted AI review results
  ipcMain.handle(
    'humanReview:getAIResults',
    wrapWithLogging('humanReview:getAIResults', wrapHandler(handleGetAIResults))
  );
}

/**
 * Unregister all human review-related IPC handlers
 */
export function unregisterHumanReviewHandlers(): void {
  ipcMain.removeHandler('humanReview:assign');
  ipcMain.removeHandler('humanReview:get');
  ipcMain.removeHandler('humanReview:start');
  ipcMain.removeHandler('humanReview:complete');
  ipcMain.removeHandler('humanReview:getAIResults');
}
