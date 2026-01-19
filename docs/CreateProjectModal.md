# CreateProjectModal Component

## Overview

The `CreateProjectModal` component is a reusable dialog for creating new projects in the Claude Tasks Desktop application. It provides a user-friendly form with validation and IPC integration for project creation.

## Location

```
src/components/projects/CreateProjectModal.tsx
src/components/projects/index.ts
```

## Features

- **Form Fields:**
  - Project Name (required, min 2 characters)
  - Description (optional, textarea)
  - Project Directory (optional, with native file picker)
  - GitHub Repository URL (optional, validated)

- **Validation:**
  - Project name required and length validation
  - GitHub URL format validation (must be a valid GitHub URL)
  - Real-time error feedback

- **IPC Integration:**
  - Uses `useIPCMutation('dialog:openDirectory')` for native file picker
  - Uses `useIPCMutation('projects:create')` for project creation
  - Gets current user from `useAuth()` hook

- **UX Features:**
  - Loading states on buttons
  - Success toast notification
  - Error toast on failure
  - Form reset on close
  - Clear button for directory selection

## Usage

### Basic Example

```tsx
import { useState } from 'react';
import { CreateProjectModal } from '@/components/projects';
import { Button } from '@/components/ui/button';

function ProjectsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  const handleProjectCreated = (project) => {
    console.log('New project created:', project);
    // Navigate to project or refresh list
  };

  return (
    <div>
      <Button onClick={() => setModalOpen(true)}>
        Create Project
      </Button>

      <CreateProjectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleProjectCreated}
      />
    </div>
  );
}
```

### With Dialog Trigger

```tsx
import { CreateProjectModal } from '@/components/projects';
import { DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

function ProjectsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <DialogTrigger asChild>
        <Button onClick={() => setModalOpen(true)}>
          New Project
        </Button>
      </DialogTrigger>

      <CreateProjectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={(project) => {
          // Redirect to project page
          navigate(`/projects/${project.id}`);
        }}
      />
    </>
  );
}
```

## Props

### CreateProjectModalProps

```typescript
interface CreateProjectModalProps {
  /**
   * Controls whether the modal is open
   */
  open: boolean;

  /**
   * Callback fired when the modal open state changes
   * @param open - New open state
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Optional callback fired when a project is successfully created
   * @param project - The newly created project
   */
  onSuccess?: (project: Project) => void;
}
```

## Dependencies

### UI Components
- `@/components/ui/dialog` - Modal container
- `@/components/ui/button` - Action buttons
- `@/components/ui/input` - Text inputs
- `@/components/ui/label` - Form labels
- `@/components/ui/textarea` - Description field

### Hooks
- `@/hooks/useIPC` - IPC mutation hook
- `@/hooks/useAuth` - Authentication context

### Icons
- `lucide-react` - Folder, X icons

### Toast
- `sonner` - Toast notifications

## IPC Channels Used

### dialog:openDirectory
Opens the native directory picker dialog.

**Parameters:**
```typescript
{
  title?: string;
  buttonLabel?: string;
}
```

**Returns:**
```typescript
{
  canceled: boolean;
  filePaths: string[];
}
```

### projects:create
Creates a new project in the database.

**Parameters:**
```typescript
{
  name: string;
  description?: string;
  targetPath?: string;
  githubRepo?: string;
  ownerId: string;
}
```

**Returns:**
```typescript
{
  id: string;
  name: string;
  description: string | null;
  targetPath: string | null;
  githubRepo: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## Validation Rules

### Project Name
- Required field
- Minimum 2 characters
- Whitespace is trimmed

### GitHub Repository
- Optional field
- Must match pattern: `https?://(www.)?github.com/[\w-]+/[\w.-]+`
- Examples:
  - ✅ `https://github.com/owner/repo`
  - ✅ `http://github.com/owner/repo-name`
  - ❌ `github.com/owner/repo` (missing protocol)
  - ❌ `https://gitlab.com/owner/repo` (not GitHub)

## Form Behavior

### On Submit
1. Validates all fields
2. Gets current user ID from auth context
3. Calls `projects:create` IPC handler
4. Shows success toast
5. Calls `onSuccess` callback with new project
6. Resets form
7. Closes modal

### On Cancel
1. Resets all form fields
2. Clears all errors
3. Closes modal

### On Close (X button)
Same as Cancel

## Error Handling

- Form validation errors display inline below fields
- IPC errors show as toast notifications
- Loading states prevent duplicate submissions
- Directory picker errors are logged and toasted

## Styling

Uses shadcn/ui components with Tailwind CSS classes. Follows the New York style variant.

### Key Classes
- Error borders: `border-destructive`
- Error text: `text-destructive`
- Required indicator: `text-destructive` (asterisk)

## Type Safety

The component uses TypeScript with strict mode and benefits from:
- Type-safe IPC calls via `useIPCMutation`
- Typed form data with `CreateProjectInput`
- Typed project response with `Project`
- Typed auth context with `AuthUser`

## Future Enhancements

Potential improvements:
- Project template selection
- Auto-detect Git repository from selected directory
- Project color/icon selection
- Duplicate project name detection
- Integration with GitHub API to validate repository exists
