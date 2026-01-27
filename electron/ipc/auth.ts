/**
 * Authentication IPC Handlers
 *
 * Handlers for authentication-related IPC channels:
 * - auth:register - Register a new user (Supabase or local fallback)
 * - auth:login - Login with email/password (Supabase or local fallback)
 * - auth:logout - Logout (Supabase or local session)
 * - auth:getCurrentUser - Get current user from stored session
 * - auth:updateProfile - Update user profile
 * - auth:refreshSession - Manual token refresh (Supabase only)
 *
 * When Supabase is configured (SUPABASE_URL and SUPABASE_ANON_KEY), authentication
 * is handled by Supabase Auth. Otherwise, falls back to local bcrypt-based authentication.
 *
 * Session tokens are stored securely and managed by the main process.
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
import { supabaseService } from '../services/supabase.js';

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
 * Map Supabase error codes to user-friendly messages
 */
function mapSupabaseError(error: { message?: string | undefined; code?: string | undefined }): string {
  const errorCode = error.code ?? '';
  const errorMessage = error.message ?? 'An unknown error occurred';

  // Supabase Auth error codes
  const errorMap: Record<string, string> = {
    // Sign up errors
    user_already_exists: 'A user with this email already exists',
    weak_password: 'Password does not meet security requirements',
    invalid_email: 'Invalid email format',
    email_not_confirmed: 'Please confirm your email address',
    signup_disabled: 'Registration is currently disabled',

    // Sign in errors
    invalid_credentials: 'Invalid email or password',
    invalid_grant: 'Invalid email or password',
    user_not_found: 'Invalid email or password',
    email_not_verified: 'Please verify your email before signing in',

    // Session errors
    session_not_found: 'Session not found. Please log in again',
    refresh_token_not_found: 'Session expired. Please log in again',
    invalid_refresh_token: 'Session expired. Please log in again',

    // Rate limiting
    over_request_rate_limit: 'Too many requests. Please try again later',
    over_email_send_rate_limit: 'Too many email requests. Please try again later',

    // Network errors
    network_error: 'Network error. Please check your connection',
  };

  // Check for known error codes
  if (errorMap[errorCode]) {
    return errorMap[errorCode];
  }

  // Check for common error message patterns
  if (errorMessage.includes('Invalid login credentials')) {
    return 'Invalid email or password';
  }
  if (errorMessage.includes('Email not confirmed')) {
    return 'Please confirm your email address before signing in';
  }
  if (errorMessage.includes('User already registered')) {
    return 'A user with this email already exists';
  }

  // Return the original message if no mapping found
  return errorMessage;
}

/**
 * Check if Supabase authentication is available
 */
function isSupabaseAuthAvailable(): boolean {
  return supabaseService.isInitialized();
}

/**
 * Register a new user using Supabase Auth (with local fallback)
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

  // Validate password strength (client-side validation)
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    throw IPCErrors.invalidArguments(
      `Password validation failed: ${passwordValidation.errors.join(', ')}`
    );
  }

  // Use Supabase Auth if available
  if (isSupabaseAuthAvailable()) {
    return handleSupabaseRegister(data);
  }

  // Fall back to local authentication
  return handleLocalRegister(data);
}

/**
 * Register using Supabase Auth
 */
async function handleSupabaseRegister(data: RegisterInput): Promise<AuthResponse> {
  const supabase = supabaseService.getClient();

  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        name: data.name,
      },
    },
  });

  if (error) {
    throw new Error(mapSupabaseError(error));
  }

  if (!authData.user || !authData.session) {
    throw new Error('Registration failed. Please try again.');
  }

  const user = authData.user;
  const session = authData.session;

  return {
    user: {
      id: user.id,
      email: user.email || data.email,
      name: (user.user_metadata?.['name'] as string) || data.name,
      avatar: (user.user_metadata?.['avatar'] as string) || null,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at || user.created_at),
    },
    token: session.access_token,
  };
}

/**
 * Register using local bcrypt-based authentication (fallback)
 */
async function handleLocalRegister(data: RegisterInput): Promise<AuthResponse> {
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
 * Login with email and password using Supabase Auth (with local fallback)
 */
async function handleLogin(
  _event: IpcMainInvokeEvent,
  data: LoginInput
): Promise<AuthResponse> {
  // Validate inputs
  if (!data.email || !data.password) {
    throw IPCErrors.invalidArguments('Email and password are required');
  }

  // Use Supabase Auth if available
  if (isSupabaseAuthAvailable()) {
    return handleSupabaseLogin(data);
  }

  // Fall back to local authentication
  return handleLocalLogin(data);
}

/**
 * Login using Supabase Auth
 */
async function handleSupabaseLogin(data: LoginInput): Promise<AuthResponse> {
  const supabase = supabaseService.getClient();

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    throw new Error(mapSupabaseError(error));
  }

  if (!authData.user || !authData.session) {
    throw new Error('Login failed. Please try again.');
  }

  const user = authData.user;
  const session = authData.session;

  return {
    user: {
      id: user.id,
      email: user.email || data.email,
      name: (user.user_metadata?.['name'] as string) || null,
      avatar: (user.user_metadata?.['avatar'] as string) || null,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at || user.created_at),
    },
    token: session.access_token,
  };
}

