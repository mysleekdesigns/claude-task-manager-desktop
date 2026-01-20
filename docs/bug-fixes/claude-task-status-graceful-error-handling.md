# Bug Fix: Graceful Error Handling for Claude Task Status

**Date:** 2026-01-20
**Issue:** IPC error "Task not found" in `claude:getTaskStatus` handler
**Severity:** Medium (user-facing console errors)

## Problem

The `claude:getTaskStatus` and `claude:getActiveTask` IPC handlers were throwing errors when a task was not found in the database. This caused issues in several scenarios:

1. **Status polling after task deletion**: The `useClaudeStatusPolling` hook polls every 2 seconds, but if a task is deleted, subsequent polls would throw "Task not found" errors
2. **Race conditions**: The frontend might query status before a task is fully created
3. **Console noise**: Error messages appeared in console even though this is a normal edge case

### Error Message
```
[22:46:50.557] IPC ERR claude:getTaskStatus (<1ms) Task not found
Error occurred in handler for 'claude:getTaskStatus': IPCError: Task not found
```

## Root Cause

In `electron/ipc/claude-code.ts`, both handlers threw errors when a task was not found:

```typescript
// Old code (lines 381-383)
if (!task) {
  throw new Error('Task not found');  // ❌ Throws error
}
```

This approach was too strict for a status polling endpoint that is expected to handle missing tasks gracefully.

## Solution

Changed both handlers to return graceful default responses instead of throwing errors:

### `handleGetTaskStatus` (lines 381-389)
```typescript
if (!task) {
  // Return graceful default response instead of throwing
  // This prevents status polling from crashing when task is deleted
  return {
    isRunning: false,
    terminalId: null,
    sessionId: null,
  };
}
```

### `handleGetActiveTask` (lines 432-443)
```typescript
if (!task) {
  // Return graceful default response instead of throwing
  // This prevents status polling from crashing when task is deleted
  return {
    isRunning: false,
    terminalId: null,
    sessionId: null,
    claudeStatus: 'IDLE' as ClaudeTaskStatus,
    startedAt: null,
    completedAt: null,
  };
}
```

## Benefits

1. **No more console errors**: Status polling silently handles deleted tasks
2. **Automatic poll termination**: The `useClaudeStatusPolling` hook already checks `isRunning: false` and stops polling
3. **Better UX**: No user-facing error messages for normal edge cases
4. **Consistent pattern**: Both status handlers use the same graceful error handling

## Frontend Impact

No changes needed in the frontend. The existing polling logic in `useClaudeStatusPolling` already handles this correctly:

```typescript
// src/hooks/useClaudeStatus.ts:79-84
const shouldPoll =
  statusQuery.data.isRunning ||
  (statusQuery.data as any).status === 'STARTING' ||
  // ... other active states

// When task is deleted, isRunning = false, so polling stops automatically
```

## Files Changed

- `electron/ipc/claude-code.ts`
  - Modified `handleGetTaskStatus` function (lines 365-404)
  - Modified `handleGetActiveTask` function (lines 409-457)

## Testing

Verified with TypeScript type checking:
```bash
npm run typecheck  # ✅ Passes
```

### Manual Testing Scenarios

1. **Task deletion during polling**: Create task → Start Claude → Delete task while running → No errors
2. **Quick status check**: Query status of non-existent task ID → Returns idle status
3. **Normal operation**: Start/pause/resume Claude Code → Status polling works correctly

## Related Files

- `src/hooks/useClaudeStatus.ts` - Status polling hook (no changes needed)
- `src/components/kanban/TaskCardStartButton.tsx` - Uses status polling (no changes needed)
- `electron/utils/ipc-logger.ts` - Logs IPC requests/responses

## Conclusion

This fix follows the principle of **graceful degradation** for status endpoints. Rather than treating a missing task as an error, we return a sensible default state that indicates the task is not running. This is the correct behavior for polling endpoints that may be called after a resource is deleted.
