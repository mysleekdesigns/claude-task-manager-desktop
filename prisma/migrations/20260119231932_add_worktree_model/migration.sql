-- CreateTable
CREATE TABLE "Worktree" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Worktree_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Terminal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "pid" INTEGER,
    "projectId" TEXT NOT NULL,
    "worktreeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Terminal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Terminal_worktreeId_fkey" FOREIGN KEY ("worktreeId") REFERENCES "Worktree" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Terminal" ("createdAt", "id", "name", "pid", "projectId", "status", "updatedAt", "worktreeId") SELECT "createdAt", "id", "name", "pid", "projectId", "status", "updatedAt", "worktreeId" FROM "Terminal";
DROP TABLE "Terminal";
ALTER TABLE "new_Terminal" RENAME TO "Terminal";
CREATE INDEX "Terminal_projectId_idx" ON "Terminal"("projectId");
CREATE INDEX "Terminal_worktreeId_idx" ON "Terminal"("worktreeId");
CREATE INDEX "Terminal_status_idx" ON "Terminal"("status");
CREATE INDEX "Terminal_createdAt_idx" ON "Terminal"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Worktree_projectId_idx" ON "Worktree"("projectId");

-- CreateIndex
CREATE INDEX "Worktree_branch_idx" ON "Worktree"("branch");

-- CreateIndex
CREATE INDEX "Worktree_createdAt_idx" ON "Worktree"("createdAt");
