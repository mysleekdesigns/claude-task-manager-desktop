# Claude Tasks Desktop - Product Requirements Document

## Desktop Application for AI-Driven Development Task Management

---

## Executive Summary

**Product Name:** Claude Tasks Desktop
**Description:** A cross-platform desktop application for managing AI-driven development tasks with Claude Code. Enables individuals and teams to manage multiple Claude Code terminal sessions, track tasks through AI-assisted workflows, and maintain project context across sessions - all running locally without requiring server infrastructure.

**Target Users:** Developers and teams using Claude Code for AI-assisted development
**Platforms:** macOS, Windows, Linux

---

## Implementation Progress

| Phase | Name | Status |
|-------|------|--------|
| 1 | Project Foundation | ✅ Complete |
| 2 | Database & ORM | ✅ Complete |
| 3 | Authentication System | ✅ Complete |
| 4 | Layout and Navigation | ✅ Complete |
| 5 | Project Management | ✅ Complete |
| 6 | Task Management Core | ✅ Complete |
| 7 | Terminal Management | ✅ Complete |
| 8 | Git Worktree Management | ✅ Complete |
| 9 | Roadmap and Planning | ✅ Complete |
| 10 | Context and Memory | ✅ Complete |
| 11 | MCP Configuration | ✅ Complete |
| 12 | GitHub Integration | ✅ Complete |
| 13 | Additional Features | ✅ Complete |
| 14 | Settings and Preferences | ✅ Complete |
| 15 | Distribution and Packaging | Next |

**Current Status:** Phase 14 complete. Settings and Preferences fully implemented with Settings UI (Profile, API Keys, Preferences, Shortcuts sections), Theme system with database persistence, and ScrollArea for tab content. Ready for Phase 15 (Distribution and Packaging).

## Recent Changes

Latest 5 commits:

1. **455bb4d** - Implement Phase 14: Settings and Preferences
   - Add UserSettings model with Prisma migration
   - Create Settings IPC handlers (get, update, updateApiKey, updateProfile)
   - Build 4 UI section components: ProfileSection, ApiKeysSection, PreferencesSection, ShortcutsSection
   - Implement Theme system with database persistence and system theme detection
   - Add ScrollArea for tab content overflow handling
   - Apply cyan tab styling for active state consistency

2. **3ffae0b** - Add missing Phase 13 IPC channels to preload whitelist

3. **504f871** - Implement Phase 13: Additional Features
   - Insights Dashboard with metrics cards, charts, productivity trends
   - Ideation Board with voting and idea-to-feature conversion
   - Changelog with auto-generation and markdown export
   - Native Features: notifications, enhanced system tray, global keyboard shortcuts

4. **435814b** - Add Prisma 7 documentation and configuration

5. **2ac1504** - Update PRD with Prisma 7 upgrade details

## Implementation Statistics

**Codebase Size:**
- Total IPC Handlers: 75+ across 12 handler files (~4,000 lines)
- React Components: 50+ components
- Database Tables: 14 with 20+ indexes

**IPC Handler Files:**
- `electron/ipc/app.ts` - 192 lines (App lifecycle and window management)
- `electron/ipc/auth.ts` - 461 lines (Authentication and session management)
- `electron/ipc/dialog.ts` - 126 lines (Native file dialogs)
- `electron/ipc/users.ts` - 272 lines (User management)
- `electron/ipc/projects.ts` - 499 lines (Project and team management)
- `electron/ipc/tasks.ts` - 569 lines (Task CRUD and Kanban operations)
- `electron/ipc/terminals.ts` - ~400 lines (Terminal process management with session capture)
- `electron/ipc/worktrees.ts` - ~300 lines (Git worktree and branch operations)
- `electron/ipc/roadmap.ts` - ~350 lines (Phases, features, milestones management)
- `electron/ipc/memories.ts` - ~250 lines (Memory CRUD and search operations)
- `electron/ipc/mcp.ts` - ~350 lines (MCP config management and file generation)
- `electron/ipc/index.ts` - 130 lines (Handler registration and exports)

**Service Files:**
- `electron/services/git.ts` - Git operations using simple-git
- `electron/services/session-capture.ts` - Terminal session insight parsing and capture

**Worktree Components:**
- `src/components/worktrees/WorktreeList.tsx`
- `src/components/worktrees/CreateWorktreeModal.tsx`
- `src/components/worktrees/WorktreeSelector.tsx`

**Roadmap Components:**
- `src/components/roadmap/PhaseCard.tsx`
- `src/components/roadmap/FeatureItem.tsx`
- `src/components/roadmap/AddFeatureModal.tsx`
- `src/components/roadmap/AddPhaseModal.tsx`

**Memory Components:**
- `src/components/memory/MemoryCard.tsx`
- `src/components/memory/AddMemoryModal.tsx`

**MCP Components:**
- `src/components/mcp/McpServerList.tsx`
- `src/components/mcp/McpServerItem.tsx`
- `src/components/mcp/AddCustomServerModal.tsx`

**MCP Service:**
- `electron/services/mcp-config.ts` - MCP config file generation for Claude Desktop

---

## Architecture Overview

### Web to Desktop Transformation

| Layer | Web Application | Desktop Application |
|-------|-----------------|---------------------|
| **Framework** | Next.js 16 (App Router) | Electron + Vite + React |
| **Frontend** | React 19 + TypeScript | React 19 + TypeScript |
| **Backend** | Next.js API Routes | Electron Main Process + IPC |
| **Database** | PostgreSQL (server) | SQLite (embedded) + Prisma |
| **Auth** | Auth.js v5 (OAuth) | Local auth (bcrypt) |
| **Terminal** | WebSocket + node-pty | Electron IPC + node-pty |
| **Git** | simple-git | simple-git (same) |
| **Distribution** | Docker + Server | .dmg / .exe / .AppImage |

### Electron Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Main Process                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │  Database  │  │  Terminal  │  │    Git     │  │   File     │ │
│  │  (SQLite)  │  │  Manager   │  │ Operations │  │   System   │ │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘ │
│         │              │               │               │         │
│         └──────────────┴───────────────┴───────────────┘         │
│                              │                                    │
│                        IPC Bridge                                 │
│                              │                                    │
└──────────────────────────────┼────────────────────────────────────┘
                               │
┌──────────────────────────────┼────────────────────────────────────┐
│                              │                                    │
│                    Renderer Process                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     React Application                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │  Kanban  │  │ Terminal │  │  Roadmap │  │ Settings │   │  │
│  │  │  Board   │  │   Grid   │  │   View   │  │   Page   │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

**What Gets Replaced:**
- PostgreSQL → SQLite (embedded, zero-config)
- Next.js API Routes → Electron IPC handlers
- WebSocket server → Electron IPC channels
- OAuth providers → Local email/password authentication

**What Stays the Same:**
- React 19 frontend components
- Tailwind CSS + shadcn/ui styling
- @dnd-kit drag-and-drop
- node-pty for terminal emulation
- simple-git for git operations
- Multi-user support with team roles

**What Gets Enhanced:**
- Native file dialogs for directory selection
- System tray with quick actions
- Native desktop notifications
- Auto-updater for seamless updates
- Offline-first operation (except GitHub features)
- Better performance (no network latency for local operations)

---

## Technology Stack

