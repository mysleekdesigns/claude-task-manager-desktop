/**
 * Type-safe IPC Communication Layer
 *
 * This file defines all IPC channels and their request/response types.
 * Both main and renderer processes use these types for type safety.
 */

import type { GitHubTokenValidation } from './github.js';

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

/**
 * Refresh session response
 */
export interface AuthRefreshSessionResponse {
  success: boolean;
  message?: string;
}

/**
 * OAuth provider types supported for authentication
 */
export type OAuthProvider = 'github' | 'google';

/**
 * Payload sent when OAuth authentication succeeds
 */
export interface OAuthSuccessPayload {
  user: AuthUser;
  provider: OAuthProvider;
}

/**
 * Payload sent when OAuth authentication fails
 */
export interface OAuthErrorPayload {
  error: string;
  errorDescription?: string;
  provider: OAuthProvider;
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
 * Claude Code task automation status (Phase 15)
 */
export type ClaudeTaskStatus = 'IDLE' | 'STARTING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'AWAITING_INPUT';

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
  // Phase 15: Claude Code automation fields
  claudeSessionId?: string | null;
  claudeSessionName?: string | null;
  claudeStartedAt?: string | null;
  claudeCompletedAt?: string | null;
  claudeStatus?: ClaudeTaskStatus;
  claudeTerminalId?: string | null;
  linkedTerminal?: Terminal | null;
  // PRD Phase scoping fields
  prdPhaseNumber?: number | null;
  prdPhaseName?: string | null;
  scopedPrdContent?: string | null;
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

// ============================================================================
// Roadmap Types (Phase 9)
// ============================================================================

/**
 * MoSCoW priority enum for features
 */
export type MoscowPriority = 'MUST' | 'SHOULD' | 'COULD' | 'WONT';

/**
 * Roadmap phase status
 */
export type RoadmapPhaseStatus = 'planned' | 'in_progress' | 'completed';

/**
 * Feature status
 */
export type FeatureStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Phase entity for roadmap planning
 */
export interface RoadmapPhase {
  id: string;
  name: string;
  description: string | null;
  order: number;
  status: RoadmapPhaseStatus;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  features?: Feature[];
  milestones?: Milestone[];
}

/**
 * Alias for Phase - used by IPC handlers
 */
export type Phase = RoadmapPhase;

/**
 * Feature entity with MoSCoW priority
 */
export interface Feature {
  id: string;
  title: string;
  description: string | null;
  priority: MoscowPriority;
  status: FeatureStatus;
  projectId: string;
  phaseId: string | null;
  createdAt: string;
  updatedAt: string;
  phase?: RoadmapPhase | null;
}

/**
 * Milestone entity
 */
export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  phaseId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create phase input data
 */
export interface CreatePhaseInput {
  name: string;
  description?: string;
  order: number;
  projectId: string;
}

/**
 * Update phase input data
 */
export interface UpdatePhaseInput {
  name?: string;
  description?: string;
  order?: number;
  status?: RoadmapPhaseStatus;
}

/**
 * Create feature input data
 */
export interface CreateFeatureInput {
  title: string;
  description?: string;
  priority: MoscowPriority;
  projectId: string;
  phaseId?: string;
}

/**
 * Update feature input data
 */
export interface UpdateFeatureInput {
  title?: string;
  description?: string;
  priority?: MoscowPriority;
  status?: FeatureStatus;
  phaseId?: string;
}

/**
 * Create milestone input data
 */
export interface CreateMilestoneInput {
  title: string;
  phaseId: string;
  order: number;
}

/**
 * Toggle milestone input data
 */
export interface ToggleMilestoneInput {
  id: string;
  completed: boolean;
}

/**
 * Reorder phases input data
 */
export interface ReorderPhasesInput {
  projectId: string;
  phaseOrders: { id: string; order: number }[];
}

/**
 * Feature list filter options
 */
export interface FeatureListFilters {
  projectId?: string;
  phaseId?: string;
  priority?: MoscowPriority;
  status?: FeatureStatus;
}

/**
 * Create task from feature response
 */
export interface CreateTaskFromFeatureResponse {
  task: Task;
  feature: Feature;
}

// ============================================================================
// Memory Types (Phase 10)
// ============================================================================

/**
 * Memory type enum
 */
export type MemoryType = 'session' | 'pr_review' | 'codebase' | 'pattern' | 'gotcha';

/**
 * Memory entity for project context
 */
export interface Memory {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create memory input data
 */
export interface CreateMemoryInput {
  type: MemoryType;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  projectId: string;
}

/**
 * Update memory input data
 */
export interface UpdateMemoryInput {
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Memory list filter options
 */
export interface MemoryListFilters {
  type?: MemoryType;
  search?: string;
}

// ============================================================================
// Idea Types (Phase 13.2)
// ============================================================================

/**
 * Idea status enum
 */
export type IdeaStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CONVERTED';

/**
 * Idea entity for ideation board
 */
export interface Idea {
  id: string;
  title: string;
  description: string | null;
  votes: number;
  status: IdeaStatus;
  projectId: string;
  createdById: string;
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Create idea input data
 */
export interface CreateIdeaInput {
  title: string;
  description?: string;
  projectId: string;
}

/**
 * Update idea input data
 */
export interface UpdateIdeaInput {
  title?: string;
  description?: string;
  status?: IdeaStatus;
}

/**
 * Idea list filter options
 */
export interface IdeaListFilters {
  status?: IdeaStatus;
}

/**
 * Vote on idea input data
 */
export interface VoteIdeaInput {
  ideaId: string;
  delta: number; // +1 for upvote, -1 for downvote
}

/**
 * Convert idea to feature response
 */
export interface ConvertIdeaToFeatureResponse {
  feature: Feature;
  idea: Idea;
}

// ============================================================================
// Terminal Types
// ============================================================================

/**
 * Terminal status enum
 */
export type TerminalStatus = 'idle' | 'running' | 'exited';

/**
 * Terminal entity
 */
export interface Terminal {
  id: string;
  name: string;
  status: TerminalStatus;
  pid: number | null;
  projectId: string;
  worktreeId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create terminal input data
 */
export interface CreateTerminalInput {
  projectId: string;
  name?: string;
  cwd?: string;
}

/**
 * Write terminal input data
 */
export interface WriteTerminalInput {
  id: string;
  data: string;
}

/**
 * Resize terminal input data
 */
export interface ResizeTerminalInput {
  id: string;
  cols: number;
  rows: number;
}

/**
 * Create terminal response
 */
export interface CreateTerminalResponse {
  id: string;
  name: string;
  pid: number;
}

// ============================================================================
// Worktree Types
// ============================================================================

/**
 * Worktree entity
 */
export interface Worktree {
  id: string;
  name: string;
  path: string;
  branch: string;
  isMain: boolean;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  terminals?: Terminal[];
  _count?: {
    terminals: number;
  };
}

/**
 * Create worktree input data
 */
export interface CreateWorktreeInput {
  projectId: string;
  name: string;
  branch: string;
  path: string;
  createBranch?: boolean;
}

/**
 * Update worktree input data
 */
export interface UpdateWorktreeInput {
  name?: string;
}

/**
 * Worktree info from git
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
  isMain: boolean;
  commit?: string;
}

/**
 * Worktree with git status information
 */
export interface WorktreeWithStatus extends Worktree {
  gitStatus?: {
    current: string | null;
    ahead: number;
    behind: number;
    staged: number;
    modified: number;
    untracked: number;
  };
}

/**
 * Delete worktree input data
 */
export interface DeleteWorktreeInput {
  id: string;
  force?: boolean;
}

/**
 * Sync worktrees result
 */
export interface SyncWorktreesResult {
  added: number;
  removed: number;
}

/**
 * Git branch information
 */
export interface BranchInfo {
  name: string;
  current: boolean;
  isRemote: boolean;
  commit: string | undefined;
}

/**
 * Git repository status
 */
export interface GitStatus {
  current: string | null;
  tracking: string | null;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
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
// Changelog Types (Phase 13.3)
// ============================================================================

/**
 * Changelog entry type enum
 */
export type ChangelogEntryType = 'FEATURE' | 'FIX' | 'IMPROVEMENT' | 'BREAKING';

/**
 * Changelog entry entity
 */
export interface ChangelogEntry {
  id: string;
  title: string;
  description: string | null;
  version: string | null;
  type: ChangelogEntryType;
  taskId: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  task?: {
    id: string;
    title: string;
  } | null;
}

/**
 * Create changelog entry input data
 */
export interface CreateChangelogInput {
  title: string;
  description?: string;
  version?: string;
  type: ChangelogEntryType;
  taskId?: string;
  projectId: string;
}

/**
 * Update changelog entry input data
 */
export interface UpdateChangelogInput {
  title?: string;
  description?: string;
  version?: string;
  type?: ChangelogEntryType;
  taskId?: string;
}

/**
 * Changelog export format
 */
export interface ChangelogExportResult {
  markdown: string;
  entries: ChangelogEntry[];
}

// ============================================================================
// Insights Types (Phase 13)
// ============================================================================

/**
 * Task metrics for insights dashboard
 */
export interface TaskMetrics {
  total: number;
  completedThisWeek: number;
  completedThisMonth: number;
  completedTotal: number;
  byStatus: {
    status: TaskStatus;
    count: number;
  }[];
  byPriority: {
    priority: Priority;
    count: number;
  }[];
}

/**
 * Time metrics for insights dashboard
 */
export interface TimeMetrics {
  averageDurationMinutes: number;
  totalTimeMinutes: number;
  phaseBreakdown: {
    phaseName: string;
    averageMinutes: number;
    taskCount: number;
  }[];
}

/**
 * Productivity trend data point
 */
export interface ProductivityTrend {
  date: string;
  completedCount: number;
  createdCount: number;
}

// ============================================================================
// MCP Types (Phase 11)
// ============================================================================

/**
 * MCP configuration entity
 */
export interface McpConfig {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create MCP config input data
 */
export interface CreateMcpInput {
  name: string;
  type: string;
  config?: Record<string, unknown>;
  projectId: string;
}

/**
 * Update MCP config input data
 */
export interface UpdateMcpInput {
  name?: string;
  config?: Record<string, unknown>;
}

/**
 * Preset MCP server definition
 */
export interface PresetMcpServer {
  name: string;
  type: string;
  description: string;
  category: 'documentation' | 'knowledge' | 'integration' | 'browser' | 'builtin';
  defaultConfig?: Record<string, unknown>;
}

/**
 * MCP server configuration for Claude Desktop (Phase 11.5)
 */
export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Claude Desktop config file structure (Phase 11.5)
 */
export interface ClaudeDesktopConfig {
  mcpServers: Record<string, McpServerConfig>;
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

// ============================================================================
// Notification Types (Phase 13.4)
// ============================================================================

/**
 * Notification input data
 */
export interface ShowNotificationInput {
  title: string;
  body: string;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
}

/**
 * Task completed notification input
 */
export interface TaskCompletedNotificationInput {
  taskId: string;
  taskTitle: string;
  projectName?: string;
}

/**
 * Terminal error notification input
 */
export interface TerminalErrorNotificationInput {
  terminalName: string;
  error: string;
}

/**
 * Assignment notification input
 */
export interface AssignmentNotificationInput {
  taskId: string;
  taskTitle: string;
  projectName?: string;
  assignerName: string;
}

// ============================================================================
// Claude Code Types (Phase 15)
// ============================================================================

/**
 * Input for starting a Claude Code task
 */
export interface ClaudeCodeStartInput {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  projectPath: string;
  sessionId: string;
  worktreeId?: string;
  maxTurns?: number;
  maxBudget?: number;
  allowedTools?: string[];
  appendSystemPrompt?: string;
}

/**
 * Response from starting a Claude Code task
 */
export interface ClaudeCodeStartResponse {
  terminalId: string;
  sessionId: string;
}

/**
 * Input for resuming a Claude Code task
 */
export interface ClaudeCodeResumeInput {
  taskId: string;
  sessionId: string;
  prompt?: string;
}

/**
 * Response from resuming a Claude Code task
 */
export interface ClaudeCodeResumeResponse {
  terminalId: string;
}

/**
 * Input for pausing a Claude Code task
 */
export interface ClaudeCodePauseInput {
  taskId: string;
}

/**
 * Input for getting Claude Code task status
 */
export interface ClaudeCodeStatusInput {
  taskId: string;
}

/**
 * Response with Claude Code task status
 */
export interface ClaudeCodeStatusResponse {
  isRunning: boolean;
  terminalId: string | null;
  sessionId: string | null;
}

/**
 * Response with detailed active Claude task information
 */
export interface ClaudeCodeActiveTaskResponse {
  isRunning: boolean;
  terminalId: string | null;
  sessionId: string | null;
  claudeStatus: ClaudeTaskStatus;
  startedAt: string | null;
  completedAt: string | null;
}

// ============================================================================
// Settings Types (Phase 14)
// ============================================================================

/**
 * User settings response
 */
export interface UserSettings {
  id: string;
  userId: string;
  theme: string;
  defaultTerminalCount: number;
  autoLaunchClaude: boolean;
  minimizeToTray: boolean;
  keyboardShortcuts: Record<string, string> | null;
  hasClaudeApiKey: boolean;
  hasGithubToken: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Update settings input
 */
export interface UpdateSettingsInput {
  theme?: string;
  defaultTerminalCount?: number;
  autoLaunchClaude?: boolean;
  minimizeToTray?: boolean;
  keyboardShortcuts?: Record<string, string>;
}

/**
 * Update API key input
 */
export interface UpdateApiKeyInput {
  claudeApiKey?: string;
  githubToken?: string;
}

/**
 * Profile update data for settings
 */
export interface ProfileUpdateData {
  name?: string;
  avatar?: string;
  currentPassword?: string;
  newPassword?: string;
}

/**
 * Change password input
 */
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/**
 * Claude API key validation result
 */
export interface ClaudeApiKeyValidation {
  valid: boolean;
  model?: string;
  error?: string;
}

/**
 * Dialog open file options
 */
export interface OpenFileOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: {
    name: string;
    extensions: string[];
  }[];
  properties?: ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles')[];
}

/**
 * Dialog open file result
 */
export interface OpenFileResult {
  canceled: boolean;
  filePaths: string[];
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
  'auth:refreshSession': () => Promise<AuthRefreshSessionResponse>;
  'auth:isSupabaseAuth': () => Promise<boolean>;
  'auth:signInWithOAuth': (provider: OAuthProvider) => Promise<void>;

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

