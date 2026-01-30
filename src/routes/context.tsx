/**
 * Context & Memory Page (Phase 10)
 *
 * Project knowledge base and session insights with memory management.
 */

import { useState, useMemo, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useMemoryManager } from '@/hooks/useMemory';
import { useTasks } from '@/hooks/useTasks';
import { MemoryCard } from '@/components/memory/MemoryCard';
import { AddMemoryModal } from '@/components/memory/AddMemoryModal';
import { EditMemoryModal } from '@/components/memory/EditMemoryModal';
import { ProjectIndexTab } from '@/components/context/ProjectIndexTab';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, AlertCircle, BookOpen } from 'lucide-react';
import type { MemoryType, MemorySource, ArchiveFilter, CreateMemoryInput, UpdateMemoryInput, Memory } from '@/types/ipc';

// ============================================================================
// Constants
// ============================================================================

const MEMORY_TYPE_FILTERS: {
  value: MemoryType | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'session', label: 'Sessions' },
  { value: 'pr_review', label: 'PR Reviews' },
  { value: 'codebase', label: 'Codebase' },
  { value: 'pattern', label: 'Patterns' },
  { value: 'gotcha', label: 'Gotchas' },
  { value: 'context', label: 'Context' },
  { value: 'decision', label: 'Decisions' },
  { value: 'task', label: 'Tasks' },
];

const SOURCE_FILTERS: {
  value: MemorySource | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'manual', label: 'Manual' },
  { value: 'auto_session', label: 'Auto (Session)' },
  { value: 'auto_commit', label: 'Auto (Commit)' },
];

const ARCHIVE_FILTERS: {
  value: ArchiveFilter;
  label: string;
}[] = [
  { value: 'active', label: 'Active Only' },
  { value: 'archived', label: 'Archived Only' },
  { value: 'all', label: 'Show All' },
];

// ============================================================================
// Component
// ============================================================================

export function ContextPage() {
  const currentProject = useProjectStore((state) => state.currentProject);

  // Local state - filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<MemoryType | 'all'>('all');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<MemorySource | 'all'>('all');
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<string>('all');
  const [selectedArchiveFilter, setSelectedArchiveFilter] = useState<ArchiveFilter>('active');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);

  // Fetch tasks for the task filter dropdown
  const { data: tasks } = useTasks(currentProject?.id || '');
  const tasksArray = tasks ?? [];

  // Build IPC filter parameters based on current filter state
  const ipcFilters = useMemo(() => {
    const filters: {
      type?: MemoryType;
      source?: MemorySource;
      taskId?: string;
      isArchived?: boolean;
    } = {};

    // Only pass non-"all" type filter to IPC
    if (selectedTypeFilter !== 'all') {
      filters.type = selectedTypeFilter;
    }

    // Only pass non-"all" source filter to IPC
    if (selectedSourceFilter !== 'all') {
      filters.source = selectedSourceFilter;
    }

    // Task filter: "all" = no filter, "unlinked" = null taskId, otherwise specific taskId
    if (selectedTaskFilter === 'unlinked') {
      filters.taskId = ''; // Empty string signals unlinked in the handler
    } else if (selectedTaskFilter !== 'all') {
      filters.taskId = selectedTaskFilter;
    }

    // Archive filter
    if (selectedArchiveFilter === 'active') {
      filters.isArchived = false;
    } else if (selectedArchiveFilter === 'archived') {
      filters.isArchived = true;
    }
    // "all" means we don't pass isArchived, showing both

    return filters;
  }, [selectedTypeFilter, selectedSourceFilter, selectedTaskFilter, selectedArchiveFilter]);

  // Fetch memories with filters passed to IPC
  const {
    memories,
    loading,
    error,
    createMemory,
    updateMemory,
    deleteMemory,
  } = useMemoryManager(currentProject?.id || '', ipcFilters);

  // The main filtering is done server-side via IPC filters
  // We only do client-side search filtering here
  const memoriesArray = memories ?? [];
  const filteredMemories = useMemo(() => {
    let filtered = memoriesArray;

    // Filter by search query (title and content) - client-side
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          m.content.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [memoriesArray, searchQuery]);

  // Count memories by type (from the already-filtered server results)
  const memoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: memoriesArray.length,
    };

    // Initialize all type counts
    MEMORY_TYPE_FILTERS.forEach((filter) => {
      if (filter.value !== 'all') {
        counts[filter.value] = 0;
      }
    });

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

  // Handle edit memory - open the modal
  const handleEditMemory = useCallback((memory: Memory) => {
    setEditingMemory(memory);
  }, []);

  // Handle save memory (from edit modal)
  const handleSaveMemory = useCallback(
    async (id: string, data: UpdateMemoryInput) => {
      await updateMemory.mutate(id, data);
    },
    [updateMemory]
  );

  // Handle archive/unarchive memory
  const handleArchiveMemory = useCallback(
    async (memory: Memory) => {
      await updateMemory.mutate(memory.id, {
        isArchived: !memory.isArchived,
      });
    },
    [updateMemory]
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
              <ProjectIndexTab projectId={currentProject.id} />
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
                  <span className="text-sm text-muted-foreground mr-2">Type:</span>
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
                      {selectedTypeFilter === 'all' && (
                        <span className="ml-1.5 text-xs">
                          ({memoryCounts[filter.value] || 0})
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>

                {/* Additional Filters Row */}
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Source Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Source:</span>
                    <Select
                      value={selectedSourceFilter}
                      onValueChange={(value) => { setSelectedSourceFilter(value as MemorySource | 'all'); }}
                    >
                      <SelectTrigger className="w-[160px]" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_FILTERS.map((filter) => (
                          <SelectItem key={filter.value} value={filter.value}>
                            {filter.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Task Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Task:</span>
                    <Select
                      value={selectedTaskFilter}
                      onValueChange={setSelectedTaskFilter}
                    >
                      <SelectTrigger className="w-[200px]" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tasks</SelectItem>
                        <SelectItem value="unlinked">Unlinked (No Task)</SelectItem>
                        {tasksArray.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title.length > 25
                              ? `${task.title.substring(0, 25)}...`
                              : task.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Archive Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Select
                      value={selectedArchiveFilter}
                      onValueChange={(value) => { setSelectedArchiveFilter(value as ArchiveFilter); }}
                    >
                      <SelectTrigger className="w-[140px]" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ARCHIVE_FILTERS.map((filter) => (
                          <SelectItem key={filter.value} value={filter.value}>
                            {filter.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                      onEdit={handleEditMemory}
                      onArchive={handleArchiveMemory}
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

      {/* Edit Memory Modal */}
      {editingMemory && (
        <EditMemoryModal
          memory={editingMemory}
          isOpen={Boolean(editingMemory)}
          onClose={() => { setEditingMemory(null); }}
          onSave={handleSaveMemory}
          tasks={tasksArray}
        />
      )}
    </div>
  );
}
