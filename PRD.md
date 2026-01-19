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
| 2 | Database & ORM | Planned |
| 3 | Authentication System | Planned |
| 4 | Layout and Navigation | Planned |
| 5 | Project Management | Planned |
| 6 | Task Management Core | Planned |
| 7 | Terminal Management | Planned |
| 8 | Git Worktree Management | Planned |
| 9 | Roadmap and Planning | Planned |
| 10 | Context and Memory | Planned |
| 11 | MCP Configuration | Planned |
| 12 | GitHub Integration | Planned |
| 13 | Additional Features | Planned |
| 14 | Settings and Preferences | Planned |
| 15 | Distribution and Packaging | Planned |

**Current Status:** Phase 1 complete. Ready for Phase 2 (Database & ORM).

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

## Phase 2: Database & ORM

### 2.1 SQLite Setup
- [ ] Install better-sqlite3 for native SQLite binding
- [ ] Configure database file location (user data directory)
- [ ] Create database initialization on first launch
- [ ] Implement database path resolution for all platforms

### 2.2 Prisma Configuration
- [ ] Install Prisma with SQLite provider
- [ ] Configure prisma schema for SQLite compatibility
- [ ] Create migration strategy for embedded database
- [ ] Set up Prisma Client generation for Electron

### 2.3 User Model
- [ ] Create User model
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
- [ ] Run initial migration

### 2.4 Project Model
- [ ] Create Project model
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
- [ ] Create ProjectMember model with roles (OWNER, ADMIN, MEMBER, VIEWER)
- [ ] Run migration

### 2.5 Database Service
- [ ] Create database service class in main process
- [ ] Implement connection management
- [ ] Add migration runner for app updates
- [ ] Create database backup/restore utilities
- [ ] Expose database operations via IPC

**Phase 2 Verification:**
- [ ] Database file created in user data directory
- [ ] Prisma Client works in main process
- [ ] Users can be created and queried
- [ ] Projects can be created and queried
- [ ] Migrations apply on app update

---

## Phase 3: Authentication System

### 3.1 Password Authentication
- [ ] Install bcrypt for password hashing
- [ ] Create password hashing utility
- [ ] Create password verification utility
- [ ] Implement secure password requirements validation

### 3.2 Session Management
- [ ] Create Session model
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
- [ ] Generate secure session tokens
- [ ] Implement session expiration and renewal
- [ ] Store current session in secure electron-store

### 3.3 Auth IPC Handlers
- [ ] Create `auth:register` handler
  - [ ] Validate email format
  - [ ] Check email uniqueness
  - [ ] Hash password
  - [ ] Create user and session
- [ ] Create `auth:login` handler
  - [ ] Verify email exists
  - [ ] Verify password
  - [ ] Create new session
- [ ] Create `auth:logout` handler
  - [ ] Invalidate current session
  - [ ] Clear stored credentials
- [ ] Create `auth:getCurrentUser` handler
- [ ] Create `auth:updateProfile` handler

### 3.4 Auth Context (Renderer)
- [ ] Create AuthContext provider
- [ ] Create useAuth hook
- [ ] Implement login/logout/register methods
- [ ] Handle session persistence across app restarts
- [ ] Auto-login from stored session on app launch

### 3.5 Auth UI Components
- [ ] Create Login page component
  - [ ] Email input
  - [ ] Password input
  - [ ] Remember me checkbox
  - [ ] Login button
  - [ ] Link to register
- [ ] Create Register page component
  - [ ] Name input
  - [ ] Email input
  - [ ] Password input with requirements
  - [ ] Confirm password input
  - [ ] Register button
  - [ ] Link to login
- [ ] Create ProtectedRoute wrapper component

**Phase 3 Verification:**
- [ ] User can register with email/password
- [ ] User can login with valid credentials
- [ ] Invalid credentials show error message
- [ ] Session persists after app restart
- [ ] Logout clears session and returns to login
- [ ] Protected routes redirect to login when unauthenticated

---

## Phase 4: Layout and Navigation

### 4.1 React Router Setup
- [ ] Install React Router v7
- [ ] Configure router with routes for all pages
- [ ] Set up route guards for authentication
- [ ] Implement navigation history

### 4.2 Sidebar Component
- [ ] Build collapsible Sidebar component
- [ ] Add navigation items with icons and keyboard shortcuts:
  - [ ] Kanban Board (K)
  - [ ] Agent Terminals (A)
  - [ ] Insights (N)
  - [ ] Roadmap (D)
  - [ ] Ideation (I)
  - [ ] Changelog (L)
  - [ ] Context (C)
  - [ ] MCP Overview (M)
  - [ ] Worktrees (W)
  - [ ] GitHub Issues (G)
  - [ ] GitHub PRs (P)
