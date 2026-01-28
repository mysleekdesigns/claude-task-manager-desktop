# Soft Deletes Implementation

Phase 18.6 - Soft Deletes for Synced Models

## Overview

Soft deletes allow records to be marked as deleted without physically removing them from the database. This supports:

- **Undo functionality**: Accidentally deleted records can be restored
- **Sync conflict resolution**: Handle cases where one user deletes while another edits
- **Data recovery**: Records are preserved until permanent cleanup
- **Audit trail**: Track when records were deleted

## Models with Soft Delete Support

The following models support soft deletes:

- **Project** - Soft deleting a project also soft deletes all its tasks and members
- **Task** - Soft deleting a task also soft deletes all its subtasks
- **ProjectMember** - Individual membership records

## Schema Changes

Each model has a new `deletedAt` field:

```prisma
model Project {
  // ... other fields
  deletedAt DateTime? // When set, record is considered soft-deleted

  @@index([deletedAt])
}
```

## Usage

### Service Layer

The `softDeleteService` provides all soft delete operations:

```typescript
import { softDeleteService } from '../services/soft-delete';

// Soft delete a record
const result = await softDeleteService.softDelete('Project', projectId);

// Restore a soft-deleted record
const result = await softDeleteService.restore('Project', projectId);

// Permanently delete a record
const result = await softDeleteService.permanentDelete('Project', projectId);

// Clean up old deleted records (older than 30 days)
const result = await softDeleteService.cleanupOldDeleted(30);

// List all soft-deleted records
const deleted = await softDeleteService.listDeleted({ table: 'Task' });

// Check if a record is deleted
const isDeleted = await softDeleteService.isDeleted('Task', taskId);
```

### Query Filters

Use the exported filter helpers in Prisma queries:

```typescript
import { notDeleted, onlyDeleted, includeDeleted } from '../services/soft-delete';

// Exclude soft-deleted records (most common)
const activeProjects = await prisma.project.findMany({
  where: {
    ...notDeleted,
    userId: someUserId,
  },
});

// Query only deleted records (for "trash" view)
const deletedProjects = await prisma.project.findMany({
  where: onlyDeleted,
});

// Include all records regardless of deletion status
const allProjects = await prisma.project.findMany({
  where: includeDeleted,
});
```

### IPC Handlers

The following IPC channels are available for soft delete operations:

| Channel | Description |
|---------|-------------|
| `softDelete:delete` | Soft delete a record |
| `softDelete:restore` | Restore a soft-deleted record |
| `softDelete:permanentDelete` | Permanently delete a record |
| `softDelete:cleanup` | Clean up old deleted records |
| `softDelete:list` | List soft-deleted records |
| `softDelete:isDeleted` | Check if a record is soft-deleted |

Example usage from renderer:

```typescript
// Soft delete a project
const result = await invoke('softDelete:delete', 'Project', projectId);

// Restore a deleted task
const result = await invoke('softDelete:restore', 'Task', taskId);
```

## Sync Integration

### Outbound Sync (Local to Supabase)

When a record is soft deleted locally:
1. The `deletedAt` timestamp is set
2. An UPDATE operation is queued to sync `deleted_at` to Supabase
3. Other clients receive the update and mark their local copies as deleted

### Inbound Sync (Supabase to Local)

When receiving sync data from Supabase:
1. The `deleted_at` field is mapped to local `deletedAt`
2. If remote has `deleted_at` set, local record is marked deleted
3. Conflict resolution applies (e.g., if local edit vs remote delete)

### Delete vs Edit Conflict

When one user deletes a record while another edits it:
- If `remote_wins`: The record stays deleted
- If `local_wins`: The edit is preserved, record is not deleted
- Conflicts are logged to `ConflictLog` table

## Cascading Behavior

### Project Deletion
When a project is soft deleted:
- All tasks in the project are soft deleted (same `deletedAt`)
- All project members are soft deleted (same `deletedAt`)

### Project Restoration
When a project is restored:
- Tasks deleted at the same time are restored
- Members deleted at the same time are restored

### Task Deletion
When a task is soft deleted:
- All subtasks are soft deleted (same `deletedAt`)

### Task Restoration
When a task is restored:
- Subtasks deleted at the same time are restored
- Cannot restore if parent project is deleted

## Cleanup

To prevent database bloat, periodically clean up old soft-deleted records:

```typescript
// Clean up records deleted more than 30 days ago
const result = await softDeleteService.cleanupOldDeleted(30);

console.log(`Permanently deleted ${result.deletedCount} records`);
```

This should be run periodically (e.g., on app startup or via scheduled task).

## Files Modified

### New Files
- `electron/services/soft-delete.ts` - Soft delete service
- `electron/ipc/soft-delete.ts` - IPC handlers for soft delete
- `prisma/migrations/YYYYMMDD_add_soft_delete_fields/` - Database migration

### Updated Files
- `prisma/schema.prisma` - Added `deletedAt` fields and indexes
- `electron/ipc/projects.ts` - Use soft delete for project deletion
- `electron/ipc/tasks.ts` - Use soft delete for task deletion
- `electron/services/sync-engine.ts` - Handle `deleted_at` in sync
- `electron/services/index.ts` - Export soft delete service
- `electron/ipc/index.ts` - Register soft delete handlers

## Testing Checklist

- [ ] Soft delete a project and verify tasks/members are also deleted
- [ ] Restore a project and verify tasks/members are restored
- [ ] Soft delete a task with subtasks
- [ ] Verify deleted records don't appear in normal queries
- [ ] Verify deleted records appear when using `onlyDeleted` filter
- [ ] Test sync of soft deletes between clients
- [ ] Test cleanup of old deleted records
- [ ] Test conflict resolution for delete vs edit scenarios
