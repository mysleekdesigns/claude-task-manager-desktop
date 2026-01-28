/**
 * Project Settings Page
 *
 * Allows users to configure project settings including:
 * - General settings (name, description)
 * - Team management (members & invitations)
 * - Directory settings
 * - GitHub integration
 * - Danger zone (delete project)
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIPCQuery, useIPCMutation } from '@/hooks/useIPC';
import { useAuth } from '@/hooks/useAuth';
import { TeamManagementSection } from '@/components/projects/TeamManagementSection';
import { PendingInvitations } from '@/components/collaboration/PendingInvitations';
import type { UpdateProjectInput, ProjectMember } from '@/types/ipc';

/**
 * Loading skeleton component for the settings page
 */
function SettingsSkeleton() {
  return (
    <div className="p-8 space-y-6">
      <div className="space-y-2">
        <div className="h-9 w-64 bg-muted rounded animate-pulse" />
        <div className="h-5 w-96 bg-muted rounded animate-pulse" />
      </div>
      <div className="space-y-6">
        <div className="h-64 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State for form values
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [githubRepo, setGithubRepo] = useState('');

  // State for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Active settings tab
  const [activeTab, setActiveTab] = useState('general');

  // Fetch project data
  const {
    data: project,
    loading,
    error,
    refetch: refetchProject,
  } = useIPCQuery('projects:get', projectId ? [projectId] : undefined, {
    enabled: !!projectId,
  });

  // Get project members from project data
  const members: ProjectMember[] = useMemo(() => {
    return project?.members || [];
  }, [project]);

  // Check if current user can manage team
  const canManageTeam = useMemo(() => {
    if (!user || !members.length) return false;
    const currentMember = members.find((m) => m.userId === user.id);
    return currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN';
  }, [user, members]);

  // Mutations
  const updateProject = useIPCMutation('projects:update');
  const deleteProject = useIPCMutation('projects:delete');
  const openDirectory = useIPCMutation('dialog:openDirectory');

  // Initialize form values when project data loads
  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
      setGithubRepo(project.githubRepo || '');
    }
  }, [project]);

  // Handle general settings save
  const handleSaveGeneral = async () => {
    if (!projectId) return;

    try {
      const updates: UpdateProjectInput = {};

      const trimmedName = name.trim();
      if (trimmedName) {
        updates.name = trimmedName;
      }

      const trimmedDescription = description.trim();
      if (trimmedDescription) {
        updates.description = trimmedDescription;
      }

      await updateProject.mutate(projectId, updates);
      toast.success('Project settings updated successfully');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update project settings'
      );
    }
  };

  // Handle directory change
  const handleChangeDirectory = async () => {
    if (!projectId) return;

    try {
      const dialogOptions: {
        title: string;
        defaultPath?: string;
        buttonLabel: string;
      } = {
        title: 'Select Project Directory',
        buttonLabel: 'Select',
      };

      if (project?.targetPath) {
        dialogOptions.defaultPath = project.targetPath;
      }

      const result = await openDirectory.mutate(dialogOptions);

      if (!result.canceled && result.filePaths.length > 0) {
        const newPath = result.filePaths[0];
        if (newPath) {
          await updateProject.mutate(projectId, { targetPath: newPath });
          toast.success('Project directory updated successfully');
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update project directory'
      );
    }
  };

  // Handle GitHub repo save
  const handleSaveGitHub = async () => {
    if (!projectId) return;

    try {
      const trimmedRepo = githubRepo.trim();
      const updates: UpdateProjectInput = {};

      if (trimmedRepo) {
        updates.githubRepo = trimmedRepo;
      }

      await updateProject.mutate(projectId, updates);
      toast.success('GitHub repository updated successfully');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update GitHub repository'
      );
    }
  };

  // Handle project deletion
  const handleDeleteProject = async () => {
    if (!projectId) return;

    try {
      await deleteProject.mutate(projectId);
      toast.success('Project deleted successfully');
      navigate('/kanban');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete project'
      );
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  // Show loading skeleton
  if (loading) {
    return <SettingsSkeleton />;
  }

  // Show error state
  if (error || !project) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-destructive">Error</h1>
          <p className="text-muted-foreground mt-2">
            {error?.message || 'Project not found'}
          </p>
        </div>
        <Button onClick={() => navigate('/kanban')} variant="outline">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
          Project Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage settings for {project.name}
        </p>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general" className="space-y-6 mt-6">
          {/* General Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Update your project's name and description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  placeholder="Enter project name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter project description (optional)"
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); }}
                  rows={4}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleSaveGeneral}
                disabled={updateProject.loading || !name.trim()}
              >
                {updateProject.loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardFooter>
          </Card>

          {/* Directory Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle>Directory Settings</CardTitle>
              <CardDescription>
                Configure the project's working directory
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Directory</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={project.targetPath || 'No directory set'}
                    readOnly
                    className="flex-1 font-mono text-sm bg-muted"
                  />
                  <Button
                    onClick={handleChangeDirectory}
                    disabled={openDirectory.loading || updateProject.loading}
                    variant="outline"
                  >
                    {openDirectory.loading ? 'Opening...' : 'Change Directory'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Management Tab */}
        <TabsContent value="team" className="space-y-6 mt-6">
          {/* Team Members Section */}
          {projectId && user && (
            <TeamManagementSection
              projectId={projectId}
              members={members}
              currentUserId={user.id}
              onMembersChange={refetchProject}
            />
          )}

          {/* Pending Invitations Section */}
          {canManageTeam && projectId && (
            <PendingInvitations
              projectId={projectId}
              canManage={canManageTeam}
              onRefresh={refetchProject}
            />
          )}
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6 mt-6">
          {/* GitHub Integration Card */}
          <Card>
            <CardHeader>
              <CardTitle>GitHub Integration</CardTitle>
              <CardDescription>
                Connect this project to a GitHub repository
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="githubRepo">Repository URL</Label>
                <Input
                  id="githubRepo"
                  placeholder="https://github.com/username/repository"
                  value={githubRepo}
                  onChange={(e) => { setGithubRepo(e.target.value); }}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the full URL to your GitHub repository
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveGitHub} disabled={updateProject.loading}>
                {updateProject.loading ? 'Saving...' : 'Save GitHub Repository'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Danger Zone Card */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Delete this project</h4>
              <p className="text-sm text-muted-foreground">
                Once you delete a project, there is no going back. Please be
                certain.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => { setDeleteDialogOpen(true); }}
            >
              Delete Project
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              project "{project.name}" and all associated data including tasks,
              terminals, and worktrees.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteDialogOpen(false); }}
              disabled={deleteProject.loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deleteProject.loading}
            >
              {deleteProject.loading ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectSettingsPage;
