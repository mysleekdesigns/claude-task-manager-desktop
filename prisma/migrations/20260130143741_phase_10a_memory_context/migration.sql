-- CreateTable
CREATE TABLE "ProjectContext" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "claudeMd" TEXT,
    "techStack" TEXT NOT NULL DEFAULT '[]',
    "keyFiles" TEXT NOT NULL DEFAULT '[]',
    "lastScanned" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectContext_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "terminalId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Memory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Memory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Memory" ("content", "createdAt", "id", "metadata", "projectId", "title", "type", "updatedAt") SELECT "content", "createdAt", "id", "metadata", "projectId", "title", "type", "updatedAt" FROM "Memory";
DROP TABLE "Memory";
ALTER TABLE "new_Memory" RENAME TO "Memory";
CREATE INDEX "Memory_projectId_idx" ON "Memory"("projectId");
CREATE INDEX "Memory_taskId_idx" ON "Memory"("taskId");
CREATE INDEX "Memory_type_idx" ON "Memory"("type");
CREATE INDEX "Memory_source_idx" ON "Memory"("source");
CREATE INDEX "Memory_isArchived_idx" ON "Memory"("isArchived");
CREATE INDEX "Memory_createdAt_idx" ON "Memory"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ProjectContext_projectId_key" ON "ProjectContext"("projectId");

-- CreateIndex
CREATE INDEX "ProjectContext_projectId_idx" ON "ProjectContext"("projectId");

-- CreateIndex
CREATE INDEX "ProjectContext_lastScanned_idx" ON "ProjectContext"("lastScanned");
