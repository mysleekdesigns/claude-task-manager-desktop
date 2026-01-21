/**
 * Phase Card Component
 *
 * Displays a phase with milestones, features, and progress tracking.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Plus, CheckSquare } from 'lucide-react';
import { FeatureItem } from './FeatureItem';
import type { Phase, Feature, RoadmapPhaseStatus } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface PhaseCardProps {
  phase: Phase;
  features: Feature[];
  onAddMilestone?: (phaseId: string) => void;
  onToggleMilestone?: (milestoneId: string) => void;
  onAddFeature?: (phaseId: string) => void;
  onBuildFeature?: (feature: Feature) => void;
  onEditFeature?: (feature: Feature) => void;
  onDeleteFeature?: (feature: Feature) => void;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get phase status badge variant
 */
function getStatusBadge(status: RoadmapPhaseStatus) {
  const variants: Record<RoadmapPhaseStatus, { variant: 'outline' | 'default' | 'secondary'; label: string }> = {
    planned: { variant: 'outline', label: 'Planned' },
    in_progress: { variant: 'default', label: 'In Progress' },
    completed: { variant: 'secondary', label: 'Completed' },
  };
  return variants[status];
}

/**
 * Calculate progress based on completed milestones and features
 */
function calculateProgress(phase: Phase, features: Feature[]): number {
  const milestones = phase.milestones || [];
  const phaseFeatures = features.filter(f => f.phaseId === phase.id);

  const totalItems = milestones.length + phaseFeatures.length;
  if (totalItems === 0) return 0;

  const completedMilestones = milestones.filter(m => m.completed).length;
  const completedFeatures = phaseFeatures.filter(f => f.status === 'completed').length;

  return Math.round(((completedMilestones + completedFeatures) / totalItems) * 100);
}

// ============================================================================
// Component
// ============================================================================

export function PhaseCard({
  phase,
  features,
  onAddMilestone,
  onToggleMilestone,
  onAddFeature,
  onBuildFeature,
  onEditFeature,
  onDeleteFeature,
}: PhaseCardProps) {
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  const statusBadge = getStatusBadge(phase.status);
  const progress = calculateProgress(phase, features);
  const milestones = phase.milestones || [];
  const phaseFeatures = features.filter(f => f.phaseId === phase.id);

  // Show max 3 features by default
  const visibleFeatures = showAllFeatures ? phaseFeatures : phaseFeatures.slice(0, 3);
  const hasMoreFeatures = phaseFeatures.length > 3;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                Phase {phase.order}
              </Badge>
              <Badge variant={statusBadge.variant} className="text-xs">
                {statusBadge.label}
              </Badge>
            </div>
            <CardTitle className="text-lg">{phase.name}</CardTitle>
            {phase.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {phase.description}
              </p>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Milestones Section */}
        {milestones.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Milestones
              </h4>
              <span className="text-xs text-muted-foreground">
                {milestones.filter(m => m.completed).length} / {milestones.length}
              </span>
            </div>
            <div className="space-y-2 pl-6">
              {milestones.map((milestone) => (
                <div key={milestone.id} className="flex items-start gap-2">
                  <Checkbox
                    id={milestone.id}
                    checked={milestone.completed}
                    onCheckedChange={() => {
                      if (onToggleMilestone) {
                        onToggleMilestone(milestone.id);
                      }
                    }}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={milestone.id}
                    className={`text-sm cursor-pointer flex-1 leading-tight ${
                      milestone.completed ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {milestone.title}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Milestone Button */}
        {onAddMilestone && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { onAddMilestone(phase.id); }}
            className="w-full text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Milestone
          </Button>
        )}

        {/* Features Section */}
        {phaseFeatures.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Features</h4>
              <span className="text-xs text-muted-foreground">
                {phaseFeatures.filter(f => f.status === 'completed').length} /{' '}
                {phaseFeatures.length}
              </span>
            </div>
            <div className="space-y-2">
              {visibleFeatures.map((feature) => (
                <FeatureItem
                  key={feature.id}
                  feature={feature}
                  onBuild={onBuildFeature}
                  onEdit={onEditFeature}
                  onDelete={onDeleteFeature}
                />
              ))}
            </div>
            {hasMoreFeatures && !showAllFeatures && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowAllFeatures(true); }}
                className="w-full text-xs"
              >
                Show {phaseFeatures.length - 3} more features
              </Button>
            )}
            {showAllFeatures && hasMoreFeatures && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowAllFeatures(false); }}
                className="w-full text-xs"
              >
                Show less
              </Button>
            )}
          </div>
        )}

        {/* Add Feature Button */}
        {onAddFeature && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { onAddFeature(phase.id); }}
            className="w-full text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Feature
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
