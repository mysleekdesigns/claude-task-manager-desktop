-- CreateTable
CREATE TABLE "McpConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "McpConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "McpConfig_projectId_idx" ON "McpConfig"("projectId");

-- CreateIndex
CREATE INDEX "McpConfig_type_idx" ON "McpConfig"("type");

-- CreateIndex
CREATE INDEX "McpConfig_createdAt_idx" ON "McpConfig"("createdAt");