| Category | Technology | Version |
|----------|------------|---------|
| **Framework** | Electron | 35.x |
| **Build Tool** | Vite | 6.x |
| **Frontend** | React | 19.x |
| **Language** | TypeScript | 5.9 |
| **Database** | SQLite + better-sqlite3 | 11.x |
| **ORM** | Prisma | 7.x |
| **Authentication** | bcrypt | 5.x |
| **Styling** | Tailwind CSS | 4.x |
| **UI Components** | shadcn/ui | latest |
| **UI Primitives** | Radix UI | latest |
| **Terminal** | @xterm/xterm | 5.5+ |
| **Terminal Backend** | node-pty | 1.1.x |
| **Git Operations** | simple-git | 3.30.x |
| **Drag & Drop** | @dnd-kit/core | 6.x |
| **Routing** | React Router | 7.x |
| **State Management** | Zustand | 5.x |
| **Packaging** | electron-builder | 26.x |
| **Auto Update** | electron-updater | 6.x |

---

## Phase 1: Project Foundation ✅

### 1.1 Electron Project Setup
- [x] Initialize Electron project with Vite and React
- [x] Configure TypeScript 5.9 with strict mode
- [x] Set up electron-builder for packaging
- [x] Configure main process entry point (`electron/main.ts`)
- [x] Configure preload script (`electron/preload.ts`)
- [x] Set up renderer process with Vite (`src/`)
- [x] Configure path aliases (@/ → src/)

### 1.2 Development Environment
- [x] Configure ESLint for Electron + React
- [x] Set up Prettier with consistent formatting
- [x] Configure hot reload for renderer process
- [x] Configure main process restart on change
- [x] Create development scripts in package.json
  - [x] `npm run dev` - Start dev mode
  - [x] `npm run build` - Build for production
  - [x] `npm run package` - Create distributables

### 1.3 Styling Setup
- [x] Install and configure Tailwind CSS v4
- [x] Initialize shadcn/ui with Electron-compatible config
- [x] Install base components (button, card, dialog, input, etc.)
- [x] Configure CSS variables for theming
- [x] Set up dark/light mode support

### 1.4 IPC Communication Layer
- [x] Define IPC channel types in shared types file
- [x] Create type-safe IPC invoke wrapper for renderer
- [x] Create IPC handler registration system for main
- [x] Implement error serialization for IPC
- [x] Add request/response logging for development

### 1.5 Window Management
- [x] Configure main window settings (size, min size, frame)
- [x] Implement window state persistence (position, size)
- [x] Add system tray support with context menu
- [x] Implement minimize to tray option
- [x] Handle window close vs app quit behavior

**Phase 1 Verification:**
- [x] `npm run dev` opens Electron window with React app
- [x] Hot reload works for renderer changes
- [x] Main process restarts on changes
- [x] Tailwind styles render correctly
- [x] shadcn/ui components display properly
- [x] IPC communication works between processes
- [x] System tray appears with menu

---

## Phase 2: Database & ORM ✅

### 2.1 SQLite Setup
- [x] Install better-sqlite3 for native SQLite binding
- [x] Configure database file location (user data directory)
- [x] Create database initialization on first launch
- [x] Implement database path resolution for all platforms

### 2.2 Prisma Configuration
- [x] Install Prisma with SQLite provider
- [x] Configure prisma schema for SQLite compatibility
- [x] Create migration strategy for embedded database
- [x] Set up Prisma Client generation for Electron

### 2.3 User Model
- [x] Create User model
  ```prisma
  model User {
    id            String   @id @default(cuid())
    name          String?
    email         String   @unique
    passwordHash  String
    avatar        String?
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
  }
  ```
- [x] Run initial migration

### 2.4 Project Model
- [x] Create Project model
  ```prisma
  model Project {
    id          String   @id @default(cuid())
    name        String
    description String?
    targetPath  String?
    githubRepo  String?
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
  }
  ```
- [x] Create ProjectMember model with roles (OWNER, ADMIN, MEMBER, VIEWER)
- [x] Run migration

### 2.5 Database Service
- [x] Create database service class in main process
- [x] Implement connection management
- [x] Add migration runner for app updates
- [x] Create database backup/restore utilities
- [x] Expose database operations via IPC

**Phase 2 Verification:**
- [x] Database file created in user data directory
- [x] Prisma Client works in main process
- [x] Users can be created and queried
- [x] Projects can be created and queried
- [x] Migrations apply on app update

---

## Phase 3: Authentication System ✅

### 3.1 Password Authentication
- [x] Install bcrypt for password hashing
- [x] Create password hashing utility
- [x] Create password verification utility
- [x] Implement secure password requirements validation

### 3.2 Session Management
- [x] Create Session model
  ```prisma
  model Session {
    id        String   @id @default(cuid())
    userId    String
    token     String   @unique
    expiresAt DateTime
    createdAt DateTime @default(now())
    user      User     @relation(fields: [userId], references: [id])
  }
  ```
- [x] Generate secure session tokens
- [x] Implement session expiration and renewal
- [x] Store current session in secure electron-store

### 3.3 Auth IPC Handlers
- [x] Create `auth:register` handler
  - [x] Validate email format
  - [x] Check email uniqueness
  - [x] Hash password
  - [x] Create user and session
- [x] Create `auth:login` handler
  - [x] Verify email exists
  - [x] Verify password
  - [x] Create new session
- [x] Create `auth:logout` handler
  - [x] Invalidate current session
  - [x] Clear stored credentials
- [x] Create `auth:getCurrentUser` handler
- [x] Create `auth:updateProfile` handler

### 3.4 Auth Context (Renderer)
- [x] Create AuthContext provider
- [x] Create useAuth hook
- [x] Implement login/logout/register methods
- [x] Handle session persistence across app restarts
- [x] Auto-login from stored session on app launch

### 3.5 Auth UI Components
- [x] Create Login page component
  - [x] Email input
  - [x] Password input
  - [x] Remember me checkbox
  - [x] Login button
  - [x] Link to register
- [x] Create Register page component
  - [x] Name input
  - [x] Email input
  - [x] Password input with requirements
  - [x] Confirm password input
  - [x] Register button
  - [x] Link to login
- [x] Create ProtectedRoute wrapper component

**Phase 3 Verification:**
- [x] User can register with email/password
- [x] User can login with valid credentials
- [x] Invalid credentials show error message
- [x] Session persists after app restart
- [x] Logout clears session and returns to login
- [x] Protected routes redirect to login when unauthenticated

---

## Phase 4: Layout and Navigation

### 4.1 React Router Setup
- [x] Install React Router v7
- [x] Configure router with routes for all pages
- [x] Set up route guards for authentication
- [x] Implement navigation history

### 4.2 Sidebar Component
- [x] Build collapsible Sidebar component
- [x] Add navigation items with icons and keyboard shortcuts:
  - [x] Kanban Board (K)
  - [x] Agent Terminals (A)
  - [x] Insights (N)
  - [x] Roadmap (D)
  - [x] Ideation (I)
  - [x] Changelog (L)
  - [x] Context (C)
  - [x] MCP Overview (M)
  - [x] Worktrees (W)
  - [x] GitHub Issues (G)
  - [x] GitHub PRs (P)
- [x] Add Claude Code link
- [x] Add Settings link
- [x] Create "+ New Task" button
- [x] Implement keyboard navigation

