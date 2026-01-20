/**
 * Ideation Board Page (Phase 13.2)
 *
 * Brainstorming and idea management interface with voting and conversion to features.
 */

import { useState, useMemo, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useIdeaManager } from '@/hooks/useIdeas';
import { IdeaCard } from '@/components/ideation/IdeaCard';
import { AddIdeaModal } from '@/components/ideation/AddIdeaModal';
import { IdeaFilters } from '@/components/ideation/IdeaFilters';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertCircle, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import type { IdeaStatus, CreateIdeaInput } from '@/types/ipc';

// ============================================================================
// Component
// ============================================================================

export function IdeationPage() {
  const currentProject = useProjectStore((state) => state.currentProject);

  // Local state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<IdeaStatus | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'votes' | 'date'>('votes');

  // Fetch ideas
  const {
    ideas,
    loading,
    error,
    createIdea,
    voteIdea,
    deleteIdea,
    convertToFeature,
  } = useIdeaManager(currentProject?.id || '');

  // Filter and sort ideas
  const filteredAndSortedIdeas = useMemo(() => {
    if (!ideas) return [];

    let filtered = ideas;

    // Filter by status
    if (selectedStatus !== 'ALL') {
      filtered = filtered.filter((idea) => idea.status === selectedStatus);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'votes') {
        return b.votes - a.votes;
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return sorted;
  }, [ideas, selectedStatus, sortBy]);

  // Count ideas by status
  const ideaCounts = useMemo(() => {
    const counts: Record<IdeaStatus | 'ALL', number> = {
      ALL: ideas?.length || 0,
      PENDING: 0,
      UNDER_REVIEW: 0,
      APPROVED: 0,
      REJECTED: 0,
      CONVERTED: 0,
    };

    ideas?.forEach((idea) => {
      counts[idea.status] = (counts[idea.status] || 0) + 1;
    });

    return counts;
  }, [ideas]);

  // Handle create idea
  const handleCreateIdea = useCallback(
    async (data: Omit<CreateIdeaInput, 'projectId'>) => {
      if (!currentProject) return;

      try {
        await createIdea.mutate({
          ...data,
          projectId: currentProject.id,
        });
        toast.success('Idea created successfully');
      } catch (err) {
        console.error('Failed to create idea:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to create idea');
      }
    },
    [currentProject, createIdea]
  );

  // Handle vote
  const handleVote = useCallback(
    async (ideaId: string, delta: number) => {
      try {
        await voteIdea.mutate(ideaId, delta);
        toast.success(delta > 0 ? 'Upvoted' : 'Downvoted');
      } catch (err) {
        console.error('Failed to vote:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to vote');
      }
    },
    [voteIdea]
  );

  // Handle convert to feature
  const handleConvert = useCallback(
    async (ideaId: string) => {
      try {
        const result = await convertToFeature.mutate(ideaId);
        toast.success(`Converted to feature: ${result.feature.title}`);
      } catch (err) {
        console.error('Failed to convert idea:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to convert idea');
      }
    },
    [convertToFeature]
  );

  // Handle delete
  const handleDelete = useCallback(
    async (ideaId: string) => {
      try {
        await deleteIdea.mutate(ideaId);
        toast.success('Idea deleted');
      } catch (err) {
        console.error('Failed to delete idea:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to delete idea');
      }
    },
    [deleteIdea]
  );

  // No project selected
  if (!currentProject) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Ideation Board</h1>
          <p className="text-muted-foreground mt-2">
            Capture and organize your development ideas
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the sidebar to view its ideas.
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
            <h1 className="text-3xl font-bold">Ideation Board</h1>
            <p className="text-muted-foreground mt-2">
              {currentProject.name} - Capture and organize your development ideas
            </p>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Idea
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

      {/* Content */}
      <div className="flex-1 px-8 pt-4 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-muted-foreground">Loading ideas...</div>
          </div>
        ) : (
          <div className="space-y-6 pb-8">
            {/* Filters */}
            <IdeaFilters
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
              sortBy={sortBy}
              onSortChange={setSortBy}
              counts={ideaCounts}
            />

            {/* Ideas Grid */}
            {filteredAndSortedIdeas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Lightbulb className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  {!ideas || ideas.length === 0
                    ? 'No ideas yet'
                    : 'No ideas match your filters'}
                </h3>
                <p className="text-muted-foreground max-w-md mb-4">
                  {!ideas || ideas.length === 0
                    ? 'Start brainstorming by adding your first idea. Ideas can be voted on by the team and converted to features.'
                    : 'Try adjusting your filters to find what you are looking for.'}
                </p>
                {(!ideas || ideas.length === 0) && (
                  <Button onClick={() => setIsAddModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Idea
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Showing {filteredAndSortedIdeas.length} of {ideas?.length || 0} ideas
                  </span>
                  <span>Sorted by {sortBy === 'votes' ? 'most votes' : 'most recent'}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAndSortedIdeas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onVote={handleVote}
                      onConvert={handleConvert}
                      onDelete={handleDelete}
                      isVoting={voteIdea.loading}
                      isConverting={convertToFeature.loading}
                      isDeleting={deleteIdea.loading}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add Idea Modal */}
      <AddIdeaModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateIdea}
      />
    </div>
  );
}
