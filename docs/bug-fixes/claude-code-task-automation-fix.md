# Claude Code Task Automation Bug Fix

## Issue Summary

Critical bug in Claude Code task automation where:
1. Database status gets updated to `IN_PROGRESS`/`RUNNING` before terminal spawns
2. Terminal doesn't spawn or exits immediately without proper error handling
3. Tasks stuck showing "Running" after restart with no terminal
4. Pause button fails because terminal doesn't exist

## Root Causes

### 1. Database Updated Before Terminal Spawn
**File:** `/electron/ipc/claude-code.ts` (line 136-147)

The database was updated to `RUNNING` status **before** the terminal was spawned. If spawning failed, the database was never rolled back, leaving the task in an inconsistent state.

### 2. No Error Handling in ClaudeCodeService
**File:** `/electron/services/claude-code.ts` (line 88-131)

The `startTask` method had no try-catch wrapper. If `terminalManager.spawn()` failed, the error propagated without cleanup or logging.

### 3. UI Relied on Database Status Only
**File:** `/src/components/kanban/TaskCardStartButton.tsx` (line 55-60)

The UI component used `claudeStatus` from the database but never validated if the terminal actually exists using `isRunning` from `claude:getTaskStatus`.

### 4. No Recovery Mechanism
After app restart, tasks stuck in `RUNNING` state had no way to reset or recover.

## Fixes Applied

### Fix 1: Database Rollback on Terminal Spawn Failure
**File:** `/electron/ipc/claude-code.ts`

**Changes:**
- Set status to `STARTING` before spawning terminal
- Wrap `claudeCodeService.startTask()` in try-catch
- On success: Update to `RUNNING`
- On failure: Rollback to `FAILED` with completion timestamp
- Log errors to task logs for debugging

**Code:**
```typescript
// Update task status to STARTING before spawning terminal
await prisma.task.update({
  where: { id: data.taskId },
  data: {
    claudeStatus: 'STARTING',
    claudeSessionId: data.sessionId,
  },
});

let result;
try {
  // Start the Claude Code task
  result = await claudeCodeService.startTask(options, mainWindow);

  // Update task with all Claude-related fields after successful spawn
  await prisma.task.update({
    where: { id: data.taskId },
    data: {
      status: 'IN_PROGRESS',
      claudeStatus: 'RUNNING',
      claudeStartedAt: new Date(),
    },
  });

  // ... log success ...
} catch (error) {
  // Rollback database status if terminal spawn fails
  await prisma.task.update({
    where: { id: data.taskId },
    data: {
      claudeStatus: 'FAILED',
      claudeCompletedAt: new Date(),
    },
  });

  // Log the error
  await prisma.taskLog.create({
    data: {
      taskId: data.taskId,
      type: 'error',
      message: 'Failed to start Claude Code automation',
      metadata: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: data.sessionId,
      }),
    },
  });

  throw new Error(`Failed to start Claude Code: ${error.message}`);
}
```

### Fix 2: Error Handling in ClaudeCodeService
**File:** `/electron/services/claude-code.ts`

**Changes:**
- Wrap entire `startTask` method in try-catch
- Clean up terminal if spawn succeeds but later steps fail
- Log errors with context
- Throw descriptive errors

**Code:**
```typescript
async startTask(
  options: ClaudeCodeOptions,
  mainWindow: BrowserWindow
): Promise<ClaudeCodeStartResult> {
  const terminalId = `claude-${options.taskId}`;

  try {
    // ... spawn terminal and write commands ...

    console.log(
      `[ClaudeCodeService] Successfully started Claude Code for task ${options.taskId}`
    );

    return { terminalId, sessionId: options.sessionId };
  } catch (error) {
    console.error(
      `[ClaudeCodeService] Failed to start Claude Code for task ${options.taskId}:`,
      error
    );

    // Clean up terminal if it was created
    if (terminalManager.has(terminalId)) {
      try {
        terminalManager.kill(terminalId);
      } catch (killError) {
        console.error(`[ClaudeCodeService] Failed to clean up terminal:`, killError);
      }
    }

    throw new Error(
      `Failed to start Claude Code: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
```

### Fix 3: UI State Mismatch Detection
**File:** `/src/components/kanban/TaskCardStartButton.tsx`

**Changes:**
- Query actual terminal running status from `claude:getTaskStatus`
- Compare database status with terminal status
- Detect state mismatch when DB says `RUNNING` but terminal isn't running
- Show "Reset" button when mismatch detected
- Only show "Pause" when terminal is actually running

**Code:**
```typescript
// Get current Claude status from task database
const claudeStatusFromDB: ClaudeTaskStatus = getClaudeStatusFromTask(task);

// Get actual runtime status (is terminal actually running?)
const isTerminalRunning = statusData?.isRunning || false;

