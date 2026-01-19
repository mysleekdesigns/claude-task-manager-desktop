# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Tasks Desktop is a cross-platform Electron desktop application for managing AI-driven development tasks with Claude Code. It enables managing multiple Claude Code terminal sessions, tracking tasks through AI-assisted workflows, and maintaining project context across sessions.

**Status:** Pre-implementation (architecture planning complete). See `PRDdesktop.md` for full requirements.

## Technology Stack

- **Framework:** Electron 35.x + Vite 6.x + React 19.x
- **Language:** TypeScript 5.9 (strict mode)
- **Database:** SQLite + better-sqlite3 + Prisma 7.x
- **UI:** Tailwind CSS 4.x + shadcn/ui + Radix UI
- **Terminal:** @xterm/xterm + node-pty
- **Git:** simple-git
- **State:** Zustand 5.x
- **Routing:** React Router 7.x
- **Drag & Drop:** @dnd-kit/core 6.x
- **Packaging:** electron-builder 26.x

## Build Commands

```bash
npm run dev       # Start development mode (Electron + Vite hot reload)
npm run build     # Build for production
npm run package   # Create distributable packages (.dmg/.exe/.AppImage)
npm test          # Run unit tests (Vitest)
npm run test:e2e  # Run E2E tests (Playwright)
npm run typecheck # TypeScript type checking
```

### Database Commands
```bash
npx prisma migrate dev --name <name>  # Create migration
npx prisma migrate deploy             # Apply migrations (production)
npx prisma generate                   # Generate Prisma client
npx prisma studio                     # Open database browser
```

## Architecture

### Process Model

Electron two-process architecture:

1. **Main Process** (`electron/`) - Node.js runtime handling database, terminal management (node-pty), git operations, file system access
2. **Renderer Process** (`src/`) - React UI in Chromium, communicates via IPC

### IPC Communication

All renderer-to-main communication uses type-safe IPC:

```typescript
// Main: electron/ipc/tasks.ts
ipcMain.handle('tasks:list', async (_, projectId: string) => {
  return prisma.task.findMany({ where: { projectId } });
});

// Renderer: via useIPC hook
const tasks = await invoke('tasks:list', projectId);
```

Push events (terminal output) use `webContents.send()` → `window.electron.on()`.

### Database

SQLite with Prisma ORM. Database stored in user data directory (`app.getPath('userData')`).

**SQLite constraint:** JSON arrays stored as strings (e.g., `tags: String @default("[]")`).

Key models: User, Session, Project, ProjectMember, Task, TaskPhase, Terminal, Worktree, Memory, McpConfig, Feature, Phase.

## Implementation Phases

The PRD defines 15 phases:

1. Project foundation (Electron + Vite + React + shadcn/ui + IPC)
2. Database (SQLite + Prisma, User/Project models)
3. Auth (bcrypt, session management, protected routes)
4. Layout (Sidebar, Header, React Router, keyboard shortcuts)
5. Projects (native file dialogs, team management)
6. Tasks (Kanban board with @dnd-kit)
7. Terminals (node-pty + xterm.js, Claude Code integration)
8. Git worktrees (simple-git)
9-15. Roadmap, Memory, MCP, GitHub, Insights, Settings, Distribution

## Key Patterns

- Use `dialog.showOpenDialog()` for directory/file selection
- Terminal processes spawn in main process, output streamed via IPC
- Auto-updater configured for GitHub Releases
- macOS requires code signing and notarization
