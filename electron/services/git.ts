/**
 * Git Service
 *
 * Manages git operations including worktrees, branches, and repository status.
 * Uses simple-git for cross-platform git command execution.
 */

import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import fs from 'fs';
import { createIPCLogger } from '../utils/ipc-logger.js';

const logger = createIPCLogger('GitService');

/**
 * Information about a git worktree
 */
export interface WorktreeInfo {
  /** Absolute path to the worktree */
  path: string;
  /** Git branch name */
  branch: string;
  /** Whether this is the main worktree */
  isMain: boolean;
  /** Current commit hash */
  commit?: string;
}

/**
 * Information about a git branch
 */
export interface BranchInfo {
  /** Branch name */
  name: string;
  /** Whether this is the currently checked out branch */
  current: boolean;
  /** Whether this is a remote tracking branch */
  isRemote: boolean;
  /** Current commit hash on this branch */
  commit: string | undefined;
}

/**
 * Repository status information
 */
export interface GitStatus {
  /** Current branch name */
  current: string | null;
  /** Upstream branch being tracked */
  tracking: string | null;
  /** Number of commits ahead of upstream */
  ahead: number;
  /** Number of commits behind upstream */
  behind: number;
  /** List of staged files */
  staged: string[];
  /** List of modified (unstaged) files */
  modified: string[];
  /** List of untracked files */
  untracked: string[];
}

/**
 * GitService handles all git operations including worktree management,
 * branch operations, and repository status checking.
 *
 * Features:
 * - Worktree management (list, create, delete)
 * - Branch operations (list, get current)
 * - Repository status checking
 * - Path validation and existence checking
 */
class GitService {
  /**
   * Get a SimpleGit instance configured for the given repository path.
   *
   * @param repoPath - Path to the git repository
   * @returns SimpleGit instance
   * @throws Error if the path doesn't exist
   */
  private getGit(repoPath: string): SimpleGit {
    // Validate path exists
    if (!fs.existsSync(repoPath)) {
      throw new Error(`Repository path does not exist: ${repoPath}`);
    }

    const options: Partial<SimpleGitOptions> = {
      baseDir: repoPath,
      binary: 'git',
      maxConcurrentProcesses: 6,
      trimmed: false,
    };

    return simpleGit(options);
  }