- [ ] Add Claude Code link
- [ ] Add Settings link
- [ ] Create "+ New Task" button
- [ ] Implement keyboard navigation

### 4.3 Header Component
- [ ] Build Header with project selector
- [ ] Create ProjectSelector dropdown
- [ ] Add search input (global search)
- [ ] Create UserMenu with avatar and dropdown
- [ ] Add window controls for frameless mode (optional)

### 4.4 Main Layout
- [ ] Create DashboardLayout component
- [ ] Implement responsive sidebar (collapse on small windows)
- [ ] Add content area with scroll management
- [ ] Implement keyboard shortcut overlay (? key)

### 4.5 Placeholder Pages
- [ ] Create placeholder for /kanban
- [ ] Create placeholder for /terminals
- [ ] Create placeholder for /insights
- [ ] Create placeholder for /roadmap
- [ ] Create placeholder for /ideation
- [ ] Create placeholder for /changelog
- [ ] Create placeholder for /context
- [ ] Create placeholder for /mcp
- [ ] Create placeholder for /worktrees
- [ ] Create placeholder for /settings
- [ ] Create placeholder for /github/issues
- [ ] Create placeholder for /github/prs

**Phase 4 Verification:**
- [ ] Sidebar displays all navigation items
- [ ] Clicking navigation items changes routes
- [ ] Keyboard shortcuts work for navigation
- [ ] Project selector dropdown functions
- [ ] User menu shows current user
- [ ] Layout responds to window resize

---

## Phase 5: Project Management

### 5.1 Database Models (Complete)
- [ ] ProjectMember relation to User and Project exists
- [ ] ProjectRole enum (OWNER, ADMIN, MEMBER, VIEWER) exists

### 5.2 Project IPC Handlers
- [ ] Create `projects:list` handler
- [ ] Create `projects:create` handler
- [ ] Create `projects:get` handler (by ID)
- [ ] Create `projects:update` handler
- [ ] Create `projects:delete` handler
- [ ] Create `projects:addMember` handler
- [ ] Create `projects:removeMember` handler
- [ ] Create `projects:updateMemberRole` handler

### 5.3 Native File Dialogs
- [ ] Implement directory picker for project path
  - [ ] Use Electron's dialog.showOpenDialog
  - [ ] Configure for directory selection
  - [ ] Return selected path to renderer
- [ ] Validate selected directory exists and is accessible
- [ ] Show directory contents preview (optional)

### 5.4 Project UI
- [ ] Build "Create Project" modal
  - [ ] Project name input
  - [ ] Description textarea
  - [ ] Directory picker button with native dialog
  - [ ] GitHub repo URL input (optional)
  - [ ] Create button
- [ ] Build Project Dashboard/Home page
  - [ ] Project overview stats
  - [ ] Recent tasks
  - [ ] Team members
- [ ] Build Project Settings page
  - [ ] Edit name/description
  - [ ] Update directory path
  - [ ] GitHub integration settings
  - [ ] Danger zone (delete project)

### 5.5 Team Management UI
- [ ] Build Team Members section
  - [ ] List current members with roles
  - [ ] Role badge display
- [ ] Create "Invite Member" modal
  - [ ] Email input (for existing users)
  - [ ] Role selector dropdown
  - [ ] Send invite button
- [ ] Implement role change dropdown (for admins/owners)
- [ ] Add remove member button with confirmation

**Phase 5 Verification:**
- [ ] Can create project with native directory picker
- [ ] Project list displays in sidebar/selector
- [ ] Can edit project settings
- [ ] Can add team members by email
- [ ] Can change member roles
- [ ] Can remove members (with confirmation)
- [ ] Can delete project (owner only)

---

## Phase 6: Task Management Core

### 6.1 Database Models
- [ ] Create Task model
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
- [ ] Create TaskPhase model
- [ ] Create TaskLog model
- [ ] Create TaskFile model
- [ ] Run migration

### 6.2 Task IPC Handlers
- [ ] Create `tasks:list` handler (with filters)
- [ ] Create `tasks:create` handler
- [ ] Create `tasks:get` handler
- [ ] Create `tasks:update` handler
- [ ] Create `tasks:updateStatus` handler (for drag-drop)
- [ ] Create `tasks:delete` handler
- [ ] Create `tasks:addPhase` handler
- [ ] Create `tasks:addLog` handler
- [ ] Create `tasks:addFile` handler
- [ ] Create `tasks:getSubtasks` handler

