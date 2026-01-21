/**
 * Settings IPC Handlers
 *
 * Handlers for user settings-related IPC channels:
 * - settings:get - Get user settings by userId
 * - settings:update - Update general settings (theme, defaultTerminalCount, autoLaunchClaude, minimizeToTray)
 * - settings:updateApiKey - Update API keys (claudeApiKey, githubToken) with secure encryption
 * - settings:updateProfile - Update user profile (name, avatar, password change)
 *
 * API keys are stored encrypted in electron-store for enhanced security.
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
  validatePassword,
} from '../services/auth.js';
import {
  getSessionToken,
  clearSessionToken,
} from '../services/session-storage.js';
import { isSessionExpired } from '../services/auth.js';
import Store from 'electron-store';

/**
 * Secure store for API keys
 * Uses encryption to protect sensitive data
 */
const apiKeyStore = new Store<{
  claudeApiKey?: string;
  githubToken?: string;
}>({
  name: 'api-keys',
  encryptionKey: 'claude-tasks-api-keys-encryption-key',
  defaults: {},
});

/**
 * Settings data types
 */
export interface UserSettingsResponse {
  id: string;
  userId: string;
  theme: string;
  defaultTerminalCount: number;
  autoLaunchClaude: boolean;
  minimizeToTray: boolean;
  keyboardShortcuts: Record<string, string> | null;
  hasClaudeApiKey: boolean;
  hasGithubToken: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateSettingsInput {
  theme?: string;
  defaultTerminalCount?: number;
  autoLaunchClaude?: boolean;
  minimizeToTray?: boolean;
  keyboardShortcuts?: Record<string, string>;
}

export interface UpdateApiKeyInput {
  claudeApiKey?: string;
  githubToken?: string;
}

export interface UpdateProfileInput {
  name?: string;
  avatar?: string;
  currentPassword?: string;
  newPassword?: string;
}

/**
 * Get the current user from session
 */
async function getCurrentUserFromSession() {
  const token = getSessionToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const prisma = databaseService.getClient();

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    clearSessionToken();
    throw new Error('Invalid session');
  }

  if (isSessionExpired(session.expiresAt)) {
    await prisma.session.delete({
      where: { token },
    });
    clearSessionToken();
    throw new Error('Session expired');
  }

  return session.user;
}

/**
 * Get user settings by userId
 */
async function handleGetSettings(
  _event: IpcMainInvokeEvent,
  userId: string
): Promise<UserSettingsResponse> {
  if (!userId) {
    throw IPCErrors.invalidArguments('User ID is required');
  }

  const prisma = databaseService.getClient();

  try {
    // Try to find existing settings
    let settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId },
      });
    }

    // Parse keyboard shortcuts JSON
    const keyboardShortcuts: Record<string, string> | null = settings.keyboardShortcuts
      ? (JSON.parse(settings.keyboardShortcuts) as Record<string, string>)
      : null;

    // Check if API keys exist in secure store
    const storedKeys = apiKeyStore.get(`user_${userId}`, {}) as {
      claudeApiKey?: string;
      githubToken?: string;
    };

    return {
      id: settings.id,
      userId: settings.userId,
      theme: settings.theme,
      defaultTerminalCount: settings.defaultTerminalCount,
      autoLaunchClaude: settings.autoLaunchClaude,
      minimizeToTray: settings.minimizeToTray,
      keyboardShortcuts,
      hasClaudeApiKey: !!storedKeys.claudeApiKey,
      hasGithubToken: !!storedKeys.githubToken,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('User not found');
    }
    throw error;
  }
}

/**
 * Update general settings
 */
async function handleUpdateSettings(
  _event: IpcMainInvokeEvent,
  userId: string,
  data: UpdateSettingsInput
): Promise<UserSettingsResponse> {
  if (!userId) {
    throw IPCErrors.invalidArguments('User ID is required');
  }

  // Validate inputs
  if (data.theme && !['light', 'dark', 'system'].includes(data.theme)) {
    throw IPCErrors.invalidArguments(
      'Theme must be one of: light, dark, system'
    );
  }

  if (
    data.defaultTerminalCount !== undefined &&
    (data.defaultTerminalCount < 1 || data.defaultTerminalCount > 10)
  ) {
    throw IPCErrors.invalidArguments(
      'Default terminal count must be between 1 and 10'
    );
  }

  const prisma = databaseService.getClient();

  try {
    // Ensure settings exist
    await prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    // Update settings
    const settings = await prisma.userSettings.update({
      where: { userId },
      data: {
        ...(data.theme !== undefined && { theme: data.theme }),
        ...(data.defaultTerminalCount !== undefined && {
          defaultTerminalCount: data.defaultTerminalCount,
        }),
        ...(data.autoLaunchClaude !== undefined && {
          autoLaunchClaude: data.autoLaunchClaude,
        }),
        ...(data.minimizeToTray !== undefined && {
          minimizeToTray: data.minimizeToTray,
        }),
        ...(data.keyboardShortcuts !== undefined && {
          keyboardShortcuts: JSON.stringify(data.keyboardShortcuts),
        }),
      },
    });

    // Parse keyboard shortcuts JSON
    const keyboardShortcuts: Record<string, string> | null = settings.keyboardShortcuts
      ? (JSON.parse(settings.keyboardShortcuts) as Record<string, string>)
      : null;

    // Check if API keys exist in secure store
    const storedKeys = apiKeyStore.get(`user_${userId}`, {}) as {
      claudeApiKey?: string;
      githubToken?: string;
    };

    return {
      id: settings.id,
      userId: settings.userId,
      theme: settings.theme,
      defaultTerminalCount: settings.defaultTerminalCount,
      autoLaunchClaude: settings.autoLaunchClaude,
      minimizeToTray: settings.minimizeToTray,
      keyboardShortcuts,
      hasClaudeApiKey: !!storedKeys.claudeApiKey,
      hasGithubToken: !!storedKeys.githubToken,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('User not found');
    }
    throw error;
  }
}