### 4.3 Header Component
- [x] Build Header with project selector
- [x] Create ProjectSelector dropdown
- [x] Add search input (global search)
- [x] Create UserMenu with avatar and dropdown
- [x] Add window controls for frameless mode (optional)

### 4.4 Main Layout
- [x] Create DashboardLayout component
- [x] Implement responsive sidebar (collapse on small windows)
- [x] Add content area with scroll management
- [x] Implement keyboard shortcut overlay (? key)

### 4.5 Placeholder Pages
- [x] Create placeholder for /kanban
- [x] Create placeholder for /terminals
- [x] Create placeholder for /insights
- [x] Create placeholder for /roadmap
- [x] Create placeholder for /ideation
- [x] Create placeholder for /changelog
- [x] Create placeholder for /context
- [x] Create placeholder for /mcp
- [x] Create placeholder for /worktrees
- [x] Create placeholder for /settings
- [x] Create placeholder for /github/issues
- [x] Create placeholder for /github/prs

**Phase 4 Verification:**
- [x] Sidebar displays all navigation items
- [x] Clicking navigation items changes routes
- [x] Keyboard shortcuts work for navigation
- [x] Project selector dropdown functions
- [x] User menu shows current user
- [x] Layout responds to window resize

---

## Phase 5: Project Management

### 5.1 Database Models (Complete)
- [x] ProjectMember relation to User and Project exists
- [x] ProjectRole enum (OWNER, ADMIN, MEMBER, VIEWER) exists

### 5.2 Project IPC Handlers
- [x] Create `projects:list` handler
- [x] Create `projects:create` handler
- [x] Create `projects:get` handler (by ID)
- [x] Create `projects:update` handler
- [x] Create `projects:delete` handler
- [x] Create `projects:addMember` handler
- [x] Create `projects:removeMember` handler
- [x] Create `projects:updateMemberRole` handler

### 5.3 Native File Dialogs
- [x] Implement directory picker for project path
  - [x] Use Electron's dialog.showOpenDialog
  - [x] Configure for directory selection
  - [x] Return selected path to renderer
- [x] Validate selected directory exists and is accessible
- [x] Show directory contents preview (optional)

### 5.4 Project UI
- [x] Build "Create Project" modal
  - [x] Project name input
  - [x] Description textarea
  - [x] Directory picker button with native dialog
  - [x] GitHub repo URL input (optional)
  - [x] Create button
- [x] Build Project Dashboard/Home page
  - [x] Project overview stats
  - [x] Recent tasks
  - [x] Team members
- [x] Build Project Settings page
  - [x] Edit name/description
  - [x] Update directory path
  - [x] GitHub integration settings
  - [x] Danger zone (delete project)

### 5.5 Team Management UI
- [x] Build Team Members section
  - [x] List current members with roles
  - [x] Role badge display
- [x] Create "Invite Member" modal
  - [x] Email input (for existing users)
  - [x] Role selector dropdown
  - [x] Send invite button
- [x] Implement role change dropdown (for admins/owners)
- [x] Add remove member button with confirmation

**Phase 5 Verification:**
- [x] Can create project with native directory picker
- [x] Project list displays in sidebar/selector
- [x] Can edit project settings
- [x] Can add team members by email
- [x] Can change member roles
- [x] Can remove members (with confirmation)
- [x] Can delete project (owner only)

---

## Phase 6: Task Management Core

### 6.1 Database Models
- [x] Create Task model
  ```prisma
  model Task {
    id          String     @id @default(cuid())
    title       String
    description String?
    branchName  String?
    status      TaskStatus @default(PENDING)
    priority    Priority   @default(MEDIUM)
    tags        String     // JSON array stored as string for SQLite
    projectId   String
    assigneeId  String?
    parentId    String?
    createdAt   DateTime   @default(now())
    updatedAt   DateTime   @updatedAt
  }

  enum TaskStatus {
    PENDING
    PLANNING
    IN_PROGRESS
    AI_REVIEW
    HUMAN_REVIEW
    COMPLETED
    CANCELLED
  }

  enum Priority {
    LOW
    MEDIUM
    HIGH
    URGENT
  }
  ```
- [x] Create TaskPhase model
- [x] Create TaskLog model
- [x] Create TaskFile model
- [x] Run migration

### 6.2 Task IPC Handlers
- [x] Create `tasks:list` handler (with filters)
- [x] Create `tasks:create` handler
- [x] Create `tasks:get` handler
- [x] Create `tasks:update` handler
- [x] Create `tasks:updateStatus` handler (for drag-drop)
- [x] Create `tasks:delete` handler
- [x] Create `tasks:addPhase` handler
- [x] Create `tasks:addLog` handler
- [x] Create `tasks:addFile` handler
- [x] Create `tasks:getSubtasks` handler

### 6.3 Kanban Board
- [x] Create /kanban page
- [x] Build KanbanBoard component
  - [x] Configure @dnd-kit DndContext
  - [x] Set up sensors (pointer, keyboard)
  - [x] Handle drag start/end events
- [x] Build KanbanColumn component
  - [x] Column header with task count
  - [x] Droppable area configuration
  - [x] "+ Add Task" button
- [x] Configure columns:
  - [x] Planning
  - [x] In Progress
  - [x] AI Review
  - [x] Human Review
  - [x] Completed (collapsible)

### 6.4 Task Card Component
- [x] Build TaskCard component
  - [x] Title display
  - [x] Description preview (truncated)
  - [x] Status badge
  - [x] Priority indicator
  - [x] Tag badges
  - [x] Phase progress (Plan → Code → QA)
  - [x] Time ago indicator
  - [x] Assignee avatar
  - [x] Menu button (edit, delete)
- [x] Make card draggable with @dnd-kit
- [x] Add click to open detail modal

### 6.5 Task Detail Modal
- [x] Build TaskModal component
- [x] Create modal header:
  - [x] Editable title
  - [x] Branch name badge
  - [x] Status badge
  - [x] Edit button
  - [x] Close button
- [x] Create tab navigation:
  - [x] Overview tab
  - [x] Subtasks tab
  - [x] Logs tab
  - [x] Files tab
- [x] Build Overview tab:
  - [x] Description editor
  - [x] Assignee selector
  - [x] Priority selector
  - [x] Tags input
- [x] Build Subtasks tab
- [x] Build Logs tab with collapsible phases
- [x] Build Files tab with action indicators

### 6.6 Task Creation Modal
- [x] Build CreateTaskModal component
  - [x] Title input
  - [x] Description textarea
  - [x] Priority selector
  - [x] Tags input
  - [x] Branch name input
  - [x] Create button
  - [x] Cancel button
- [x] Validate form with Zod
- [x] Show loading state during creation
- [x] Close and refresh board on success

**Phase 6 Verification:**
- [x] Kanban board displays all columns
- [x] Tasks appear in correct columns by status
- [x] Can drag task to different column
- [x] Status updates in database after drag
- [x] Task detail modal opens on click
- [x] Can edit task in modal
- [x] Can create new task from modal
- [x] Subtasks display and can be added

---

## Phase 7: Terminal Management

### 7.1 Terminal Process Management (Main Process)
- [x] Install node-pty with native bindings
- [x] Create TerminalManager class
  - [x] Map of terminal ID → pty instance
  - [x] spawn() method for new terminals
  - [x] write() method for input
  - [x] resize() method for dimensions
  - [x] kill() method for cleanup
