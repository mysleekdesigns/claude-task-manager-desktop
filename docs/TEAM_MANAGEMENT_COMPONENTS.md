# Team Management UI Components

## Overview

Three React components for managing project team members with role-based access control.

Created: 2026-01-19

## Components Created

### 1. TeamMembersList.tsx
**Location:** `/Users/simonlacey/Documents/GitHub/mcp/claude-task-manager-desktop/src/components/projects/TeamMembersList.tsx`

**Purpose:** Displays list of project team members with management controls.

**Props:**
- `projectId: string` - Project identifier
- `members: ProjectMember[]` - Array of team members
- `currentUserId: string` - Current user's ID
- `currentUserRole: ProjectRole` - Current user's role
- `onMemberChange?: () => void` - Callback when members change

**Features:**
- Avatar display with initials fallback
- Role badges (color-coded):
  - Owner: Purple
  - Admin: Blue
  - Member: Green
  - Viewer: Gray
- Role change dropdown (for Owners/Admins)
- Remove member button (for Owners/Admins)
- Permissions:
  - Can't change own role
  - Can't change or remove Owner
  - Only Owner/Admin can manage members

**IPC Mutations:**
- `projects:updateMemberRole` - Update member role
- `projects:removeMember` - Remove member from project

---

### 2. InviteMemberModal.tsx
**Location:** `/Users/simonlacey/Documents/GitHub/mcp/claude-task-manager-desktop/src/components/projects/InviteMemberModal.tsx`

**Purpose:** Modal dialog for inviting new members to a project.

**Props:**
- `open: boolean` - Modal open state
- `onOpenChange: (open: boolean) => void` - Open state change handler
- `projectId: string` - Project identifier
- `onSuccess?: () => void` - Success callback

**Features:**
- Email search for existing users
- User preview with avatar and details
- Role selector (Admin, Member, Viewer)
- Role descriptions in dropdown
- Email validation
- User not found error handling
- Search on blur or button click

**IPC Mutations:**
- `users:findByEmail` - Search for user by email
- `projects:addMember` - Add member to project

**Form Fields:**
- Email input with search button
- Role selector dropdown
- User preview card (when found)

---

### 3. TeamManagementSection.tsx
**Location:** `/Users/simonlacey/Documents/GitHub/mcp/claude-task-manager-desktop/src/components/projects/TeamManagementSection.tsx`

**Purpose:** Complete team management section combining list and invite modal.

**Props:**
- `projectId: string` - Project identifier
- `members: ProjectMember[]` - Array of team members
- `currentUserId: string` - Current user's ID
- `onMembersChange?: () => void` - Callback when members change

**Features:**
- Card layout with header
- Member count display
- "Invite Member" button (Owner/Admin only)
- Integrates TeamMembersList and InviteMemberModal
- Auto-detects current user role
- Handles member list refresh

**UI Components:**
- Card container
- Team members icon
- Invite button with icon
- Member count badge

---

## Type Definitions

### ProjectRole
```typescript
type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
```

### ProjectMember
```typescript
interface ProjectMember {
  id: string;
  role: ProjectRole;
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

---

## IPC Channels Added

### users:findByEmail
**Type Definition:** `src/types/ipc.ts`

```typescript
'users:findByEmail': (email: string) => Promise<AuthUser | null>;
```

Added to `IpcChannels` interface and `VALID_INVOKE_CHANNELS` array.

---

## Dependencies

### UI Components (shadcn/ui)
- Avatar, AvatarFallback, AvatarImage
- Badge
- Button
- Card, CardContent, CardDescription, CardHeader, CardTitle
- Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
- Input
- Label
- Select, SelectContent, SelectItem, SelectTrigger, SelectValue

### Icons (lucide-react)
- Trash2
- Search
- UserPlus
- AlertCircle
- Users

### Hooks
- `useIPCMutation` from `@/hooks/useIPC`

### Toast
- `sonner` for toast notifications

---

## Usage Example

```tsx
import { TeamManagementSection } from '@/components/projects';

function ProjectSettings({ projectId }: { projectId: string }) {
  const { data: project } = useIPCQuery('projects:get', [projectId]);
  const { data: currentUser } = useIPCQuery('auth:getCurrentUser');

  if (!project || !currentUser) return null;

  return (
    <div className="space-y-6">
      <TeamManagementSection
        projectId={projectId}
        members={project.members || []}
        currentUserId={currentUser.id}
        onMembersChange={() => {
          // Refetch project data
        }}
      />
    </div>
  );
}
```

---

## Permission Rules

### Can Manage Members
- Owner: ✓
- Admin: ✓
- Member: ✗
- Viewer: ✗

### Can Change Roles
- Owner can change: Admin, Member, Viewer
- Admin can change: Admin, Member, Viewer
- Cannot change: Own role, Owner role

### Can Remove Members
- Owner can remove: Admin, Member, Viewer
- Admin can remove: Admin, Member, Viewer
- Cannot remove: Self, Owner

### Can Invite Members
- Owner: ✓
- Admin: ✓
- Member: ✗
- Viewer: ✗

---

## Toast Notifications

### Success Messages
- "Member role updated successfully"
- "{userName} removed from project"
- "{userName} added to project"

### Error Messages
- "Failed to update member role"
- "Failed to remove member"
- "Failed to add member to project"
- "User not found with this email address"
- "Please enter an email address"
- "Please enter a valid email address"

---

## File Structure

```
src/components/projects/
├── index.ts                    # Barrel export
├── TeamMembersList.tsx         # Member list component
├── InviteMemberModal.tsx       # Invite modal component
└── TeamManagementSection.tsx   # Combined section component
```

---

## Notes

- All components use type-safe IPC hooks
- Role colors are implemented with custom Tailwind classes
- Email validation uses regex pattern
- User search triggers on blur or button click
- Components handle loading states during IPC operations
- Error handling with toast notifications
- TypeScript strict mode compliant
