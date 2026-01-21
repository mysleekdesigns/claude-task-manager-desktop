/**
 * Authentication IPC Handlers
 *
 * Handlers for authentication-related IPC channels:
 * - auth:register - Register a new user
 * - auth:login - Login with email/password
 * - auth:logout - Logout (delete session)
 * - auth:getCurrentUser - Get current user from stored session
 * - auth:updateProfile - Update user profile
 *
 * Session tokens are stored securely in electron-store and managed by the main process.
 * The renderer does not need to handle or store tokens directly.
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { databaseService } from '../services/database.js';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  calculateSessionExpiry,
  isSessionExpired,
  validatePassword,
  validateEmail,
} from '../services/auth.js';
import {
  getSessionToken,
  setSessionToken,
  clearSessionToken,
} from '../services/session-storage.js';

/**
 * Auth data types
 */
export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  name?: string;
  avatar?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  token: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Register a new user
 */
async function handleRegister(
  _event: IpcMainInvokeEvent,
  data: RegisterInput
): Promise<AuthResponse> {
  // Validate inputs
  if (!data.email || !data.password || !data.name) {
    throw IPCErrors.invalidArguments('Name, email and password are required');
  }

  // Validate email format
  if (!validateEmail(data.email)) {
    throw IPCErrors.invalidArguments('Invalid email format');
  }

  // Validate password strength
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    throw IPCErrors.invalidArguments(
      `Password validation failed: ${passwordValidation.errors.join(', ')}`
    );
  }

  const prisma = databaseService.getClient();

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('A user with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user and session in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          name: data.name,
        },
      });

      // Create session
      const token = generateSessionToken();
      const expiresAt = calculateSessionExpiry();

      await tx.session.create({
        data: {
          token,
          userId: user.id,
          expiresAt,
        },
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        token,
      };
    });

    // Store session token
    setSessionToken(result.token);

    return result;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      throw new Error('A user with this email already exists');
    }
    throw error;
  }
}

/**
 * Login with email and password
 */
async function handleLogin(
  _event: IpcMainInvokeEvent,
  data: LoginInput
): Promise<AuthResponse> {
  // Validate inputs
  if (!data.email || !data.password) {
    throw IPCErrors.invalidArguments('Email and password are required');
  }

  const prisma = databaseService.getClient();

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const isPasswordValid = await verifyPassword(data.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Create new session
  const token = generateSessionToken();
  const expiresAt = calculateSessionExpiry();

  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  // Store session token
  setSessionToken(token);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    token,
  };
}

/**
 * Logout (delete session)
 */
async function handleLogout(
  _event: IpcMainInvokeEvent
): Promise<void> {
  const token = getSessionToken();

  if (!token) {
    // Already logged out
    return;
  }

  const prisma = databaseService.getClient();

  try {
    await prisma.session.delete({
      where: { token },
    });
  } catch (error) {
    // Ignore errors if session doesn't exist (already logged out)
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      // Session doesn't exist, just clear local storage
    } else {
      throw error;
    }
  } finally {
    // Always clear local session token
    clearSessionToken();
  }
}

/**
 * Get current user from stored session
 */
async function handleGetCurrentUser(
  _event: IpcMainInvokeEvent
): Promise<UserResponse | null> {
  const token = getSessionToken();

  if (!token) {
    return null;
  }

  const prisma = databaseService.getClient();

  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      // Session not found in database, clear local token
      clearSessionToken();
      return null;
    }

    // Check if session is expired
    if (isSessionExpired(session.expiresAt)) {
      // Delete expired session
      await prisma.session.delete({
        where: { token },
      });
      clearSessionToken();
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatar: session.user.avatar,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    };
  } catch {
    clearSessionToken();
    return null;
  }
}

/**
 * Update user profile
 */
async function handleUpdateProfile(
  _event: IpcMainInvokeEvent,
  data: UpdateProfileInput
): Promise<UserResponse> {
  const token = getSessionToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const prisma = databaseService.getClient();

  try {
    // Get user from session
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      clearSessionToken();
      throw new Error('Invalid session');
    }

    // Check if session is expired
    if (isSessionExpired(session.expiresAt)) {
      await prisma.session.delete({
        where: { token },
      });
      clearSessionToken();
      throw new Error('Session expired');
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('User not found');
    }
    throw error;
  }
}

/**
 * Register all auth-related IPC handlers
 */
export function registerAuthHandlers(): void {
  // auth:register - Register a new user
  ipcMain.handle(
    'auth:register',
    wrapWithLogging('auth:register', wrapHandler(handleRegister))
  );

  // auth:login - Login with email/password
  ipcMain.handle(
    'auth:login',
    wrapWithLogging('auth:login', wrapHandler(handleLogin))
  );

  // auth:logout - Logout (delete session)
  ipcMain.handle(
    'auth:logout',
    wrapWithLogging('auth:logout', wrapHandler(handleLogout))
  );

  // auth:getCurrentUser - Get current user from stored session
  ipcMain.handle(
    'auth:getCurrentUser',
    wrapWithLogging('auth:getCurrentUser', wrapHandler(handleGetCurrentUser))
  );

  // auth:updateProfile - Update user profile
  ipcMain.handle(
    'auth:updateProfile',
    wrapWithLogging('auth:updateProfile', wrapHandler(handleUpdateProfile))
  );
}

/**
 * Unregister all auth-related IPC handlers
 */
export function unregisterAuthHandlers(): void {
  ipcMain.removeHandler('auth:register');
  ipcMain.removeHandler('auth:login');
  ipcMain.removeHandler('auth:logout');
  ipcMain.removeHandler('auth:getCurrentUser');
  ipcMain.removeHandler('auth:updateProfile');
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

    // Don't log sensitive data (passwords, tokens)
    const sanitizedArgs = args.map((arg) => {
      if (channel === 'auth:register' || channel === 'auth:login') {
        if (typeof arg === 'object' && arg !== null && 'password' in arg) {
          const { password: _password, ...rest } = arg as Record<string, unknown>;
          return { ...rest, password: '[REDACTED]' };
        }
      }
      return arg;
    });

    logIPCRequest(channel, sanitizedArgs);

    try {
      const result = await handler(event, ...args);
      const duration = performance.now() - startTime;

      // Don't log sensitive data in responses (tokens)
      const sanitizedResult =
        channel === 'auth:register' || channel === 'auth:login'
          ? { user: (result as AuthResponse).user, token: '[REDACTED]' }
          : result;

      logIPCResponse(channel, sanitizedResult, duration, true);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logIPCError(channel, error, duration);
      throw error;
    }
  };
}
