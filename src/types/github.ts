/**
 * GitHub Types
 *
 * Type definitions for GitHub Issues and Pull Requests
 */

// ============================================================================
// Token Management Types
// ============================================================================

/**
 * GitHub token validation result
 */
export interface GitHubTokenValidation {
  valid: boolean;
  username?: string;
  name?: string;
  avatarUrl?: string;
  scopes?: string[];
  error?: string;
}

// ============================================================================
// Common Types
// ============================================================================

/**
 * GitHub user information
 */
export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
}

/**
 * GitHub label
 */
export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description?: string;
}

// ============================================================================
// Issue Types
// ============================================================================

/**
 * GitHub issue state
 */
export type GitHubIssueState = 'open' | 'closed';

/**
 * GitHub issue entity
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: GitHubIssueState;
  user: GitHubUser;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  created_at: string;
  updated_at: string;
  closed_at?: string;
  html_url: string;
  comments: number;
}

/**
 * GitHub issue comment
 */
export interface GitHubIssueComment {
  id: number;
  body: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  html_url: string;
}

/**
 * Issue list filter options
 */
export interface GitHubIssueFilters {
  state?: 'open' | 'closed' | 'all';
  labels?: string[];
  assignee?: string;
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
}

// ============================================================================
// Pull Request Types
// ============================================================================

/**
 * GitHub PR state
 */
export type GitHubPRState = 'open' | 'closed';

/**
 * GitHub PR merged state (only applicable when state is 'closed')
 */
export type GitHubPRMergedState = 'merged' | 'not_merged';

/**
 * Branch information
 */
export interface GitHubBranch {
  label: string;
  ref: string;
  sha: string;
  user: GitHubUser;
  repo: {
    id: number;
    name: string;
    full_name: string;
  };
}

/**
 * Review status types
 */
export type GitHubReviewState =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'COMMENTED'
  | 'PENDING';

/**
 * Review information
 */
export interface GitHubReview {
  id: number;
  user: GitHubUser;
  body?: string;
  state: GitHubReviewState;
  submitted_at: string;
}

/**
 * File change information
 */
export interface GitHubFileChange {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

/**
 * GitHub Pull Request entity
 */
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: GitHubPRState;
  merged: boolean;
  user: GitHubUser;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  head: GitHubBranch;
  base: GitHubBranch;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  merged_at?: string;
  html_url: string;
  comments: number;
  review_comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  reviews?: GitHubReview[];
  files?: GitHubFileChange[];
}

/**
 * Combined status for display
 */
export type GitHubPRDisplayState = 'open' | 'merged' | 'closed';

/**
 * PR list filter options
 */
export interface GitHubPRFilters {
  state?: 'open' | 'closed' | 'all';
  sort?: 'created' | 'updated' | 'popularity' | 'long-running';
  direction?: 'asc' | 'desc';
}
