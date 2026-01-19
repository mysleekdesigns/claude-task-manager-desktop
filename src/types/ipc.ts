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
// Project Types
// ============================================================================

/**
 * Project entity with member information
 */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  targetPath: string | null;
  githubRepo: string | null;
  createdAt: string;
  updatedAt: string;
  members?: ProjectMember[];
}

// ============================================================================
// Task Types
// ============================================================================

/**
 * Task status enum
 */
export type TaskStatus = 'PENDING' | 'PLANNING' | 'IN_PROGRESS' | 'AI_REVIEW' | 'HUMAN_REVIEW' | 'COMPLETED' | 'CANCELLED';

/**
 * Task priority enum
 */
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Phase status enum
 */
export type PhaseStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/**
 * Task entity with relations
 */
export interface Task {
  id: string;
  title: string;
  description: string | null;
  branchName: string | null;
  status: TaskStatus;
  priority: Priority;
  tags: string[];
  projectId: string;
  assigneeId: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  } | null;
  phases?: TaskPhase[];
  logs?: TaskLog[];
  files?: TaskFile[];
  subtasks?: Task[];
  parent?: Task | null;
}

/**
 * Task phase entity
 */
export interface TaskPhase {
  id: string;
  name: string;
  status: PhaseStatus;
  model: string | null;
  taskId: string;
  startedAt: string | null;
  endedAt: string | null;
  logs?: TaskLog[];
}

/**
 * Task log entry
 */
export interface TaskLog {
  id: string;
  type: string;
  message: string;
  metadata: string | null;
  taskId: string;
  phaseId: string | null;
  createdAt: string;
}

/**
 * Task file record
 */
export interface TaskFile {
  id: string;
  path: string;
  action: string;
  taskId: string;
  createdAt: string;
}

/**
 * Create task input data
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: Priority;
  tags?: string[];
  branchName?: string;
  projectId: string;
  assigneeId?: string;
  parentId?: string;
}

/**
 * Update task input data
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: Priority;
  tags?: string[];
  branchName?: string;
  status?: TaskStatus;
  assigneeId?: string;
}

/**
 * Task list filter options
 */
export interface TaskListFilters {
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
}

/**
 * Add phase input data
 */
export interface AddPhaseInput {
  taskId: string;
  name: string;
  model?: string;
}

/**
 * Add log input data
 */
export interface AddLogInput {
  taskId: string;
  phaseId?: string;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Add file input data
 */
export interface AddFileInput {
  taskId: string;
  path: string;
  action: string;
}

/**
 * Project member information
 */
export interface ProjectMember {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  userId: string;
  projectId: string;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}

/**
 * Create project input data
 */
export interface CreateProjectInput {
  name: string;
  description?: string;
  targetPath?: string;
  githubRepo?: string;
  ownerId: string;
}

/**
 * Update project input data
 */
export interface UpdateProjectInput {
  name?: string;
  description?: string;
  targetPath?: string;
  githubRepo?: string;
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

  // Project channels
  'projects:list': (userId: string) => Promise<Project[]>;
  'projects:create': (data: CreateProjectInput) => Promise<Project>;
  'projects:get': (id: string) => Promise<Project | null>;
  'projects:update': (id: string, data: UpdateProjectInput) => Promise<Project>;
  'projects:delete': (id: string) => Promise<void>;
  'projects:addMember': (
    projectId: string,
    userId: string,
    role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  ) => Promise<ProjectMember>;
  'projects:removeMember': (projectId: string, userId: string) => Promise<void>;
  'projects:updateMemberRole': (
    projectId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  ) => Promise<ProjectMember>;

  // User channels
  'users:findByEmail': (email: string) => Promise<AuthUser | null>;

  // Task channels
  'tasks:list': (
    projectId: string,
    filters?: TaskListFilters
  ) => Promise<Task[]>;
  'tasks:create': (data: CreateTaskInput) => Promise<Task>;
  'tasks:get': (id: string) => Promise<Task | null>;
  'tasks:update': (id: string, data: UpdateTaskInput) => Promise<Task>;
  'tasks:updateStatus': (id: string, status: TaskStatus) => Promise<Task>;
  'tasks:delete': (id: string) => Promise<void>;
  'tasks:addPhase': (data: AddPhaseInput) => Promise<TaskPhase>;
  'tasks:addLog': (data: AddLogInput) => Promise<TaskLog>;
  'tasks:addFile': (data: AddFileInput) => Promise<TaskFile>;
  'tasks:getSubtasks': (parentId: string) => Promise<Task[]>;
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
  'projects:list',
  'projects:create',
  'projects:get',
  'projects:update',
  'projects:delete',
  'projects:addMember',
  'projects:removeMember',
  'projects:updateMemberRole',
  'users:findByEmail',
  'tasks:list',
  'tasks:create',
  'tasks:get',
  'tasks:update',
  'tasks:updateStatus',
  'tasks:delete',
  'tasks:addPhase',
  'tasks:addLog',
  'tasks:addFile',
  'tasks:getSubtasks',
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
