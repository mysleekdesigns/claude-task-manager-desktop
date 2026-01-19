# Layout Components

Production-quality Header components for the Claude Tasks Desktop application.

## Components

### Header
Main application header with project selector, global search, and user menu.

**Features:**
- Project dropdown selector
- Global search input with keyboard shortcut hint (Cmd/Ctrl+K)
- User avatar menu with profile and logout
- Optional window controls for frameless mode

**Usage:**
```tsx
import { Header } from '@/components/layout';

function App() {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Your content */}
      </main>
    </div>
  );
}

// With window controls for frameless window
function App() {
  const handleMinimize = () => window.electron.invoke('window:minimize');
  const handleMaximize = () => window.electron.invoke('window:maximize');
  const handleClose = () => window.electron.invoke('window:close');

  return (
    <div className="h-screen flex flex-col">
      <Header
        showWindowControls={true}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        onClose={handleClose}
      />
      <main className="flex-1">
        {/* Your content */}
      </main>
    </div>
  );
}
```

### ProjectSelector
Dropdown to switch between projects and create new ones.

**Features:**
- Shows current project name
- Lists all user projects with paths
- "Create New Project" action
- Currently uses mock data (will be replaced with IPC call)

**Usage:**
```tsx
import { ProjectSelector } from '@/components/layout';

function MyComponent() {
  return <ProjectSelector />;
}
```

**TODO:**
- Replace mock data with `invoke('projects:list')` when IPC handler is ready
- Connect to global state/context for current project
- Implement project switching via `invoke('projects:switch', projectId)`

### UserMenu
User avatar/initials dropdown with profile and logout actions.

**Features:**
- Displays user avatar or initials from name/email
- Shows user name and email in dropdown
- Links to Profile and Settings pages
- Logout action with navigation

**Usage:**
```tsx
import { UserMenu } from '@/components/layout';

function MyComponent() {
  return <UserMenu />;
}
```

**Note:** Must be used within AuthProvider context.

## Integration

These components are designed to work with:
- **AuthProvider**: Provides user data and logout functionality
- **React Router**: Navigation to settings and profile pages
- **shadcn/ui**: Uses Button, Avatar, Input, DropdownMenu components
- **Tailwind CSS**: Dark theme with cyan accents

## File Structure

```
src/components/layout/
├── Header.tsx           # Main header component
├── ProjectSelector.tsx  # Project dropdown
├── UserMenu.tsx        # User avatar menu
├── index.tsx           # Barrel exports
└── README.md           # This file
```

## Keyboard Shortcuts

- **Search**: Cmd+K (macOS) / Ctrl+K (Windows/Linux) - Opens global search (placeholder)

## Window Controls

The Header component supports optional window controls for frameless Electron windows:
- Minimize button
- Maximize/Restore button
- Close button (with destructive hover style)

To enable, set `showWindowControls={true}` and provide callback handlers.

## Styling

All components follow the dark theme with cyan accents defined in the project's Tailwind config:
- Background: Dark navy (`hsl(222.2 84% 4.9%)`)
- Primary: Cyan (`hsl(199.89 95% 48.04%)`)
- Uses shadcn/ui's CSS variables for consistency

## Dependencies

- React 19
- React Router 7
- shadcn/ui components (Avatar, Button, DropdownMenu, Input)
- lucide-react icons
- @/hooks/useAuth
- @/components/ui/*