  /**
   * List all worktrees for a repository.
   *
   * @param repoPath - Path to the git repository
   * @returns Array of WorktreeInfo objects
   * @throws Error if repository is invalid or git command fails
   */
  async listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
    try {
      logger.info(`Listing worktrees for repository: ${repoPath}`);

      const git = this.getGit(repoPath);

      // Use git worktree list --porcelain to get machine-readable output
      const result = await git.raw(['worktree', 'list', '--porcelain']);

      return this.parseWorktreeOutput(result);
    } catch (error) {
      logger.error('Failed to list worktrees:', error);
      throw new Error(
        `Failed to list worktrees: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Add a new worktree to the repository.
   *
   * @param repoPath - Path to the git repository
   * @param branch - Branch name for the worktree
   * @param worktreePath - Path where the worktree should be created
   * @param createBranch - Whether to create a new branch (default: false)
   * @returns Promise that resolves when the worktree is created
   * @throws Error if worktree creation fails
   */
  async addWorktree(
    repoPath: string,
    branch: string,
    worktreePath: string,
    createBranch = false
  ): Promise<void> {
    try {
      logger.info(
        `Adding worktree: branch=${branch}, path=${worktreePath}, createBranch=${String(createBranch)}`
      );

      // Validate worktree path doesn't already exist
      if (fs.existsSync(worktreePath)) {
        throw new Error(`Worktree path already exists: ${worktreePath}`);
      }

      // Validate branch name
      if (!branch || branch.trim().length === 0) {
        throw new Error('Branch name cannot be empty');
      }

      const git = this.getGit(repoPath);

      const args = ['worktree', 'add'];

      if (createBranch) {
        args.push('-b', branch);
      }

      args.push(worktreePath, branch);

      await git.raw(args);

      logger.info(`Worktree added successfully: ${worktreePath}`);
    } catch (error) {
      logger.error('Failed to add worktree:', error);
      throw new Error(
        `Failed to add worktree: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Remove a worktree from the repository.
   *
   * @param repoPath - Path to the git repository
   * @param worktreePath - Path to the worktree to remove
   * @param force - Whether to force removal (default: false)
   * @returns Promise that resolves when the worktree is removed
   * @throws Error if worktree removal fails
   */
  async removeWorktree(
    repoPath: string,
    worktreePath: string,
    force = false
  ): Promise<void> {
    try {
      logger.info(`Removing worktree: ${worktreePath}, force=${String(force)}`);

      // Validate worktree path exists
      if (!fs.existsSync(worktreePath)) {
        throw new Error(`Worktree path does not exist: ${worktreePath}`);
      }

      const git = this.getGit(repoPath);

      const args = ['worktree', 'remove', worktreePath];

      if (force) {
        args.push('--force');
      }

      await git.raw(args);

      logger.info(`Worktree removed successfully: ${worktreePath}`);
    } catch (error) {
      logger.error('Failed to remove worktree:', error);
      throw new Error(
        `Failed to remove worktree: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * List all branches in the repository (both local and remote).
   *
   * @param repoPath - Path to the git repository
   * @returns Array of BranchInfo objects
   * @throws Error if repository is invalid or git command fails
   */
  async listBranches(repoPath: string): Promise<BranchInfo[]> {
    try {
      logger.info(`Listing branches for repository: ${repoPath}`);

      const git = this.getGit(repoPath);

      // Get all branches (local and remote)
      const branches = await git.branch(['-a']);

      const branchList: BranchInfo[] = [];

      // Process local branches
      for (const [name, branchObj] of Object.entries(branches.branches)) {
        const commitStr =
          branchObj && typeof branchObj === 'object' && 'commit' in branchObj
            ? ((branchObj as { commit?: string }).commit ?? '').substring(0, 7)
            : undefined;

        branchList.push({
          name,
          current: branches.current === name,
          isRemote: false,
          commit: commitStr || undefined,
        });
      }

      return branchList;
    } catch (error) {
      logger.error('Failed to list branches:', error);
      throw new Error(
        `Failed to list branches: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the current branch name.
   *
   * @param repoPath - Path to the git repository
   * @returns Current branch name, or "HEAD" if in detached state
   * @throws Error if repository is invalid or git command fails
   */
  async getCurrentBranch(repoPath: string): Promise<string> {
    try {
      logger.info(`Getting current branch for repository: ${repoPath}`);

      const git = this.getGit(repoPath);

      const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
      return branch.trim();
    } catch (error) {
      logger.error('Failed to get current branch:', error);
      throw new Error(
        `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the repository status.
   *
   * @param repoPath - Path to the git repository
   * @returns GitStatus object containing status information
   * @throws Error if repository is invalid or git command fails
   */
  async getStatus(repoPath: string): Promise<GitStatus> {
    try {
      logger.info(`Getting status for repository: ${repoPath}`);

      const git = this.getGit(repoPath);

      const status = await git.status();

      return {
        current: status.current || null,
        tracking: status.tracking || null,
        ahead: status.ahead || 0,
        behind: status.behind || 0,
        staged: status.staged || [],
        modified: status.modified || [],
        untracked: (status as { untracked?: string[] }).untracked ?? [],
      };
    } catch (error) {
      logger.error('Failed to get repository status:', error);
      throw new Error(
        `Failed to get repository status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if a path is a valid git repository.
   *
   * @param repoPath - Path to check
   * @returns true if the path is a valid git repository, false otherwise
   */
  async isGitRepo(repoPath: string): Promise<boolean> {
    try {
      // Check if path exists
      if (!fs.existsSync(repoPath)) {
        return false;
      }

      const git = this.getGit(repoPath);

      // Try to get the git root directory
      await git.revparse(['--git-dir']);
      return true;
    } catch {
      logger.debug(`Path is not a valid git repository: ${repoPath}`);
      return false;
    }
  }

  /**
   * Parse worktree list output in porcelain format.
   *
   * Format:
   * worktree /path/to/main
   * branch refs/heads/main
   * detached
   *
   * worktree /path/to/feature
   * branch refs/heads/feature
   *
   * @param output - Raw output from 'git worktree list --porcelain'
   * @returns Array of WorktreeInfo objects
   */
  private parseWorktreeOutput(output: string): WorktreeInfo[] {
    const worktrees: WorktreeInfo[] = [];

    if (!output || output.trim().length === 0) {
      return worktrees;
    }

    // Split by double newlines to separate worktree blocks
    const blocks = output.trim().split('\n\n');

    for (const block of blocks) {
      const lines = block.split('\n').filter(line => line.length > 0);
      const worktreeData: {
        path?: string;
        branch?: string;
        detached?: boolean;
        commit?: string;
      } = {};

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          worktreeData.path = line.substring('worktree '.length);
        } else if (line.startsWith('branch ')) {
          const branchRef = line.substring('branch '.length);
          // Extract branch name from refs/heads/branchname
          worktreeData.branch = branchRef.replace('refs/heads/', '');
        } else if (line.startsWith('detached')) {
          worktreeData.detached = true;
        } else if (line.startsWith('HEAD ')) {
          const headRef = line.substring('HEAD '.length);
          worktreeData.commit = headRef.substring(0, 7);
        }
      }

      // Only add if we have a path
      if (worktreeData.path) {
        // Determine if this is the main worktree (typically the repository root)
        const isMain = worktreeData.branch === 'main' || worktreeData.branch === 'master';

        worktrees.push({
          path: worktreeData.path,
          branch: worktreeData.branch ?? 'HEAD',
          isMain,
          ...(worktreeData.commit !== undefined && { commit: worktreeData.commit }),
        });
      }
    }

    return worktrees;
  }
}

/**
 * Export a singleton instance of GitService
 */
export const gitService = new GitService();
