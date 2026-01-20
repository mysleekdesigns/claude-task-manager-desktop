/**
 * Prisma 7 Configuration File
 *
 * This file configures Prisma CLI commands (migrate, studio, etc.)
 * The runtime adapter is configured in electron/services/database.ts
 *
 * URL resolution:
 * - DATABASE_URL env var is set by the app for runtime migrations
 * - For development, use: DATABASE_URL=file:./prisma/dev.db npx prisma migrate dev
 */

import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
