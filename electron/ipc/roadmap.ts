/**
 * Roadmap IPC Handlers
 *
 * Handlers for roadmap-related IPC channels (Phase 9: Phases, Features, Milestones).
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import type { Phase, Feature, Milestone } from '@prisma/client';

// Re-define enums as types to match Prisma's generated enums
type MoscowPriority = 'MUST' | 'SHOULD' | 'COULD' | 'WONT';
type FeatureStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
type PhaseStatus = 'planned' | 'in_progress' | 'completed';

/**
 * Phase data types for IPC
 */
export interface CreatePhaseInput {
  name: string;
  description?: string;
  order: number;
  projectId: string;
}

export interface UpdatePhaseInput {
  name?: string;
  description?: string;
  order?: number;
  status?: PhaseStatus;
}

export interface ReorderPhasesInput {
  phaseId: string;
  order: number;
}

/**
 * Feature data types for IPC
 */
export interface CreateFeatureInput {
  title: string;
  description?: string;
  priority: MoscowPriority;
  projectId: string;
  phaseId?: string;
}

export interface UpdateFeatureInput {
  title?: string;
  description?: string;
  priority?: MoscowPriority;
  status?: FeatureStatus;
  phaseId?: string;
}

export interface FeatureListFilters {
  projectId?: string;
  phaseId?: string;
  priority?: MoscowPriority;
  status?: FeatureStatus;
}

/**
 * Phase with relations for API responses
 */
export type PhaseWithRelations = Phase & {
  features?: Feature[];
  milestones?: MilestoneWithCompleted[];
};

/**
 * Feature with relations for API responses
 */
export type FeatureWithRelations = Feature & {
  phase?: Phase | null;
};

/**
 * Milestone with completion status
 */
export type MilestoneWithCompleted = Milestone & {
  completed: boolean;
};

// ============================================================================
// Phase Handlers
// ============================================================================

/**
 * List all phases for a project (ordered by order field)
 */
async function handleListPhases(
  _event: IpcMainInvokeEvent,
  projectId: string
): Promise<PhaseWithRelations[]> {
  if (!projectId) {
    throw IPCErrors.invalidArguments('Project ID is required');
  }

  const prisma = databaseService.getClient();

  const phases = await prisma.phase.findMany({
    where: { projectId },
    include: {
      features: true,
      milestones: true,
    },
    orderBy: { order: 'asc' },
  });

  return phases;
}

/**
 * Create a new phase
 */
async function handleCreatePhase(
  _event: IpcMainInvokeEvent,
  data: CreatePhaseInput
): Promise<PhaseWithRelations> {
  if (!data.name || !data.projectId || data.order === undefined) {
    throw IPCErrors.invalidArguments('Phase name, project ID, and order are required');
  }

  const prisma = databaseService.getClient();

  const phase = await prisma.phase.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      order: data.order,
      projectId: data.projectId,
    },
    include: {
      features: true,
      milestones: true,
    },
  });

  return phase;
}

/**
 * Update a phase by ID
 */
async function handleUpdatePhase(
  _event: IpcMainInvokeEvent,
  id: string,
  data: UpdatePhaseInput
): Promise<PhaseWithRelations> {
  if (!id) {
    throw IPCErrors.invalidArguments('Phase ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    const phase = await prisma.phase.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.status !== undefined && { status: data.status }),
      },
      include: {
        features: true,
        milestones: true,
      },
    });

    return phase;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Phase not found');
    }
    throw error;
  }
}

/**
 * Delete a phase by ID
 */
async function handleDeletePhase(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<void> {
  if (!id) {
    throw IPCErrors.invalidArguments('Phase ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    await prisma.phase.delete({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Phase not found');
    }
    throw error;
  }
}

/**
 * Reorder phases (update order field for multiple phases)
 */