// Detect state mismatch: database says RUNNING but terminal isn't running
const hasStateMismatch =
  (claudeStatusFromDB === 'RUNNING' || claudeStatusFromDB === 'STARTING') &&
  !isTerminalRunning &&
  statusData !== undefined;

// Determine the effective Claude status
const claudeStatus: ClaudeTaskStatus = hasStateMismatch ? 'FAILED' : claudeStatusFromDB;

// Show Reset button when there's a state mismatch
if (hasStateMismatch) {
  return (
    <Button onClick={handleReset} disabled={isResetting}>
      <RefreshCw className={isResetting ? 'animate-spin' : ''} />
      Reset
    </Button>
  );
}

// Show Pause button when Claude is running (and terminal actually exists)
if ((claudeStatus === 'RUNNING' || claudeStatus === 'AWAITING_INPUT') && isTerminalRunning) {
  return <Button onClick={handlePause}>Pause</Button>;
}
```

### Fix 4: Reset/Recovery Mechanism
**File:** `/src/components/kanban/TaskCardStartButton.tsx`

**Changes:**
- Added `handleReset` function to reset stuck tasks
- Updates database status back to `IDLE`
- Sets `claudeCompletedAt` timestamp
- Shows user-friendly success/error messages

**Code:**
```typescript
const handleReset = async (e: React.MouseEvent) => {
  e.stopPropagation();

  setIsResetting(true);
  try {
    // Reset the task status in the database
    const { invoke } = window.electron;
    await invoke('tasks:update', task.id, {
      claudeStatus: 'IDLE',
      claudeCompletedAt: new Date().toISOString(),
    });

    toast.success('Task status reset successfully');

    // Refresh status after reset
    setTimeout(() => refetchStatus(), 500);
  } catch (err) {
    console.error('Failed to reset task status:', err);
    toast.error('Failed to reset task status');
  } finally {
    setIsResetting(false);
  }
};
```

### Fix 5: Enhanced Error Messages
**File:** `/src/components/kanban/TaskCardStartButton.tsx`

**Changes:**
- Show actual error messages from backend in toasts
- Trigger status refresh after errors
- Detect terminal-not-found errors and auto-refresh

**Code:**
```typescript
try {
  await startTask({ ... });
  toast.success('Claude Code session started');
} catch (err) {
  const errorMessage = err instanceof Error
    ? err.message
    : 'Failed to start Claude Code session';
  toast.error(errorMessage);

  // Refresh status to show the actual state after error
  setTimeout(() => refetchStatus(), 100);
}
```

## Testing

### Before Fix
1. Click "Start" on a task
2. Database updates to `RUNNING`
3. Terminal spawn fails (e.g., wrong directory)
4. Task stuck in `RUNNING` state forever
5. Pause button shows but fails when clicked
6. After restart, still shows "Running" with no way to recover

### After Fix
1. Click "Start" on a task
2. Database updates to `STARTING`
3. If terminal spawn fails:
   - Database rolls back to `FAILED`
   - Error message shown in toast
   - Error logged to task logs
   - Terminal cleaned up if partially created
4. If spawn succeeds:
   - Database updates to `RUNNING`
   - Terminal actually running
   - Pause button works correctly
5. After restart, if database says `RUNNING` but terminal isn't:
   - "Reset" button shown instead of "Pause"
   - User can reset the task status
   - Clear error message explains the issue

## Verification Steps

1. **Test successful start:**
   ```
   - Click Start button on a task
   - Verify terminal spawns
   - Verify database status = RUNNING
   - Verify Pause button appears
   - Click Pause, verify it works
   ```

2. **Test failed start (bad project path):**
   ```
   - Set project path to invalid directory
   - Click Start button
   - Verify error toast appears
   - Verify database status = FAILED (not RUNNING)
   - Verify Start button is available again
   ```

3. **Test state mismatch (after restart):**
   ```
   - Start a task successfully
   - Kill the app (not graceful shutdown)
   - Restart the app
   - Verify "Reset" button shows (not "Pause")
   - Click Reset
   - Verify status changes to IDLE
   - Verify Start button available again
   ```

4. **Test Pause with no terminal:**
   ```
   - Manually update DB to RUNNING with no terminal
   - Click Pause button (if it shows)
   - Verify error message shown
   - Verify status refresh triggers
   - Verify Reset button appears
   ```

## Files Modified

1. `/electron/ipc/claude-code.ts` - Database rollback and error handling
2. `/electron/services/claude-code.ts` - Try-catch wrapper and cleanup
3. `/src/components/kanban/TaskCardStartButton.tsx` - State mismatch detection and reset mechanism

## Related Issues

- Terminal spawn failures
- Database inconsistency on errors
- No recovery after app restart
- Poor error visibility for users

## Status

✅ **FIXED** - All changes implemented and ready for testing.