- [x] Handle process spawn errors
- [x] Implement automatic cleanup on window close

### 7.2 Database Models
- [x] Create Terminal model
  ```prisma
  model Terminal {
    id         String   @id @default(cuid())
    name       String
    status     String   @default("idle")
    pid        Int?
    projectId  String
    worktreeId String?
    createdAt  DateTime @default(now())
  }
  ```
- [x] Run migration

### 7.3 Terminal IPC Handlers
- [x] Create `terminal:create` handler
  - [x] Create database record
  - [x] Spawn pty process
  - [x] Set up output streaming
  - [x] Return terminal ID
- [x] Create `terminal:write` handler
  - [x] Send input to pty
- [x] Create `terminal:resize` handler
  - [x] Update pty dimensions
- [x] Create `terminal:close` handler
  - [x] Kill pty process
  - [x] Update database status
  - [x] Clean up resources
- [x] Create `terminal:list` handler

### 7.4 Terminal Output Streaming
- [x] Set up IPC channel for terminal output
- [x] Use Electron's webContents.send for push updates
- [x] Implement output buffering for performance
- [x] Handle ANSI escape sequences properly

### 7.5 XTerm.js Integration
- [x] Install @xterm/xterm and addons
  - [x] @xterm/addon-fit
  - [x] @xterm/addon-web-links
  - [x] @xterm/addon-unicode11
- [x] Create XTermWrapper component
  - [x] Initialize terminal on mount
  - [x] Connect to IPC output channel
  - [x] Send input via IPC
  - [x] Handle resize events
  - [x] Clean up on unmount

### 7.6 Terminal UI
- [x] Create /terminals page
- [x] Build TerminalGrid component
  - [x] 2x2 default grid
  - [x] Support up to 12 terminals (3x4)
  - [x] Responsive grid layout
- [x] Build TerminalPane component
  - [x] Header with terminal name
  - [x] Status indicator (green/red dot)
  - [x] Worktree selector dropdown
  - [x] Expand button (fullscreen single terminal)
  - [x] Close button
- [x] Build terminal control bar:
  - [x] Terminal count indicator
  - [x] "+ New Terminal" button
  - [x] "Invoke Claude All" button

### 7.7 Claude Code Integration
- [x] Auto-launch Claude Code on terminal create (optional)
- [x] Show Claude status indicator
- [x] Add re-launch button when Claude exits
- [x] Implement "Invoke Claude All" broadcast
  - [x] Command input modal
  - [x] Send to all active terminals
  - [x] Show execution status

**Phase 7 Verification:**
- [x] Terminal grid displays correctly
- [x] New terminal spawns shell
- [x] Can type commands and see output
- [x] Terminal resize works
- [x] Can close terminal and process ends
- [x] "Invoke Claude All" sends to all terminals
- [x] Claude Code launches in terminal

**Post-Implementation Fixes:**
- Fixed race condition errors during terminal cleanup (commit 778beb4)
- Improved terminal close functionality to prevent zombie processes
- Enhanced terminal process lifecycle management for better stability

---

## Phase 8: Git Worktree Management ✅

### 8.1 Database Models
- [x] Create Worktree model
  ```prisma
  model Worktree {
    id        String   @id @default(cuid())
    name      String
    path      String
    branch    String
    isMain    Boolean  @default(false)
    projectId String
    createdAt DateTime @default(now())
  }
  ```
- [x] Add worktreeId relation to Terminal model
- [x] Run migration

### 8.2 Git Operations (Main Process)
- [x] Create git service using simple-git
- [x] Implement worktree operations:
  - [x] `listWorktrees(repoPath)` - List all worktrees
  - [x] `addWorktree(repoPath, branch, path)` - Create worktree
  - [x] `removeWorktree(repoPath, path)` - Remove worktree
- [x] Implement branch operations:
  - [x] `listBranches(repoPath)` - List local/remote branches
  - [x] `getCurrentBranch(repoPath)` - Get current branch
- [x] Handle git errors gracefully
- [x] Validate paths before operations

### 8.3 Worktree IPC Handlers
- [x] Create `worktrees:list` handler
- [x] Create `worktrees:create` handler
- [x] Create `worktrees:delete` handler
- [x] Create `worktrees:sync` handler
- [x] Create `branches:list` handler
- [x] Create `git:status` handler

### 8.4 Worktree UI
- [x] Create /worktrees page
- [x] Build WorktreeList component
  - [x] Table/card view
  - [x] Branch name column
  - [x] Path column
  - [x] Main indicator badge
  - [x] Terminal count using worktree
  - [x] Actions (open in terminal, delete)
- [x] Build CreateWorktreeModal
  - [x] Branch selector dropdown
  - [x] Custom path input with directory picker
  - [x] Create from new branch option
  - [x] Create button
- [x] Build worktree selector for terminals
  - [x] Dropdown in terminal header
  - [x] Shows available worktrees
  - [x] Changes terminal working directory

**Phase 8 Verification:**
- [x] Worktree list shows existing worktrees
- [x] Can create worktree from existing branch
- [x] Can create worktree with new branch
- [x] Worktree selector in terminal works
- [x] Terminal opens in selected worktree path
- [x] Can delete worktree with confirmation

---

## Phase 9: Roadmap and Planning

### 9.1 Database Models
- [ ] Create Phase model
  ```prisma
  model Phase {
    id          String   @id @default(cuid())
    name        String
    description String?
    order       Int
    status      String   @default("planned")
    projectId   String
  }
  ```
- [ ] Create Feature model with MoSCoW priority
  ```prisma
  model Feature {
    id          String         @id @default(cuid())
    title       String
    description String?
    priority    MoscowPriority
    status      String         @default("planned")
    projectId   String
    phaseId     String?
  }

  enum MoscowPriority {
    MUST
    SHOULD
    COULD
    WONT
  }
  ```
- [ ] Create Milestone model
- [ ] Run migration

### 9.2 Roadmap IPC Handlers
- [ ] Create `phases:list` handler
- [ ] Create `phases:create` handler
- [ ] Create `phases:update` handler
- [ ] Create `phases:delete` handler
- [ ] Create `phases:reorder` handler
- [ ] Create `features:list` handler
- [ ] Create `features:create` handler
- [ ] Create `features:update` handler
- [ ] Create `features:delete` handler
- [ ] Create `milestones:toggle` handler

### 9.3 Roadmap UI
- [ ] Create /roadmap page
- [ ] Build project header section:
  - [ ] Project name with status badge
  - [ ] Description
  - [ ] Stats (feature count, phase count, priority breakdown)
- [ ] Build view tabs:
  - [ ] Kanban view
  - [ ] Phases view (default)
  - [ ] All Features view
  - [ ] By Priority view
- [ ] Build PhaseCard component:
  - [ ] Phase number and name
  - [ ] Description
  - [ ] Status badge (planned, active, completed)
  - [ ] Progress bar
  - [ ] Milestones with checkboxes
  - [ ] Features list
- [ ] Build FeatureItem component:
  - [ ] MoSCoW priority badge
  - [ ] Feature title
  - [ ] "Build" button → creates task

