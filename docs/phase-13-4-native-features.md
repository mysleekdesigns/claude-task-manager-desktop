# Phase 13.4: Native Features Implementation

## Overview

Phase 13.4 implements native desktop features for Claude Tasks Desktop, including:

- Native notifications using Electron's Notification API
- Enhanced system tray with quick actions and recent projects
- Global keyboard shortcuts for common actions

## Implementation Details

### 1. Native Notifications

**Location:** `electron/services/notifications.ts`

The notification service provides a unified interface for showing notifications across all platforms (Windows, macOS, Linux).

**Key Features:**
- Task completion notifications
- Terminal error notifications
- Assignment/mention notifications
- Generic notification support
- Automatic permission handling per platform
- Click-to-focus behavior

**Usage Example (from renderer):**
```typescript
// Show task completed notification
await window.electron.invoke('notifications:taskCompleted', {
  taskId: '123',
  taskTitle: 'Implement authentication',
  projectName: 'My Project'
});

// Show terminal error
await window.electron.invoke('notifications:terminalError', {
  terminalName: 'Main Terminal',
  error: 'Command failed with exit code 1'
});

// Show assignment notification
await window.electron.invoke('notifications:assignment', {
  taskId: '456',
  taskTitle: 'Fix bug in login',
  projectName: 'Auth Project',
  assignerName: 'John Doe'
});

// Generic notification
await window.electron.invoke('notifications:show', {
  title: 'Custom Title',
  body: 'Custom message',
  urgency: 'critical'
});
```

**Platform Differences:**
- **Windows/macOS:** Notifications enabled by default
- **Linux:** Depends on desktop environment notification daemon
- All platforms support click-to-focus behavior

**IPC Handlers:**
- `notifications:isSupported` - Check if notifications are available
- `notifications:requestPermission` - Request notification permission
- `notifications:show` - Show generic notification
- `notifications:taskCompleted` - Show task completion notification
- `notifications:terminalError` - Show terminal error notification
- `notifications:assignment` - Show assignment notification

### 2. Enhanced System Tray

**Location:** `electron/services/tray.ts`

The tray service has been enhanced with dynamic recent projects and quick actions.

**Features:**
- Toggle window visibility (Show/Hide)
- New Task quick action (Cmd/Ctrl+Shift+N)
- Recent Projects submenu (last 5 projects)
- Quit action
- Dynamic menu updates

**Menu Structure:**
```
┌─────────────────────────────────────┐
│ Show/Hide Claude Tasks              │
├─────────────────────────────────────┤
│ New Task            Cmd+Shift+N     │
│ Recent Projects              >      │
├─────────────────────────────────────┤
│ Quit                Cmd+Q           │
└─────────────────────────────────────┘
```

**Recent Projects Submenu:**
- Displays the 5 most recently updated projects
- Click to open project in main window
- Shows "No recent projects" when database is empty
- Shows "Database not connected" if DB unavailable

**IPC Events Sent to Renderer:**
- `tray:new-task` - Triggered when "New Task" is clicked
- `tray:open-project` - Triggered when a project is clicked (includes projectId)

**Renderer Integration:**
```typescript
// Listen for tray events
window.electron.on('tray:new-task', () => {
  // Open new task modal
  openTaskModal();
});

window.electron.on('tray:open-project', (projectId: string) => {
  // Navigate to project
  navigate(`/projects/${projectId}`);
});
```

**Refreshing Tray Menu:**
The tray menu is automatically refreshed when:
- Window visibility changes
- Can be manually refreshed by calling `trayService.refreshMenu()` from main process

### 3. Global Keyboard Shortcuts

**Location:** `electron/services/shortcuts.ts`

The shortcuts service registers global keyboard shortcuts that work even when the app is not focused.

**Registered Shortcuts:**

| Shortcut | Action | Description |
|----------|--------|-------------|
| Cmd/Ctrl+Shift+T | Toggle App | Show/hide the main window |
| Cmd/Ctrl+Shift+N | New Task | Open new task dialog |

**Features:**
- Cross-platform support (macOS uses Cmd, Windows/Linux use Ctrl)
- Intelligent toggle behavior:
  - If window is hidden, show it
  - If window is visible but not focused, focus it
  - If window is visible and focused, hide it
