# Sidebar Component Documentation

## Overview

The Sidebar component is a collapsible navigation menu that provides quick access to all main application features in Claude Task Manager Desktop. It includes keyboard shortcut support, visual indicators for active routes, and persistent state management.

## Location

- **Component:** `/src/components/layout/Sidebar.tsx`
- **Layout Wrapper:** `/src/components/layout/MainLayout.tsx`
- **Store:** `/src/store/useSidebarStore.ts`

## Features

### 1. Navigation Items

The sidebar includes the following navigation options:

| Label | Icon | Route | Keyboard Shortcut |
|-------|------|-------|-------------------|
| Kanban Board | LayoutGrid | `/kanban` | ⌘⇧K |
| Agent Terminals | Terminal | `/terminals` | ⌘⇧A |
| Insights | BarChart | `/insights` | ⌘⇧N |
| Roadmap | Map | `/roadmap` | ⌘⇧D |
| Ideation | Lightbulb | `/ideation` | ⌘⇧I |
| Changelog | FileText | `/changelog` | ⌘⇧L |
| Context | Brain | `/context` | ⌘⇧C |
| MCP Overview | Plug | `/mcp` | ⌘⇧M |
| Worktrees | GitBranch | `/worktrees` | ⌘⇧W |
| GitHub Issues | CircleDot | `/issues` | ⌘⇧G |
| GitHub PRs | GitPullRequest | `/prs` | ⌘⇧P |

### 2. Additional Elements

- **New Task Button:** Prominent button at the top (⌘N)
- **Claude Code Link:** External link to claude.ai/code
- **Settings:** Link to application settings

### 3. Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Toggle Sidebar | ⌘B |
| New Task | ⌘N |
| Navigate to Page | ⌘⇧[Key] |

### 4. Collapsed State

- Width: 64px (collapsed) / 256px (expanded)
- Animations: Smooth transitions (300ms)
- State Persistence: Saved to localStorage via Zustand
- Icons: Always visible
- Text: Hidden when collapsed
- Tooltips: Shown when collapsed with keyboard shortcuts

### 5. Visual Indicators

- **Active Route:** Highlighted with accent background color
- **Hover States:** Interactive feedback on all buttons
- **Keyboard Shortcut Display:** Small kbd badges showing shortcuts

## Usage

### Basic Implementation

The MainLayout component wraps the Sidebar with the content area:

```tsx
import { MainLayout } from '@/components/layout';

// In routes configuration
{
  path: '/',
  element: (
    <ProtectedRoute>
      <MainLayout />
    </ProtectedRoute>
  ),
  children: [
    // Child routes are rendered in the content area
  ],
}
```

### Custom Task Creation Handler

```tsx
<Sidebar onNewTask={() => {
  // Your custom task creation logic
  console.log('Create new task');
}} />
```

### Accessing Sidebar State

```tsx
import { useSidebarStore } from '@/store/useSidebarStore';

function MyComponent() {
  const { collapsed, setCollapsed, toggleCollapsed } = useSidebarStore();

  return (
    <div>
      Sidebar is {collapsed ? 'collapsed' : 'expanded'}
      <button onClick={toggleCollapsed}>Toggle</button>
    </div>
  );
}
```

## Architecture

### Component Structure

```
Sidebar (TooltipProvider wrapper)
├── Header
│   ├── Logo + Title (when expanded)
│   └── Collapse Button
├── New Task Button
├── Navigation Items (map)
│   └── NavButton + Tooltip
└── Footer
    ├── Claude Code Link
    └── Settings Link
```

### State Management

The sidebar uses Zustand with persistence middleware:

```typescript
interface SidebarState {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
}
```

State is automatically persisted to `localStorage` under the key `sidebar-storage`.

### Routing Integration

- Uses `react-router-dom`'s `useLocation` to detect active route
- Uses `useNavigate` for programmatic navigation
- Active route detection highlights the corresponding nav item

## Styling

### Theme Integration

The Sidebar uses Tailwind CSS with CSS variables for theming:

- `bg-card` - Sidebar background
- `border-border` - Border colors
- `text-foreground` - Default text color
- `text-muted-foreground` - Secondary text color
- `bg-accent` - Active route background
- Gradient: `from-cyan-400 to-cyan-600` - Brand accent (logo, New Task button)

### Responsive Design

Currently fixed-width, but the collapsed state provides a compact view:
- **Expanded:** 256px (16rem)
- **Collapsed:** 64px (4rem)

## Accessibility

- **Keyboard Navigation:** Full keyboard support for all actions
- **ARIA Labels:** Proper labeling via shadcn/ui components
- **Focus Management:** Clear focus indicators
- **Tooltips:** Context provided via Radix UI Tooltip primitives

## Dependencies

### Required Packages

```json
{
  "react-router-dom": "^7.x",
  "zustand": "^5.x",
  "lucide-react": "^0.x",
  "@radix-ui/react-tooltip": "via shadcn/ui"
}
```

### shadcn/ui Components

- `Button`
- `Tooltip`, `TooltipProvider`, `TooltipTrigger`, `TooltipContent`

## Future Enhancements

Potential improvements for future phases:

1. **User Preferences**
   - Configurable keyboard shortcuts
   - Custom navigation order
   - Hide/show specific items

2. **Badge Indicators**
   - Notification counts on navigation items
   - Active terminal indicators
   - Unread changelog entries

3. **Search**
   - Quick search/filter for navigation items
   - Command palette integration

4. **Responsive Behavior**
   - Auto-collapse on mobile/small screens
   - Drawer-style overlay on touch devices

5. **Customization**
   - Theme color picker
   - Icon customization
   - Layout position (left/right)

## Testing

To test the Sidebar:

1. **Visual Testing:**
   ```bash
   npm run dev
   ```
   - Navigate through all routes
   - Test collapse/expand animation
   - Verify tooltips in collapsed state

2. **Keyboard Testing:**
   - Try all keyboard shortcuts (⌘B, ⌘N, ⌘⇧K, etc.)
   - Test navigation with Tab key
   - Verify focus indicators

3. **State Persistence:**
   - Collapse sidebar → refresh page → verify state persists
   - Clear localStorage → verify default expanded state

## Troubleshooting

### Sidebar doesn't collapse

Check that Zustand is properly installed:
```bash
npm install zustand
```

### Routes not highlighting

Verify that route paths match exactly:
- Sidebar uses `/kanban`, `/terminals`, etc.
- Routes should be defined without trailing slashes

### Keyboard shortcuts not working

- Ensure `useEffect` cleanup is working
- Check for event propagation conflicts
- Verify no input fields are capturing events

## Related Files

- **MainLayout:** `/src/components/layout/MainLayout.tsx`
- **Route Configuration:** `/src/routes/routes.tsx`
- **Theme Configuration:** `/src/index.css`
- **IPC Types:** `/src/types/ipc.ts` (for future task creation)

## Migration Notes

If you have an existing DashboardLayout or Sidebar component:

1. Replace `<DashboardLayout>` with `<MainLayout>` in route config
2. Update route structure to use nested children
3. Remove old collapsed state props (now managed by Zustand)
4. Update keyboard shortcut handlers if customized
