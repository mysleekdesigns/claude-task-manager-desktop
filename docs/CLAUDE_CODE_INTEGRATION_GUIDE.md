# Claude Code Integration Guide

## Overview

The Claude Tasks Desktop application includes built-in integration with Claude Code, allowing you to manage multiple Claude Code sessions across terminals and send commands to them simultaneously.

## Features

### 1. Claude Status Indicator

Each terminal displays a Claude status badge showing the current state:

- **No badge** - Claude Code is not running
- **"Claude active"** (blue badge) - Claude Code is actively running and processing
- **"Claude waiting"** (gray badge) - Claude Code is idle and waiting for input

The badge includes a Sparkles (✨) icon for easy visual identification.

### 2. Launch/Re-launch Claude Button

Each terminal header includes a button to launch or re-launch Claude Code:

- **"Launch Claude"** - Appears when Claude is inactive
- **"Re-launch Claude"** - Appears when Claude has been running before

Clicking this button sends the `claude` command to the terminal, starting Claude Code.

### 3. Invoke Claude All

The "Invoke Claude All" feature allows you to broadcast a command or prompt to multiple terminals at once.

#### How to Use

1. Click the "Invoke Claude All" button in the terminal toolbar (top-right)
2. A modal will open with:
   - Text area for your command/prompt
   - List of all terminals with checkboxes
   - "Select All" / "Deselect All" quick actions

3. Enter your command or prompt (e.g., "Review the current file for bugs")
4. Select which terminals should receive the command
   - Terminals with active Claude are pre-selected by default
   - You can select/deselect individual terminals

5. Click "Invoke All" to send the command
6. The modal will show execution status for each terminal:
   - Spinner icon - Command being sent
   - Green checkmark - Successfully sent
   - Red X - Failed to send (with error message)

7. The modal automatically closes on successful completion

## Keyboard Shortcuts

*Coming in future updates*

Planned shortcuts:
- `Cmd/Ctrl + Shift + I` - Open Invoke Claude All modal
- `Cmd/Ctrl + L` - Launch Claude in focused terminal

## Use Cases

### 1. Parallel Development Tasks

Launch Claude Code in multiple terminals, each working in different parts of your codebase:

```
Terminal 1: Working on frontend components
Terminal 2: Working on backend API
Terminal 3: Writing tests
Terminal 4: Documentation updates
```

Send a command to all terminals at once:
```
"Run the test suite and report any failures"
```

### 2. Multi-Branch Development

Use terminals connected to different git worktrees:

```
Terminal 1: main branch
Terminal 2: feature/new-ui branch
Terminal 3: bugfix/auth branch
```

Send updates to all branches:
```
"Update package dependencies to latest versions"
```

### 3. Code Review Workflow

Have Claude review different parts of your codebase simultaneously:

```
Terminal 1: src/components/
Terminal 2: src/routes/
Terminal 3: electron/
```

Send review prompt to all:
```
"Review code for security vulnerabilities and suggest improvements"
```

## Advanced Tips

### 1. Template Commands

Create a collection of commonly used commands:

**Code Review**
```
Review the current file for:
- Security vulnerabilities
- Performance issues
- Code quality improvements
- Missing error handling
```

**Refactoring**
```
Refactor this code to:
- Improve readability
- Follow TypeScript best practices
- Add proper type safety
- Extract reusable utilities
```

**Documentation**
```
Add comprehensive documentation including:
- JSDoc comments for functions
- Usage examples
- Type definitions
- Edge case handling
```

### 2. Terminal Organization

Organize terminals by responsibility:

- **Development Terminals** - Active coding work
- **Review Terminals** - Code review and analysis
- **Test Terminals** - Running tests and checking coverage
- **Utility Terminals** - Git operations, package management

### 3. Status Monitoring

The Claude status badges help you understand terminal state at a glance:

- **Active** - Claude is working on a task
- **Waiting** - Claude is ready for new commands
- **Inactive** - Terminal is free for manual commands

## Troubleshooting

### Claude Doesn't Launch

**Problem:** Clicking "Launch Claude" doesn't start Claude Code

**Solutions:**
1. Check that Claude Code is installed globally (`npm install -g @anthropic-ai/claude-code`)
2. Verify the terminal has an active shell session
3. Check terminal output for error messages

### Commands Not Sending

**Problem:** Invoke Claude All shows errors when sending commands

**Solutions:**
1. Ensure terminals are in running state (not exited)
2. Check that Claude Code is active in target terminals
3. Verify network connection (for Claude API calls)

### Status Not Updating

**Problem:** Claude status badge doesn't reflect actual state

**Solutions:**
1. This is expected in current version (Phase 7.7)
2. Automatic status detection coming in future update
3. Manually track status based on terminal output
4. Use Re-launch button to reset status

## Implementation Details

### Terminal Write IPC

Commands are sent to terminals using the `terminal:write` IPC channel:

```typescript
await window.electron.invoke('terminal:write', {
  id: terminalId,
  data: 'claude\n',
});
```

### Broadcast Implementation

The Invoke Claude All feature sends commands in parallel:

```typescript
await Promise.all(
  selectedTerminals.map(id =>
    window.electron.invoke('terminal:write', {
      id,
      data: `${command}\n`,
    })
  )
);
```

### Status Detection (Coming Soon)

Future versions will automatically detect Claude status using pattern matching:

```typescript
import { detectClaudeStatus } from '@/lib/claude-detector';

const status = detectClaudeStatus(terminalOutput);
// Returns: 'inactive' | 'active' | 'waiting'
```

## Future Features

### Planned Enhancements

1. **Automatic Status Detection**
   - Real-time Claude status updates based on terminal output
   - Visual indicators for Claude waiting state

2. **Command History**
   - Store recent Invoke Claude commands
   - Quick-select from history dropdown
   - Save custom command templates

3. **Auto-launch Setting**
   - Automatically launch Claude when terminal is created
   - Per-project configuration
   - Custom startup commands

4. **Response Monitoring**
   - Track Claude responses across terminals
   - Parse completion signals
   - Update task status automatically

5. **Terminal Grouping**
   - Create terminal groups for batch operations
   - Send commands to specific groups
   - Save group configurations

## Feedback

This is Phase 7.7 of the Claude Tasks Desktop implementation. Features and workflows will continue to evolve based on user feedback and requirements.

For issues or feature requests, please refer to the project documentation.