async function handleReorderPhases(
  _event: IpcMainInvokeEvent,
  updates: ReorderPhasesInput[]
): Promise<void> {
  if (!updates || updates.length === 0) {
    throw IPCErrors.invalidArguments('Phase updates are required');
  }

  const prisma = databaseService.getClient();

  try {
    // Use transaction to update all phases atomically
    await prisma.$transaction(
      updates.map((update) =>
        prisma.phase.update({
          where: { id: update.phaseId },
          data: { order: update.order },
        })
      )
    );
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('One or more phases not found');
    }
    throw error;
  }
}

// ============================================================================
// Feature Handlers
// ============================================================================

/**
 * List features with optional filters
 */
async function handleListFeatures(
  _event: IpcMainInvokeEvent,
  filters?: FeatureListFilters
): Promise<FeatureWithRelations[]> {
  const prisma = databaseService.getClient();

  // Build where clause with filters
  const where: {
    projectId?: string;
    phaseId?: string | null;
    priority?: MoscowPriority;
    status?: FeatureStatus;
  } = {};

  if (filters?.projectId) {
    where.projectId = filters.projectId;
  }
  if (filters?.phaseId !== undefined) {
    where.phaseId = filters.phaseId || null;
  }
  if (filters?.priority) {
    where.priority = filters.priority;
  }
  if (filters?.status) {
    where.status = filters.status;
  }

  const features = await prisma.feature.findMany({
    where,
    include: {
      phase: true,
    },
    orderBy: [
      { priority: 'asc' }, // MUST comes first
      { createdAt: 'desc' },
    ],
  });

  return features;
}

/**
 * Create a new feature
 */
async function handleCreateFeature(
  _event: IpcMainInvokeEvent,
  data: CreateFeatureInput
): Promise<FeatureWithRelations> {
  if (!data.title || !data.priority || !data.projectId) {
    throw IPCErrors.invalidArguments('Feature title, priority, and project ID are required');
  }

  const prisma = databaseService.getClient();

  const feature = await prisma.feature.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      priority: data.priority,
      projectId: data.projectId,
      phaseId: data.phaseId ?? null,
    },
    include: {
      phase: true,
    },
  });

  return feature;
}

/**
 * Update a feature by ID
 */
async function handleUpdateFeature(
  _event: IpcMainInvokeEvent,
  id: string,
  data: UpdateFeatureInput
): Promise<FeatureWithRelations> {
  if (!id) {
    throw IPCErrors.invalidArguments('Feature ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    const feature = await prisma.feature.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.phaseId !== undefined && { phaseId: data.phaseId }),
      },
      include: {
        phase: true,
      },
    });

    return feature;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Feature not found');
    }
    throw error;
  }
}

/**
 * Delete a feature by ID
 */
async function handleDeleteFeature(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<void> {
  if (!id) {
    throw IPCErrors.invalidArguments('Feature ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    await prisma.feature.delete({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Feature not found');
    }
    throw error;
  }
}

// ============================================================================
// Milestone Handlers
// ============================================================================

/**
 * Toggle milestone completed status
 */