  // Roadmap channels (Phase 9)
  'phases:list': (projectId: string) => Promise<Phase[]>;
  'phases:create': (data: CreatePhaseInput) => Promise<Phase>;
  'phases:update': (id: string, data: UpdatePhaseInput) => Promise<Phase>;
  'phases:delete': (id: string) => Promise<void>;
  'phases:reorder': (updates: { phaseId: string; order: number }[]) => Promise<void>;
  'features:list': (filters?: FeatureListFilters) => Promise<Feature[]>;
  'features:create': (data: CreateFeatureInput) => Promise<Feature>;
  'features:update': (id: string, data: UpdateFeatureInput) => Promise<Feature>;
  'features:delete': (id: string) => Promise<void>;
  'features:createTask': (featureId: string, assigneeId?: string) => Promise<CreateTaskFromFeatureResponse>;
  'milestones:create': (data: CreateMilestoneInput) => Promise<Milestone>;
  'milestones:toggle': (id: string) => Promise<Milestone>;
  'milestones:delete': (id: string) => Promise<void>;

  // Terminal channels
  'terminal:create': (data: CreateTerminalInput) => Promise<CreateTerminalResponse>;
  'terminal:write': (data: WriteTerminalInput) => Promise<void>;
  'terminal:resize': (data: ResizeTerminalInput) => Promise<void>;
  'terminal:close': (id: string) => Promise<void>;
  'terminal:list': (projectId: string) => Promise<Terminal[]>;
  'terminal:pause': (terminalId: string) => Promise<boolean>;
  'terminal:resume': (terminalId: string) => Promise<boolean>;
  'terminal:getBuffer': (terminalId: string) => Promise<string[]>;
  'terminal:clearOutputBuffer': (terminalId: string) => Promise<void>;
  'terminal:get-last-status': (terminalId: string) => Promise<ClaudeStatusMessage | null>;