### 9.4 Feature Management
- [ ] Build AddFeatureModal
  - [ ] Title input
  - [ ] Description textarea
  - [ ] Priority selector (Must/Should/Could/Won't)
  - [ ] Phase selector
  - [ ] Create button
- [ ] Implement "Build" button action
  - [ ] Create task from feature
  - [ ] Link task to feature
  - [ ] Update feature status

**Phase 9 Verification:**
- [ ] Phases display in correct order
- [ ] Features show with priority badges
- [ ] Milestones can be checked/unchecked
- [ ] "Build" button creates task from feature
- [ ] View tabs switch correctly
- [ ] Can add/edit/delete phases
- [ ] Can add/edit/delete features

---

## Phase 10: Context and Memory ✅

### 10.1 Database Models
- [x] Create Memory model
  ```prisma
  model Memory {
    id        String   @id @default(cuid())
    type      String   // session, pr_review, codebase, pattern, gotcha
    title     String
    content   String
    metadata  String?  // JSON string for SQLite
    projectId String
    createdAt DateTime @default(now())
  }
  ```
- [x] Run migration

### 10.2 Memory IPC Handlers
- [x] Create `memories:list` handler (with type filter)
- [x] Create `memories:create` handler
- [x] Create `memories:get` handler
- [x] Create `memories:delete` handler
- [x] Create `memories:search` handler (full-text search)

### 10.3 Context UI
- [x] Create /context page
- [x] Build tab navigation:
  - [x] Project Index tab
  - [x] Memories tab
- [x] Build Project Index tab (codebase overview)
  - [x] File tree visualization
  - [x] Key file highlights
  - [x] Architecture overview
- [x] Build Memories tab:
  - [x] Search input
  - [x] Filter chips (All, PR Reviews, Sessions, etc.)
  - [x] Memory count indicator
  - [x] Memory card list

### 10.4 Memory Card Component
- [x] Build MemoryCard component:
  - [x] Type badge
  - [x] Title
  - [x] Timestamp
  - [x] Content preview
  - [x] Expand/collapse toggle
  - [x] Delete button

### 10.5 Session Insight Capture
- [x] Hook into terminal session end
- [x] Parse Claude conversation for insights
- [x] Auto-create memory entries
- [x] Tag with session metadata

**Phase 10 Verification:**
- [x] Memory browser displays memories
- [x] Search filters results correctly
- [x] Type filters work
- [x] Memory cards expand/collapse
- [x] Can create memories manually
- [x] Session insights auto-captured on terminal close

---

## Phase 11: MCP Configuration ✅

### 11.1 Database Models
- [x] Create McpConfig model
  ```prisma
  model McpConfig {
    id        String   @id @default(cuid())
    name      String
    type      String
    enabled   Boolean  @default(false)
    config    String?  // JSON string
    projectId String
    createdAt DateTime @default(now())
  }
  ```
- [x] Run migration

### 11.2 MCP IPC Handlers
- [x] Create `mcp:list` handler
- [x] Create `mcp:create` handler
- [x] Create `mcp:update` handler
- [x] Create `mcp:delete` handler
- [x] Create `mcp:toggle` handler

### 11.3 MCP UI
- [x] Create /mcp page
- [x] Build MCP overview header:
  - [x] Project name
  - [x] Enabled server count
- [x] Build McpServerList component with categories:
  - [x] Documentation
  - [x] Knowledge Graphs
  - [x] Integrations
  - [x] Browser Automation
  - [x] Built-in
- [x] Build McpServerItem component:
  - [x] Icon
  - [x] Name
  - [x] Description
  - [x] Toggle switch
  - [x] Configure button

### 11.4 Custom Server Management
- [x] Build Custom Servers section
- [x] Build AddCustomServerModal:
  - [x] Name input
  - [x] Type selector
  - [x] Configuration JSON editor
  - [x] Save/Cancel buttons
- [x] Implement server configuration validation

### 11.5 MCP Config File Generation
- [x] Generate claude_desktop_config.json format
- [x] Auto-update config when servers toggle
- [x] Support server-specific environment variables

**Phase 11 Verification:**
- [x] MCP servers list displays preset servers
- [x] Toggle enables/disables servers
- [x] Custom server can be added
- [x] Configuration persists to database
- [x] Config file generates correctly

---

## Phase 12: GitHub Integration ✅

### 12.1 GitHub Authentication
- [x] Create GitHubToken storage in UserSettings
- [x] Build token input UI in settings
- [x] Validate token on save
- [x] Encrypt token at rest (electron-store encryption)

### 12.2 GitHub IPC Handlers
- [x] Create github service using Octokit
- [x] Create `github:getIssues` handler
- [x] Create `github:getIssue` handler
- [x] Create `github:getPRs` handler
- [x] Create `github:getPR` handler
- [x] Create `github:createIssue` handler
- [x] Create `github:createPR` handler
- [x] Handle rate limiting gracefully

### 12.3 GitHub Issues UI
- [x] Create /github/issues page
- [x] Build IssuesList component
- [x] Build IssueCard component:
  - [x] Issue number and title
  - [x] State (open/closed) badge
  - [x] Labels
  - [x] Assignees
  - [x] Created date
- [x] Build IssueDetailModal:
  - [x] Full issue body (markdown)
  - [x] Comments
  - [x] "Create Task from Issue" button
- [x] Implement issue → task conversion

### 12.4 GitHub PRs UI
- [x] Create /github/prs page
- [x] Build PrList component
- [x] Build PrCard component:
  - [x] PR number and title
  - [x] State (open/merged/closed) badge
  - [x] Branch info (head → base)
  - [x] Review status
  - [x] Created date
- [x] Build PrDetailModal:
  - [x] PR body
  - [x] Files changed
  - [x] Review comments

**Phase 12 Verification:**
- [x] Can add GitHub token in settings
- [x] Issues list loads from repository
- [x] Issue detail shows full content
- [x] Can create task from issue
- [x] PRs list loads from repository
- [x] PR detail shows files and reviews

---

## Phase 13: Additional Features ✅

### 13.1 Insights Dashboard
- [x] Create /insights page
- [x] Build metrics cards:
  - [x] Tasks completed (this week/month)
  - [x] Average task duration
  - [x] Tasks by status breakdown
  - [x] Tasks by priority breakdown
- [x] Add time tracking visualizations
  - [x] Task completion over time chart
  - [x] Time per phase breakdown
- [x] Show productivity trends
- [x] Display model usage stats (if tracked)

### 13.2 Ideation Board
- [x] Create Idea model
  ```prisma
  model Idea {
    id          String     @id @default(cuid())
    title       String
    description String?
    votes       Int        @default(0)
    status      IdeaStatus @default(PENDING)
    projectId   String
    createdById String
    createdAt   DateTime   @default(now())
  }

  enum IdeaStatus {
    PENDING
    UNDER_REVIEW
    APPROVED
    REJECTED
    CONVERTED
  }
  ```
- [x] Create /ideation page
- [x] Build IdeaCard component
- [x] Implement voting (upvote/downvote)
- [x] Add idea → feature conversion

### 13.3 Changelog
- [x] Create ChangelogEntry model
- [x] Create /changelog page
- [x] Auto-generate entries from completed tasks
- [x] Group by date/version
- [x] Support manual entries
- [x] Export changelog (markdown)

### 13.4 Native Features
- [x] Implement native notifications
  - [x] Task completion
  - [x] Terminal errors
  - [x] Mentions/assignments
- [x] Add to system tray quick actions:
  - [x] New Task
  - [x] Show/Hide window
  - [x] Recent projects
  - [x] Quit
- [x] Implement global keyboard shortcuts
  - [x] Show/hide app
  - [x] New task

**Phase 13 Verification:**
- [x] Insights dashboard shows metrics
- [x] Charts render correctly
- [x] Ideation board displays ideas
- [x] Can vote on ideas
- [x] Changelog auto-generates from tasks
- [x] Native notifications work
- [x] System tray actions work

---

## Phase 14: Settings and Preferences ✅

### 14.1 Settings Models
- [x] Create/Update UserSettings model
  ```prisma
  model UserSettings {
    id                   String @id @default(cuid())
    userId               String @unique
    claudeApiKey         String?
    githubToken          String?
    defaultTerminalCount Int    @default(2)
    theme                String @default("system")
    keyboardShortcuts    String? // JSON string
    autoLaunchClaude     Boolean @default(true)
    minimizeToTray       Boolean @default(true)
    createdAt            DateTime @default(now())
    updatedAt            DateTime @updatedAt
  }
  ```
- [x] Run migration

### 14.2 Settings IPC Handlers
- [x] Create `settings:get` handler
- [x] Create `settings:update` handler
- [x] Create `settings:updateApiKey` handler (encrypted)
- [x] Create `settings:updateProfile` handler

### 14.3 Settings UI
- [x] Create /settings page
- [x] Build Profile section:
  - [x] Avatar upload (local file)
  - [x] Name input
  - [x] Email display (read-only)
  - [x] Change password form
- [x] Build API Keys section:
  - [x] Claude API key input (masked)
  - [x] GitHub token input (masked)
  - [x] Test connection buttons
- [x] Build Preferences section:
  - [x] Theme selector (Light/Dark/System)
  - [x] Default terminal count
  - [x] Auto-launch Claude toggle
  - [x] Minimize to tray toggle
- [x] Build Keyboard Shortcuts section:
  - [x] List of shortcuts
  - [x] Customization (future)

### 14.4 Theme System
- [x] Implement theme persistence
- [x] Support system theme detection
- [x] Apply theme to all components
- [x] Support theme switching without restart

**Phase 14 Verification:**
- [x] Can update profile information
- [x] Can change password
- [x] API keys save securely
- [x] Theme switching works
- [x] Preferences persist across restarts

---

## Phase 15: Distribution and Packaging

### 15.1 Build Configuration
- [ ] Configure electron-builder
  - [ ] macOS: .dmg and .zip
  - [ ] Windows: .exe (NSIS installer) and .zip
  - [ ] Linux: .AppImage, .deb, .rpm
- [ ] Set up app metadata (name, version, description)
- [ ] Configure app icons for all platforms
- [ ] Set up file associations (optional)

### 15.2 Code Signing
- [ ] macOS signing:
  - [ ] Apple Developer certificate
  - [ ] Notarization setup
  - [ ] Hardened runtime entitlements
- [ ] Windows signing:
  - [ ] Code signing certificate
  - [ ] SignTool configuration

### 15.3 Auto-Update System
- [ ] Install electron-updater
- [ ] Configure update server (GitHub Releases)
- [ ] Implement update check on app launch
- [ ] Build update available notification
- [ ] Implement background download
- [ ] Create update installation dialog
- [ ] Handle update errors gracefully

### 15.4 Release Process
- [ ] Set up GitHub Actions workflow:
  - [ ] Build on push to release branch
  - [ ] Build for all platforms in parallel
  - [ ] Sign and notarize
  - [ ] Upload to GitHub Releases
  - [ ] Generate release notes
- [ ] Create manual release script for local builds
- [ ] Set up beta/stable release channels

### 15.5 Installation Experience
- [ ] macOS:
  - [ ] DMG with app and Applications folder link
  - [ ] Background image
  - [ ] License agreement (optional)
- [ ] Windows:
  - [ ] NSIS installer with progress
  - [ ] Start menu and desktop shortcuts
  - [ ] Uninstaller
- [ ] Linux:
  - [ ] Desktop integration
  - [ ] Icon installation

### 15.6 Testing Distribution
- [ ] Test fresh install on macOS
- [ ] Test fresh install on Windows
- [ ] Test fresh install on Linux (Ubuntu, Fedora)
- [ ] Test auto-update flow on each platform
- [ ] Test upgrade from previous version

**Phase 15 Verification:**
- [ ] macOS .dmg installs correctly
- [ ] macOS app is notarized and runs without warnings
- [ ] Windows installer works correctly
- [ ] Windows app doesn't trigger SmartScreen (if signed)
- [ ] Linux AppImage runs correctly
- [ ] Auto-update downloads and installs new version
- [ ] Update doesn't lose user data

---

## File Structure

```
claude-tasks-desktop/
├── electron/
│   ├── main.ts                 # Main process entry
│   ├── preload.ts              # Preload script (IPC bridge)
│   ├── services/
│   │   ├── database.ts         # SQLite/Prisma service
│   │   ├── terminal.ts         # Terminal manager (node-pty)
│   │   ├── git.ts              # Git operations (simple-git)
│   │   ├── github.ts           # GitHub API (Octokit)
│   │   └── auth.ts             # Authentication service
│   ├── ipc/
│   │   ├── index.ts            # IPC handler registration
│   │   ├── auth.ts             # Auth handlers
│   │   ├── projects.ts         # Project handlers
│   │   ├── tasks.ts            # Task handlers
│   │   ├── terminals.ts        # Terminal handlers
│   │   ├── worktrees.ts        # Worktree handlers
│   │   ├── memories.ts         # Memory handlers
│   │   ├── mcp.ts              # MCP config handlers
│   │   └── github.ts           # GitHub handlers
│   └── utils/
│       ├── paths.ts            # Platform-specific paths
│       ├── store.ts            # electron-store config
│       └── updater.ts          # Auto-update logic
├── src/
│   ├── main.tsx                # Renderer entry
│   ├── App.tsx                 # Root component with router
│   ├── routes/
│   │   ├── index.tsx           # Route definitions
│   │   ├── login.tsx           # Login page
│   │   ├── register.tsx        # Register page
│   │   ├── dashboard.tsx       # Dashboard layout
│   │   ├── kanban.tsx          # Kanban board
│   │   ├── terminals.tsx       # Terminal grid
│   │   ├── roadmap.tsx         # Roadmap view
│   │   ├── context.tsx         # Context/memory
│   │   ├── mcp.tsx             # MCP configuration
│   │   ├── worktrees.tsx       # Worktree management
│   │   ├── insights.tsx        # Insights dashboard
│   │   ├── ideation.tsx        # Ideation board
│   │   ├── changelog.tsx       # Changelog
│   │   ├── settings.tsx        # Settings page
│   │   └── github/
│   │       ├── issues.tsx
│   │       └── prs.tsx
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── ProjectSelector.tsx
│   │   │   └── UserMenu.tsx
│   │   ├── kanban/
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   └── CreateTaskModal.tsx
│   │   ├── terminal/
│   │   │   ├── TerminalGrid.tsx
│   │   │   ├── TerminalPane.tsx
│   │   │   └── XTermWrapper.tsx
│   │   ├── task/
│   │   │   ├── TaskModal.tsx
│   │   │   └── tabs/
│   │   ├── roadmap/
│   │   │   ├── PhaseCard.tsx
│   │   │   └── FeatureItem.tsx
│   │   ├── memory/
│   │   │   └── MemoryCard.tsx
│   │   ├── mcp/
│   │   │   ├── McpServerList.tsx
│   │   │   └── McpServerItem.tsx
│   │   ├── github/
│   │   │   ├── IssueCard.tsx
│   │   │   └── PrCard.tsx
│   │   ├── settings/
│   │   │   ├── ProfileSection.tsx
│   │   │   ├── ApiKeysSection.tsx
│   │   │   └── PreferencesSection.tsx
│   │   └── providers/
│   │       ├── AuthProvider.tsx
│   │       └── ThemeProvider.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useIPC.ts           # Type-safe IPC invoke hook
│   │   ├── useProjects.ts
│   │   ├── useTasks.ts
│   │   └── useTerminals.ts
│   ├── lib/
│   │   ├── ipc.ts              # IPC channel definitions
│   │   └── utils.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── ipc.ts              # IPC message types
│   │   └── models.ts           # Database model types
│   └── styles/
│       └── globals.css
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── prisma.config.ts              # Prisma 7 config (datasource URL, migrations)
├── resources/
│   ├── icon.icns               # macOS icon
│   ├── icon.ico                # Windows icon
│   ├── icon.png                # Linux icon
│   └── dmg-background.png      # macOS DMG background
├── .github/
│   └── workflows/
│       └── release.yml         # CI/CD for releases
├── package.json
├── electron-builder.yml        # Build configuration
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## Database Schema (SQLite + Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

// Prisma 7: URL configured in prisma.config.ts, adapter used at runtime
datasource db {
  provider = "sqlite"
}

// Authentication
model User {
  id            String          @id @default(cuid())
  name          String?
  email         String          @unique
  passwordHash  String
  avatar        String?
  projects      ProjectMember[]
  assignedTasks Task[]          @relation("AssignedTasks")
  settings      UserSettings?
  ideas         Idea[]          @relation("CreatedIdeas")
  sessions      Session[]
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
}

model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

// Projects
model Project {
  id               String            @id @default(cuid())
  name             String
  description      String?
  targetPath       String?
  githubRepo       String?
  members          ProjectMember[]
  tasks            Task[]
  features         Feature[]
  phases           Phase[]
  terminals        Terminal[]
  memories         Memory[]
  mcpConfigs       McpConfig[]
  worktrees        Worktree[]
  changelogEntries ChangelogEntry[]
  ideas            Idea[]
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
}

model ProjectMember {
  id        String      @id @default(cuid())
  role      ProjectRole @default(MEMBER)
  userId    String
  user      User        @relation(fields: [userId], references: [id])
  projectId String
  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt DateTime    @default(now())
  @@unique([userId, projectId])
}

enum ProjectRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

// Git Worktrees
model Worktree {
  id        String     @id @default(cuid())
  name      String
  path      String
  branch    String
  isMain    Boolean    @default(false)
  projectId String
  project   Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  terminals Terminal[]
  createdAt DateTime   @default(now())
}

// Tasks
model Task {
  id          String          @id @default(cuid())
  title       String
  description String?
  branchName  String?
  status      TaskStatus      @default(PENDING)
  priority    Priority        @default(MEDIUM)
  tags        String          @default("[]") // JSON array as string
  projectId   String
  project     Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assigneeId  String?
  assignee    User?           @relation("AssignedTasks", fields: [assigneeId], references: [id])
  phases      TaskPhase[]
  logs        TaskLog[]
  files       TaskFile[]
  subtasks    Task[]          @relation("Subtasks")
  parentId    String?
  parent      Task?           @relation("Subtasks", fields: [parentId], references: [id])
  changelog   ChangelogEntry?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

enum TaskStatus {
  PENDING
  PLANNING
  IN_PROGRESS
  AI_REVIEW
  HUMAN_REVIEW
  COMPLETED
  CANCELLED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model TaskPhase {
  id        String      @id @default(cuid())
  name      String
  status    PhaseStatus @default(PENDING)
  model     String?
  taskId    String
  task      Task        @relation(fields: [taskId], references: [id], onDelete: Cascade)
  logs      TaskLog[]
  startedAt DateTime?
  endedAt   DateTime?
}

enum PhaseStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

model TaskLog {
  id        String     @id @default(cuid())
  type      String
  message   String
  metadata  String?    // JSON as string
  taskId    String
  task      Task       @relation(fields: [taskId], references: [id], onDelete: Cascade)
  phaseId   String?
  phase     TaskPhase? @relation(fields: [phaseId], references: [id])
  createdAt DateTime   @default(now())
}

model TaskFile {
  id        String   @id @default(cuid())
  path      String
  action    String
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

// Terminals
model Terminal {
  id         String    @id @default(cuid())
  name       String
  status     String    @default("idle")
  pid        Int?
  projectId  String
  project    Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  worktreeId String?
  worktree   Worktree? @relation(fields: [worktreeId], references: [id])
  createdAt  DateTime  @default(now())
}

// Roadmap
model Phase {
  id          String      @id @default(cuid())
  name        String
  description String?
  order       Int
  status      String      @default("planned")
  projectId   String
  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  features    Feature[]
  milestones  Milestone[]
}

model Feature {
  id          String         @id @default(cuid())
  title       String
  description String?
  priority    MoscowPriority
  status      String         @default("planned")
  projectId   String
  project     Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  phaseId     String?
  phase       Phase?         @relation(fields: [phaseId], references: [id])
  createdAt   DateTime       @default(now())
}

enum MoscowPriority {
  MUST
  SHOULD
  COULD
  WONT
}

model Milestone {
  id        String  @id @default(cuid())
  title     String
  completed Boolean @default(false)
  phaseId   String
  phase     Phase   @relation(fields: [phaseId], references: [id], onDelete: Cascade)
}

// Memory
model Memory {
  id        String   @id @default(cuid())
  type      String   // session, pr_review, codebase, pattern, gotcha
  title     String
  content   String
  metadata  String?  // JSON as string
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

// MCP Configuration
model McpConfig {
  id        String   @id @default(cuid())
  name      String
  type      String
  enabled   Boolean  @default(false)
  config    String?  // JSON as string
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

// Changelog
model ChangelogEntry {
  id          String        @id @default(cuid())
  title       String
  description String?
  version     String?
  type        ChangelogType @default(FEATURE)
  taskId      String?       @unique
  task        Task?         @relation(fields: [taskId], references: [id], onDelete: SetNull)
  projectId   String
  project     Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

enum ChangelogType {
  FEATURE
  FIX
  IMPROVEMENT
  BREAKING
}

// User Settings
model UserSettings {
  id                   String   @id @default(cuid())
  userId               String   @unique
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  claudeApiKey         String?
  githubToken          String?
  defaultTerminalCount Int      @default(2)
  theme                String   @default("system")
  keyboardShortcuts    String?  // JSON as string
  autoLaunchClaude     Boolean  @default(true)
  minimizeToTray       Boolean  @default(true)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}

// Ideation
model Idea {
  id          String     @id @default(cuid())
  title       String
  description String?
  votes       Int        @default(0)
  status      IdeaStatus @default(PENDING)
  projectId   String
  project     Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdById String
  createdBy   User       @relation("CreatedIdeas", fields: [createdById], references: [id], onDelete: Cascade)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

enum IdeaStatus {
  PENDING
  UNDER_REVIEW
  APPROVED
  REJECTED
  CONVERTED
}
```

---

## IPC Handler Patterns

### Main Process Handler Registration

```typescript
// electron/ipc/index.ts
import { ipcMain } from 'electron';
import { registerAuthHandlers } from './auth';
import { registerProjectHandlers } from './projects';
import { registerTaskHandlers } from './tasks';
import { registerTerminalHandlers } from './terminals';

export function registerAllHandlers() {
  registerAuthHandlers();
  registerProjectHandlers();
  registerTaskHandlers();
  registerTerminalHandlers();
  // ... other handlers
}
```

### Handler Example

```typescript
// electron/ipc/tasks.ts
import { ipcMain } from 'electron';
import { prisma } from '../services/database';
import type { Task, TaskStatus } from '@prisma/client';

export function registerTaskHandlers() {
  ipcMain.handle('tasks:list', async (_, projectId: string) => {
    return prisma.task.findMany({
      where: { projectId },
      include: { assignee: true, phases: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  ipcMain.handle('tasks:create', async (_, data: CreateTaskInput) => {
    return prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        tags: JSON.stringify(data.tags || []),
        projectId: data.projectId,
      },
    });
  });

  ipcMain.handle('tasks:updateStatus', async (_, id: string, status: TaskStatus) => {
    return prisma.task.update({
      where: { id },
      data: { status },
    });
  });
}
```

### Renderer Process Invocation

```typescript
// src/hooks/useIPC.ts
import type { IpcChannels } from '../types/ipc';

export function useIPC() {
  const invoke = async <T extends keyof IpcChannels>(
    channel: T,
    ...args: Parameters<IpcChannels[T]>
  ): Promise<ReturnType<IpcChannels[T]>> => {
    return window.electron.invoke(channel, ...args);
  };

  return { invoke };
}

// Usage in component
const { invoke } = useIPC();
const tasks = await invoke('tasks:list', projectId);
```

### Preload Script

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  },
  removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});
