/**
 * GitHub Issues Page
 * Browse and manage GitHub issues
 */

import { useState, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { IssuesList } from '@/components/github/IssuesList';
import { IssueDetailModal } from '@/components/github/IssueDetailModal';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { GitHubIssue } from '@/types/github';

// Mock data for development - will be replaced with IPC calls
const MOCK_ISSUES: GitHubIssue[] = [
  {
    id: 1,
    number: 123,
    title: 'Add dark mode support to settings page',
    body: 'We need to implement dark mode toggle in the settings page.\n\n## Requirements\n\n- [ ] Add toggle switch\n- [ ] Persist user preference\n- [ ] Update theme dynamically',
    state: 'open',
    user: {
      id: 1,
      login: 'developer',
      avatar_url: 'https://github.com/identicons/developer.png',
      html_url: 'https://github.com/developer',
    },
    labels: [
      { id: 1, name: 'enhancement', color: 'a2eeef', description: 'New feature or request' },
      { id: 2, name: 'ui', color: '1d76db', description: 'User interface' },
    ],
    assignees: [
      {
        id: 1,
        login: 'developer',
        avatar_url: 'https://github.com/identicons/developer.png',
        html_url: 'https://github.com/developer',
      },
    ],
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    html_url: 'https://github.com/example/repo/issues/123',
    comments: 3,
  },
  {
    id: 2,
    number: 122,
    title: 'Bug: Terminal crashes on resize',
    body: 'When resizing the terminal window rapidly, the application crashes.\n\n### Steps to reproduce\n\n1. Open terminal\n2. Resize window multiple times quickly\n3. Application crashes\n\n### Expected behavior\n\nTerminal should handle resize events gracefully.',
    state: 'open',
    user: {
      id: 2,
      login: 'tester',
      avatar_url: 'https://github.com/identicons/tester.png',
      html_url: 'https://github.com/tester',
    },
    labels: [
      { id: 3, name: 'bug', color: 'd73a4a', description: 'Something is not working' },
      { id: 4, name: 'priority:high', color: 'b60205' },
    ],
    assignees: [],
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    html_url: 'https://github.com/example/repo/issues/122',
    comments: 7,
  },
  {
    id: 3,
    number: 121,
    title: 'Documentation: Update installation guide',
    body: 'The installation guide needs to be updated with new prerequisites.',
    state: 'closed',
    user: {
      id: 3,
      login: 'docs-writer',
      avatar_url: 'https://github.com/identicons/docs-writer.png',
      html_url: 'https://github.com/docs-writer',
    },
    labels: [
      { id: 5, name: 'documentation', color: '0075ca' },
    ],
    assignees: [
      {
        id: 3,
        login: 'docs-writer',
        avatar_url: 'https://github.com/identicons/docs-writer.png',
        html_url: 'https://github.com/docs-writer',
      },
    ],
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    closed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    html_url: 'https://github.com/example/repo/issues/121',
    comments: 2,
  },
];

export function GitHubIssuesPage() {
  const currentProject = useProjectStore((state) => state.currentProject);
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [issues, _setIssues] = useState<GitHubIssue[]>(MOCK_ISSUES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Handle issue click
  const handleIssueClick = useCallback((issue: GitHubIssue) => {
    setSelectedIssue(issue);
  }, []);

  // Handle close modal
  const handleCloseModal = useCallback(() => {
    setSelectedIssue(null);
  }, []);

  // Handle create task from issue
  const handleCreateTask = useCallback(async (issue: GitHubIssue) => {
    try {
      // TODO: Implement IPC call to create task from issue
      console.log('Creating task from issue:', issue);

      // For now, show a success message
      alert(`Task created from issue #${issue.number}: ${issue.title}`);
    } catch (err) {
      console.error('Failed to create task from issue:', err);
      setError(err instanceof Error ? err : new Error('Failed to create task'));
    }
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Implement IPC call to fetch issues
      // const fetchedIssues = await invoke('github:getIssues', currentProject?.githubRepo);
      // setIssues(fetchedIssues);

      // For now, just simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('Failed to fetch issues:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch issues'));
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  // No project selected
  if (!currentProject) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">GitHub Issues</h1>
          <p className="text-muted-foreground mt-2">
            Browse and manage GitHub issues
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the sidebar to view its GitHub issues.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No GitHub repo configured
  if (!currentProject.githubRepo) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">GitHub Issues</h1>
          <p className="text-muted-foreground mt-2">
            Browse and manage GitHub issues
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This project does not have a GitHub repository configured. Please add a GitHub repository in project settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">GitHub Issues</h1>
            <p className="text-muted-foreground mt-2">
              {currentProject.githubRepo} - Browse and manage issues
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="px-8 pt-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Issues List */}
      <div className="flex-1 px-8 pt-4 pb-8 overflow-auto">
        <IssuesList
          issues={issues}
          loading={loading}
          onIssueClick={handleIssueClick}
        />
      </div>

      {/* Issue Detail Modal */}
      <IssueDetailModal
        issue={selectedIssue}
        isOpen={!!selectedIssue}
        onClose={handleCloseModal}
        onCreateTask={handleCreateTask}
      />
    </div>
  );
}