  // Worktree channels
  'worktrees:list': (projectId: string) => Promise<WorktreeWithStatus[]>;
  'worktrees:create': (data: CreateWorktreeInput) => Promise<Worktree>;
  'worktrees:get': (id: string) => Promise<Worktree | null>;
  'worktrees:update': (id: string, data: UpdateWorktreeInput) => Promise<Worktree>;
  'worktrees:delete': (data: DeleteWorktreeInput) => Promise<boolean>;
  'worktrees:sync': (data: { projectId: string }) => Promise<SyncWorktreesResult>;

  // Git channels
  'branches:list': (projectId: string) => Promise<BranchInfo[]>;
  'git:status': (path: string) => Promise<GitStatus>;

  // Memory channels (Phase 10)
  'memories:list': (
    projectId: string,
    filters?: MemoryListFilters
  ) => Promise<Memory[]>;
  'memories:create': (data: CreateMemoryInput) => Promise<Memory>;
  'memories:get': (id: string) => Promise<Memory | null>;
  'memories:update': (id: string, data: UpdateMemoryInput) => Promise<Memory>;
  'memories:delete': (id: string) => Promise<void>;

  // Idea channels (Phase 13.2)
  'ideas:list': (
    projectId: string,
    filters?: IdeaListFilters
  ) => Promise<Idea[]>;
  'ideas:create': (data: CreateIdeaInput) => Promise<Idea>;
  'ideas:get': (id: string) => Promise<Idea | null>;
  'ideas:update': (id: string, data: UpdateIdeaInput) => Promise<Idea>;
  'ideas:delete': (id: string) => Promise<void>;
  'ideas:vote': (ideaId: string, delta: number) => Promise<Idea>;
  'ideas:convertToFeature': (ideaId: string) => Promise<ConvertIdeaToFeatureResponse>;

