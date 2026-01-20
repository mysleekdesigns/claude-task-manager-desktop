/**
 * Roadmap Page
 *
 * Project roadmap with phases, features, and milestones (Phase 9).
 */

import { useCallback, useMemo, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useRoadmapManager } from '@/hooks/useRoadmap';
import { useTaskManager } from '@/hooks/useTasks';
import { PhaseCard } from '@/components/roadmap/PhaseCard';
import { FeatureItem } from '@/components/roadmap/FeatureItem';
import { AddPhaseModal } from '@/components/roadmap/AddPhaseModal';
import { AddFeatureModal } from '@/components/roadmap/AddFeatureModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertCircle, ListTodo } from 'lucide-react';
import type { Feature, MoscowPriority, CreateTaskInput } from '@/types/ipc';

// ============================================================================
// Component
// ============================================================================

export function RoadmapPage() {
  const currentProject = useProjectStore((state) => state.currentProject);

  // Modal state
  const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | undefined>();

  // Fetch roadmap data
  const {
    phases,
    features,
    loading,
    error,
    createPhase,
    createFeature,
    deleteFeature,
    toggleMilestone,
  } = useRoadmapManager(currentProject?.id || '');

  // Fetch tasks for creating tasks from features
  const { createTask } = useTaskManager(currentProject?.id || '');

  // Sort phases by order
  const sortedPhases = useMemo(() => {
    return [...phases].sort((a, b) => a.order - b.order);
  }, [phases]);

  // Calculate stats
  const stats = useMemo(() => {
    const priorityCounts = features.reduce(
      (acc, f) => {
        acc[f.priority] = (acc[f.priority] || 0) + 1;
        return acc;
      },
      {} as Record<MoscowPriority, number>
    );

    return {
      totalFeatures: features.length,
      totalPhases: phases.length,
      mustHave: priorityCounts.MUST || 0,
      shouldHave: priorityCounts.SHOULD || 0,
      couldHave: priorityCounts.COULD || 0,
      wontHave: priorityCounts.WONT || 0,
    };
  }, [features, phases]);

  // Features by priority for the priority view
  const featuresByPriority = useMemo(() => {
    const groups: Record<MoscowPriority, Feature[]> = {
      MUST: [],
      SHOULD: [],
      COULD: [],
      WONT: [],
    };
    features.forEach((f) => {
      groups[f.priority].push(f);
    });
    return groups;
  }, [features]);

  // Unassigned features (not in any phase)
  const unassignedFeatures = useMemo(() => {
    return features.filter((f) => !f.phaseId);
  }, [features]);

  // Handle add phase
  const handleAddPhase = useCallback(
    async (data: { name: string; description: string }) => {
      const nextOrder = Math.max(0, ...phases.map((p) => p.order)) + 1;
      await createPhase.mutate({
        name: data.name,
        description: data.description,
        order: nextOrder,
        projectId: currentProject!.id,
      });
    },
    [createPhase, phases, currentProject]
  );

  // Handle add feature
  const handleAddFeature = useCallback(
    async (data: {
      title: string;
      description: string;
      priority: MoscowPriority;
      phaseId?: string;
    }) => {
      const featureData: {
        title: string;
        description: string;
        priority: MoscowPriority;
        projectId: string;
        phaseId?: string;
      } = {
        title: data.title,
        description: data.description,
        priority: data.priority,
        projectId: currentProject!.id,
      };
      if (data.phaseId !== undefined) {
        featureData.phaseId = data.phaseId;
      }
      await createFeature.mutate(featureData);
    },
    [createFeature, currentProject]
  );

  // Handle build feature (create task from feature)
  const handleBuildFeature = useCallback(
    async (feature: Feature) => {
      const taskData: CreateTaskInput = {
        title: feature.title,
        priority: 'MEDIUM', // Default priority
        projectId: currentProject!.id,
      };
      if (feature.description) {
        taskData.description = feature.description;
      }

      try {
        await createTask.mutate(taskData);
        alert(`Task created from feature: ${feature.title}`);
      } catch (err) {
        console.error('Failed to create task from feature:', err);
        alert('Failed to create task');
      }
    },
    [createTask, currentProject]
  );

  // Handle delete feature
  const handleDeleteFeature = useCallback(
    async (feature: Feature) => {
      if (
        window.confirm(
          `Are you sure you want to delete "${feature.title}"? This action cannot be undone.`
        )
      ) {
        try {
          await deleteFeature.mutate(feature.id);
        } catch (err) {
          console.error('Failed to delete feature:', err);
        }
      }
    },
    [deleteFeature]
  );

  // Handle toggle milestone
  const handleToggleMilestone = useCallback(
    async (milestoneId: string) => {
      try {
        await toggleMilestone.mutate(milestoneId);
      } catch (err) {
        console.error('Failed to toggle milestone:', err);
      }
    },
    [toggleMilestone]
  );

  // Handle open add feature modal for specific phase
  const handleOpenFeatureModal = useCallback((phaseId?: string) => {
    setSelectedPhaseId(phaseId);
    setIsFeatureModalOpen(true);
  }, []);

  // No project selected
  if (!currentProject) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Roadmap</h1>
          <p className="text-muted-foreground mt-2">
            Project phases, features, and milestones
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the sidebar to view its roadmap.
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
            <h1 className="text-3xl font-bold">{currentProject.name}</h1>
            <p className="text-muted-foreground mt-2">
              {currentProject.description || 'Project roadmap and feature planning'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsFeatureModalOpen(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Feature
            </Button>
            <Button onClick={() => setIsPhaseModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Phase
            </Button>
          </div>
        </div>

        {/* Stats Section */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Phases:</span>
            <Badge variant="secondary">{stats.totalPhases}</Badge>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Features:</span>
            <Badge variant="secondary">{stats.totalFeatures}</Badge>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Must:</span>
            <Badge variant="destructive">{stats.mustHave}</Badge>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Should:</span>
            <Badge variant="default">{stats.shouldHave}</Badge>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Could:</span>
            <Badge variant="secondary">{stats.couldHave}</Badge>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Won't:</span>
            <Badge variant="outline">{stats.wontHave}</Badge>
          </div>
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
            <div className="text-muted-foreground">Loading roadmap...</div>
          </div>
        ) : (
          <Tabs defaultValue="phases" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="phases">Phases View</TabsTrigger>
              <TabsTrigger value="all-features">All Features</TabsTrigger>
              <TabsTrigger value="by-priority">By Priority</TabsTrigger>
            </TabsList>

            {/* Phases View (Default) */}
            <TabsContent value="phases" className="space-y-6">
              {sortedPhases.length === 0 ? (
                <div className="text-center py-12">
                  <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No phases yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first phase to start planning your roadmap.
                  </p>
                  <Button onClick={() => setIsPhaseModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Phase
                  </Button>
                </div>
              ) : (
                sortedPhases.map((phase) => (
                  <PhaseCard
                    key={phase.id}
                    phase={phase}
                    features={features}
                    onAddFeature={handleOpenFeatureModal}
                    onToggleMilestone={handleToggleMilestone}
                    onBuildFeature={handleBuildFeature}
                    onDeleteFeature={handleDeleteFeature}
                  />
                ))
              )}

              {/* Unassigned Features Section */}
              {unassignedFeatures.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">
                    Unassigned Features ({unassignedFeatures.length})
                  </h3>
                  <div className="space-y-2">
                    {unassignedFeatures.map((feature) => (
                      <FeatureItem
                        key={feature.id}
                        feature={feature}
                        onBuild={handleBuildFeature}
                        onDelete={handleDeleteFeature}
                      />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* All Features View */}
            <TabsContent value="all-features" className="space-y-2">
              {features.length === 0 ? (
                <div className="text-center py-12">
                  <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No features yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add features to start planning your product.
                  </p>
                  <Button onClick={() => setIsFeatureModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Feature
                  </Button>
                </div>
              ) : (
                features.map((feature) => (
                  <FeatureItem
                    key={feature.id}
                    feature={feature}
                    onBuild={handleBuildFeature}
                    onDelete={handleDeleteFeature}
                  />
                ))
              )}
            </TabsContent>

            {/* By Priority View */}
            <TabsContent value="by-priority" className="space-y-6">
              {(['MUST', 'SHOULD', 'COULD', 'WONT'] as MoscowPriority[]).map(
                (priority) => (
                  <div key={priority}>
                    <h3 className="text-lg font-semibold mb-3">
                      {priority === 'MUST' && 'Must Have'}
                      {priority === 'SHOULD' && 'Should Have'}
                      {priority === 'COULD' && 'Could Have'}
                      {priority === 'WONT' && "Won't Have"}
                      <Badge variant="secondary" className="ml-2">
                        {featuresByPriority[priority].length}
                      </Badge>
                    </h3>
                    {featuresByPriority[priority].length === 0 ? (
                      <p className="text-sm text-muted-foreground pl-4">
                        No features in this priority
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {featuresByPriority[priority].map((feature) => (
                          <FeatureItem
                            key={feature.id}
                            feature={feature}
                            onBuild={handleBuildFeature}
                            onDelete={handleDeleteFeature}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Modals */}
      <AddPhaseModal
        isOpen={isPhaseModalOpen}
        onClose={() => setIsPhaseModalOpen(false)}
        onSubmit={handleAddPhase}
        nextOrder={sortedPhases.length + 1}
      />

      <AddFeatureModal
        isOpen={isFeatureModalOpen}
        onClose={() => {
          setIsFeatureModalOpen(false);
          setSelectedPhaseId(undefined);
        }}
        onSubmit={handleAddFeature}
        phases={sortedPhases}
        defaultPhaseId={selectedPhaseId}
      />
    </div>
  );
}
