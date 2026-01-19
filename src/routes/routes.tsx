/**
 * Route Configuration
 *
 * Central route definitions for the application.
 * Public routes are accessible without authentication.
 * Protected routes require authentication via ProtectedRoute wrapper.
 */

import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { MainLayout } from '@/components/layout';

// Public pages
import { LoginPage } from './login';
import { RegisterPage } from './register';

// Protected pages
import { KanbanPage } from './kanban';
import { TerminalsPage } from './terminals';
import { InsightsPage } from './insights';
import { RoadmapPage } from './roadmap';
import { IdeationPage } from './ideation';
import { ChangelogPage } from './changelog';
import { ContextPage } from './context';
import { McpPage } from './mcp';
import { WorktreesPage } from './worktrees';
import { SettingsPage } from './settings';
import { ProjectSettingsPage } from './project-settings';
import { ProjectDashboardPage } from './project-dashboard';
import { GitHubIssuesPage } from './github/issues';
import { GitHubPRsPage } from './github/prs';

/**
 * Route definitions
 */
export const routes: RouteObject[] = [
  // Public routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },

  // Protected routes - all require authentication and use MainLayout with Sidebar
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <KanbanPage />,
      },
      {
        path: 'kanban',
        element: <KanbanPage />,
      },
      {
        path: 'terminals',
        element: <TerminalsPage />,
      },
      {
        path: 'insights',
        element: <InsightsPage />,
      },
      {
        path: 'roadmap',
        element: <RoadmapPage />,
      },
      {
        path: 'ideation',
        element: <IdeationPage />,
      },
      {
        path: 'changelog',
        element: <ChangelogPage />,
      },
      {
        path: 'context',
        element: <ContextPage />,
      },
      {
        path: 'mcp',
        element: <McpPage />,
      },
      {
        path: 'worktrees',
        element: <WorktreesPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'project-settings/:projectId',
        element: <ProjectSettingsPage />,
      },
      {
        path: 'projects/:projectId',
        element: <ProjectDashboardPage />,
      },
      {
        path: 'issues',
        element: <GitHubIssuesPage />,
      },
      {
        path: 'prs',
        element: <GitHubPRsPage />,
      },
    ],
  },
];