  // Changelog channels (Phase 13.3)
  'changelog:list': (projectId: string) => Promise<ChangelogEntry[]>;
  'changelog:create': (data: CreateChangelogInput) => Promise<ChangelogEntry>;
  'changelog:update': (id: string, data: UpdateChangelogInput) => Promise<ChangelogEntry>;
  'changelog:delete': (id: string) => Promise<void>;
  'changelog:export': (projectId: string) => Promise<ChangelogExportResult>;

  // MCP channels (Phase 11)
  'mcp:list': (projectId: string) => Promise<McpConfig[]>;
  'mcp:create': (data: CreateMcpInput) => Promise<McpConfig>;
  'mcp:get': (id: string) => Promise<McpConfig | null>;
  'mcp:update': (id: string, data: UpdateMcpInput) => Promise<McpConfig>;
  'mcp:toggle': (id: string) => Promise<McpConfig>;
  'mcp:delete': (id: string) => Promise<void>;
  'mcp:presets': () => Promise<PresetMcpServer[]>;
  'mcp:generateConfig': (projectId: string) => Promise<ClaudeDesktopConfig>;
  'mcp:writeConfig': (projectId: string) => Promise<void>;
  'mcp:readConfig': () => Promise<ClaudeDesktopConfig | null>;

  // Insights channels (Phase 13)
  'insights:getTaskMetrics': (projectId: string) => Promise<TaskMetrics>;
  'insights:getTimeMetrics': (projectId: string) => Promise<TimeMetrics>;
  'insights:getProductivityTrends': (
    projectId: string,
    days?: number
  ) => Promise<ProductivityTrend[]>;

