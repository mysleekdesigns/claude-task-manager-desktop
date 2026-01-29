import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Terminal,
  BarChart,
  Map,
  Lightbulb,
  FileText,
  Brain,
  Plug,
  GitBranch,
  CircleDot,
  GitPullRequest,
  Settings,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  LogOut,
  Folder,
  FolderPlus,
  Check,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/store/useSidebarStore';
import { useAuth } from '@/hooks/useAuth';
import { useProjectStore } from '@/store/useProjectStore';
import { CreateProjectModal } from '@/components/projects';
import type { Project } from '@/types/ipc';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  shortcut: string;
}

const navigationItems: NavItem[] = [
  { id: 'kanban', label: 'Kanban Board', icon: LayoutGrid, path: '/kanban', shortcut: 'K' },
  { id: 'terminals', label: 'Agent Terminals', icon: Terminal, path: '/terminals', shortcut: 'A' },
  { id: 'insights', label: 'Insights', icon: BarChart, path: '/insights', shortcut: 'N' },
  { id: 'roadmap', label: 'Roadmap', icon: Map, path: '/roadmap', shortcut: 'D' },
  { id: 'ideation', label: 'Ideation', icon: Lightbulb, path: '/ideation', shortcut: 'I' },
  { id: 'changelog', label: 'Changelog', icon: FileText, path: '/changelog', shortcut: 'L' },
  { id: 'context', label: 'Context', icon: Brain, path: '/context', shortcut: 'C' },
  { id: 'mcp', label: 'MCP Overview', icon: Plug, path: '/mcp', shortcut: 'M' },
  { id: 'worktrees', label: 'Worktrees', icon: GitBranch, path: '/worktrees', shortcut: 'W' },
  { id: 'issues', label: 'GitHub Issues', icon: CircleDot, path: '/issues', shortcut: 'G' },
  { id: 'prs', label: 'GitHub PRs', icon: GitPullRequest, path: '/prs', shortcut: 'P' },
];

/**
 * Get user initials from name or email
 * Returns up to 2 capital letters
 */
function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Sidebar() {
  const { collapsed, toggleCollapsed } = useSidebarStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    projects,
    currentProject,
    isLoading: projectsLoading,
    error: projectsError,
    fetchProjects,
    setCurrentProject,
    clearError: clearProjectError,
  } = useProjectStore();
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);

  // Fetch projects when user changes
  useEffect(() => {
    if (user?.id) {
      void fetchProjects(user.id);
    }
  }, [user?.id, fetchProjects]);

  // Handle project dropdown open
  const handleProjectDropdownOpen = (open: boolean) => {
    if (open && projectsError) {
      clearProjectError();
    }
  };

  // Handle project selection
  const handleProjectSelect = (projectId: string) => {
    setCurrentProject(projectId);
  };

  // Handle project creation
  const handleProjectCreated = async (project: Project) => {
    if (user?.id) {
      await fetchProjects(user.id);
    }
    setCurrentProject(project.id);
  };

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Cmd/Ctrl + Shift is pressed (navigation shortcuts)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        const key = e.key.toUpperCase();
        const item = navigationItems.find(item => item.shortcut === key);

        if (item) {
          e.preventDefault();
          void navigate(item.path);
        }
      }

      // Toggle sidebar with Cmd/Ctrl + B
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [navigate, toggleCollapsed]);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        data-testid="sidebar"
        className={cn(
          'flex h-screen flex-col border-r border-border bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Header with collapse button */}
        <div className="flex items-center justify-between border-b border-border px-3 pt-12 pb-2">

          <div className={cn('flex items-center gap-2', collapsed && 'mx-auto')}>
            <div className="flex size-7 items-center justify-center rounded-md bg-cyan-500">
              <CheckSquare className="size-4 text-gray-900" />
            </div>
            {!collapsed && (
              <span className="font-semibold text-foreground">Claude Tasks</span>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleCollapsed}
                className={cn('shrink-0', collapsed && 'mx-auto')}
              >
                {collapsed ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <ChevronLeft className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? 'Expand' : 'Collapse'} (⌘B)
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Project Selector Section */}
        <div className="border-b border-border px-2 py-3">
          <DropdownMenu onOpenChange={handleProjectDropdownOpen}>
            <DropdownMenuTrigger asChild>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-full"
                      aria-label="Select project"
                    >
                      {projectsLoading && projects.length === 0 ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Folder className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {currentProject?.name || 'Select Project'}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full h-auto px-3 py-2 justify-between font-normal"
                  aria-label="Select project"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {projectsLoading && projects.length === 0 ? (
                      <Loader2 className="size-4 shrink-0 animate-spin" />
                    ) : (
                      <Folder className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-xs text-muted-foreground">Project</span>
                      <span className="text-sm truncate max-w-[160px]">
                        {projectsLoading && projects.length === 0
                          ? 'Loading...'
                          : currentProject?.name || 'Select Project'}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="size-4 shrink-0 opacity-50" />
                </Button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-64"
              align={collapsed ? 'start' : 'start'}
              side={collapsed ? 'right' : 'bottom'}
            >
              <DropdownMenuLabel>Projects</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Error state */}
              {projectsError && (
                <div className="px-2 py-1.5 text-xs text-destructive">
                  {projectsError}
                </div>
              )}

              {/* Empty state */}
              {!projectsLoading && projects.length === 0 && (
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
                      <Check className="size-4 ml-2 shrink-0" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => { setCreateProjectModalOpen(true); }}
                className="cursor-pointer"
              >
                <FolderPlus className="mr-2 size-4" />
                <span>Create New Project</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <li key={item.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          'w-full justify-start',
                          isActive && 'bg-accent text-accent-foreground',
                          collapsed && 'justify-center px-0'
                        )}
                        asChild
                      >
                        <Link to={item.path} data-testid={`nav-${item.id}`}>
                          <Icon className={cn('size-4', !collapsed && 'mr-3')} />
                          {!collapsed && (
                            <span className="flex-1 text-left">{item.label}</span>
                          )}
                          {!collapsed && (
                            <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                              <span className="text-xs">⌘⇧</span>
                              {item.shortcut}
                            </kbd>
                          )}
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right">
                        <div className="flex items-center gap-2">
                          {item.label}
                          <kbd className="ml-1 rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
                            ⌘⇧{item.shortcut}
                          </kbd>
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer - Settings */}
        <div className="border-t border-border p-2 space-y-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start text-muted-foreground hover:text-foreground',
                  collapsed && 'justify-center px-0',
                  location.pathname === '/settings' && 'bg-accent text-accent-foreground'
                )}
                asChild
              >
                <Link to="/settings" data-testid="nav-settings">
                  <Settings className={cn('size-4', !collapsed && 'mr-3')} />
                  {!collapsed && <span className="flex-1 text-left">Settings</span>}
                </Link>
              </Button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">Settings</TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* User Section */}
        {user && (
          <div className="border-t border-border p-3">
            <div className={cn(
              'flex items-center',
              collapsed ? 'flex-col gap-2' : 'gap-3'
            )}>
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {getInitials(user.name || user.email)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">
                    {user.name || user.email}
                  </p>
                  {user.name && user.email && (
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  )}
                </div>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void logout()}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    data-testid="signout-button"
                  >
                    <LogOut className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={collapsed ? 'right' : 'top'}>
                  Sign out
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
      </aside>

      {/* Create Project Modal */}
      <CreateProjectModal
        open={createProjectModalOpen}
        onOpenChange={setCreateProjectModalOpen}
        onSuccess={(project: Project) => { void handleProjectCreated(project); }}
      />
    </TooltipProvider>
  );
}
