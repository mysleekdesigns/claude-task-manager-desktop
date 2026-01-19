/**
 * Type-safe IPC Communication Layer
 *
 * This file defines all IPC channels and their request/response types.
 * Both main and renderer processes use these types for type safety.
 */

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * App information returned by app:getVersion
 */
export interface AppVersion {
  version: string;
  name: string;
  isDev: boolean;
}

/**
 * Platform information returned by app:getPlatform
 */
export interface AppPlatform {
  platform: NodeJS.Platform;
  arch: string;
  osVersion: string;
}

/**
 * Dialog open directory options
 */
export interface OpenDirectoryOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  message?: string; // macOS only
}

/**
 * Dialog open directory result
 */
export interface OpenDirectoryResult {
  canceled: boolean;
  filePaths: string[];
}

/**
 * Serialized error for IPC transport
 */
export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: string;
}

// ============================================================================
// Auth Types
// ============================================================================

/**
 * User entity returned by auth operations
 */
export interface AuthUser {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Session response from login/register
 */
export interface AuthSessionResponse {
  user: AuthUser;
  token: string;
}

/**
 * Login credentials
 */
export interface AuthLoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data
 */
export interface AuthRegisterData {
  name: string;
  email: string;
  password: string;
}

/**
 * Profile update data
 */
export interface AuthProfileUpdate {
  name?: string;
  avatar?: string;
}

// ============================================================================
// IPC Channel Definitions
// ============================================================================

/**
 * IPC Channels interface defining all invoke channels and their signatures.
 *
 * Format: 'domain:action': (args) => Promise<ReturnType>
 *
 * Add new channels here to maintain type safety across the application.
 */
/**
 * App info returned by app:getInfo
 */
export interface AppInfo {
  name: string;
  version: string;
  platform: NodeJS.Platform;
  isDev: boolean;
}

export interface IpcChannels {
  // App channels
  'app:getInfo': () => Promise<AppInfo>;
  'app:getVersion': () => Promise<AppVersion>;
  'app:getPlatform': () => Promise<AppPlatform>;
  'app:getPath': (name: AppPathName) => Promise<string>;

  // Dialog channels
  'dialog:openDirectory': (
    options?: OpenDirectoryOptions
  ) => Promise<OpenDirectoryResult>;

  // Window management channels
  'window:minimize': () => Promise<void>;
  'window:maximize': () => Promise<void>;
  'window:close': () => Promise<void>;
  'window:isMaximized': () => Promise<boolean>;

  // Preferences channels (tray behavior)
  'preferences:getMinimizeToTray': () => Promise<boolean>;
  'preferences:setMinimizeToTray': (value: boolean) => Promise<void>;
  'preferences:getCloseToTray': () => Promise<boolean>;
  'preferences:setCloseToTray': (value: boolean) => Promise<void>;

  // Auth channels (session managed by main process via electron-store)
  'auth:login': (
    credentials: AuthLoginCredentials
  ) => Promise<AuthSessionResponse>;
  'auth:register': (data: AuthRegisterData) => Promise<AuthSessionResponse>;
  'auth:logout': () => Promise<void>;
  'auth:getCurrentUser': () => Promise<AuthUser | null>;
  'auth:updateProfile': (
    updates: AuthProfileUpdate
  ) => Promise<AuthUser>;
}

/**
 * Valid app path names for app:getPath
 */
export type AppPathName =
  | 'home'
  | 'appData'
  | 'userData'
  | 'temp'
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos'
  | 'logs';

/**
 * Extract channel names as a union type
 */
export type IpcChannelName = keyof IpcChannels;

/**
 * Extract the function type for a specific channel
 */
export type IpcChannelFunction<T extends IpcChannelName> = IpcChannels[T];

/**
 * Extract the parameters type for a specific channel
 */
export type IpcChannelParams<T extends IpcChannelName> = Parameters<
  IpcChannels[T]
>;

/**
 * Extract the return type for a specific channel (unwrapped from Promise)
 */
export type IpcChannelReturn<T extends IpcChannelName> = Awaited<
  ReturnType<IpcChannels[T]>
>;

// ============================================================================
// Event Channel Definitions (push events from main to renderer)
// ============================================================================

/**
 * Event channels interface for push events from main process.
 * These are events sent via webContents.send() and received via window.electron.on()
 */
export interface IpcEventChannels {
  'app:update-available': (info: UpdateInfo) => void;
  'app:update-downloaded': (info: UpdateInfo) => void;
  'app:update-progress': (progress: UpdateProgress) => void;
}

/**
 * Update information for auto-updater events
 */
export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

/**
 * Update progress information
 */
export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

/**
 * Extract event channel names as a union type
 */
export type IpcEventChannelName = keyof IpcEventChannels;

/**
 * Extract the callback type for a specific event channel
 */
export type IpcEventCallback<T extends IpcEventChannelName> =
  IpcEventChannels[T];

/**
 * Extract the parameters type for a specific event channel callback
 */
export type IpcEventParams<T extends IpcEventChannelName> = Parameters<
  IpcEventChannels[T]
>;

// ============================================================================
// Channel Whitelists (for preload script security)
// ============================================================================

/**
 * List of all valid invoke channels for security validation
 */
export const VALID_INVOKE_CHANNELS: readonly IpcChannelName[] = [
  'app:getInfo',
  'app:getVersion',
  'app:getPlatform',
  'app:getPath',
  'dialog:openDirectory',
  'window:minimize',
  'window:maximize',
  'window:close',
  'window:isMaximized',
  'preferences:getMinimizeToTray',
  'preferences:setMinimizeToTray',
  'preferences:getCloseToTray',
  'preferences:setCloseToTray',
  'auth:login',
  'auth:register',
  'auth:logout',
  'auth:getCurrentUser',
  'auth:updateProfile',
] as const;

/**
 * List of all valid event channels for security validation
 */
export const VALID_EVENT_CHANNELS: readonly IpcEventChannelName[] = [
  'app:update-available',
  'app:update-downloaded',
  'app:update-progress',
] as const;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a string is a valid invoke channel
 */
export function isValidInvokeChannel(
  channel: string
): channel is IpcChannelName {
  return VALID_INVOKE_CHANNELS.includes(channel as IpcChannelName);
}

/**
 * Type guard to check if a string is a valid event channel
 */
export function isValidEventChannel(
  channel: string
): channel is IpcEventChannelName {
  return VALID_EVENT_CHANNELS.includes(channel as IpcEventChannelName);
}
