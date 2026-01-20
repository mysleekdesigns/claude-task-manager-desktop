-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "claudeApiKey" TEXT,
    "githubToken" TEXT,
    "defaultTerminalCount" INTEGER NOT NULL DEFAULT 2,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "keyboardShortcuts" TEXT,
    "autoLaunchClaude" BOOLEAN NOT NULL DEFAULT true,
    "minimizeToTray" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "UserSettings_userId_idx" ON "UserSettings"("userId");
