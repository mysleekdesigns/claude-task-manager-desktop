/**
 * GitHub IPC Handlers (Phase 12.1 + 12.2)
 *
 * Handles GitHub authentication, token management, and API operations.
 * Includes rate limiting, issue management, and PR operations.
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { Octokit } from '@octokit/rest';
import type { RestEndpointMethodTypes } from '@octokit/rest';
import Store from 'electron-store';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
  createIPCLogger,
} from '../utils/ipc-logger.js';

const logger = createIPCLogger('GitHub IPC');

// ============================================================================
// Secure Token Storage
// ============================================================================

interface SecureStore {
  githubToken?: string;
}

// Create encrypted store for sensitive data
const secureStore = new Store<SecureStore>({
  name: 'secure-store',
  encryptionKey: 'claude-tasks-desktop-encryption-key', // In production, use a generated key
});

// ============================================================================
// Octokit Client Management
// ============================================================================

/**
 * Get authenticated Octokit client
 */
function getOctokit(): Octokit {
  const token = secureStore.get('githubToken');

  if (!token) {
    throw new Error('GitHub token not configured. Please set a token first.');
  }

  return new Octokit({ auth: token });
}

/**
 * Handle GitHub API errors including rate limiting
 */
function handleGitHubError(error: unknown): never {
  if (error instanceof Error && 'status' in error) {
    const status = (error as { status?: number }).status;

    if (status === 403) {
      // Check if it's a rate limit error
      if ('response' in error) {
        const response = (error as { response?: { headers?: Record<string, string> } }).response;
        const remaining = response?.headers?.['x-ratelimit-remaining'];

        if (remaining === '0') {
          const resetTime = response?.headers?.['x-ratelimit-reset'];
          const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
          const resetStr = resetDate ? ` Resets at ${resetDate.toLocaleTimeString()}.` : '';

          throw new Error(`GitHub API rate limit exceeded.${resetStr} Please try again later.`);
        }
      }
    }

    if (status === 401) {
      throw new Error('GitHub token is invalid or expired. Please update your token.');
    }

    if (status === 404) {
      throw new Error('Repository or resource not found. Check the owner/repo names.');
    }
  }

  throw error;
}

// ============================================================================
// Types
// ============================================================================

export interface GitHubTokenValidation {
  valid: boolean;
  username?: string;
  name?: string;
  avatarUrl?: string;
  scopes?: string[];
  error?: string;
}

export interface ListIssuesInput {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  labels?: string[];
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface GetIssueInput {
  owner: string;
  repo: string;
  issue_number: number;
}

export interface CreateIssueInput {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

export interface ListPullRequestsInput {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  sort?: 'created' | 'updated' | 'popularity' | 'long-running';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface GetPullRequestInput {
  owner: string;
  repo: string;
  pull_number: number;
}

export interface CreatePullRequestInput {
  owner: string;
  repo: string;
  title: string;
  head: string;
  base: string;
  body?: string;
  draft?: boolean;
}

// ============================================================================
// Token Management Handlers (Phase 12.1)
// ============================================================================

/**
 * Save GitHub personal access token
 */
async function handleSaveToken(
  _event: IpcMainInvokeEvent,
  token: string
): Promise<void> {
  if (!token || typeof token !== 'string') {
    throw IPCErrors.invalidArguments('Token is required');
  }

  // Store encrypted token
  secureStore.set('githubToken', token);
}

/**
 * Validate GitHub token and return token info
 */
async function handleValidateToken(
  _event: IpcMainInvokeEvent
): Promise<GitHubTokenValidation> {
  const token = secureStore.get('githubToken');

  if (!token) {
    return {
      valid: false,
      error: 'No token configured',
    };
  }

  try {
    const octokit = new Octokit({ auth: token });

    // Get authenticated user info and scopes
    const response = await octokit.request('GET /user');
    const user = response.data;
    const scopes = (response.headers['x-oauth-scopes'])?.split(', ') || [];

    return {
      valid: true,
      username: user.login,
      name: user.name || user.login,
      avatarUrl: user.avatar_url,
      scopes,
    };
  } catch (error) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      valid: false,
      error: errorMessage,
    };
  }
}

/**
 * Delete stored GitHub token
 */
async function handleDeleteToken(_event: IpcMainInvokeEvent): Promise<void> {
  secureStore.delete('githubToken');
}

/**
 * Get token status (not the actual token for security)
 */
async function handleGetToken(_event: IpcMainInvokeEvent): Promise<{ hasToken: boolean }> {
  const token = secureStore.get('githubToken');
  return { hasToken: !!token };
}

// ============================================================================
// Issue Management Handlers (Phase 12.2)
// ============================================================================

/**
 * List issues for a repository
 */
async function handleGetIssues(
  _event: IpcMainInvokeEvent,
  data: ListIssuesInput
): Promise<RestEndpointMethodTypes['issues']['listForRepo']['response']['data']> {
  if (!data.owner || !data.repo) {
    throw IPCErrors.invalidArguments('Owner and repo are required');
  }

  try {
    const octokit = getOctokit();

    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: data.owner,
      repo: data.repo,
      state: data.state || 'open',
      labels: data.labels?.join(','),
      sort: data.sort || 'created',
      direction: data.direction || 'desc',
      per_page: data.per_page || 30,
      page: data.page || 1,
    });

