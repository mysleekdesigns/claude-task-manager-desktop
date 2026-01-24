-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TaskFix" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "fixType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "findings" TEXT NOT NULL DEFAULT '[]',
    "patch" TEXT,
    "researchNotes" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "preFixScore" INTEGER,
    "postFixScore" INTEGER,
    "scoreImprovement" INTEGER,
    "verificationSummary" TEXT,
    "postFixFindings" TEXT NOT NULL DEFAULT '[]',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" DATETIME,
    CONSTRAINT "TaskFix_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TaskFix" ("completedAt", "createdAt", "findings", "fixType", "id", "patch", "researchNotes", "startedAt", "status", "summary", "taskId", "updatedAt") SELECT "completedAt", "createdAt", "findings", "fixType", "id", "patch", "researchNotes", "startedAt", "status", "summary", "taskId", "updatedAt" FROM "TaskFix";
DROP TABLE "TaskFix";
ALTER TABLE "new_TaskFix" RENAME TO "TaskFix";
CREATE INDEX "TaskFix_taskId_idx" ON "TaskFix"("taskId");
CREATE INDEX "TaskFix_status_idx" ON "TaskFix"("status");
CREATE UNIQUE INDEX "TaskFix_taskId_fixType_key" ON "TaskFix"("taskId", "fixType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
