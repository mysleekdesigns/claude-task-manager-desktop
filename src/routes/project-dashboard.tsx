/**
 * Project Dashboard / Home Page
 *
 * Main landing page for a selected project showing overview, stats, and team members.
 */

import { useParams, useNavigate } from 'react-router';
import { useIPCQuery } from '@/hooks/useIPC';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Folder, Github, Settings, Users, ListTodo, CheckCircle2, Terminal, Activity } from 'lucide-react';

/**
 * Skeleton loader for the dashboard
 */
function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      <div className="space-y-4">
        <div className="h-10 w-64 bg-muted rounded" />
        <div className="h-5 w-96 bg-muted rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-64 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Error state for when project is not found
 */
function ProjectNotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Project Not Found</CardTitle>
          <CardDescription>
            The requested project could not be found or you don't have access to it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/dashboard')}>
            Go Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Get initials from name for avatar fallback
 */
function getInitials(name: string | null | undefined, email: string | undefined): string {
  if (name) {
    const parts = name.split(' ');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return '??';
}

/**
 * Project Dashboard Component
 */
export function ProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Fetch project data
  const { data: project, loading, error } = useIPCQuery(
    'projects:get',
    projectId ? [projectId] : undefined,
    { enabled: !!projectId }
  );

  // Loading state
  if (loading) {
    return <DashboardSkeleton />;
  }

  // Error or not found
  if (error || !project) {
    return <ProjectNotFound />;
  }

  // Calculate stats
  const memberCount = project.members?.length || 0;
  const tasksCount = 0; // Placeholder - will be real data later
  const completedTasksCount = 0; // Placeholder
  const activeTerminalsCount = 0; // Placeholder

  // Get team members to display (max 5)
  const displayMembers = project.members?.slice(0, 5) || [];
  const hasMoreMembers = memberCount > 5;

  return (
    <div className="p-8 space-y-6">
      {/* Header Section */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
              {project.name}
            </h1>
            <p className="text-muted-foreground">
              {project.description || 'No description provided'}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(`/projects/${projectId}/settings`)}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>

        {/* Project Metadata */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {project.targetPath && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Folder className="h-4 w-4" />
              <span className="font-mono">{project.targetPath}</span>
            </div>
          )}
          {!project.targetPath && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Folder className="h-4 w-4" />
              <span className="italic">No directory set</span>
            </div>
          )}

          {project.githubRepo && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <a
                href={project.githubRepo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-4 w-4" />
                <span>GitHub Repository</span>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Total Tasks</CardDescription>
              <ListTodo className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{tasksCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Completed</CardDescription>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{completedTasksCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Team Members</CardDescription>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{memberCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Active Terminals</CardDescription>
              <Terminal className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeTerminalsCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Activity Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Recent Activity</CardTitle>
            </div>
            <CardDescription>Latest updates and changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <p className="text-sm italic">No recent activity</p>
            </div>
          </CardContent>
        </Card>

        {/* Team Members Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Team</CardTitle>
                <Badge variant="secondary">{memberCount}</Badge>
              </div>
              {hasMoreMembers && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/projects/${projectId}/team`)}
                >
                  View All
                </Button>
              )}
            </div>
            <CardDescription>Project members and their roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {displayMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Avatar>
                    <AvatarImage src={member.user?.avatar || undefined} />
                    <AvatarFallback>
                      {getInitials(member.user?.name, member.user?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {member.user?.name || member.user?.email}
                    </p>
                    {member.user?.name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {member.user.email}
                      </p>
                    )}
                  </div>
                  <Badge variant={member.role === 'OWNER' ? 'default' : 'outline'}>
                    {member.role}
                  </Badge>
                </div>
              ))}
              {memberCount === 0 && (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <p className="text-sm italic">No team members</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Named export for clearer imports
export { ProjectDashboard as ProjectDashboardPage };

export default ProjectDashboard;