    logger.info(`Retrieved ${String(issues.length)} issues for ${data.owner}/${data.repo}`);
    return issues;
  } catch (error) {
    logger.error('Failed to list issues:', error);
    handleGitHubError(error);
  }
}

/**
 * Get a single issue
 */
async function handleGetIssue(
  _event: IpcMainInvokeEvent,
  data: GetIssueInput
): Promise<RestEndpointMethodTypes['issues']['get']['response']['data']> {
  if (!data.owner || !data.repo || !data.issue_number) {
    throw IPCErrors.invalidArguments('Owner, repo, and issue_number are required');
  }

  try {
    const octokit = getOctokit();

    const { data: issue } = await octokit.rest.issues.get({
      owner: data.owner,
      repo: data.repo,
      issue_number: data.issue_number,
    });

    logger.info(`Retrieved issue #${String(data.issue_number)} from ${data.owner}/${data.repo}`);
    return issue;
  } catch (error) {
    logger.error('Failed to get issue:', error);
    handleGitHubError(error);
  }
}

/**
 * Create a new issue
 */
async function handleCreateIssue(
  _event: IpcMainInvokeEvent,
  data: CreateIssueInput
): Promise<RestEndpointMethodTypes['issues']['create']['response']['data']> {
  if (!data.owner || !data.repo || !data.title) {
    throw IPCErrors.invalidArguments('Owner, repo, and title are required');
  }

  try {
    const octokit = getOctokit();

    const { data: issue } = await octokit.rest.issues.create({
      owner: data.owner,
      repo: data.repo,
      title: data.title,
      ...(data.body !== undefined && { body: data.body }),
      ...(data.labels !== undefined && { labels: data.labels }),
      ...(data.assignees !== undefined && { assignees: data.assignees }),
      ...(data.milestone !== undefined && { milestone: data.milestone }),
    });

    logger.info(`Created issue #${String(issue.number)}: ${issue.title}`);
    return issue;
  } catch (error) {
    logger.error('Failed to create issue:', error);
    handleGitHubError(error);
  }
}

// ============================================================================
// Pull Request Management Handlers (Phase 12.2)
// ============================================================================

/**
 * List pull requests for a repository
 */
async function handleGetPRs(
  _event: IpcMainInvokeEvent,
  data: ListPullRequestsInput
): Promise<RestEndpointMethodTypes['pulls']['list']['response']['data']> {
  if (!data.owner || !data.repo) {
    throw IPCErrors.invalidArguments('Owner and repo are required');
  }

  try {
    const octokit = getOctokit();

    const { data: pullRequests } = await octokit.rest.pulls.list({
      owner: data.owner,
      repo: data.repo,
      state: data.state || 'open',
      sort: data.sort || 'created',
      direction: data.direction || 'desc',
      per_page: data.per_page || 30,
      page: data.page || 1,
    });

    logger.info(`Retrieved ${String(pullRequests.length)} PRs for ${data.owner}/${data.repo}`);
    return pullRequests;
  } catch (error) {
    logger.error('Failed to list pull requests:', error);
    handleGitHubError(error);
  }
}

/**
 * Get a single pull request
 */
