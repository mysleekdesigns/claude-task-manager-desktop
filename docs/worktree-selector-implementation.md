# Worktree Selector Implementation

**Phase 8.4c: Worktree Selector for Terminal Panes**

## Overview

This implementation adds worktree selection functionality to terminal panes, allowing users to change the working directory of a running terminal to any available git worktree.

## Components Created

### 1. WorktreeSelector Component

**Location:** `src/components/worktrees/WorktreeSelector.tsx`

A compact dropdown selector for choosing worktrees in terminal headers.

**Features:**
- Fetches worktrees list from `worktrees:list` IPC
- Shows worktree name, branch, and path
- Includes "Project Root" option for default working directory
- Compact design optimized for terminal header (size='sm')
- Loading and error states
- Graceful handling of null worktrees

**Props:**
```typescript
interface WorktreeSelectorProps {
  projectId: string;
  value: string | null | undefined;     // Current worktreeId
  onChange: (worktreeId: string | null, path: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'default';              // Compact for terminal header
  showLabel?: boolean;
}
```

**UI Components Used:**
- `Select` with `SelectTrigger`, `SelectContent`, `SelectItem`
- `Badge` for branch and main worktree indicators
- `GitBranch` and `Folder` icons from lucide-react

## Integration

### 2. TerminalPane Component Updates

**Location:** `src/components/terminal/TerminalPane.tsx`

**Changes:**
- Added `projectId` prop (required for fetching worktrees)
- Added `worktreeId` to terminal prop interface
- Added `onWorktreeChange` callback prop
- Replaced placeholder worktree dropdown with `WorktreeSelector`
- Removed unused `GitBranch` import (now in WorktreeSelector)

**New Props:**
```typescript
export interface TerminalPaneProps {
  terminal: {
    id: string;
    name: string;
    status: 'idle' | 'running' | 'exited';
    claudeStatus?: 'inactive' | 'active' | 'waiting';
    worktreeId?: string | null;          // NEW
  };
  projectId: string;                      // NEW
  onWorktreeChange?: (                   // NEW
    terminalId: string,
    worktreeId: string | null,
    path: string
  ) => void;
  // ... existing props
}
```

### 3. Terminals Page Updates

**Location:** `src/routes/terminals.tsx`

**Changes:**
- Added `handleWorktreeChange` handler
- Passes `projectId` to all `TerminalPane` instances
- Passes `worktreeId` from terminal data
- Passes `onWorktreeChange` callback

**Handler Implementation:**
```typescript
const handleWorktreeChange = useCallback(
  async (terminalId: string, worktreeId: string | null, path: string) => {
    if (!currentProject) return;

    try {
      // Send cd command to change terminal's working directory
      if (path) {
        await writeTerminalMutation.mutate({
          id: terminalId,
          data: `cd "${path}"\n`,
        });
      } else {
        // Default to project root
        if (currentProject.targetPath) {
          await writeTerminalMutation.mutate({
            id: terminalId,
            data: `cd "${currentProject.targetPath}"\n`,
          });
        }
      }

      console.log(`Terminal ${terminalId} changed to worktree ${worktreeId || 'default'}`);
    } catch (err) {
      console.error('Failed to change worktree:', err);
      alert('Failed to change worktree. Please try again.');
    }
  },
  [writeTerminalMutation, currentProject]
);
```

## Behavior

### Worktree Changing Mechanism

Currently uses **Option B: Send `cd` command** approach:

1. User selects a worktree from the dropdown
2. `onChange` callback fires with worktreeId and path
3. Handler sends `cd "<path>"\n` to the terminal via `terminal:write` IPC
4. Terminal process changes working directory
5. Subsequent commands run in the new directory

**Alternative (Future Enhancement):**
Option A would kill and respawn the terminal in the new directory, but this would lose terminal history and running processes.

### UI States

1. **Default State**: Shows "Project Root" with folder icon
2. **Worktree Selected**: Shows worktree name, branch badge, and truncated path
3. **Loading State**: Shows "Loading..." with git branch icon
4. **Error State**: Shows error indicator with alert icon
5. **Disabled State**: Selector disabled when terminal status is not 'running'

### Worktree Display

Each worktree option shows:
- Worktree name (primary text)
- Branch name (in badge)
- "Main" badge (if isMain is true)
- Truncated path (shows last 2 segments)
- Full path on hover (tooltip)

## Future Enhancements

### Recommended IPC Handler Addition

Add `terminal:update` handler to persist worktree association:

```typescript
// electron/ipc/terminals.ts
async function handleUpdateTerminal(
  _event: IpcMainInvokeEvent,
  data: { id: string; worktreeId?: string | null; name?: string }
): Promise<Terminal> {
  const prisma = databaseService.getClient();

  return prisma.terminal.update({
    where: { id: data.id },
    data: {
      worktreeId: data.worktreeId,
      name: data.name,
    },
  });
}
```

This would allow:
1. Persisting worktree association in database
2. Restoring terminal to correct worktree on app restart
3. Better tracking of which terminals are using which worktrees

### Other Possible Enhancements

1. **Visual Indicator**: Show current working directory in terminal header
2. **Recent Worktrees**: Show recently used worktrees at the top
3. **Create New Worktree**: Add quick-create option in dropdown
4. **Branch Sync Status**: Show git status (ahead/behind) for each worktree
5. **Multi-Select**: Allow applying worktree change to multiple terminals at once

## Testing Checklist

- [ ] Selector appears in terminal header
- [ ] "Project Root" option is always available
- [ ] Worktrees are fetched and displayed correctly
- [ ] Branch badges show correct branch names
- [ ] Path truncation works for long paths
- [ ] Full path visible on hover
- [ ] Changing worktree sends cd command
- [ ] Terminal working directory actually changes
- [ ] Disabled when terminal is not running
- [ ] Loading state shows during fetch
- [ ] Error state shows on fetch failure
- [ ] Empty state message when no worktrees exist
- [ ] Works in both expanded and grid views
- [ ] No memory leaks or performance issues

## File Changes Summary

**New Files:**
- `src/components/worktrees/WorktreeSelector.tsx` (216 lines)

**Modified Files:**
- `src/components/worktrees/index.ts` (added export)
- `src/components/terminal/TerminalPane.tsx` (added projectId, worktreeId, onWorktreeChange)
- `src/routes/terminals.tsx` (added handleWorktreeChange, passed new props)

**No Changes Required:**
- `electron/ipc/terminals.ts` (uses existing terminal:write handler)
- `electron/ipc/worktrees.ts` (existing worktrees:list handler used)

## Dependencies

**IPC Calls Used:**
- `worktrees:list` - Fetch worktrees for project
- `terminal:write` - Send cd command to terminal

**UI Components Used:**
- shadcn/ui: Select, Badge
- lucide-react: GitBranch, Folder, AlertCircle
- Custom: useIPCQuery hook

## Notes

1. **Terminal Status Check**: Selector is disabled when terminal status is not 'running' to prevent cd commands to inactive terminals.

2. **Path Quoting**: Paths are wrapped in double quotes in cd command to handle spaces: `cd "${path}"`

3. **Null Safety**: All null checks in place for worktrees array, currentProject, and optional values.

4. **TypeScript Strict Mode**: Implementation passes strict TypeScript checks with `exactOptionalPropertyTypes: true`.

5. **Backwards Compatible**: Worktrees are optional - terminals work fine without them (defaults to project root).

6. **Performance**: Worktree list is cached by React Query, minimal re-fetching.
