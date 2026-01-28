/**
 * Activity Page
 *
 * Displays a full activity feed for the current project.
 * Shows recent changes by collaborators with filtering and real-time updates.
 */

import { useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { ActivityFeed, type ActivityItemData } from '@/components/collaboration';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Users } from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// Component
// ============================================================================

export function ActivityPage() {
  const currentProject = useProjectStore((state) => state.currentProject);

  // Handle activity item click
  const handleActivityClick = useCallback((activity: ActivityItemData) => {
    // In production, this would navigate to the relevant entity
    // For now, show a toast with the activity details
    toast.info(`${activity.userName} ${activity.type.replace('_', ' ')} "${activity.entityName}"`);
  }, []);

  // No project selected
  if (!currentProject) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8" />
            Activity Feed
          </h1>
          <p className="text-muted-foreground mt-2">
            Track recent changes and collaborator activity
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the sidebar to view its activity.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Users className="h-8 w-8" />
          Activity Feed
        </h1>
        <p className="text-muted-foreground mt-2">
          {currentProject.name} - Recent changes by collaborators
        </p>
      </div>

      {/* Activity Feed */}
      <ActivityFeed
        projectId={currentProject.id}
        title="Recent Activity"
        maxHeight="calc(100vh - 250px)"
        showFilters={true}
        onActivityClick={handleActivityClick}
      />
    </div>
  );
}
