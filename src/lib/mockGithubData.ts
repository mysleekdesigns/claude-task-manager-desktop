/**
 * Mock GitHub Data
 *
 * Sample data for testing GitHub PR components
 */

import type { GitHubPullRequest } from '@/types/github';

export const mockPullRequests: GitHubPullRequest[] = [
  {
    id: 1,
    number: 42,
    title: 'Add GitHub PR UI components',
    body: 'This PR implements the GitHub Pull Request UI components including:\n\n- PrCard component for displaying PR summary\n- PrList component with filtering and sorting\n- PrDetailModal for viewing full PR details\n\n## Changes\n- Created new GitHub types\n- Implemented responsive UI with shadcn/ui\n- Added support for review status display',
    state: 'open',
    merged: false,
    user: {
      login: 'developer',
      id: 1,
      avatar_url: 'https://github.com/identicons/developer.png',
      html_url: 'https://github.com/developer',
    },
    labels: [
      { id: 1, name: 'enhancement', color: '84b6eb', description: 'New feature' },
      { id: 2, name: 'ui', color: 'fbca04', description: 'User interface' },
    ],
    assignees: [],
    head: {
      label: 'developer:feature/github-prs',
      ref: 'feature/github-prs',
      sha: 'abc123',
      user: {
        login: 'developer',
        id: 1,
        avatar_url: 'https://github.com/identicons/developer.png',
        html_url: 'https://github.com/developer',
      },
      repo: {
        id: 1,
        name: 'claude-task-manager',
        full_name: 'developer/claude-task-manager',
      },
    },
    base: {
      label: 'main',
      ref: 'main',
      sha: 'def456',
      user: {
        login: 'developer',
        id: 1,
        avatar_url: 'https://github.com/identicons/developer.png',
        html_url: 'https://github.com/developer',
      },
      repo: {
        id: 1,
        name: 'claude-task-manager',
        full_name: 'developer/claude-task-manager',
      },
    },
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
    html_url: 'https://github.com/developer/claude-task-manager/pull/42',
    comments: 3,
    review_comments: 2,
    commits: 5,
    additions: 245,
    deletions: 12,
    changed_files: 8,
    reviews: [
      {
        id: 1,
        user: {
          login: 'reviewer1',
          id: 2,
          avatar_url: 'https://github.com/identicons/reviewer1.png',
          html_url: 'https://github.com/reviewer1',
        },
        body: 'Looks good! Just a few minor suggestions.',
        state: 'APPROVED',
        submitted_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 2,
        user: {
          login: 'reviewer2',
          id: 3,
          avatar_url: 'https://github.com/identicons/reviewer2.png',
          html_url: 'https://github.com/reviewer2',
        },
        body: 'Could you add some unit tests for the new components?',
        state: 'CHANGES_REQUESTED',
        submitted_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
    ],
    files: [
      {
        filename: 'src/components/github/PrCard.tsx',
        status: 'added',
        additions: 120,
        deletions: 0,
        changes: 120,
      },
      {
        filename: 'src/components/github/PrList.tsx',
        status: 'added',
        additions: 85,
        deletions: 0,
        changes: 85,
      },
      {
        filename: 'src/components/github/PrDetailModal.tsx',
        status: 'added',
        additions: 180,
        deletions: 0,
        changes: 180,
      },
      {
        filename: 'src/types/github.ts',
        status: 'modified',
        additions: 45,
        deletions: 5,
        changes: 50,
      },
      {
        filename: 'src/routes/github/prs.tsx',
        status: 'modified',
        additions: 60,
        deletions: 10,
        changes: 70,
      },
    ],
  },
  {
    id: 2,
    number: 41,
    title: 'Fix terminal output buffering issue',
    body: 'Fixes a bug where terminal output would sometimes get buffered and not display in real-time.',
    state: 'closed',
    merged: true,
    merged_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    user: {
      login: 'developer',
      id: 1,
      avatar_url: 'https://github.com/identicons/developer.png',
      html_url: 'https://github.com/developer',
    },
    labels: [
      { id: 3, name: 'bug', color: 'd73a4a', description: 'Something is broken' },
    ],
    assignees: [],
    head: {
      label: 'developer:fix/terminal-buffering',
      ref: 'fix/terminal-buffering',
      sha: 'ghi789',
      user: {
        login: 'developer',
        id: 1,
        avatar_url: 'https://github.com/identicons/developer.png',
        html_url: 'https://github.com/developer',
      },
      repo: {
        id: 1,
        name: 'claude-task-manager',
        full_name: 'developer/claude-task-manager',
      },
    },
    base: {
      label: 'main',
      ref: 'main',
      sha: 'def456',
      user: {
        login: 'developer',
        id: 1,
        avatar_url: 'https://github.com/identicons/developer.png',
        html_url: 'https://github.com/developer',
      },
      repo: {
        id: 1,
        name: 'claude-task-manager',
        full_name: 'developer/claude-task-manager',
      },
    },
    created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    closed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    html_url: 'https://github.com/developer/claude-task-manager/pull/41',
    comments: 1,
    review_comments: 0,
    commits: 2,
    additions: 15,
    deletions: 8,
    changed_files: 1,
    reviews: [
      {
        id: 3,
        user: {
          login: 'reviewer1',
          id: 2,
          avatar_url: 'https://github.com/identicons/reviewer1.png',
          html_url: 'https://github.com/reviewer1',
        },
        body: 'LGTM! Good catch.',
        state: 'APPROVED',
        submitted_at: new Date(Date.now() - 24.5 * 60 * 60 * 1000).toISOString(),
      },
    ],
    files: [
      {
        filename: 'electron/terminal/TerminalManager.ts',
        status: 'modified',
        additions: 15,
        deletions: 8,
        changes: 23,
      },
    ],
  },
];