  // GitHub channels (Phase 12)
  'github:saveToken': (token: string) => Promise<void>;
  'github:validateToken': () => Promise<GitHubTokenValidation>;
  'github:deleteToken': () => Promise<void>;
  'github:getToken': () => Promise<{ hasToken: boolean }>;
  'github:getIssues': (params: {
    owner: string;
    repo: string;
    state?: 'open' | 'closed' | 'all';
    labels?: string[];
    sort?: 'created' | 'updated' | 'comments';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  }) => Promise<unknown>;
  'github:getIssue': (params: {
    owner: string;
    repo: string;
    issue_number: number;
  }) => Promise<unknown>;
  'github:createIssue': (params: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    labels?: string[];
    assignees?: string[];
    milestone?: number;
  }) => Promise<unknown>;
  'github:getPRs': (params: {
    owner: string;
    repo: string;
    state?: 'open' | 'closed' | 'all';
    sort?: 'created' | 'updated' | 'popularity' | 'long-running';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  }) => Promise<unknown>;
  'github:getPR': (params: {
    owner: string;
    repo: string;
    pull_number: number;
  }) => Promise<unknown>;
  'github:createPR': (params: {
    owner: string;
    repo: string;
    title: string;
    head: string;
    base: string;
    body?: string;
    draft?: boolean;
  }) => Promise<unknown>;

  // Notification channels (Phase 13.4)
  'notifications:isSupported': () => Promise<boolean>;
  'notifications:requestPermission': () => Promise<boolean>;
  'notifications:show': (data: ShowNotificationInput) => Promise<void>;
  'notifications:taskCompleted': (data: TaskCompletedNotificationInput) => Promise<void>;
  'notifications:terminalError': (data: TerminalErrorNotificationInput) => Promise<void>;
  'notifications:assignment': (data: AssignmentNotificationInput) => Promise<void>;

  // Settings channels (Phase 14)
  'settings:get': (userId: string) => Promise<UserSettings>;
  'settings:update': (userId: string, data: UpdateSettingsInput) => Promise<UserSettings>;
  'settings:updateApiKey': (userId: string, data: UpdateApiKeyInput) => Promise<{ success: boolean }>;
  'settings:updateProfile': (data: ProfileUpdateData) => Promise<AuthUser>;

  // Claude API key channels (Phase 14)
  'claude:getApiKey': () => Promise<{ hasKey: boolean }>;
  'claude:saveApiKey': (apiKey: string) => Promise<void>;
  'claude:validateApiKey': () => Promise<ClaudeApiKeyValidation>;
  'claude:deleteApiKey': () => Promise<void>;

  // File operation channels
  'dialog:openFile': (options: OpenFileOptions) => Promise<OpenFileResult>;
  'file:readAsBase64': (filePath: string) => Promise<string>;

  // Password change channel
  'auth:changePassword': (data: ChangePasswordInput) => Promise<void>;

  // Preferences channels (simplified - deprecated, use settings:* instead)
  'settings:getPreferences': () => Promise<UserSettings>;
  'settings:savePreferences': (data: UpdateSettingsInput) => Promise<UserSettings>;

  // Claude Code Task Automation channels (Phase 15)
  'claude:startTask': (data: ClaudeCodeStartInput) => Promise<ClaudeCodeStartResponse>;
  'claude:resumeTask': (data: ClaudeCodeResumeInput) => Promise<ClaudeCodeResumeResponse>;
  'claude:pauseTask': (data: ClaudeCodePauseInput) => Promise<void>;
  'claude:getTaskStatus': (data: ClaudeCodeStatusInput) => Promise<ClaudeCodeStatusResponse>;
  'claude:getActiveTask': (data: ClaudeCodeStatusInput) => Promise<ClaudeCodeActiveTaskResponse>;

  // AI Review Workflow channels
  'review:start': (data: StartReviewInput) => Promise<void>;
  'review:getProgress': (taskId: string) => Promise<ReviewProgressResponse | null>;
  'review:cancel': (taskId: string) => Promise<void>;
  'review:getHistory': (taskId: string) => Promise<TaskHistoryResponse | null>;
  'review:getFindings': (data: { taskId: string; reviewType: ReviewType }) => Promise<ReviewFinding[] | null>;

  // Fix Workflow channels
  'fix:start': (data: StartFixInput) => Promise<void>;
  'fix:getProgress': (data: { taskId: string; fixType: FixType }) => Promise<FixProgressResponse | null>;
  'fix:cancel': (data: { taskId: string; fixType: FixType }) => Promise<void>;
  'fix:retry': (data: { taskId: string; fixType: FixType }) => Promise<void>;
  'fix:getVerification': (data: { taskId: string; fixType: FixType }) => Promise<FixVerificationResult | null>;

  // Human Review Workflow channels
  'humanReview:assign': (data: AssignReviewerInput) => Promise<HumanReview>;
  'humanReview:get': (taskId: string) => Promise<HumanReview | null>;
  'humanReview:start': (taskId: string) => Promise<HumanReview>;
  'humanReview:complete': (data: CompleteReviewInput) => Promise<HumanReview>;
  'humanReview:getAIResults': (taskId: string) => Promise<FormattedAIReview | null>;

