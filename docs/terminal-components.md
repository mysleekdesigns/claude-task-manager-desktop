# Terminal UI Components Documentation

This document describes the Terminal UI components built for Phase 7 of the Claude Tasks Desktop application.

## Overview

The terminal components provide a multi-terminal interface for managing Claude Code sessions. The design supports 1-12 concurrent terminals in a responsive grid layout with expand/collapse functionality.

## Components

### 1. TerminalPane

**File:** `src/components/terminal/TerminalPane.tsx`

A single terminal pane with header controls and content area.

#### Props

```typescript
interface TerminalPaneProps {
  terminal: {
    id: string;
    name: string;
    status: 'idle' | 'running' | 'exited';
  };
  isExpanded?: boolean;
  onClose: (id: string) => void;
  onExpand: (id: string) => void;
  onCollapse: () => void;
  children?: React.ReactNode; // Slot for XTermWrapper content
}
```

#### Features

- **Header Controls**
  - Status indicator dot (green for running, gray for idle, red for exited)
  - Editable terminal name (click to rename)
  - Status badge
  - Worktree selector dropdown (placeholder for Phase 8)
  - More options menu (rename, close)
  - Expand/collapse button
  - Close button

- **Close Confirmation**
  - Shows confirmation dialog when closing a running terminal
  - Prevents accidental termination of active sessions

- **Content Area**
  - Black background for terminal display
  - Accepts children prop for XTermWrapper integration
  - Shows placeholder text when no content provided

#### Usage

```tsx
import { TerminalPane } from '@/components/terminal';

<TerminalPane
  terminal={{ id: '1', name: 'Terminal 1', status: 'running' }}
  isExpanded={false}
  onClose={(id) => handleClose(id)}
  onExpand={(id) => handleExpand(id)}
  onCollapse={handleCollapse}
>
  {/* XTermWrapper will go here */}
</TerminalPane>
```

### 2. TerminalGrid

**File:** `src/components/terminal/TerminalGrid.tsx`

Grid layout for displaying multiple terminal panes with automatic sizing.

#### Props

```typescript
interface TerminalGridProps {
  terminals: Array<{
    id: string;
    name: string;
    status: 'idle' | 'running' | 'exited';
  }>;
  expandedTerminalId?: string | null;
  onTerminalClose: (id: string) => void;
  onTerminalExpand: (id: string) => void;
  onCollapseExpanded: () => void;
  children?: React.ReactNode;
}
```

#### Grid Layout Rules

The grid automatically adjusts based on terminal count:

- **1 terminal**: 1x1 grid
- **2 terminals**: 2x1 grid
- **3-4 terminals**: 2x2 grid
- **5-6 terminals**: 3x2 grid
- **7-9 terminals**: 3x3 grid
- **10-12 terminals**: 4x3 grid

#### Features

- **Responsive Grid**
  - Automatic column/row calculation
  - Smooth transitions when adding/removing terminals
  - Proper spacing and gaps

- **Expand Mode**
  - When a terminal is expanded, shows only that terminal full-screen
  - Automatically returns to grid when collapsed

- **Empty State**
  - Shows helpful message when no terminals are open
  - Keyboard emoji icon for visual interest

#### Usage

```tsx
import { TerminalGrid } from '@/components/terminal';

<TerminalGrid
  terminals={terminals}
  expandedTerminalId={expandedId}
  onTerminalClose={handleClose}
  onTerminalExpand={handleExpand}
  onCollapseExpanded={handleCollapse}
/>
```

### 3. TerminalToolbar

**File:** `src/components/terminal/TerminalToolbar.tsx`

Control bar for terminal management.

#### Props

```typescript
interface TerminalToolbarProps {
  terminalCount: number;
  maxTerminals?: number; // default: 12
  onNewTerminal: () => void;
  onInvokeClaudeAll: () => void;
}
```

#### Features

- **Terminal Count Badge**
  - Shows current vs. maximum terminals (e.g., "4/12")
  - Terminal icon for visual identification

- **New Terminal Button**
  - Primary action button
  - Disabled when at maximum capacity
  - Tooltip shows status

