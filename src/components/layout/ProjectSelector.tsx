/**
 * ProjectSelector Component
 *
 * Dropdown to switch between projects and create new ones.
 * Uses Zustand store for state management and IPC for data fetching.
 */

import { useEffect, useState, useRef } from 'react';
import { Check, ChevronDown, FolderPlus, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateProjectModal } from '@/components/projects';
import { useProjectStore } from '@/store/useProjectStore';
import { useAuth } from '@/hooks/useAuth';
import type { Project } from '@/types/ipc';

export function ProjectSelector() {
  const { user } = useAuth();
  const {
    projects,
    currentProject,
    isLoading,
    error,
    fetchProjects,
    setCurrentProject,
    clearError,
  } = useProjectStore();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const prevErrorRef = useRef<string | null>(null);

  // Fetch projects when component mounts or user changes
  useEffect(() => {
    console.log('[ProjectSelector] useEffect triggered, user?.id:', user?.id);
    if (user?.id) {
      console.log('[ProjectSelector] Fetching projects for user:', user.id);
      void fetchProjects(user.id);
    } else {
      console.log('[ProjectSelector] No user ID available, skipping project fetch');
    }
  }, [user?.id, fetchProjects]);

  // Show toast notification when there's a new error
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      console.error('[ProjectSelector] Error loading projects:', error);
      toast.error('Failed to load projects', {
        description: error,
      });
    }
    prevErrorRef.current = error;
  }, [error]);

  // Clear error when dropdown opens
  const handleOpenChange = (open: boolean) => {
    if (open && error) {
      clearError();
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setCurrentProject(projectId);
  };

  const handleCreateProject = () => {
    setCreateModalOpen(true);
  };

  const handleProjectCreated = async (project: Project) => {
    // Refetch projects to include the new one
    if (user?.id) {
      await fetchProjects(user.id);
    }
    // Optionally select the newly created project
    setCurrentProject(project.id);
  };

  // Display loading state
  if (isLoading && projects.length === 0) {
    return (
      <Button
        variant="ghost"
        className="h-9 px-3 gap-2 justify-start font-normal"
        disabled
        aria-label="Loading projects"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="max-w-[200px] truncate">Loading...</span>
      </Button>
    );
  }

  // Display current project name or fallback
  const displayName = currentProject?.name || 'Select Project';
  const hasError = !!error;

  return (
    <>
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`h-9 px-3 gap-2 justify-start font-normal ${hasError ? 'text-destructive' : ''}`}
          aria-label="Select project"
        >
          {hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
          <span className="max-w-[200px] truncate">{displayName}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuLabel>Projects</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Error state */}
        {error && (
          <div className="px-2 py-1.5 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && projects.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No projects yet
          </div>
        )}

        {/* Project list */}
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => { handleProjectSelect(project.id); }}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="text-sm font-medium truncate">{project.name}</span>
                {project.targetPath && (
                  <span className="text-xs text-muted-foreground truncate">
                    {project.targetPath}
                  </span>
                )}
              </div>
              {currentProject?.id === project.id && (
                <Check className="h-4 w-4 ml-2 flex-shrink-0" />
              )}
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCreateProject} className="cursor-pointer">
          <FolderPlus className="mr-2 h-4 w-4" />
          <span>Create New Project</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    {/* Create Project Modal */}
    <CreateProjectModal
      open={createModalOpen}
      onOpenChange={setCreateModalOpen}
      onSuccess={(project: Project) => { void handleProjectCreated(project); }}
    />
  </>
  );
}
