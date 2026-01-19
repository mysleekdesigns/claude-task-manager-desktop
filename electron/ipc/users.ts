/**
 * User IPC Handlers
 *
 * Handlers for user-related IPC channels (CRUD operations).
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';

/**
 * User data types
 */
export interface CreateUserInput {
  email: string;
  name?: string;
  passwordHash: string;
  avatar?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  passwordHash?: string;
  avatar?: string;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  passwordHash: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new user
 */
async function handleCreateUser(
  _event: IpcMainInvokeEvent,
  data: CreateUserInput
): Promise<User> {
  if (!data.email || !data.passwordHash) {
    throw IPCErrors.invalidArguments('Email and password hash are required');
  }

  const prisma = databaseService.getClient();

  try {
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name ?? null,
        passwordHash: data.passwordHash,
        avatar: data.avatar ?? null,
      },
    });

    return user;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      throw new Error('A user with this email already exists');
    }
    throw error;
  }
}

/**
 * Get user by ID
 */
async function handleGetUserById(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<User | null> {
  if (!id) {
    throw IPCErrors.invalidArguments('User ID is required');
  }

  const prisma = databaseService.getClient();
  const user = await prisma.user.findUnique({
    where: { id },
  });

  return user;
}

/**
 * Get user by email
 */
async function handleGetUserByEmail(
  _event: IpcMainInvokeEvent,
  email: string
): Promise<User | null> {
  if (!email) {
    throw IPCErrors.invalidArguments('Email is required');
  }

  const prisma = databaseService.getClient();
  const user = await prisma.user.findUnique({
    where: { email },
  });

  return user;
}

/**
 * Find user by email (alias for searching)
 */
async function handleFindUserByEmail(
  _event: IpcMainInvokeEvent,
  email: string
): Promise<User | null> {
  if (!email) {
    throw IPCErrors.invalidArguments('Email is required');
  }

  const prisma = databaseService.getClient();
  const user = await prisma.user.findUnique({
    where: { email },
  });

  return user;
}

/**
 * Update user
 */
async function handleUpdateUser(
  _event: IpcMainInvokeEvent,
  id: string,
  data: UpdateUserInput
): Promise<User> {
  if (!id) {
    throw IPCErrors.invalidArguments('User ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.passwordHash !== undefined && { passwordHash: data.passwordHash }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
      },
    });

    return user;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('User not found');
    }
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      throw new Error('A user with this email already exists');
    }
    throw error;
  }
}

/**
 * Delete user
 */
async function handleDeleteUser(
  _event: IpcMainInvokeEvent,
  id: string
): Promise<void> {
  if (!id) {
    throw IPCErrors.invalidArguments('User ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    await prisma.user.delete({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('User not found');
    }
    throw error;
  }
}

/**
 * Register all user-related IPC handlers
 */
export function registerUserHandlers(): void {
  // users:create - Create a new user
  ipcMain.handle(
    'users:create',
    wrapWithLogging('users:create', wrapHandler(handleCreateUser))
  );

  // users:getById - Get user by ID
  ipcMain.handle(
    'users:getById',
    wrapWithLogging('users:getById', wrapHandler(handleGetUserById))
  );

  // users:getByEmail - Get user by email
  ipcMain.handle(
    'users:getByEmail',
    wrapWithLogging('users:getByEmail', wrapHandler(handleGetUserByEmail))
  );

  // users:findByEmail - Find user by email (for searching)
  ipcMain.handle(
    'users:findByEmail',
    wrapWithLogging('users:findByEmail', wrapHandler(handleFindUserByEmail))
  );

  // users:update - Update user
  ipcMain.handle(
    'users:update',
    wrapWithLogging('users:update', wrapHandler(handleUpdateUser))
  );

  // users:delete - Delete user
  ipcMain.handle(
    'users:delete',
    wrapWithLogging('users:delete', wrapHandler(handleDeleteUser))
  );
}

/**
 * Unregister all user-related IPC handlers
 */
export function unregisterUserHandlers(): void {
  ipcMain.removeHandler('users:create');
  ipcMain.removeHandler('users:getById');
  ipcMain.removeHandler('users:getByEmail');
  ipcMain.removeHandler('users:findByEmail');
  ipcMain.removeHandler('users:update');
  ipcMain.removeHandler('users:delete');
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
