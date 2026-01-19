# Project Dashboard Component

## Overview

The Project Dashboard is the main landing page when a project is selected. It provides an at-a-glance view of project information, statistics, and team members.

## Location

`src/routes/project-dashboard.tsx`

## Features

### 1. Header Section
- **Project Name**: Large, gradient-styled heading
- **Description**: Displays project description or placeholder text if none set
- **Directory Path**: Shows the target directory with folder icon, or "No directory set" if not configured
- **GitHub Link**: External link to repository if configured (opens in browser)
- **Settings Button**: Navigates to project settings page

### 2. Statistics Cards (4-column grid)
- **Total Tasks**: Count of all tasks (placeholder: 0)
- **Completed Tasks**: Count of completed tasks (placeholder: 0)
- **Team Members**: Count from members array (real data)
- **Active Terminals**: Count of running terminals (placeholder: 0)

### 3. Two-Column Layout

#### Left Column - Recent Activity Card
- **Title**: "Recent Activity" with activity icon
- **Content**: Placeholder for now ("No recent activity")
- **Future**: Will show task updates, commits, etc.

#### Right Column - Team Members Card
- **Title**: "Team" with member count badge
- **Members List**: Shows up to 5 members with:
  - Avatar (with fallback to initials)
  - Name and email
  - Role badge (highlighted for OWNER)
- **View All Button**: Shown if more than 5 members
- **Navigation**: Links to `/projects/:id/team` page

## Data Loading

### IPC Query
Uses `useIPCQuery('projects:get', [projectId])` to fetch project data with members.

### Loading States
- **Loading**: Animated skeleton loader with placeholder cards
- **Error/Not Found**: Dedicated error screen with "Go Back" button
- **Success**: Full dashboard with project data

## Type Safety

### Types Used
- `Project` - Main project entity with metadata
- `ProjectMember` - Member with user info and role
- All types from `src/types/ipc.ts`

### IPC Channels
- `projects:get` - Fetches project by ID with members relation

## Styling

### Design System
- Uses shadcn/ui components (Card, Button, Badge, Avatar, Separator)
- Gradient text for project name (cyan 400-600)
- Responsive grid layouts
- Hover effects on interactive elements
- Proper spacing and visual hierarchy

### Icons
Uses lucide-react icons:
- Folder (directory)
- Github (repository link)
- Settings (settings button)
- Users (team section)
- ListTodo (tasks stat)
- CheckCircle2 (completed stat)
- Terminal (terminals stat)
- Activity (activity section)

## Navigation

### Route Params
- Receives `projectId` from route params via `useParams()`

### Navigation Targets
- `/dashboard` - Back to main dashboard (on error)
- `/projects/:id/settings` - Project settings page
- `/projects/:id/team` - Full team members list (if >5 members)

## Future Enhancements

### Placeholders for Real Data
Currently showing placeholder values (0) for:
- Total tasks count
- Completed tasks count
- Active terminals count
- Recent activity feed

These will be replaced with real data when:
- Task system is implemented (Phase 6)
- Terminal system is implemented (Phase 7)
- Activity tracking is added

### Potential Additions
- Project stats graphs/charts
- Quick actions (create task, open terminal)
- Recent commits from GitHub
- Project health indicators
- Task completion progress bar

## Helper Functions

### getInitials(name, email)
Generates avatar fallback text:
- Two letters from first and last name if available
- First two letters of name if single word
- First two letters of email as fallback
- "??" if no data available

## Component Structure

```
ProjectDashboard
├── DashboardSkeleton (loading state)
├── ProjectNotFound (error state)
└── Main Dashboard
    ├── Header Section
    │   ├── Project Name & Description
    │   ├── Settings Button
    │   └── Metadata (Path, GitHub)
    ├── Stats Cards (Grid)
    │   ├── Tasks Card
    │   ├── Completed Card
    │   ├── Team Card
    │   └── Terminals Card
    └── Two-Column Layout
        ├── Recent Activity Card
        └── Team Members Card
```

## Integration Points

### Required IPC Handlers
- ✅ `projects:get` - Already implemented in `electron/ipc/projects.ts`

### Required Types
- ✅ `Project` interface
- ✅ `ProjectMember` interface
- ✅ IPC channel types

### Required UI Components
- ✅ Card, CardHeader, CardTitle, CardDescription, CardContent
- ✅ Button
- ✅ Badge
- ✅ Avatar, AvatarImage, AvatarFallback
- ✅ Separator

## Usage Example

```tsx
// In your router configuration
import { ProjectDashboard } from '@/routes/project-dashboard';

<Route path="/projects/:projectId" element={<ProjectDashboard />} />
```

## Testing Checklist

- [ ] Loads project data correctly
- [ ] Shows loading skeleton while fetching
- [ ] Displays error state for invalid project ID
- [ ] Shows correct member count and details
- [ ] Navigates to settings page
- [ ] Displays GitHub link correctly (opens in new tab)
- [ ] Shows "View All" for >5 team members
- [ ] Avatar fallbacks work correctly
- [ ] Responsive layout works on different screen sizes