### 6.3 Kanban Board
- [ ] Create /kanban page
- [ ] Build KanbanBoard component
  - [ ] Configure @dnd-kit DndContext
  - [ ] Set up sensors (pointer, keyboard)
  - [ ] Handle drag start/end events
- [ ] Build KanbanColumn component
  - [ ] Column header with task count
  - [ ] Droppable area configuration
  - [ ] "+ Add Task" button
- [ ] Configure columns:
  - [ ] Planning
  - [ ] In Progress
  - [ ] AI Review
  - [ ] Human Review
  - [ ] Completed (collapsible)

### 6.4 Task Card Component
- [ ] Build TaskCard component
  - [ ] Title display
  - [ ] Description preview (truncated)
  - [ ] Status badge
  - [ ] Priority indicator
  - [ ] Tag badges
  - [ ] Phase progress (Plan → Code → QA)
  - [ ] Time ago indicator
  - [ ] Assignee avatar
  - [ ] Menu button (edit, delete)
- [ ] Make card draggable with @dnd-kit
- [ ] Add click to open detail modal

### 6.5 Task Detail Modal
- [ ] Build TaskModal component
- [ ] Create modal header:
  - [ ] Editable title
  - [ ] Branch name badge
  - [ ] Status badge
  - [ ] Edit button
  - [ ] Close button
- [ ] Create tab navigation:
  - [ ] Overview tab
  - [ ] Subtasks tab
  - [ ] Logs tab
  - [ ] Files tab
- [ ] Build Overview tab:
  - [ ] Description editor
  - [ ] Assignee selector
  - [ ] Priority selector
  - [ ] Tags input
- [ ] Build Subtasks tab
- [ ] Build Logs tab with collapsible phases
- [ ] Build Files tab with action indicators

### 6.6 Task Creation Modal
- [ ] Build CreateTaskModal component
  - [ ] Title input
  - [ ] Description textarea
  - [ ] Priority selector
  - [ ] Tags input
  - [ ] Branch name input
  - [ ] Create button
  - [ ] Cancel button
- [ ] Validate form with Zod
- [ ] Show loading state during creation
- [ ] Close and refresh board on success

**Phase 6 Verification:**
- [ ] Kanban board displays all columns
- [ ] Tasks appear in correct columns by status
- [ ] Can drag task to different column
- [ ] Status updates in database after drag
- [ ] Task detail modal opens on click
- [ ] Can edit task in modal
- [ ] Can create new task from modal
- [ ] Subtasks display and can be added

---

## Phase 7: Terminal Management

### 7.1 Terminal Process Management (Main Process)
- [ ] Install node-pty with native bindings
- [ ] Create TerminalManager class
  - [ ] Map of terminal ID → pty instance
  - [ ] spawn() method for new terminals
  - [ ] write() method for input
  - [ ] resize() method for dimensions
  - [ ] kill() method for cleanup
- [ ] Handle process spawn errors
- [ ] Implement automatic cleanup on window close

### 7.2 Database Models
- [ ] Create Terminal model
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
- [ ] Run migration

### 7.3 Terminal IPC Handlers
- [ ] Create `terminal:create` handler
  - [ ] Create database record
  - [ ] Spawn pty process
  - [ ] Set up output streaming
  - [ ] Return terminal ID
- [ ] Create `terminal:write` handler
  - [ ] Send input to pty
- [ ] Create `terminal:resize` handler
  - [ ] Update pty dimensions
- [ ] Create `terminal:close` handler
  - [ ] Kill pty process
  - [ ] Update database status
  - [ ] Clean up resources
- [ ] Create `terminal:list` handler

### 7.4 Terminal Output Streaming
- [ ] Set up IPC channel for terminal output
- [ ] Use Electron's webContents.send for push updates
- [ ] Implement output buffering for performance
- [ ] Handle ANSI escape sequences properly

### 7.5 XTerm.js Integration
- [ ] Install @xterm/xterm and addons
  - [ ] @xterm/addon-fit
  - [ ] @xterm/addon-web-links
  - [ ] @xterm/addon-unicode11
- [ ] Create XTermWrapper component
  - [ ] Initialize terminal on mount
  - [ ] Connect to IPC output channel
  - [ ] Send input via IPC
  - [ ] Handle resize events
  - [ ] Clean up on unmount