  // Research channels
  'research:searchSolution': (data: ResearchRequest) => Promise<ResearchResponse>;
  'research:searchStackOverflow': (data: ResearchRequest) => Promise<ResearchResponse>;
  'research:searchGitHub': (data: ResearchRequest) => Promise<ResearchResponse>;
  'research:openUrl': (url: string) => Promise<ResearchResponse>;

  // Network status channels (Phase 18)
  'network:getStatus': () => Promise<NetworkStatusInfo>;
  'network:ping': () => Promise<NetworkStatusInfo>;
  'network:isOnline': () => Promise<boolean>;
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
  'auth:state-change': (session: AuthStateChangePayload | null) => void;
  'auth:oauth-success': (payload: OAuthSuccessPayload) => void;
  'auth:oauth-error': (payload: OAuthErrorPayload) => void;
  // Network status events (Phase 18)
  'network:status-change': (status: NetworkStatusInfo) => void;
  // Sync status events (Phase 18)
  'sync:status': (status: SyncStatusEvent) => void;
  'sync:progress': (progress: number) => void;
  // Conflict events (Phase 18.4 & 18.5)
  'sync:conflict': (payload: ConflictEventPayload) => void;
  'sync:conflict-resolved': (payload: ConflictResolvedPayload) => void;
}

/**
 * Payload for auth state change events from Supabase
 */
export interface AuthStateChangePayload {
  user: AuthUser;
  accessToken: string;
}

/**
 * Dynamic terminal event channels
 * These use template literal types to support terminal-specific events
 */
export type DynamicTerminalEventChannel =
  | `terminal:output:${string}`
  | `terminal:exit:${string}`;

/**
 * Dynamic Claude event channels
 * These use template literal types to support task-specific Claude lifecycle events
 */
export type DynamicClaudeEventChannel =
  | `claude:started:${string}`
  | `claude:completed:${string}`
  | `claude:failed:${string}`
  | `terminal:status:${string}`;

/**
 * Dynamic review event channels
 * These use template literal types to support task-specific review events
 */
export type DynamicReviewEventChannel =
  | `review:progress:${string}`
  | `review:complete:${string}`;

/**
 * Dynamic fix event channels
 * These use template literal types to support task/type-specific fix events
 */
export type DynamicFixEventChannel =
  | `fix:progress:${string}:${string}`
  | `fix:complete:${string}`
  | `fix:verified:${string}:${string}`;

// ============================================================================
// Claude Status Display Types
// ============================================================================

/**
 * Tool types used by Claude Code
 */
export type ClaudeToolType =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'WebFetch'
  | 'WebSearch'
  | 'TodoWrite'
  | 'NotebookEdit'
  | 'Skill'
  | 'Task'
  | 'unknown';

/**
 * Claude status message type - sent from main process to renderer
 * via the `terminal:status:${terminalId}` event channel.
 *
 * This provides human-readable status updates parsed from Claude Code's
 * stream-json output, allowing the UI to show clean progress indicators.
 */
export interface ClaudeStatusMessage {
  /** Type of status message */
  type: 'tool_start' | 'tool_end' | 'thinking' | 'text' | 'error' | 'command_failed' | 'system' | 'awaiting_input';
  /** Human-readable status message (e.g., "Reading package.json...") */
  message: string;
  /** Optional additional details */
  details?: string;
  /** Tool name if applicable */
  tool?: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
}

/**
 * Combined event channels (static + dynamic)
 */
export type AllEventChannels = keyof IpcEventChannels | DynamicTerminalEventChannel | DynamicClaudeEventChannel | DynamicReviewEventChannel | DynamicFixEventChannel;

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

// ============================================================================
// Human Review Types (Human Review Workflow)
// ============================================================================

/**
 * Status of a human review
 */
export type HumanReviewStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

/**
 * Human review entity with relations
 */
export interface HumanReview {
  id: string;
  taskId: string;
  reviewerId: string | null;
  status: HumanReviewStatus;
  aiReviewData: string | null;
  notes: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
 * Individual AI review result for human review display
 */
export interface AIReviewResult {
  reviewType: string;
  status: string;
  score: number | null;
  summary: string | null;
  findings: ReviewFinding[];
}

/**
 * Formatted AI review data for human review workflow
 */
export interface FormattedAIReview {
  overallScore: number | null;
  reviews: AIReviewResult[];
  completedAt: string | null;
}

// ============================================================================
// AI Review Types (Review Workflow)
// ============================================================================

/**
 * Type of AI review to perform
 */
export type ReviewType = 'security' | 'quality' | 'performance' | 'documentation' | 'research';

/**
 * Status of an individual review
 */
export type ReviewStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/**
 * Progress response for an ongoing review workflow
 */
export interface ReviewProgressResponse {
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  reviews: Array<{
    reviewType: ReviewType;
    status: ReviewStatus;
    score?: number;
    summary?: string;
    findingsCount: number;
  }>;
  overallScore?: number;
}

/**
 * Activity type in task history
 */
export type ActivityType = 'tool_use' | 'text' | 'thinking' | 'error' | 'decision';

/**
 * Individual activity entry in task history
 */
export interface TaskActivity {
  id: string;
  type: ActivityType;
  toolName?: string;
  summary: string;
  details?: Record<string, unknown>;
  duration?: number;
  createdAt: string;
}

/**
 * Summary of task work history
 */
export interface TaskHistorySummary {
  summary: string;
  keyChanges: string[];
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
}

/**
 * Complete task history response
 */
export interface TaskHistoryResponse {
  taskId: string;
  activities: TaskActivity[];
  summary?: TaskHistorySummary;
}

/**
 * Severity level for review findings
 */
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Individual finding from a code review
 */
export interface ReviewFinding {
  severity: FindingSeverity;
  title: string;
  description: string;
  file?: string;
  line?: number;
}

/**
 * Input for starting a review workflow
 */
export interface StartReviewInput {
  taskId: string;
  reviewTypes?: ReviewType[];
}

// ============================================================================
// Fix Types
// ============================================================================

/** Types of fixes that can be performed */
export type FixType = 'security' | 'quality' | 'performance';

/** Status of a fix operation */
export type FixStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'FIX_APPLIED'      // Fix changes made, awaiting verification
  | 'VERIFYING'        // Running verification review
  | 'VERIFIED_SUCCESS' // Verification passed
  | 'VERIFIED_FAILED'  // Verification showed insufficient improvement
  | 'COMPLETED'        // Keep existing for backwards compat
  | 'FAILED';

/** Result of fix verification comparing pre/post fix scores */
export interface FixVerificationResult {
  preFixScore: number;
  postFixScore: number;
  scoreImprovement: number;
  remainingFindings: ReviewFinding[];
  summary: string;
  passed: boolean;
  /** Number of original findings that were fixed */
  fixedCount?: number;
  /** Number of original findings still present */
  originalFindingsRemaining?: number;
  /** Number of NEW issues introduced by the fix (regressions) */
  newFindingsIntroduced?: number;
  /** Whether a regression was detected (new issues or score drop) */
  hasRegression?: boolean;
}

/** Input for starting a fix */
export interface StartFixInput {
  taskId: string;
  fixType: FixType;
  findings: ReviewFinding[];
}

/** Progress response for a fix operation */
export interface FixProgressResponse {
  taskId: string;
  fixType: FixType;
  status: FixStatus;
  summary?: string;
  currentActivity?: {
    message: string;
    timestamp: number;
  };
  /** Current phase of the fix workflow */
  phase?: 'research' | 'fix' | 'verify';
  /** Verification result if verification has completed */
  verification?: FixVerificationResult;
  /** Number of retry attempts made */
  retryCount?: number;
  /** Whether another retry is allowed */
  canRetry?: boolean;
}

/** Result of a completed fix */
export interface FixResult {
  fixType: FixType;
  status: FixStatus;
  summary?: string;
  patch?: string;
  researchNotes?: string;
}

// ============================================================================
// Network Status Types (Phase 18)
// ============================================================================

/**
 * Network connection states
 */
export type NetworkStatus = 'online' | 'offline' | 'reconnecting';

/**
 * Network status information returned by network:getStatus
 */
export interface NetworkStatusInfo {
  status: NetworkStatus;
  isOnline: boolean;
  lastOnlineAt: string | null;
  lastCheckedAt: string | null;
  supabaseReachable: boolean;
}

/**
 * Sync operation status
 */
export type SyncOperationStatus = 'idle' | 'syncing' | 'error' | 'success';

/**
 * Sync status event payload for sync:status event
 */
export interface SyncStatusEvent {
  /** Current sync operation status */
  status: SyncOperationStatus;
  /** Sync progress percentage (0-100) when syncing */
  progress?: number;
  /** Number of changes pending sync */
  pendingCount?: number;
  /** Error message if status is 'error' */
  error?: string;
  /** Timestamp of last successful sync */
  lastSyncedAt?: string;
}

// ============================================================================
// Conflict Resolution Types (Phase 18.4 & 18.5)
// ============================================================================

/**
 * Table names that support conflict resolution
 */
export type ConflictTable = 'Project' | 'Task';

/**
 * Resolution decision for a sync conflict
 */
export type ResolutionDecision = 'local_wins' | 'remote_wins' | 'needs_merge';

/**
 * Field-level conflict information
 */
export interface FieldConflict {
  /** Name of the conflicting field */
  field: string;
  /** Local value of the field */
  localValue: unknown;
  /** Remote value of the field */
  remoteValue: unknown;
}

/**
 * Conflict event payload sent to renderer when a conflict is detected
 */
export interface ConflictEventPayload {
  /** Table name where conflict occurred */
  table: ConflictTable;
  /** ID of the record with conflict */
  recordId: string;
  /** Local sync version at time of conflict */
  localVersion: number;
  /** Remote sync version at time of conflict */
  remoteVersion: number;
  /** How the conflict was resolved */
  decision: ResolutionDecision;
  /** List of fields that were in conflict */
  conflictingFields: FieldConflict[];
  /** When the conflict was resolved */
  resolvedAt: string;
}

/**
 * Conflict resolved event payload
 */
export interface ConflictResolvedPayload {
  /** Table name where conflict was resolved */
  table: ConflictTable;
  /** ID of the record */
  recordId: string;
  /** How the conflict was resolved */
  decision: ResolutionDecision;
  /** When the conflict was resolved */
  resolvedAt: string;
}

/**
 * Conflict log entry for audit trail display
 */
export interface ConflictLogEntry {
  /** Unique ID of the conflict log entry */
  id: string;
  /** Table name */
  table: string;
  /** Record ID */
  recordId: string;
  /** Local version at conflict time */
  localVersion: number;
  /** Remote version at conflict time */
  remoteVersion: number;
  /** Resolution decision */
  resolution: string;
  /** When the conflict was resolved */
  resolvedAt: string;
  /** When the log entry was created */
  createdAt: string;
}

// ============================================================================
// Research Types
// ============================================================================

/**
 * Input for researching a solution
 */
export interface ResearchRequest {
  title: string;
  description: string;
  severity: string;
  file?: string;
  line?: number;
  category: 'security' | 'quality' | 'performance' | 'documentation' | 'research';
}

/**
 * Result from a research request
 */
export interface ResearchResponse {
  success: boolean;
  searchUrl?: string;
  error?: string;
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
  'auth:refreshSession',
  'auth:isSupabaseAuth',
  'auth:signInWithOAuth',
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
  'phases:list',
  'phases:create',
  'phases:update',
  'phases:delete',
  'phases:reorder',
  'features:list',
  'features:create',
  'features:update',
  'features:delete',
  'features:createTask',
  'milestones:create',
  'milestones:toggle',
  'milestones:delete',
  'terminal:create',
  'terminal:write',
  'terminal:resize',
  'terminal:close',
  'terminal:list',
  'terminal:pause',
  'terminal:resume',
  'terminal:getBuffer',
  'terminal:clearOutputBuffer',
  'terminal:get-last-status',
  'worktrees:list',
  'worktrees:create',
  'worktrees:get',
  'worktrees:update',
  'worktrees:delete',
  'worktrees:sync',
  'branches:list',
  'git:status',
  'memories:list',
  'memories:create',
  'memories:get',
  'memories:update',
  'memories:delete',
  'mcp:list',
  'mcp:create',
  'mcp:get',
  'mcp:update',
  'mcp:toggle',
  'mcp:delete',
  'mcp:presets',
  'mcp:generateConfig',
  'mcp:writeConfig',
  'mcp:readConfig',
  'github:saveToken',
  'github:validateToken',
  'github:deleteToken',
  'github:getToken',
  'github:getIssues',
  'github:getIssue',
  'github:createIssue',
  'github:getPRs',
  'github:getPR',
  'github:createPR',
  'insights:getTaskMetrics',
  'insights:getTimeMetrics',
  'insights:getProductivityTrends',
  'ideas:list',
  'ideas:create',
  'ideas:get',
  'ideas:update',
  'ideas:delete',
  'ideas:vote',
  'ideas:convertToFeature',
  'changelog:list',
  'changelog:create',
  'changelog:update',
  'changelog:delete',
  'changelog:export',
  'notifications:isSupported',
  'notifications:requestPermission',
  'notifications:show',
  'notifications:taskCompleted',
  'notifications:terminalError',
  'notifications:assignment',
  'settings:get',
  'settings:update',
  'settings:updateApiKey',
  'settings:updateProfile',
  'settings:getPreferences',
  'settings:savePreferences',
  'claude:getApiKey',
  'claude:saveApiKey',
  'claude:validateApiKey',
  'claude:deleteApiKey',
  'dialog:openFile',
  'file:readAsBase64',
  'auth:changePassword',
  'claude:startTask',
  'claude:resumeTask',
  'claude:pauseTask',
  'claude:getTaskStatus',
  'claude:getActiveTask',
  // AI Review Workflow
  'review:start',
  'review:getProgress',
  'review:cancel',
  'review:getHistory',
  'review:getFindings',
  // Fix Workflow
  'fix:start',
  'fix:getProgress',
  'fix:cancel',
  'fix:retry',
  'fix:getVerification',
  // Human Review Workflow
  'humanReview:assign',
  'humanReview:get',
  'humanReview:start',
  'humanReview:complete',
  'humanReview:getAIResults',
  // Research channels
  'research:searchSolution',
  'research:searchStackOverflow',
  'research:searchGitHub',
  'research:openUrl',
  // Network status channels (Phase 18)
  'network:getStatus',
  'network:ping',
  'network:isOnline',
] as const;

/**
 * List of all valid event channels for security validation
 */
export const VALID_EVENT_CHANNELS: readonly IpcEventChannelName[] = [
  'app:update-available',
  'app:update-downloaded',
  'app:update-progress',
  'auth:state-change',
  'auth:oauth-success',
  'auth:oauth-error',
  'network:status-change',
  // Sync status events (Phase 18)
  'sync:status',
  'sync:progress',
  // Conflict events (Phase 18.4 & 18.5)
  'sync:conflict',
  'sync:conflict-resolved',
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
