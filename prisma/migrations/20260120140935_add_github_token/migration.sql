-- CreateTable
CREATE TABLE "GitHubToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "lastValidatedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GitHubToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GitHubToken_userId_idx" ON "GitHubToken"("userId");

-- CreateIndex
CREATE INDEX "GitHubToken_isValid_idx" ON "GitHubToken"("isValid");

-- CreateIndex
CREATE INDEX "GitHubToken_createdAt_idx" ON "GitHubToken"("createdAt");
