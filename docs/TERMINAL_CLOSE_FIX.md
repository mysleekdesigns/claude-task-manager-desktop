# Terminal Close Functionality Fix

## Problem

Terminals would not close when the close button was clicked on the Agent Terminals page. The terminal would remain visible in the UI even after clicking the close button.

## Root Cause

The issue was in the IPC handler for `terminal:close` in `/electron/ipc/terminals.ts`. When a terminal was closed:

1. The terminal process was correctly killed via `terminalManager.kill(id)`
2. However, the database record was only **updated** (status set to 'idle') instead of being **deleted**
3. When the UI refetched the terminal list, the closed terminal would still appear because it still existed in the database

## Solution

### Backend Changes (electron/ipc/terminals.ts)

1. **Modified `handleCloseTerminal` function** (lines 196-231):
   - Changed from `prisma.terminal.update()` to `prisma.terminal.delete()`
   - Now completely removes the terminal from the database when closed

2. **Modified terminal spawn `onExit` handler** (lines 92-110):
   - Changed from `prisma.terminal.update()` to `prisma.terminal.delete()`
   - Now handles both manual close (via close button) and natural exit (process terminated)
   - Added error filtering to ignore "Record not found" errors (when terminal was already deleted via close button)

### Frontend Changes (src/routes/terminals.tsx)

**Modified `handleCloseTerminal` function** (lines 136-154):
- Moved the expanded state reset to happen before the IPC call for better UX
- Added clearer comments explaining the flow
- Maintained the same error handling

## Technical Details

### Previous Behavior
```typescript
// Database was updated but record remained
await prisma.terminal.update({
  where: { id },
  data: {
    status: 'idle',
    pid: null,
  },
});
```

### New Behavior
```typescript
// Terminal is completely deleted from database
await prisma.terminal.delete({
  where: { id },
});
```

## Edge Cases Handled

1. **Manual close via button**: Terminal is deleted immediately when user clicks close button
2. **Natural process exit**: Terminal is deleted when the process exits on its own
3. **Race condition**: If both close button AND process exit happen simultaneously, the second delete operation will fail gracefully with a "Record not found" error that is caught and filtered

## Files Modified

1. `/electron/ipc/terminals.ts` - IPC handler for terminal operations
2. `/src/routes/terminals.tsx` - Main terminals page component

## Testing Recommendations

1. Create a terminal and click the close button - terminal should disappear immediately
2. Create a terminal, run a command, wait for it to exit - terminal should disappear
3. Create multiple terminals and close them one by one - all should close properly
4. Expand a terminal and close it - should collapse and close properly
5. Close a terminal while it's running a process - should show confirmation dialog and close properly

## Related Code

- Terminal Manager: `/electron/services/terminal.ts`
- XTerm Wrapper: `/src/components/terminal/XTermWrapper.tsx`
- Terminal Pane: `/src/components/terminal/TerminalPane.tsx`
- IPC Types: `/src/types/ipc.ts`

## Future Improvements

Consider adding:
- Optimistic UI updates (remove terminal from UI before IPC call completes)
- Animation for terminal removal
- Undo functionality for accidental closes
- Option to preserve terminal history in database for later viewing