```

---

## Terminal IPC Pattern

### Output Streaming

```typescript
// electron/ipc/terminals.ts
import { ipcMain, BrowserWindow } from 'electron';
import { TerminalManager } from '../services/terminal';

const terminalManager = new TerminalManager();

export function registerTerminalHandlers(mainWindow: BrowserWindow) {
  ipcMain.handle('terminal:create', async (_, { projectId, worktreeId }) => {
    const terminal = await terminalManager.create({
      projectId,
      worktreeId,
      onData: (data) => {
        // Push output to renderer
        mainWindow.webContents.send(`terminal:output:${terminal.id}`, data);
      },
      onExit: (code) => {
        mainWindow.webContents.send(`terminal:exit:${terminal.id}`, code);
      },
    });
    return terminal;
  });

  ipcMain.handle('terminal:write', async (_, { id, data }) => {
    terminalManager.write(id, data);
  });

  ipcMain.handle('terminal:resize', async (_, { id, cols, rows }) => {
    terminalManager.resize(id, cols, rows);
  });
}
```

### Renderer Subscription

```typescript
// src/components/terminal/XTermWrapper.tsx
useEffect(() => {
  const handleOutput = (data: string) => {
    terminal.write(data);
  };

  window.electron.on(`terminal:output:${terminalId}`, handleOutput);

  return () => {
    window.electron.removeListener(`terminal:output:${terminalId}`, handleOutput);
  };
}, [terminalId]);
```

---

## Distribution Requirements

### macOS
- **Signing:** Apple Developer ID certificate required
- **Notarization:** Required for Gatekeeper
- **Entitlements:**
  - `com.apple.security.cs.allow-jit` (for node-pty)
  - `com.apple.security.cs.allow-unsigned-executable-memory`
  - `com.apple.security.cs.disable-library-validation`
- **Format:** .dmg with background image and Applications link

### Windows
- **Signing:** Code signing certificate (EV recommended to avoid SmartScreen)
- **Format:** NSIS installer (.exe)
- **Includes:**
  - Start menu shortcut
  - Desktop shortcut (optional)
  - Uninstaller

### Linux
- **Formats:**
  - AppImage (universal)
  - .deb (Debian/Ubuntu)
  - .rpm (Fedora/RHEL)
- **Desktop integration:**
  - .desktop file
  - Icon installation

### Auto-Update
- Host releases on GitHub Releases
- electron-updater configuration:
  ```yaml
  publish:
    provider: github
    owner: your-org
    repo: claude-tasks-desktop
  ```
- Update channels: stable, beta (optional)

---

## Verification Checklist

### Phase 1 - Foundation ✅
- [x] Electron app launches with React UI
- [x] Hot reload works in development
- [x] shadcn/ui components render correctly
- [x] IPC communication functional
- [x] System tray appears

### Phase 2 - Database ✅
- [x] SQLite database creates on first launch
- [x] Prisma migrations apply
- [x] CRUD operations work

### Phase 3 - Authentication ✅
- [x] User registration works
- [x] User login works
- [x] Session persists across restarts
- [x] Protected routes redirect properly

### Phase 4 - Layout ✅
- [x] Sidebar navigation works
- [x] Keyboard shortcuts function
- [x] Project selector works
- [x] Responsive layout

### Phase 5 - Projects ✅
- [x] Native file picker works
- [x] Projects create/edit/delete
- [x] Team management works

### Phase 6 - Tasks ✅
- [x] Kanban board displays
- [x] Drag-and-drop works
- [x] Task CRUD works
- [x] Task modal functional

### Phase 7 - Terminals ✅
- [x] Terminal spawns shell
- [x] Input/output works
- [x] Resize works
- [x] Claude Code launches

### Phase 8 - Worktrees ✅
- [x] Git operations work
- [x] Worktree CRUD works
- [x] Terminal worktree selector works

### Phase 9 - Roadmap ✅
- [x] Phases display
- [x] Features with priorities
- [x] Feature → Task conversion

### Phase 10 - Memory ✅
- [x] Memory CRUD works
- [x] Search works
- [x] Session capture works

### Phase 11 - MCP ✅
- [x] Server list displays
- [x] Toggle works
- [x] Custom server add works
- [x] Config file generation works

### Phase 12 - GitHub ✅
- [x] Token authentication works
- [x] Issues list/detail
- [x] PRs list/detail
- [x] Issue → Task works

### Phase 13 - Additional ✅
- [x] Insights displays metrics
- [x] Ideation voting works
- [x] Changelog generates
- [x] Native notifications work

### Phase 14 - Settings ✅
- [x] Profile updates
- [x] API keys save securely
- [x] Theme switching works

### Phase 15 - Distribution
- [ ] macOS build works
- [ ] Windows build works
- [ ] Linux build works
- [ ] Auto-update works
- [ ] Code signing works

---

## End-to-End Workflow

1. **Launch** → App opens, checks for updates
2. **Login/Register** → Local authentication
3. **Create Project** → Native file picker for directory
4. **Create Task** → Kanban board updates
5. **Open Terminal** → Claude Code launches
6. **Work on Task** → Move through statuses via drag-drop
7. **Capture Insights** → Memory auto-saves on session end
8. **View Progress** → Insights dashboard shows metrics
9. **Generate Changelog** → Auto-generate from completed tasks
10. **Update** → Auto-updater downloads and installs new version
