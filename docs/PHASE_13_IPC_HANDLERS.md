# Phase 13 IPC Handlers Implementation

## Overview

This document summarizes the implementation of IPC handlers for Ideas, Changelog, and Insights features as part of Phase 13.

## Files Created

### 1. Ideas IPC Handlers (`electron/ipc/ideas.ts`)

Implements the following IPC channels:

- `ideas:list` - List ideas for a project with optional status filter
  - Parameters: `projectId: string`, `filters?: { status?: IdeaStatus }`
  - Returns: Array of ideas with creator and project relations
  - Ordered by votes (descending) then creation date (descending)

- `ideas:create` - Create a new idea
  - Parameters: `{ title, description?, projectId, createdById }`
  - Returns: Created idea with relations
  - Validates required fields (title, projectId, createdById)

- `ideas:update` - Update an idea
  - Parameters: `id: string`, `{ title?, description?, status? }`
  - Returns: Updated idea with relations
  - Supports partial updates

- `ideas:delete` - Delete an idea
  - Parameters: `id: string`
  - Returns: void
  - Cascades delete via Prisma schema

- `ideas:vote` - Upvote or downvote an idea
  - Parameters: `id: string`, `increment: boolean = true`
  - Returns: Updated idea with new vote count
  - Uses Prisma's atomic increment/decrement

- `ideas:convertToFeature` - Convert an idea to a feature
  - Parameters: `{ ideaId, priority, phaseId? }`
  - Returns: `{ idea, feature }` - both updated/created records
  - Uses Prisma transaction to ensure atomicity
  - Sets idea status to 'CONVERTED'
  - Creates new Feature with same title/description

### 2. Changelog IPC Handlers (`electron/ipc/changelog.ts`)

Implements the following IPC channels:

- `changelog:list` - List changelog entries for a project
  - Parameters: `projectId: string`
  - Returns: Array of changelog entries with task and project relations
  - Ordered by creation date (descending)

- `changelog:create` - Create a manual changelog entry
  - Parameters: `{ title, description?, version?, type?, projectId, taskId? }`
  - Returns: Created entry with relations
  - Defaults type to 'FEATURE' if not specified

- `changelog:update` - Update a changelog entry
  - Parameters: `id: string`, `{ title?, description?, version?, type? }`
  - Returns: Updated entry with relations
  - Supports partial updates

- `changelog:delete` - Delete a changelog entry
  - Parameters: `id: string`
  - Returns: void

- `changelog:generateFromTask` - Auto-generate entry from completed task
  - Parameters: `taskId: string`, `version?: string`
  - Returns: Generated changelog entry
  - Prevents duplicate entries (checks if task already has changelog)
  - Intelligently determines type from task tags:
    - `bug` or `fix` → FIX
    - `breaking` or `breaking-change` → BREAKING
    - `improvement` or `enhancement` → IMPROVEMENT
    - Default → FEATURE

- `changelog:export` - Export changelog as markdown
  - Parameters: `projectId: string`, `version?: string`
  - Returns: Markdown string
  - Groups entries by type (Breaking, Features, Improvements, Fixes)
  - Includes emoji icons for each section
  - Optionally filters by version

### 3. Insights IPC Handlers (`electron/ipc/insights.ts`)

Note: This file already existed with a different implementation. The existing implementation was kept.

Implements the following IPC channels:

- `insights:getTaskMetrics` - Get task completion statistics
  - Parameters: `projectId: string`
  - Returns: Task metrics including:
    - Total task count
    - Tasks completed this week/month
    - Tasks grouped by status
    - Tasks grouped by priority

- `insights:getTimeMetrics` - Get average task duration and time per phase
  - Parameters: `projectId: string`
  - Returns: Time metrics including:
    - Average task duration (milliseconds)
    - Average time per phase
    - Total completed tasks count

- `insights:getProductivityTrends` - Get completion trends over time
  - Parameters: `projectId: string`, `daysBack: number = 30`
  - Returns: Productivity trends including:
    - Completions by day
    - Completions by week
    - Completions by month

## Database Changes

### Updated Prisma Schema

Added `ChangelogEntry` relation to the `Project` model:

```prisma
model Project {
  // ... existing fields
  changelogEntries ChangelogEntry[]
}
```

Added `changelogEntry` relation to the `Task` model:

```prisma
model Task {
  // ... existing fields
  changelogEntry ChangelogEntry?
}
```

The `ChangelogEntry` model and `ChangelogEntryType` enum already existed in the schema (added in a previous phase):

```prisma
enum ChangelogEntryType {
  FEATURE
  FIX
  IMPROVEMENT
  BREAKING
}

model ChangelogEntry {
  id          String             @id @default(cuid())
  title       String
  description String?
  version     String?
  type        ChangelogEntryType @default(FEATURE)
  taskId      String?            @unique
  projectId   String
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  project     Project            @relation(fields: [projectId], references: [id], onDelete: Cascade)
  task        Task?              @relation(fields: [taskId], references: [id], onDelete: SetNull)

  @@index([projectId])
  @@index([type])
  @@index([version])
  @@index([createdAt])
}
```

## IPC Registration

Updated `electron/ipc/index.ts` to register the new handlers:

```typescript
import { registerIdeaHandlers, unregisterIdeaHandlers } from './ideas.js';
import { registerChangelogHandlers, unregisterChangelogHandlers } from './changelog.js';

// In registerIPCHandlers():
registerIdeaHandlers();
registerChangelogHandlers();

// In unregisterIPCHandlers():
unregisterIdeaHandlers();
unregisterChangelogHandlers();
```

## Implementation Patterns

All IPC handlers follow the established patterns:

1. **Type Safety**: Explicit type definitions for inputs and outputs
2. **Error Handling**: Uses `wrapHandler` and `IPCErrors` utilities
3. **Logging**: Wrapped with `wrapWithLogging` for request/response/error logging
4. **Validation**: Input validation with meaningful error messages
5. **Serialization**: Returns JSON-serializable data (no Prisma instances)
6. **Database Service**: Uses centralized `databaseService.getClient()`
7. **Transactions**: Uses Prisma transactions for multi-step operations
8. **Relations**: Includes relevant relations in responses

## Next Steps

To complete Phase 13, the following frontend work is needed:

1. Add IPC channel type definitions to `src/types/ipc.ts`
2. Fix existing TypeScript errors in frontend components:
   - `src/components/ideation/AddIdeaModal.tsx`
   - `src/components/ideation/IdeaCard.tsx`
   - `src/hooks/useIdeas.ts`
   - `src/routes/ideation.tsx`
   - `src/routes/insights.tsx`

3. Create Prisma migration for the schema changes:
   ```bash
   npx prisma migrate dev --name add-changelog-relations
   ```

## Testing

To test the IPC handlers:

1. Run the migration to update the database schema
2. Start the Electron app in development mode
3. Use the frontend UI to interact with Ideas, Changelog, and Insights features
4. Check the IPC logs in the console for request/response details

## Files Modified

- `/Users/simonlacey/Documents/GitHub/mcp/claude-task-manager-desktop/electron/ipc/ideas.ts` (created)
- `/Users/simonlacey/Documents/GitHub/mcp/claude-task-manager-desktop/electron/ipc/changelog.ts` (created)
- `/Users/simonlacey/Documents/GitHub/mcp/claude-task-manager-desktop/electron/ipc/insights.ts` (existing, no changes needed)
- `/Users/simonlacey/Documents/GitHub/mcp/claude-task-manager-desktop/electron/ipc/index.ts` (updated)
- `/Users/simonlacey/Documents/GitHub/mcp/claude-task-manager-desktop/prisma/schema.prisma` (updated)