### 7.6 Terminal UI
- [ ] Create /terminals page
- [ ] Build TerminalGrid component
  - [ ] 2x2 default grid
  - [ ] Support up to 12 terminals (3x4)
  - [ ] Responsive grid layout
- [ ] Build TerminalPane component
  - [ ] Header with terminal name
  - [ ] Status indicator (green/red dot)
  - [ ] Worktree selector dropdown
  - [ ] Expand button (fullscreen single terminal)
  - [ ] Close button
- [ ] Build terminal control bar:
  - [ ] Terminal count indicator
  - [ ] "+ New Terminal" button
  - [ ] "Invoke Claude All" button

### 7.7 Claude Code Integration
- [ ] Auto-launch Claude Code on terminal create (optional)
- [ ] Show Claude status indicator
- [ ] Add re-launch button when Claude exits
- [ ] Implement "Invoke Claude All" broadcast
  - [ ] Command input modal
  - [ ] Send to all active terminals
  - [ ] Show execution status

**Phase 7 Verification:**
- [ ] Terminal grid displays correctly
- [ ] New terminal spawns shell
- [ ] Can type commands and see output
- [ ] Terminal resize works
- [ ] Can close terminal and process ends
- [ ] "Invoke Claude All" sends to all terminals
- [ ] Claude Code launches in terminal

---

## Phase 8: Git Worktree Management

### 8.1 Database Models
- [ ] Create Worktree model
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
- [ ] Add worktreeId relation to Terminal model
- [ ] Run migration

### 8.2 Git Operations (Main Process)
- [ ] Create git service using simple-git
- [ ] Implement worktree operations:
  - [ ] `listWorktrees(repoPath)` - List all worktrees
  - [ ] `addWorktree(repoPath, branch, path)` - Create worktree
  - [ ] `removeWorktree(repoPath, path)` - Remove worktree
- [ ] Implement branch operations:
  - [ ] `listBranches(repoPath)` - List local/remote branches
  - [ ] `getCurrentBranch(repoPath)` - Get current branch
- [ ] Handle git errors gracefully
- [ ] Validate paths before operations

### 8.3 Worktree IPC Handlers
- [ ] Create `worktrees:list` handler
- [ ] Create `worktrees:create` handler
- [ ] Create `worktrees:delete` handler
- [ ] Create `branches:list` handler
- [ ] Create `git:status` handler

### 8.4 Worktree UI
- [ ] Create /worktrees page
- [ ] Build WorktreeList component
  - [ ] Table/card view
  - [ ] Branch name column
  - [ ] Path column
  - [ ] Main indicator badge
  - [ ] Terminal count using worktree
  - [ ] Actions (open in terminal, delete)
- [ ] Build CreateWorktreeModal
  - [ ] Branch selector dropdown
  - [ ] Custom path input with directory picker
  - [ ] Create from new branch option
  - [ ] Create button
- [ ] Build worktree selector for terminals
  - [ ] Dropdown in terminal header
  - [ ] Shows available worktrees
  - [ ] Changes terminal working directory

**Phase 8 Verification:**
- [ ] Worktree list shows existing worktrees
- [ ] Can create worktree from existing branch
- [ ] Can create worktree with new branch
- [ ] Worktree selector in terminal works
- [ ] Terminal opens in selected worktree path
- [ ] Can delete worktree with confirmation

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

## Phase 10: Context and Memory

### 10.1 Database Models
- [ ] Create Memory model
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
- [ ] Run migration

### 10.2 Memory IPC Handlers
- [ ] Create `memories:list` handler (with type filter)
- [ ] Create `memories:create` handler
- [ ] Create `memories:get` handler
- [ ] Create `memories:delete` handler
- [ ] Create `memories:search` handler (full-text search)

### 10.3 Context UI
- [ ] Create /context page
- [ ] Build tab navigation:
  - [ ] Project Index tab
  - [ ] Memories tab
- [ ] Build Project Index tab (codebase overview)
  - [ ] File tree visualization
  - [ ] Key file highlights
  - [ ] Architecture overview
- [ ] Build Memories tab:
  - [ ] Search input
  - [ ] Filter chips (All, PR Reviews, Sessions, etc.)
  - [ ] Memory count indicator
  - [ ] Memory card list

### 10.4 Memory Card Component
- [ ] Build MemoryCard component:
  - [ ] Type badge
  - [ ] Title
  - [ ] Timestamp
  - [ ] Content preview
  - [ ] Expand/collapse toggle
  - [ ] Delete button