/**
 * Login using local bcrypt-based authentication (fallback)
 */
async function handleLocalLogin(data: LoginInput): Promise<AuthResponse> {
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
 * Logout (delete session) using Supabase Auth (with local fallback)
 */
async function handleLogout(
  _event: IpcMainInvokeEvent
): Promise<void> {
  // Use Supabase Auth if available
  if (isSupabaseAuthAvailable()) {
    return handleSupabaseLogout();
  }

  // Fall back to local logout
  return handleLocalLogout();
}

/**
 * Logout using Supabase Auth
 */
async function handleSupabaseLogout(): Promise<void> {
  try {
    await supabaseService.clearSession();
  } catch (error) {
    // Log error but don't throw - user should still be logged out locally
    console.error('Error signing out from Supabase:', error);
  }
}

/**
 * Logout using local session (fallback)
 */
async function handleLocalLogout(): Promise<void> {
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
 * Get current user from stored session using Supabase Auth (with local fallback)
 */
async function handleGetCurrentUser(
  _event: IpcMainInvokeEvent
): Promise<UserResponse | null> {
  // Use Supabase Auth if available
  if (isSupabaseAuthAvailable()) {
    return handleSupabaseGetCurrentUser();
  }

  // Fall back to local session
  return handleLocalGetCurrentUser();
}

/**
 * Get current user from Supabase session
 */
async function handleSupabaseGetCurrentUser(): Promise<UserResponse | null> {
  try {
    const supabase = supabaseService.getClient();

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || '',
      name: (user.user_metadata?.['name'] as string) || null,
      avatar: (user.user_metadata?.['avatar'] as string) || null,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at || user.created_at),
    };
  } catch (error) {
    console.error('Error getting current user from Supabase:', error);
    return null;
  }
}

/**
 * Get current user from local session (fallback)
 */
async function handleLocalGetCurrentUser(): Promise<UserResponse | null> {
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
 * Update user profile using Supabase Auth (with local fallback)
 */
async function handleUpdateProfile(
  _event: IpcMainInvokeEvent,
  data: UpdateProfileInput
): Promise<UserResponse> {
  // Use Supabase Auth if available
  if (isSupabaseAuthAvailable()) {
    return handleSupabaseUpdateProfile(data);
  }

  // Fall back to local update
  return handleLocalUpdateProfile(data);
}

/**
 * Update user profile using Supabase Auth
 */
async function handleSupabaseUpdateProfile(data: UpdateProfileInput): Promise<UserResponse> {
  const supabase = supabaseService.getClient();

  // First check if user is authenticated
  const { data: { user: currentUser }, error: getUserError } = await supabase.auth.getUser();

  if (getUserError || !currentUser) {
    throw new Error('Not authenticated');
  }

  // Update user metadata
  const updateData: { data: Record<string, unknown> } = {
    data: {},
  };

  if (data.name !== undefined) {
    updateData.data['name'] = data.name;
  }
  if (data.avatar !== undefined) {
    updateData.data['avatar'] = data.avatar;
  }

  const { data: authData, error } = await supabase.auth.updateUser(updateData);

  if (error) {
    throw new Error(mapSupabaseError(error));
  }

  if (!authData.user) {
    throw new Error('Failed to update profile');
  }

  const user = authData.user;

  return {
    id: user.id,
    email: user.email || '',
    name: (user.user_metadata?.['name'] as string) || null,
    avatar: (user.user_metadata?.['avatar'] as string) || null,
    createdAt: new Date(user.created_at),
    updatedAt: new Date(user.updated_at || user.created_at),
  };
}

/**
 * Update user profile using local database (fallback)
 */
async function handleLocalUpdateProfile(data: UpdateProfileInput): Promise<UserResponse> {
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
 * Refresh the current session token (Supabase only)
 */
async function handleRefreshSession(
  _event: IpcMainInvokeEvent
): Promise<{ success: boolean; message?: string }> {
  // Only available with Supabase
  if (!isSupabaseAuthAvailable()) {
    // Local sessions don't need manual refresh
    return { success: true, message: 'Local sessions do not require refresh' };
  }

  try {
    const session = await supabaseService.refreshSession();

    if (!session) {
      return { success: false, message: 'Failed to refresh session' };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message };
  }
}

/**
 * Check if Supabase authentication is being used
 */
async function handleIsSupabaseAuth(
  _event: IpcMainInvokeEvent
): Promise<boolean> {
  return isSupabaseAuthAvailable();
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

  // auth:refreshSession - Manual token refresh (Supabase only)
  ipcMain.handle(
    'auth:refreshSession',
    wrapWithLogging('auth:refreshSession', wrapHandler(handleRefreshSession))
  );

  // auth:isSupabaseAuth - Check if using Supabase authentication
  ipcMain.handle(
    'auth:isSupabaseAuth',
    wrapWithLogging('auth:isSupabaseAuth', wrapHandler(handleIsSupabaseAuth))
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
  ipcMain.removeHandler('auth:refreshSession');
  ipcMain.removeHandler('auth:isSupabaseAuth');
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
