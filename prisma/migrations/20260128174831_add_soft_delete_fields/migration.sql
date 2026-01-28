-- AlterTable
ALTER TABLE "Project" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "deletedAt" DATETIME;

-- CreateTable
CREATE TABLE "ConflictLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "table" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "localVersion" INTEGER NOT NULL,
    "remoteVersion" INTEGER NOT NULL,
    "resolution" TEXT NOT NULL,
    "localData" TEXT NOT NULL,
    "remoteData" TEXT NOT NULL,
    "resolvedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ConflictLog_table_idx" ON "ConflictLog"("table");

-- CreateIndex
CREATE INDEX "ConflictLog_recordId_idx" ON "ConflictLog"("recordId");

-- CreateIndex
CREATE INDEX "ConflictLog_resolution_idx" ON "ConflictLog"("resolution");

-- CreateIndex
CREATE INDEX "ConflictLog_createdAt_idx" ON "ConflictLog"("createdAt");

-- CreateIndex
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- CreateIndex
CREATE INDEX "ProjectMember_deletedAt_idx" ON "ProjectMember"("deletedAt");

-- CreateIndex
CREATE INDEX "Task_deletedAt_idx" ON "Task"("deletedAt");
