# Project Store Implementation

## Overview

This document describes the implementation of the Zustand-based project management store and the updated ProjectSelector component.

## Files Created/Modified

### Created
- `/src/store/useProjectStore.ts` - Zustand store for project management

### Modified
- `/src/components/layout/ProjectSelector.tsx` - Updated to use the new store instead of mock data

## Implementation Details

### Store Structure

The `useProjectStore` provides centralized state management for projects with the following features:

#### State
- `projects: Project[]` - Array of all projects for the current user
- `currentProject: Project | null` - Currently selected project
- `isLoading: boolean` - Loading state for async operations
- `error: string | null` - Error messages from failed operations

#### Actions
- `fetchProjects(userId)` - Fetch all projects for a user
- `setCurrentProject(projectId)` - Select a project
- `createProject(data, userId)` - Create a new project
- `updateProject(id, data)` - Update project details
- `deleteProject(id)` - Delete a project
- `addMember(projectId, userId, role)` - Add team member
- `removeMember(projectId, userId)` - Remove team member
- `updateMemberRole(projectId, userId, role)` - Update member role
- `clearError()` - Clear error state
- `reset()` - Reset store to initial state

#### Persistence
The store uses Zustand's persist middleware to save only the `currentProject.id` to localStorage. This allows the app to restore the last selected project on reload without storing the entire project list (which may become stale).

### TypeScript Types

All types match the Prisma schema exactly:

```typescript
interface Project {
  id: string;
  name: string;
  description: string | null;
  targetPath: string | null;
  githubRepo: string | null;
  createdAt: string;
  updatedAt: string;
  members?: ProjectMember[];
}

interface ProjectMember {
  id: string;
  role: ProjectRole; // 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  userId: string;
  projectId: string;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}
```

### ProjectSelector Component Updates

The component now:
1. Uses `useAuth()` to get the current user
2. Fetches projects automatically when the user is available
3. Displays loading state with spinner
4. Shows error messages when operations fail
5. Displays empty state when no projects exist
6. Shows project path (targetPath) as subtitle when available
7. Clears errors when the dropdown is reopened

### IPC Integration (Placeholder)

All IPC calls are currently mocked with TODO comments indicating where the actual `invoke()` calls should be added. The structure is:

```typescript
// TODO: Replace with actual IPC call when handler is ready
// const projects = await invoke('projects:list', _userId);

// For now, use mock data or empty array
const projects: Project[] = [];
```

Once the IPC handlers are implemented in the main process, simply uncomment the `invoke()` calls and remove the mock implementation.

## IPC Channels Required

The following IPC channels need to be implemented in the main process:

1. `projects:list` - Get all projects for a user
   - Input: `userId: string`
   - Output: `Project[]`

2. `projects:create` - Create a new project
   - Input: `CreateProjectData & { userId: string }`
   - Output: `Project`

3. `projects:update` - Update project details
   - Input: `projectId: string, data: UpdateProjectData`
   - Output: `Project`

4. `projects:delete` - Delete a project
   - Input: `projectId: string`
   - Output: `void`

5. `projects:addMember` - Add member to project
   - Input: `projectId: string, userId: string, role: ProjectRole`
   - Output: `void`

6. `projects:removeMember` - Remove member from project
   - Input: `projectId: string, userId: string`
   - Output: `void`

7. `projects:updateMemberRole` - Update member role
   - Input: `projectId: string, userId: string, role: ProjectRole`
   - Output: `void`

## Next Steps

1. **Implement IPC Handlers**: Create the main process handlers for all project-related operations
2. **Update Type Definitions**: Add the IPC channel definitions to `/src/types/ipc.ts`
3. **Uncomment IPC Calls**: Remove the mock implementations and use the actual IPC calls
4. **Create Project Modal**: Build the UI for creating new projects (currently logs to console)
5. **Add Optimistic Updates**: Implement optimistic UI updates for better UX
6. **Error Handling**: Add toast notifications for errors instead of inline messages

## Testing

To test the store:

```typescript
// In a component
import { useProjectStore } from '@/store/useProjectStore';

function MyComponent() {
  const { projects, currentProject, setCurrentProject } = useProjectStore();

  // Use the store...
}
```

## Type Safety

All store operations are fully type-safe:
- Parameter types are enforced
- Return types are inferred correctly
- No `any` types used
- Matches Prisma schema exactly
