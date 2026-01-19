# Project Settings Page

## Overview

The Project Settings page (`src/routes/project-settings.tsx`) provides a comprehensive interface for managing project configuration. It allows users to update project details, configure directories, integrate with GitHub, and delete projects.

## File Location

```
src/routes/project-settings.tsx
```

## Route Configuration

- **Path:** `/project-settings/:projectId`
- **Layout:** MainLayout (with sidebar)
- **Authentication:** Protected route (requires authentication)

## Features

### 1. General Settings Card
- **Project Name:** Editable text input for project name
- **Description:** Multi-line textarea for project description
- **Validation:** Name field is required (cannot be empty)
- **Save Button:** Updates project name and description

### 2. Directory Settings Card
- **Current Directory Display:** Read-only input showing current project path
- **Change Directory Button:** Opens native file picker dialog
- **Fallback:** Shows "No directory set" when no path is configured
- **Native Integration:** Uses Electron's `dialog:openDirectory` IPC channel

### 3. GitHub Integration Card
- **Repository URL Input:** Text field for GitHub repository URL
- **Placeholder:** Shows expected URL format (`https://github.com/username/repository`)
- **Help Text:** Descriptive text below input explaining usage
- **Save Button:** Updates GitHub repository URL

### 4. Danger Zone Card
- **Visual Distinction:** Red border to indicate destructive actions
- **Delete Project Button:** Opens confirmation dialog before deletion
- **Warning Message:** Clear description of permanent deletion consequences
- **Confirmation Dialog:** Two-step confirmation process
- **Post-Delete Navigation:** Redirects to `/kanban` after successful deletion

## State Management

### Data Fetching
```typescript
useIPCQuery('projects:get', [projectId])
```
- Fetches project data on mount
- Shows loading skeleton while loading
- Handles error states (project not found)

### Mutations
```typescript
useIPCMutation('projects:update')  // Update project settings
useIPCMutation('projects:delete')  // Delete project
useIPCMutation('dialog:openDirectory')  // Open directory picker
```

### Local State
- `name`: Project name (string)
- `description`: Project description (string)
- `githubRepo`: GitHub repository URL (string)
- `deleteDialogOpen`: Dialog visibility (boolean)

## User Experience

### Loading States
- **Initial Load:** Full-page skeleton while fetching project data
- **Button States:** Buttons show loading text during mutations
  - "Saving..." during updates
  - "Opening..." during directory selection
  - "Deleting..." during deletion

### Error Handling
- **Project Not Found:** Shows error message with navigation back to dashboard
- **Mutation Errors:** Toast notifications for all error states
- **Network Errors:** Gracefully handled with user-friendly messages

### Success Feedback
- Toast notifications for successful operations:
  - "Project settings updated successfully"
  - "Project directory updated successfully"
  - "GitHub repository updated successfully"
  - "Project deleted successfully"

## TypeScript Types

### IPC Channels Used
```typescript
'projects:get': (id: string) => Promise<Project | null>
'projects:update': (id: string, data: UpdateProjectInput) => Promise<Project>
'projects:delete': (id: string) => Promise<void>
'dialog:openDirectory': (options?: OpenDirectoryOptions) => Promise<OpenDirectoryResult>
```

### Input Types
```typescript
interface UpdateProjectInput {
  name?: string;
  description?: string;
  targetPath?: string;
  githubRepo?: string;
}
```

## Validation

- **Name Field:** Required, must not be empty after trimming
- **Description:** Optional, no validation
- **GitHub URL:** Optional, no format validation (allows flexibility)
- **Directory Path:** Validated by Electron's file picker

## Security Considerations

- All IPC calls use type-safe channels defined in `src/types/ipc.ts`
- Project ID from route params is validated before use
- User confirmation required before destructive delete operation
- No direct file system access from renderer process

## Accessibility

- Proper label associations for all form inputs
- Keyboard navigation support (native to shadcn/ui components)
- Clear focus indicators
- Descriptive button labels
- Semantic HTML structure

## Related Files

### Type Definitions
- `src/types/ipc.ts` - IPC channel types and interfaces
  - Added `Project`, `ProjectMember`, `UpdateProjectInput` types
  - Added project IPC channel definitions

### Routes
- `src/routes/routes.tsx` - Route configuration
- `src/routes/index.ts` - Route exports

### IPC Handlers
- `electron/ipc/projects.ts` - Main process handlers for project operations

### Components Used
- `@/components/ui/card` - Card layout components
- `@/components/ui/button` - Action buttons
- `@/components/ui/input` - Text inputs
- `@/components/ui/label` - Form labels
- `@/components/ui/textarea` - Multi-line text input
- `@/components/ui/dialog` - Confirmation modal
- `@/components/ui/separator` - Visual dividers
- `sonner` - Toast notifications

### Hooks
- `useIPCQuery` - Query hook for fetching project data
- `useIPCMutation` - Mutation hook for updating/deleting
- `useParams` - React Router hook for route parameters
- `useNavigate` - React Router hook for navigation

## Future Enhancements

Potential improvements for future iterations:

1. **GitHub URL Validation:** Regex validation for GitHub URLs
2. **Auto-save:** Debounced auto-save for form fields
3. **Undo Delete:** Soft delete with recovery period
4. **More Integrations:** GitLab, Bitbucket support
5. **Directory Validation:** Check if directory exists and is accessible
6. **Project Templates:** Apply settings from templates
7. **Export/Import:** Export project configuration as JSON
8. **Activity Log:** Show recent changes to project settings

## Testing Considerations

When testing this page:

1. Test with valid and invalid project IDs
2. Test network error scenarios
3. Test with very long project names/descriptions
4. Test directory picker cancellation
5. Test delete dialog cancellation
6. Verify navigation after deletion
7. Test concurrent updates (optimistic locking)
8. Test with projects that have no directory set