- **Invoke Claude All Button**
  - Runs Claude Code in all terminals
  - Disabled when no terminals exist
  - Sparkles icon for AI-related action

#### Usage

```tsx
import { TerminalToolbar } from '@/components/terminal';

<TerminalToolbar
  terminalCount={terminals.length}
  maxTerminals={12}
  onNewTerminal={handleNewTerminal}
  onInvokeClaudeAll={handleInvokeClaudeAll}
/>
```

## Complete Example

```tsx
import { useState } from 'react';
import { TerminalGrid, TerminalToolbar } from '@/components/terminal';

function TerminalPage() {
  const [terminals, setTerminals] = useState([
    { id: '1', name: 'Terminal 1', status: 'running' },
    { id: '2', name: 'Terminal 2', status: 'idle' },
  ]);
  const [expandedId, setExpandedId] = useState(null);

  const handleNewTerminal = () => {
    const newId = (terminals.length + 1).toString();
    setTerminals([...terminals, {
      id: newId,
      name: `Terminal ${newId}`,
      status: 'idle',
    }]);
  };

  const handleClose = (id) => {
    setTerminals(terminals.filter(t => t.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  return (
    <div className="flex flex-col h-screen">
      <TerminalToolbar
        terminalCount={terminals.length}
        onNewTerminal={handleNewTerminal}
        onInvokeClaudeAll={() => console.log('Invoke all')}
      />
      <div className="flex-1 overflow-hidden">
        <TerminalGrid
          terminals={terminals}
          expandedTerminalId={expandedId}
          onTerminalClose={handleClose}
          onTerminalExpand={setExpandedId}
          onCollapseExpanded={() => setExpandedId(null)}
        />
      </div>
    </div>
  );
}
```

## Styling

All components use shadcn/ui components for consistent styling:

- **Cards**: Terminal panes use `Card`, `CardHeader`, `CardContent`
- **Buttons**: All buttons use `Button` with appropriate variants
- **Badges**: Status badges use `Badge` component
- **Dialogs**: Close confirmation uses `Dialog` components
- **Dropdowns**: Menus use `DropdownMenu` components
- **Tooltips**: Help text uses `Tooltip` components

### Dark Theme Support

All components support dark theme through Tailwind CSS theme variables. The terminal content area has a black background by default for terminal display.

### Transitions

Smooth transitions are applied to:
- Grid layout changes
- Expand/collapse animations
- Hover states
- Shadow changes

## Integration Points

### Phase 7 (Current)

These UI components are ready for integration with:
- XTermWrapper component (terminal emulator)
- Terminal state management
- IPC handlers for terminal creation/management

### Phase 8 (Git Worktrees)

The worktree selector dropdown is already in place in the TerminalPane header. It currently shows a placeholder menu item.

## Files Created

1. `/src/components/terminal/TerminalPane.tsx` - Individual terminal pane
2. `/src/components/terminal/TerminalGrid.tsx` - Grid layout manager
3. `/src/components/terminal/TerminalToolbar.tsx` - Control toolbar
4. `/src/components/terminal/index.ts` - Component exports
5. `/src/components/terminal/TerminalExample.tsx` - Example/demo component
6. `/docs/terminal-components.md` - This documentation

## Testing

To test the components independently, you can use the `TerminalExample` component:

```tsx
import { TerminalExample } from '@/components/terminal/TerminalExample';

// Render in your app for testing
<TerminalExample />
```

This provides a working demo with mock data to verify layout, interactions, and styling.

## Next Steps

1. **Phase 7 Integration**
   - Integrate XTermWrapper into TerminalPane children slot
   - Connect to terminal IPC handlers
   - Add terminal state management (Zustand store)

2. **Phase 8 Integration**
   - Implement worktree selector functionality
   - Connect to git worktree IPC handlers
   - Show current worktree in terminal header

3. **Future Enhancements**
   - Keyboard shortcuts for terminal management
   - Drag-to-reorder terminals
   - Save/restore terminal layouts
   - Terminal themes/color schemes