/**
 * Update API keys (stored securely in electron-store)
 */
async function handleUpdateApiKey(
  _event: IpcMainInvokeEvent,
  userId: string,
  data: UpdateApiKeyInput
): Promise<{ success: boolean }> {
  if (!userId) {
    throw IPCErrors.invalidArguments('User ID is required');
  }

  if (!data.claudeApiKey && !data.githubToken) {
    throw IPCErrors.invalidArguments(
      'At least one API key must be provided'
    );
  }

  const prisma = databaseService.getClient();

  try {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get existing keys
    const existingKeys = apiKeyStore.get(`user_${userId}`, {}) as {
      claudeApiKey?: string;
      githubToken?: string;
    };

    // Update keys in secure store
    const updatedKeys = {
      ...existingKeys,
      ...(data.claudeApiKey !== undefined && {
        claudeApiKey: data.claudeApiKey,
      }),
      ...(data.githubToken !== undefined && { githubToken: data.githubToken }),
    };

    apiKeyStore.set(`user_${userId}`, updatedKeys);

    // Update the UserSettings record to trigger updatedAt timestamp
    await prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: { updatedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      throw new Error('User not found');
    }
    throw error;
  }
}

/**
 * Update user profile (name, avatar, password)
 */
async function handleUpdateProfile(
  _event: IpcMainInvokeEvent,
  data: UpdateProfileInput
): Promise<{
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}> {
  // Get current user from session
  const currentUser = await getCurrentUserFromSession();

  const prisma = databaseService.getClient();

  try {
    // If changing password, verify current password and validate new password
    if (data.newPassword) {
      if (!data.currentPassword) {
        throw IPCErrors.invalidArguments(
          'Current password is required to set a new password'
        );
      }

      // Verify current password
      const isPasswordValid = await verifyPassword(
        data.currentPassword,
        currentUser.passwordHash
      );

      if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      const passwordValidation = validatePassword(data.newPassword);
      if (!passwordValidation.isValid) {
        throw IPCErrors.invalidArguments(
          `Password validation failed: ${passwordValidation.errors.join(', ')}`
        );
      }

      // Hash new password
      const newPasswordHash = await hashPassword(data.newPassword);

      // Update user with new password
      const user = await prisma.user.update({
        where: { id: currentUser.id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.avatar !== undefined && { avatar: data.avatar }),
          passwordHash: newPasswordHash,
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
    }

    // Update user without password change
    const user = await prisma.user.update({
      where: { id: currentUser.id },
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
 * Register all settings-related IPC handlers
 */
export function registerSettingsHandlers(): void {
  // settings:get - Get user settings by userId
  ipcMain.handle(
    'settings:get',
    wrapWithLogging('settings:get', wrapHandler(handleGetSettings))
  );

  // settings:update - Update general settings
  ipcMain.handle(
    'settings:update',
    wrapWithLogging('settings:update', wrapHandler(handleUpdateSettings))
  );

  // settings:updateApiKey - Update API keys with secure encryption
  ipcMain.handle(
    'settings:updateApiKey',
    wrapWithLogging('settings:updateApiKey', wrapHandler(handleUpdateApiKey))
  );

  // settings:updateProfile - Update user profile
  ipcMain.handle(
    'settings:updateProfile',
    wrapWithLogging('settings:updateProfile', wrapHandler(handleUpdateProfile))
  );
}

/**
 * Unregister all settings-related IPC handlers
 */
export function unregisterSettingsHandlers(): void {
  ipcMain.removeHandler('settings:get');
  ipcMain.removeHandler('settings:update');
  ipcMain.removeHandler('settings:updateApiKey');
  ipcMain.removeHandler('settings:updateProfile');
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

    // Don't log sensitive data (API keys, passwords)
    const sanitizedArgs = args.map((arg) => {
      if (channel === 'settings:updateApiKey') {
        if (typeof arg === 'object' && arg !== null) {
          const sanitized: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(arg as Record<string, unknown>)) {
            if (key === 'claudeApiKey' || key === 'githubToken') {
              sanitized[key] = value ? '[REDACTED]' : undefined;
            } else {
              sanitized[key] = value;
            }
          }
          return sanitized;
        }
      }
      if (channel === 'settings:updateProfile') {
        if (typeof arg === 'object' && arg !== null) {
          const sanitized = { ...arg } as Record<string, unknown>;
          if ('currentPassword' in sanitized) {
            sanitized['currentPassword'] = '[REDACTED]';
          }
          if ('newPassword' in sanitized) {
            sanitized['newPassword'] = '[REDACTED]';
          }
          return sanitized;
        }
      }
      return arg;
    });

    logIPCRequest(channel, sanitizedArgs);

    try {
      const result = await handler(event, ...args);
      const duration = performance.now() - startTime;

      // Don't log sensitive data in responses
      const sanitizedResult =
        channel === 'settings:get'
          ? {
              ...(result as UserSettingsResponse),
              // Only show boolean flags, not actual keys
            }
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
