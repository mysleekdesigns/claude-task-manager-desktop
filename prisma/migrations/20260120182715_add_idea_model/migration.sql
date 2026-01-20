-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Idea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Idea_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChangelogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "type" TEXT NOT NULL DEFAULT 'FEATURE',
    "taskId" TEXT,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChangelogEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChangelogEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Idea_projectId_idx" ON "Idea"("projectId");

-- CreateIndex
CREATE INDEX "Idea_status_idx" ON "Idea"("status");

-- CreateIndex
CREATE INDEX "Idea_createdById_idx" ON "Idea"("createdById");

-- CreateIndex
CREATE INDEX "Idea_votes_idx" ON "Idea"("votes");

-- CreateIndex
CREATE INDEX "Idea_createdAt_idx" ON "Idea"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChangelogEntry_taskId_key" ON "ChangelogEntry"("taskId");

-- CreateIndex
CREATE INDEX "ChangelogEntry_projectId_idx" ON "ChangelogEntry"("projectId");

-- CreateIndex
CREATE INDEX "ChangelogEntry_type_idx" ON "ChangelogEntry"("type");

-- CreateIndex
CREATE INDEX "ChangelogEntry_version_idx" ON "ChangelogEntry"("version");

-- CreateIndex
CREATE INDEX "ChangelogEntry_createdAt_idx" ON "ChangelogEntry"("createdAt");
