-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "claudeStartedAt" DATETIME,
    "claudeCompletedAt" DATETIME,
    "claudeStatus" TEXT NOT NULL DEFAULT 'IDLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("assigneeId", "branchName", "createdAt", "description", "id", "parentId", "priority", "projectId", "status", "tags", "title", "updatedAt") SELECT "assigneeId", "branchName", "createdAt", "description", "id", "parentId", "priority", "projectId", "status", "tags", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_priority_idx" ON "Task"("priority");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");
CREATE INDEX "Task_claudeStatus_idx" ON "Task"("claudeStatus");
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");
CREATE TABLE "new_Terminal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "pid" INTEGER,
    "projectId" TEXT NOT NULL,
    "worktreeId" TEXT,
    "taskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Terminal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Terminal_worktreeId_fkey" FOREIGN KEY ("worktreeId") REFERENCES "Worktree" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Terminal_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Terminal" ("createdAt", "id", "name", "pid", "projectId", "status", "updatedAt", "worktreeId") SELECT "createdAt", "id", "name", "pid", "projectId", "status", "updatedAt", "worktreeId" FROM "Terminal";
DROP TABLE "Terminal";
ALTER TABLE "new_Terminal" RENAME TO "Terminal";
CREATE INDEX "Terminal_projectId_idx" ON "Terminal"("projectId");
CREATE INDEX "Terminal_worktreeId_idx" ON "Terminal"("worktreeId");
CREATE INDEX "Terminal_taskId_idx" ON "Terminal"("taskId");
CREATE INDEX "Terminal_status_idx" ON "Terminal"("status");
CREATE INDEX "Terminal_createdAt_idx" ON "Terminal"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
