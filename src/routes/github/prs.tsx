/**
 * GitHub Pull Requests Page
 * Browse and manage GitHub pull requests
 */

import { useState } from 'react';
import { PrList } from '@/components/github/PrList';
import { PrDetailModal } from '@/components/github/PrDetailModal';
import { Button } from '@/components/ui/button';
import { RefreshCw, ExternalLink } from 'lucide-react';
import type { GitHubPullRequest } from '@/types/github';
import { mockPullRequests } from '@/lib/mockGithubData';

// ============================================================================
// Component
// ============================================================================

export function GitHubPRsPage() {
  const [selectedPr, setSelectedPr] = useState<GitHubPullRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // For development: Use mock data. In production, fetch from IPC
  // TODO: Replace with: const { data: prs, loading } = useIPCQuery('github:listPrs', [projectId]);
  const useMockData = true; // Set to false when IPC handlers are implemented
  const prs: GitHubPullRequest[] = useMockData ? mockPullRequests : [];

  // Handle PR card click
  const handlePrClick = (pr: GitHubPullRequest) => {
    setSelectedPr(pr);
    setIsModalOpen(true);
  };

  // Handle refresh (placeholder for IPC call)
  const handleRefresh = async () => {
    setIsLoading(true);
    // TODO: Call IPC handler to fetch PRs from GitHub
    // Example: const prs = await invoke('github:listPrs', projectId);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className="bg-background h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">Pull Requests</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            View and manage pull requests from your GitHub repository
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {prs.length === 0 && !isLoading ? (
            // Empty State
            <div className="bg-muted/50 rounded-lg p-12 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <ExternalLink className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    No Pull Requests
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Connect your GitHub repository to view pull requests here.
                    Pull requests will sync automatically when you link a
                    project to a GitHub repository.
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <Button onClick={() => (window.location.href = '/projects')}>
                    Configure Project
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      window.open(
                        'https://docs.github.com/en/pull-requests',
                        '_blank'
                      )
                    }
                  >
                    Learn More
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // PR List
            <PrList
              prs={prs}
              loading={isLoading}
              onPrClick={handlePrClick}
            />
          )}
        </div>
      </div>

      {/* PR Detail Modal */}
      <PrDetailModal
        pr={selectedPr}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </div>
  );
}