### 10.5 Session Insight Capture
- [ ] Hook into terminal session end
- [ ] Parse Claude conversation for insights
- [ ] Auto-create memory entries
- [ ] Tag with session metadata

**Phase 10 Verification:**
- [ ] Memory browser displays memories
- [ ] Search filters results correctly
- [ ] Type filters work
- [ ] Memory cards expand/collapse
- [ ] Can create memories manually
- [ ] Session insights auto-captured on terminal close

---

## Phase 11: MCP Configuration

### 11.1 Database Models
- [ ] Create McpConfig model
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
- [ ] Run migration

### 11.2 MCP IPC Handlers
- [ ] Create `mcp:list` handler
- [ ] Create `mcp:create` handler
- [ ] Create `mcp:update` handler
- [ ] Create `mcp:delete` handler
- [ ] Create `mcp:toggle` handler

### 11.3 MCP UI
- [ ] Create /mcp page
- [ ] Build MCP overview header:
  - [ ] Project name
  - [ ] Enabled server count
- [ ] Build McpServerList component with categories:
  - [ ] Documentation
  - [ ] Knowledge Graphs
  - [ ] Integrations
  - [ ] Browser Automation
  - [ ] Built-in
- [ ] Build McpServerItem component:
  - [ ] Icon
  - [ ] Name
  - [ ] Description
  - [ ] Toggle switch
  - [ ] Configure button

### 11.4 Custom Server Management
- [ ] Build Custom Servers section
- [ ] Build AddCustomServerModal:
  - [ ] Name input
  - [ ] Type selector
  - [ ] Configuration JSON editor
  - [ ] Save/Cancel buttons
- [ ] Implement server configuration validation

### 11.5 MCP Config File Generation
- [ ] Generate claude_desktop_config.json format
- [ ] Auto-update config when servers toggle
- [ ] Support server-specific environment variables

**Phase 11 Verification:**
- [ ] MCP servers list displays preset servers
- [ ] Toggle enables/disables servers
- [ ] Custom server can be added
- [ ] Configuration persists to database
- [ ] Config file generates correctly

---

## Phase 12: GitHub Integration

### 12.1 GitHub Authentication
- [ ] Create GitHubToken storage in UserSettings
- [ ] Build token input UI in settings
- [ ] Validate token on save
- [ ] Encrypt token at rest (electron-store encryption)

### 12.2 GitHub IPC Handlers
- [ ] Create github service using Octokit
- [ ] Create `github:getIssues` handler
- [ ] Create `github:getIssue` handler
- [ ] Create `github:getPRs` handler
- [ ] Create `github:getPR` handler
- [ ] Create `github:createIssue` handler
- [ ] Create `github:createPR` handler
- [ ] Handle rate limiting gracefully

### 12.3 GitHub Issues UI
- [ ] Create /github/issues page
- [ ] Build IssuesList component
- [ ] Build IssueCard component:
  - [ ] Issue number and title
  - [ ] State (open/closed) badge
  - [ ] Labels
  - [ ] Assignees
  - [ ] Created date
- [ ] Build IssueDetailModal:
  - [ ] Full issue body (markdown)
  - [ ] Comments
  - [ ] "Create Task from Issue" button
- [ ] Implement issue → task conversion

### 12.4 GitHub PRs UI
- [ ] Create /github/prs page
- [ ] Build PrList component
- [ ] Build PrCard component:
  - [ ] PR number and title
  - [ ] State (open/merged/closed) badge
  - [ ] Branch info (head → base)
  - [ ] Review status
  - [ ] Created date
- [ ] Build PrDetailModal:
  - [ ] PR body
  - [ ] Files changed
  - [ ] Review comments

**Phase 12 Verification:**
- [ ] Can add GitHub token in settings
- [ ] Issues list loads from repository
- [ ] Issue detail shows full content
- [ ] Can create task from issue
- [ ] PRs list loads from repository
- [ ] PR detail shows files and reviews

---

## Phase 13: Additional Features

### 13.1 Insights Dashboard
- [ ] Create /insights page
- [ ] Build metrics cards:
  - [ ] Tasks completed (this week/month)
  - [ ] Average task duration
  - [ ] Tasks by status breakdown
  - [ ] Tasks by priority breakdown
- [ ] Add time tracking visualizations
  - [ ] Task completion over time chart
  - [ ] Time per phase breakdown
- [ ] Show productivity trends
- [ ] Display model usage stats (if tracked)

### 13.2 Ideation Board
- [ ] Create Idea model
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
- [ ] Create /ideation page
- [ ] Build IdeaCard component
- [ ] Implement voting (upvote/downvote)
- [ ] Add idea → feature conversion

