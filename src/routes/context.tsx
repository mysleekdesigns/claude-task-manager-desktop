/**
 * Context & Memory Page (Phase 10)
 *
 * Project knowledge base and session insights with memory management.
 */

import { useState, useMemo, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useMemoryManager } from '@/hooks/useMemory';
import { MemoryCard } from '@/components/memory/MemoryCard';
import { AddMemoryModal } from '@/components/memory/AddMemoryModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Search, AlertCircle, BookOpen } from 'lucide-react';
import type { MemoryType, CreateMemoryInput, Memory } from '@/types/ipc';

// ============================================================================
// Constants
// ============================================================================

const MEMORY_TYPE_FILTERS: {
  value: MemoryType | 'all';
  label: string;
  count?: number;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'session', label: 'Sessions' },
  { value: 'pr_review', label: 'PR Reviews' },
  { value: 'codebase', label: 'Codebase' },
  { value: 'pattern', label: 'Patterns' },
  { value: 'gotcha', label: 'Gotchas' },
];

// ============================================================================
// Component
// ============================================================================

export function ContextPage() {
  const currentProject = useProjectStore((state) => state.currentProject);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<MemoryType | 'all'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Fetch memories
  const {
    memories,
    loading,
    error,
    createMemory,
    deleteMemory,
  } = useMemoryManager(currentProject?.id || '');

  // Filter memories by search and type
  const memoriesArray = memories ?? [];
  const filteredMemories = useMemo(() => {
    let filtered = memoriesArray;

    // Filter by type
    if (selectedTypeFilter !== 'all') {
      filtered = filtered.filter((m) => m.type === selectedTypeFilter);
    }

    // Filter by search query (title and content)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          m.content.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [memoriesArray, selectedTypeFilter, searchQuery]);

  // Count memories by type
  const memoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: memoriesArray.length,
      session: 0,
      pr_review: 0,
      codebase: 0,
      pattern: 0,
      gotcha: 0,
    };

    memoriesArray.forEach((m) => {
      counts[m.type] = (counts[m.type] || 0) + 1;
    });

    return counts;
  }, [memoriesArray]);

  // Handle create memory
  const handleCreateMemory = useCallback(
    async (data: Omit<CreateMemoryInput, 'projectId'>) => {
      if (!currentProject) return;

      await createMemory.mutate({
        ...data,
        projectId: currentProject.id,
      });
    },
    [currentProject, createMemory]
  );

  // Handle delete memory
  const handleDeleteMemory = useCallback(
    async (memory: Memory) => {
      await deleteMemory.mutate(memory.id);
    },
    [deleteMemory]
  );

  // No project selected
  if (!currentProject) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Context & Memory</h1>
          <p className="text-muted-foreground mt-2">
            Project knowledge base and session insights
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the sidebar to view its context and memories.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Context & Memory</h1>
            <p className="text-muted-foreground mt-2">
              Project knowledge base and session insights
            </p>
          </div>
          <Button onClick={() => { setIsAddModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Memory
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
            <div className="text-muted-foreground">Loading memories...</div>
          </div>
        ) : (
          <Tabs defaultValue="memories" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="project-index">Project Index</TabsTrigger>
              <TabsTrigger value="memories">Memories</TabsTrigger>
            </TabsList>

            {/* Project Index Tab */}
            <TabsContent value="project-index">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  Project Index Visualization
                </h3>
                <p className="text-muted-foreground max-w-md">
                  File tree and architecture overview coming soon. This will show your
                  project structure, dependencies, and key entry points.
                </p>
              </div>
            </TabsContent>

            {/* Memories Tab */}
            <TabsContent value="memories" className="space-y-4">
              {/* Search and Filters */}
              <div className="flex flex-col gap-4">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search memories..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); }}
                    className="pl-9"
                  />
                </div>

                {/* Type Filter Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground mr-2">Filter:</span>
                  {MEMORY_TYPE_FILTERS.map((filter) => (
                    <Badge
                      key={filter.value}
                      variant={
                        selectedTypeFilter === filter.value ? 'default' : 'outline'
                      }
                      className="cursor-pointer transition-colors"
                      onClick={() => { setSelectedTypeFilter(filter.value); }}
                    >
                      {filter.label}
                      <span className="ml-1.5 text-xs">
                        ({memoryCounts[filter.value] || 0})
                      </span>
                    </Badge>
                  ))}
                </div>

                {/* Memory Count */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Showing {filteredMemories.length} of {memoriesArray.length} memories
                  </span>
                </div>
              </div>

              {/* Memories Grid */}
              {filteredMemories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    {memoriesArray.length === 0
                      ? 'No memories yet'
                      : 'No memories match your filters'}
                  </h3>
                  <p className="text-muted-foreground max-w-md mb-4">
                    {memoriesArray.length === 0
                      ? 'Start building your project knowledge base by adding important context, insights, and learnings.'
                      : 'Try adjusting your search query or filters to find what you are looking for.'}
                  </p>
                  {memoriesArray.length === 0 && (
                    <Button onClick={() => { setIsAddModalOpen(true); }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Memory
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
                  {filteredMemories.map((memory) => (
                    <MemoryCard
                      key={memory.id}
                      memory={memory}
                      onDelete={handleDeleteMemory}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Add Memory Modal */}
      <AddMemoryModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); }}
        onSubmit={handleCreateMemory}
      />
    </div>
  );
}
