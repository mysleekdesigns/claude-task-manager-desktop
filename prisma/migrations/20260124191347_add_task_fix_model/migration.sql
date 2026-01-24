-- CreateTable
CREATE TABLE "TaskFix" (
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
    CONSTRAINT "TaskFix_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TaskFix_taskId_idx" ON "TaskFix"("taskId");

-- CreateIndex
CREATE INDEX "TaskFix_status_idx" ON "TaskFix"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskFix_taskId_fixType_key" ON "TaskFix"("taskId", "fixType");