- Automatic cleanup on app quit
- Error handling for conflicting shortcuts

**Usage in Code:**
```typescript
// The shortcuts are automatically registered in main.ts
shortcutService.initialize(mainWindow);

// Register custom shortcut (if needed)
shortcutService.register(
  'CommandOrControl+Shift+P',
  () => console.log('Custom shortcut triggered'),
  'Open command palette'
);

// Check if shortcut is registered
const isRegistered = shortcutService.isRegistered('CommandOrControl+Shift+T');

// Get all registered shortcuts
const shortcuts = shortcutService.getRegisteredShortcuts();
// Returns: [{ key: 'CommandOrControl+Shift+T', description: 'Toggle application window' }, ...]
```

**IPC Events Sent to Renderer:**
- `shortcuts:new-task` - Triggered when Cmd/Ctrl+Shift+N is pressed

**Renderer Integration:**
```typescript
// Listen for shortcut events
window.electron.on('shortcuts:new-task', () => {
  // Open new task modal
  openTaskModal();
});
```

## File Structure

```
electron/
├── services/
│   ├── notifications.ts       # Native notification service
│   ├── shortcuts.ts           # Global keyboard shortcuts service
│   └── tray.ts               # Enhanced system tray service (updated)
├── ipc/
│   ├── notifications.ts       # Notification IPC handlers
│   └── index.ts              # Updated to register notification handlers
└── main.ts                   # Updated to initialize shortcuts service

src/
└── types/
    └── ipc.ts                # Updated with notification type definitions
```

## Integration with Main Process

The services are initialized in `electron/main.ts`:

```typescript
// Initialize tray after window is created
trayService.initialize(mainWindow);

// Initialize global keyboard shortcuts
shortcutService.initialize(mainWindow);
```

IPC handlers are registered in `electron/ipc/index.ts`:

```typescript
registerNotificationHandlers();
```

## Testing Checklist

### Notifications
- [ ] Task completion notification shows correctly
- [ ] Terminal error notification shows correctly
- [ ] Assignment notification shows correctly
- [ ] Clicking notification focuses the app
- [ ] Notifications work on Windows
- [ ] Notifications work on macOS
- [ ] Notifications work on Linux

### System Tray
- [ ] Tray icon appears in system tray
- [ ] "Show/Hide Claude Tasks" toggles window
- [ ] "New Task" sends IPC event to renderer
- [ ] Recent projects are populated correctly
- [ ] Clicking a project opens it in main window
- [ ] "Quit" closes the application
- [ ] Menu updates when projects change

### Keyboard Shortcuts
- [ ] Cmd/Ctrl+Shift+T toggles window visibility
- [ ] Cmd/Ctrl+Shift+N triggers new task event
- [ ] Shortcuts work when app is not focused
- [ ] Shortcuts are platform-specific (Cmd on macOS, Ctrl on Windows/Linux)
- [ ] Shortcuts are unregistered on app quit

## Future Enhancements

1. **Notification Preferences**
   - Add settings to enable/disable notification types
   - Customize notification sounds
   - Set quiet hours

2. **More Keyboard Shortcuts**
   - Quick search (Cmd/Ctrl+K)
   - Switch between projects (Cmd/Ctrl+1-9)
   - Focus terminal (Cmd/Ctrl+`)

3. **Tray Enhancements**
   - Show unread notification count in tray icon
   - Add "Recent Tasks" submenu
   - Quick terminal access from tray

4. **Notification Actions**
   - "Mark as Done" button on task notifications
   - "View Details" button to open specific task
   - Snooze notifications

## Known Limitations

1. **Linux Notifications**
   - Depend on desktop environment's notification daemon
   - May not work in all Linux distributions
   - Some DEs may not support notification actions

2. **Global Shortcuts**
   - Can conflict with other applications
   - Limited number of available key combinations
   - Cannot override system shortcuts

3. **Tray Menu Updates**
   - Recent projects menu is cached until window visibility changes
   - Manual refresh needed when projects are created/deleted outside the app

## References

- [Electron Notification API](https://www.electronjs.org/docs/latest/api/notification)
- [Electron globalShortcut API](https://www.electronjs.org/docs/latest/api/global-shortcut)
- [Electron Tray API](https://www.electronjs.org/docs/latest/api/tray)