### 13.3 Changelog
- [ ] Create ChangelogEntry model
- [ ] Create /changelog page
- [ ] Auto-generate entries from completed tasks
- [ ] Group by date/version
- [ ] Support manual entries
- [ ] Export changelog (markdown)

### 13.4 Native Features
- [ ] Implement native notifications
  - [ ] Task completion
  - [ ] Terminal errors
  - [ ] Mentions/assignments
- [ ] Add to system tray quick actions:
  - [ ] New Task
  - [ ] Show/Hide window
  - [ ] Recent projects
  - [ ] Quit
- [ ] Implement global keyboard shortcuts
  - [ ] Show/hide app
  - [ ] New task

**Phase 13 Verification:**
- [ ] Insights dashboard shows metrics
- [ ] Charts render correctly
- [ ] Ideation board displays ideas
- [ ] Can vote on ideas
- [ ] Changelog auto-generates from tasks
- [ ] Native notifications work
- [ ] System tray actions work

---

## Phase 14: Settings and Preferences

### 14.1 Settings Models
- [ ] Create/Update UserSettings model
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
- [ ] Run migration

### 14.2 Settings IPC Handlers
- [ ] Create `settings:get` handler
- [ ] Create `settings:update` handler
- [ ] Create `settings:updateApiKey` handler (encrypted)
- [ ] Create `settings:updateProfile` handler

### 14.3 Settings UI
- [ ] Create /settings page
- [ ] Build Profile section:
  - [ ] Avatar upload (local file)
  - [ ] Name input
  - [ ] Email display (read-only)
  - [ ] Change password form
- [ ] Build API Keys section:
  - [ ] Claude API key input (masked)
  - [ ] GitHub token input (masked)
  - [ ] Test connection buttons
- [ ] Build Preferences section:
  - [ ] Theme selector (Light/Dark/System)
  - [ ] Default terminal count
  - [ ] Auto-launch Claude toggle
  - [ ] Minimize to tray toggle
- [ ] Build Keyboard Shortcuts section:
  - [ ] List of shortcuts
  - [ ] Customization (future)

### 14.4 Theme System
- [ ] Implement theme persistence
- [ ] Support system theme detection
- [ ] Apply theme to all components
- [ ] Support theme switching without restart

**Phase 14 Verification:**
- [ ] Can update profile information
- [ ] Can change password
- [ ] API keys save securely
- [ ] Theme switching works
- [ ] Preferences persist across restarts

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

datasource db {
  provider = "sqlite"
  url      = "file:./claude-tasks.db"
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

### Phase 2 - Database
- [ ] SQLite database creates on first launch
- [ ] Prisma migrations apply
- [ ] CRUD operations work

### Phase 3 - Authentication
- [ ] User registration works
- [ ] User login works
- [ ] Session persists across restarts
- [ ] Protected routes redirect properly

### Phase 4 - Layout
- [ ] Sidebar navigation works
- [ ] Keyboard shortcuts function
- [ ] Project selector works
- [ ] Responsive layout

### Phase 5 - Projects
- [ ] Native file picker works
- [ ] Projects create/edit/delete
- [ ] Team management works

### Phase 6 - Tasks
- [ ] Kanban board displays
- [ ] Drag-and-drop works
- [ ] Task CRUD works
- [ ] Task modal functional

### Phase 7 - Terminals
- [ ] Terminal spawns shell
- [ ] Input/output works
- [ ] Resize works
- [ ] Claude Code launches

### Phase 8 - Worktrees
- [ ] Git operations work
- [ ] Worktree CRUD works
- [ ] Terminal worktree selector works

### Phase 9 - Roadmap
- [ ] Phases display
- [ ] Features with priorities
- [ ] Feature → Task conversion

### Phase 10 - Memory
- [ ] Memory CRUD works
- [ ] Search works
- [ ] Session capture works

### Phase 11 - MCP
- [ ] Server list displays
- [ ] Toggle works
- [ ] Custom server add works

### Phase 12 - GitHub
- [ ] Token authentication works
- [ ] Issues list/detail
- [ ] PRs list/detail
- [ ] Issue → Task works

### Phase 13 - Additional
- [ ] Insights displays metrics
- [ ] Ideation voting works
- [ ] Changelog generates
- [ ] Native notifications work

### Phase 14 - Settings
- [ ] Profile updates
- [ ] API keys save securely
- [ ] Theme switching works

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
