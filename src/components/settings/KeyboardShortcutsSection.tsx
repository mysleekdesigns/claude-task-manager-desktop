/**
 * Keyboard Shortcuts Section Component (Phase 14.3)
 *
 * Settings section displaying keyboard shortcuts.
 * Currently display-only - customization marked as future enhancement.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// Types
// ============================================================================

interface KeyboardShortcut {
  id: string;
  action: string;
  description: string;
  keys: string[];
  category: 'Navigation' | 'Tasks' | 'Terminals' | 'General';
}

// ============================================================================
// Shortcuts Data
// ============================================================================

const SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  {
    id: 'nav-dashboard',
    action: 'Go to Dashboard',
    description: 'Navigate to the dashboard page',
    keys: ['⌘', 'Shift', 'D'],
    category: 'Navigation',
  },
  {
    id: 'nav-projects',
    action: 'Go to Projects',
    description: 'Navigate to the projects page',
    keys: ['⌘', 'Shift', 'P'],
    category: 'Navigation',
  },
  {
    id: 'nav-tasks',
    action: 'Go to Tasks',
    description: 'Navigate to the tasks page',
    keys: ['⌘', 'Shift', 'T'],
    category: 'Navigation',
  },
  {
    id: 'nav-roadmap',
    action: 'Go to Roadmap',
    description: 'Navigate to the roadmap page',
    keys: ['⌘', 'Shift', 'R'],
    category: 'Navigation',
  },
  {
    id: 'nav-memory',
    action: 'Go to Memory',
    description: 'Navigate to the memory page',
    keys: ['⌘', 'Shift', 'M'],
    category: 'Navigation',
  },
  {
    id: 'nav-insights',
    action: 'Go to Insights',
    description: 'Navigate to the insights page',
    keys: ['⌘', 'Shift', 'I'],
    category: 'Navigation',
  },
  {
    id: 'nav-settings',
    action: 'Go to Settings',
    description: 'Navigate to the settings page',
    keys: ['⌘', ','],
    category: 'Navigation',
  },
  {
    id: 'toggle-sidebar',
    action: 'Toggle Sidebar',
    description: 'Show or hide the sidebar',
    keys: ['⌘', 'B'],
    category: 'Navigation',
  },

  // Tasks
  {
    id: 'task-new',
    action: 'New Task',
    description: 'Create a new task',
    keys: ['⌘', 'N'],
    category: 'Tasks',
  },
  {
    id: 'task-search',
    action: 'Search Tasks',
    description: 'Focus the task search input',
    keys: ['⌘', 'K'],
    category: 'Tasks',
  },

  // Terminals
  {
    id: 'terminal-new',
    action: 'New Terminal',
    description: 'Open a new terminal',
    keys: ['⌘', 'T'],
    category: 'Terminals',
  },
  {
    id: 'terminal-close',
    action: 'Close Terminal',
    description: 'Close the active terminal',
    keys: ['⌘', 'W'],
    category: 'Terminals',
  },
  {
    id: 'terminal-clear',
    action: 'Clear Terminal',
    description: 'Clear the terminal output',
    keys: ['⌘', 'L'],
    category: 'Terminals',
  },

  // General
  {
    id: 'general-refresh',
    action: 'Refresh',
    description: 'Refresh the current view',
    keys: ['⌘', 'R'],
    category: 'General',
  },
  {
    id: 'general-quit',
    action: 'Quit Application',
    description: 'Quit the application',
    keys: ['⌘', 'Q'],
    category: 'General',
  },
];

// ============================================================================
// Component
// ============================================================================

export function KeyboardShortcutsSection() {
  // Group shortcuts by category
  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  const renderKeys = (keys: string[]) => {
    return (
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            <kbd className="px-2 py-1 rounded border border-border bg-muted font-mono text-xs min-w-[24px] text-center">
              {key}
            </kbd>
            {index < keys.length - 1 && (
              <span className="text-muted-foreground text-xs">+</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Keyboard Shortcuts</CardTitle>
            <CardDescription>
              Navigate and control the application using keyboard shortcuts
            </CardDescription>
          </div>
          <Badge variant="outline">Display Only</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Info Banner */}
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            Keyboard shortcuts help you navigate and perform actions quickly. Custom shortcuts
            will be available in a future update.
          </p>
        </div>

        {/* Shortcuts by Category */}
        {categories.map((category) => {
          const categoryShortcuts = SHORTCUTS.filter((s) => s.category === category);

          return (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{category}</h3>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Action</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[200px] text-right">Shortcut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryShortcuts.map((shortcut) => (
                      <TableRow key={shortcut.id}>
                        <TableCell className="font-medium">{shortcut.action}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {shortcut.description}
                        </TableCell>
                        <TableCell className="text-right">
                          {renderKeys(shortcut.keys)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })}

        {/* Platform Notice */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Note: On Windows and Linux, use <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-xs">Ctrl</kbd> instead of <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-xs">⌘</kbd>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