async function handleToggleMilestone(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<Milestone> {
  if (!id) {
    throw IPCErrors.invalidArguments('Milestone ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    // Get current milestone
    const currentMilestone = await prisma.milestone.findUnique({
      where: { id },
    });

    if (!currentMilestone) {
      throw new Error('Milestone not found');
    }

    // Toggle the completed status
    const milestone = await prisma.milestone.update({
      where: { id },
      data: {
        completed: !currentMilestone.completed,
      },
    });

    return milestone;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Milestone not found');
    }
    throw error;
  }
}

// ============================================================================
// Conversion Handlers
// ============================================================================

/**
 * Create a task from a feature (creates task, updates feature status)
 */
async function handleCreateTaskFromFeature(
  _event: IpcMainInvokeEvent,
  featureId: string,
  assigneeId?: string
): Promise<{ task: any; feature: FeatureWithRelations }> {
  if (!featureId) {
    throw IPCErrors.invalidArguments('Feature ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    // Use transaction to create task and update feature atomically
    const result = await prisma.$transaction(async (tx) => {
      // Get the feature
      const feature = await tx.feature.findUnique({
        where: { id: featureId },
        include: { phase: true },
      });

      if (!feature) {
        throw new Error('Feature not found');
      }

      // Create a task from the feature
      const task = await tx.task.create({
        data: {
          title: feature.title,
          description: feature.description,
          priority: mapMoscowPriorityToTaskPriority(feature.priority),
          tags: JSON.stringify(['from-feature']),
          projectId: feature.projectId,
          assigneeId: assigneeId ?? null,
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          phases: true,
        },
      });

      // Update feature status to in_progress
      const updatedFeature = await tx.feature.update({
        where: { id: featureId },
        data: { status: 'in_progress' },
        include: { phase: true },
      });

      return {
        task: {
          ...task,
          tags: JSON.parse(task.tags || '[]'),
        },
        feature: updatedFeature,
      };
    });

    return result;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('Feature not found');
    }
    throw error;
  }
}

/**
 * Helper: Map MoSCoW priority to Task priority
 */
function mapMoscowPriorityToTaskPriority(
  moscow: MoscowPriority
): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
  switch (moscow) {
    case 'MUST':
      return 'URGENT';
    case 'SHOULD':
      return 'HIGH';
    case 'COULD':
      return 'MEDIUM';
    case 'WONT':
      return 'LOW';
    default:
      return 'MEDIUM';
  }
}

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Register all roadmap-related IPC handlers
 */
export function registerRoadmapHandlers(): void {
  // phases:list - List all phases for a project
  ipcMain.handle(
    'phases:list',
    wrapWithLogging('phases:list', wrapHandler(handleListPhases))
  );

  // phases:create - Create a new phase
  ipcMain.handle(
    'phases:create',
    wrapWithLogging('phases:create', wrapHandler(handleCreatePhase))
  );

  // phases:update - Update phase by ID
  ipcMain.handle(
    'phases:update',
    wrapWithLogging('phases:update', wrapHandler(handleUpdatePhase))
  );

  // phases:delete - Delete phase by ID
  ipcMain.handle(
    'phases:delete',
    wrapWithLogging('phases:delete', wrapHandler(handleDeletePhase))
  );

  // phases:reorder - Reorder phases
  ipcMain.handle(
    'phases:reorder',
    wrapWithLogging('phases:reorder', wrapHandler(handleReorderPhases))
  );

  // features:list - List features with optional filters
  ipcMain.handle(
    'features:list',
    wrapWithLogging('features:list', wrapHandler(handleListFeatures))
  );

  // features:create - Create a new feature
  ipcMain.handle(
    'features:create',
    wrapWithLogging('features:create', wrapHandler(handleCreateFeature))
  );

  // features:update - Update feature by ID
  ipcMain.handle(
    'features:update',
    wrapWithLogging('features:update', wrapHandler(handleUpdateFeature))
  );

  // features:delete - Delete feature by ID
  ipcMain.handle(
    'features:delete',
    wrapWithLogging('features:delete', wrapHandler(handleDeleteFeature))
  );

  // milestones:toggle - Toggle milestone completed status
  ipcMain.handle(
    'milestones:toggle',
    wrapWithLogging('milestones:toggle', wrapHandler(handleToggleMilestone))
  );

  // features:createTask - Create a task from a feature
  ipcMain.handle(
    'features:createTask',
    wrapWithLogging('features:createTask', wrapHandler(handleCreateTaskFromFeature))
  );
}

/**
 * Unregister all roadmap-related IPC handlers
 */
export function unregisterRoadmapHandlers(): void {
  ipcMain.removeHandler('phases:list');
  ipcMain.removeHandler('phases:create');
  ipcMain.removeHandler('phases:update');
  ipcMain.removeHandler('phases:delete');
  ipcMain.removeHandler('phases:reorder');
  ipcMain.removeHandler('features:list');
  ipcMain.removeHandler('features:create');
  ipcMain.removeHandler('features:update');
  ipcMain.removeHandler('features:delete');
  ipcMain.removeHandler('milestones:toggle');
  ipcMain.removeHandler('features:createTask');
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
