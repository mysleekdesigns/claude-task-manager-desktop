# Kanban Board Infinite Loop Fix

## Issue
React error: "Maximum update depth exceeded" in the Kanban board, causing the application to crash or freeze.

## Root Cause
The infinite loop was caused by unstable function references and improper useEffect dependencies:

1. **TaskCard.tsx (lines 71-73)**:
   ```tsx
   const handleStatusChange = () => {
     setRefreshKey(prev => prev + 1);
   };
   ```
   - This callback was recreated on every render
   - When passed as `onStateChange` prop, it caused `TaskCardStartButton` to re-render

2. **TaskCardStartButton.tsx (lines 63-65)**:
   ```tsx
   useEffect(() => {
     onStateChange?.();
   }, [claudeStatus, onStateChange]);
   ```
   - `onStateChange` was in the dependency array
   - When the parent's `handleStatusChange` changed, the effect ran
   - This triggered `setRefreshKey`, causing parent re-render
   - **Infinite loop!**

3. **useClaudeStatus.ts (line 96)**:
   ```tsx
   }, [taskId, interval, statusQuery.data, statusQuery]);
   ```
   - Including the entire `statusQuery` object caused unnecessary re-renders
   - `statusQuery` is a new object on every query update

## Solution

### 1. Memoize Callback in TaskCard.tsx
```tsx
// Before
const handleStatusChange = () => {
  setRefreshKey(prev => prev + 1);
};

// After
const handleStatusChange = useCallback(() => {
  setRefreshKey(prev => prev + 1);
}, []);
```
- Used `useCallback` with empty dependencies to create a stable function reference
- Function won't be recreated on re-renders

### 2. Fix Dependency Array in useClaudeStatus.ts
```tsx
// Before
}, [taskId, interval, statusQuery.data, statusQuery]);

// After
}, [taskId, interval, statusQuery.data, statusQuery.refetch]);
```
- Changed from `statusQuery` (unstable object) to `statusQuery.refetch` (stable function)
- `refetch` is memoized by `useCallback` in `useIPCQuery` hook
- Prevents unnecessary effect re-runs

## Files Modified
- `/src/components/kanban/TaskCard.tsx` - Added `useCallback` import and memoized `handleStatusChange`
- `/src/hooks/useClaudeStatus.ts` - Fixed dependency array to use `statusQuery.refetch`

## Verification
After the fix:
- Development server starts without errors
- No "Maximum update depth exceeded" errors in console
- Task cards render correctly with Claude status badges
- Polling works correctly without causing infinite loops

## Prevention
To prevent similar issues:
1. Always memoize callbacks passed as props using `useCallback`
2. Only include primitive values or stable references in useEffect dependencies
3. Avoid including entire objects in dependency arrays - use specific properties or methods
4. Use React DevTools Profiler to detect unnecessary re-renders during development