async function handleGetPR(
  _event: IpcMainInvokeEvent,
  data: GetPullRequestInput
): Promise<RestEndpointMethodTypes['pulls']['get']['response']['data']> {
  if (!data.owner || !data.repo || !data.pull_number) {
    throw IPCErrors.invalidArguments('Owner, repo, and pull_number are required');
  }

  try {
    const octokit = getOctokit();

    const { data: pullRequest } = await octokit.rest.pulls.get({
      owner: data.owner,
      repo: data.repo,
      pull_number: data.pull_number,
    });

    logger.info(`Retrieved PR #${String(data.pull_number)} from ${data.owner}/${data.repo}`);
    return pullRequest;
  } catch (error) {
    logger.error('Failed to get pull request:', error);
    handleGitHubError(error);
  }
}

/**
 * Create a new pull request
 */
async function handleCreatePR(
  _event: IpcMainInvokeEvent,
  data: CreatePullRequestInput
): Promise<RestEndpointMethodTypes['pulls']['create']['response']['data']> {
  if (!data.owner || !data.repo || !data.title || !data.head || !data.base) {
    throw IPCErrors.invalidArguments(
      'Owner, repo, title, head, and base are required'
    );
  }

  try {
    const octokit = getOctokit();

    const { data: pullRequest } = await octokit.rest.pulls.create({
      owner: data.owner,
      repo: data.repo,
      title: data.title,
      head: data.head,
      base: data.base,
      ...(data.body !== undefined && { body: data.body }),
      ...(data.draft !== undefined && { draft: data.draft }),
    });

    logger.info(`Created PR #${String(pullRequest.number)}: ${pullRequest.title}`);
    return pullRequest;
  } catch (error) {
    logger.error('Failed to create pull request:', error);
    handleGitHubError(error);
  }
}

// ============================================================================
// Registration
// ============================================================================

/**
 * Register all GitHub-related IPC handlers
 */
export function registerGitHubHandlers(): void {
  // Token management (Phase 12.1)
  ipcMain.handle(
    'github:saveToken',
    wrapWithLogging('github:saveToken', wrapHandler(handleSaveToken))
  );

  ipcMain.handle(
    'github:validateToken',
    wrapWithLogging('github:validateToken', wrapHandler(handleValidateToken))
  );

  ipcMain.handle(
    'github:deleteToken',
    wrapWithLogging('github:deleteToken', wrapHandler(handleDeleteToken))
  );

  ipcMain.handle(
    'github:getToken',
    wrapWithLogging('github:getToken', wrapHandler(handleGetToken))
  );

  // Issue management (Phase 12.2)
  ipcMain.handle(
    'github:getIssues',
    wrapWithLogging('github:getIssues', wrapHandler(handleGetIssues))
  );

  ipcMain.handle(
    'github:getIssue',
    wrapWithLogging('github:getIssue', wrapHandler(handleGetIssue))
  );

  ipcMain.handle(
    'github:createIssue',
    wrapWithLogging('github:createIssue', wrapHandler(handleCreateIssue))
  );

  // Pull request management (Phase 12.2)
  ipcMain.handle(
    'github:getPRs',
    wrapWithLogging('github:getPRs', wrapHandler(handleGetPRs))
  );

  ipcMain.handle(
    'github:getPR',
    wrapWithLogging('github:getPR', wrapHandler(handleGetPR))
  );

  ipcMain.handle(
    'github:createPR',
    wrapWithLogging('github:createPR', wrapHandler(handleCreatePR))
  );

  logger.info('GitHub IPC handlers registered');
}

/**
 * Unregister all GitHub-related IPC handlers
 */
export function unregisterGitHubHandlers(): void {
  // Token management
  ipcMain.removeHandler('github:saveToken');
  ipcMain.removeHandler('github:validateToken');
  ipcMain.removeHandler('github:deleteToken');
  ipcMain.removeHandler('github:getToken');

  // Issue management
  ipcMain.removeHandler('github:getIssues');
  ipcMain.removeHandler('github:getIssue');
  ipcMain.removeHandler('github:createIssue');

  // Pull request management
  ipcMain.removeHandler('github:getPRs');
  ipcMain.removeHandler('github:getPR');
  ipcMain.removeHandler('github:createPR');

  logger.info('GitHub IPC handlers unregistered');
}

/**
 * Wrap a handler with logging, sanitizing sensitive data
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

    // Sanitize sensitive data (tokens)
    const sanitizedArgs = args.map((arg) => {
      if (channel === 'github:saveToken') {
        // Completely redact token parameter
        return '[REDACTED]';
      }
      return arg;
    });

    logIPCRequest(channel, sanitizedArgs);

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
