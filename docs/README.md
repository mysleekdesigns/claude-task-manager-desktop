# Documentation

This directory contains comprehensive documentation for the Claude Tasks Desktop application, organized by topic.

## Quick Start

New to the project? Start here:
- [NATIVE_MODULES_CHECKLIST.md](../NATIVE_MODULES_CHECKLIST.md) - Quick reference if you're experiencing native module issues

## Building & Distribution

### Native Module Configuration
- **[NATIVE_MODULES_FIX.md](NATIVE_MODULES_FIX.md)** - Problem explanation and solution for node-pty loading
- **[NATIVE_MODULES_ARCHITECTURE.md](NATIVE_MODULES_ARCHITECTURE.md)** - Deep technical explanation of how native modules work
- **[NATIVE_MODULES_FLOW_DIAGRAM.md](NATIVE_MODULES_FLOW_DIAGRAM.md)** - Visual flowcharts showing module loading at each stage

### Testing & Verification
- **[TESTING_NATIVE_MODULES.md](TESTING_NATIVE_MODULES.md)** - Step-by-step testing procedures and diagnostic commands
- **[NEXT_STEPS.md](NEXT_STEPS.md)** - Implementation and deployment guide

### Summaries
- **[FIX_SUMMARY_NODE_PTY.md](FIX_SUMMARY_NODE_PTY.md)** - Executive summary of all changes

## Development

### Setup
```bash
# Clean install (recommended)
rm -rf node_modules package-lock.json
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package
```

### Database Migrations
```bash
# Create a new migration
npx prisma migrate dev --name <migration_name>

# View database (Prisma Studio)
npx prisma studio

# Generate Prisma client
npx prisma generate
```

### Common Tasks
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build for production |
| `npm run package` | Create distributable packages |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Lint code |
| `npm run format` | Format code |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |

## Architecture

### Technology Stack
- **Framework**: Electron 35.x + Vite 6.x + React 19.x
- **Language**: TypeScript 5.9 (strict mode)
- **Database**: SQLite + Prisma 7.x
- **UI**: Tailwind CSS 4.x + shadcn/ui + Radix UI
- **Terminal**: xterm.js + node-pty
- **Drag & Drop**: @dnd-kit/core
- **State**: Zustand
- **Packaging**: electron-builder 26.x

### Process Model
- **Main Process** (`electron/`) - Node.js runtime, database, terminals, git
- **Renderer Process** (`src/`) - React UI in Chromium, communicates via IPC

## Key Features

### Terminal Emulation
- Uses node-pty for cross-platform terminal spawning
- Supports macOS, Windows, and Linux shells
- Real-time terminal output streaming via IPC
- See: [Terminal Components](terminal-components.md)

### Project Management
- Create and manage multiple projects
- File system integration with native dialogs
- Git worktree support

### Task Management
- Kanban board with drag-and-drop (Phase 6)
- Task phases and progress tracking
- Integration with Claude Code sessions

### Database
- SQLite embedded in app
- Prisma ORM for type-safe queries
- User data stored in `~/.claude-tasks/`

## Important Notes

### SQLite Limitations
JSON arrays are stored as strings in the database:
```typescript
// In schema
tags String @default("[]")

// In code
const parsed = JSON.parse(task.tags || '[]')
const stringified = JSON.stringify(newTags)
```

### Native Modules
- node-pty and better-sqlite3 are externalized from Vite bundling
- See [NATIVE_MODULES_ARCHITECTURE.md](NATIVE_MODULES_ARCHITECTURE.md) for details
- Configure via vite.config.ts and electron-builder.yml

### IPC Communication
All renderer-to-main communication is type-safe:
```typescript
// Main process handler
ipcMain.handle('tasks:list', async (_, projectId: string) => {
  return prisma.task.findMany({ where: { projectId } });
});

// Renderer process
const tasks = await invoke('tasks:list', projectId);
```

## Troubleshooting

### Native Module Errors
```bash
npm run build:natives
npm run dev
```
See [TESTING_NATIVE_MODULES.md](TESTING_NATIVE_MODULES.md) for detailed diagnostics.

### Database Issues
```bash
# Regenerate Prisma client
npx prisma generate

# Reset database (development only)
rm ~/.claude-tasks/app.db
npm run dev
```

### Build Failures
```bash
# Clean rebuild
rm -rf dist dist-electron node_modules package-lock.json
npm install
npm run build
```

## File Organization

```
claude-task-manager-desktop/
├── electron/          # Main process code
│   ├── ipc/          # IPC handlers by domain
│   ├── services/     # Business logic (database, terminal, auth)
│   ├── utils/        # Utilities
│   ├── main.ts       # Entry point
│   └── preload.ts    # Preload script (security boundary)
├── src/              # Renderer process (React)
│   ├── components/   # Reusable components
│   ├── pages/        # Page components
│   ├── hooks/        # Custom React hooks
│   ├── lib/          # Utilities
│   ├── types/        # TypeScript types
│   └── App.tsx       # Root component
├── prisma/           # Database schema and migrations
├── docs/             # Documentation
├── build/            # Build assets (icons, entitlements)
├── vite.config.ts    # Vite configuration
├── electron-builder.yml  # Packaging configuration
└── tsconfig.json     # TypeScript configuration
```

## Release Process

1. **Testing** - Run all tests and verify functionality
2. **Build** - `npm run build`
3. **Package** - `npm run package`
4. **Release** - Tag version and create GitHub release
5. **Auto-Update** - Users receive update notification

See [FIX_SUMMARY_NODE_PTY.md](FIX_SUMMARY_NODE_PTY.md) for deployment details.

## Getting Help

### For Development Issues
- Check the technology docs above
- Review code examples in electron/ and src/
- See CLAUDE.md in project root for role definitions

### For Native Module Issues
- Start with [NATIVE_MODULES_CHECKLIST.md](../NATIVE_MODULES_CHECKLIST.md)
- Read [NATIVE_MODULES_FIX.md](NATIVE_MODULES_FIX.md)
- Run diagnostic commands in [TESTING_NATIVE_MODULES.md](TESTING_NATIVE_MODULES.md)

### For Build/Packaging Issues
- Check [electron-builder documentation](https://www.electron.build/)
- Verify platform-specific requirements (code signing, etc.)
- Review [NEXT_STEPS.md](NEXT_STEPS.md) troubleshooting section

## Additional Resources

### External Documentation
- [Electron Documentation](https://www.electronjs.org/docs)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### Useful Tools
- VS Code Extensions: ESLint, Prettier, Tailwind CSS IntelliSense
- Debugging: Chrome DevTools (built into Electron)
- Database: Prisma Studio (`npx prisma studio`)

---

Last updated: 2026-01-19
