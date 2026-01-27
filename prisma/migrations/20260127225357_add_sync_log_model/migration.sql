-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "table" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "synced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" DATETIME,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetPath" TEXT,
    "githubRepo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "supabaseId" TEXT,
    "syncVersion" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" DATETIME
);
INSERT INTO "new_Project" ("createdAt", "description", "githubRepo", "id", "name", "targetPath", "updatedAt") SELECT "createdAt", "description", "githubRepo", "id", "name", "targetPath", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");
CREATE INDEX "Project_supabaseId_idx" ON "Project"("supabaseId");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "branchName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "projectId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "parentId" TEXT,
    "claudeSessionId" TEXT,
    "claudeSessionName" TEXT,
    "claudeTerminalId" TEXT,
    "claudeStartedAt" DATETIME,
    "claudeCompletedAt" DATETIME,
    "claudeStatus" TEXT NOT NULL DEFAULT 'IDLE',
    "prdPhaseNumber" INTEGER,
    "prdPhaseName" TEXT,
    "scopedPrdContent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "supabaseId" TEXT,
    "syncVersion" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" DATETIME,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("assigneeId", "branchName", "claudeCompletedAt", "claudeSessionId", "claudeSessionName", "claudeStartedAt", "claudeStatus", "claudeTerminalId", "createdAt", "description", "id", "parentId", "prdPhaseName", "prdPhaseNumber", "priority", "projectId", "scopedPrdContent", "status", "tags", "title", "updatedAt") SELECT "assigneeId", "branchName", "claudeCompletedAt", "claudeSessionId", "claudeSessionName", "claudeStartedAt", "claudeStatus", "claudeTerminalId", "createdAt", "description", "id", "parentId", "prdPhaseName", "prdPhaseNumber", "priority", "projectId", "scopedPrdContent", "status", "tags", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_priority_idx" ON "Task"("priority");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");
CREATE INDEX "Task_claudeStatus_idx" ON "Task"("claudeStatus");
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");
CREATE INDEX "Task_supabaseId_idx" ON "Task"("supabaseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SyncLog_synced_idx" ON "SyncLog"("synced");

-- CreateIndex
CREATE INDEX "SyncLog_table_idx" ON "SyncLog"("table");

-- CreateIndex
CREATE INDEX "SyncLog_createdAt_idx" ON "SyncLog"("createdAt");
