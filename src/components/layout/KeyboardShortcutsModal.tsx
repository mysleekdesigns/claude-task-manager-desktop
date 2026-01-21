import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Command,
  Keyboard,
  LayoutDashboard,
  KanbanSquare,
  Terminal,
  BarChart3,
  MapPin,
  Lightbulb,
  ScrollText,
  Database,
  Settings,
  Blocks,
  GitBranch,
  Github,
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutSection {
  title: string;
  shortcuts: {
    keys: string[];
    description: string;
    icon?: React.ReactNode;
  }[];
}

// @ts-expect-error navigator.platform is deprecated but still works
const isMac = (navigator.platform?.toUpperCase().includes('MAC') ?? navigator.userAgent.toUpperCase().includes('MAC'));
const modKey = isMac ? '⌘' : 'Ctrl';

const shortcutSections: ShortcutSection[] = [
  {
    title: 'General',
    shortcuts: [
      {
        keys: ['?'],
        description: 'Show keyboard shortcuts',
        icon: <Keyboard className="h-4 w-4" />,
      },
      {
        keys: [modKey, 'K'],
        description: 'Open command palette',
        icon: <Command className="h-4 w-4" />,
      },
      {
        keys: [modKey, 'B'],
        description: 'Toggle sidebar',
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        keys: ['Esc'],
        description: 'Close dialog/modal',
      },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      {
        keys: ['G', 'K'],
        description: 'Go to Kanban board',
        icon: <KanbanSquare className="h-4 w-4" />,
      },
      {
        keys: ['G', 'T'],
        description: 'Go to Terminals',
        icon: <Terminal className="h-4 w-4" />,
      },
      {
        keys: ['G', 'I'],
        description: 'Go to Insights',
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        keys: ['G', 'R'],
        description: 'Go to Roadmap',
        icon: <MapPin className="h-4 w-4" />,
      },
      {
        keys: ['G', 'D'],
        description: 'Go to Ideation',
        icon: <Lightbulb className="h-4 w-4" />,
      },
      {
        keys: ['G', 'C'],
        description: 'Go to Changelog',
        icon: <ScrollText className="h-4 w-4" />,
      },
      {
        keys: ['G', 'M'],
        description: 'Go to Context & Memory',
        icon: <Database className="h-4 w-4" />,
      },
      {
        keys: ['G', 'P'],
        description: 'Go to MCP Config',
        icon: <Blocks className="h-4 w-4" />,
      },
      {
        keys: ['G', 'W'],
        description: 'Go to Worktrees',
        icon: <GitBranch className="h-4 w-4" />,
      },
      {
        keys: ['G', 'H'],
        description: 'Go to GitHub',
        icon: <Github className="h-4 w-4" />,
      },
      {
        keys: ['G', 'S'],
        description: 'Go to Settings',
        icon: <Settings className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Tasks',
    shortcuts: [
      {
        keys: ['C'],
        description: 'Create new task',
      },
      {
        keys: ['E'],
        description: 'Edit selected task',
      },
      {
        keys: ['D'],
        description: 'Delete selected task',
      },
      {
        keys: ['Enter'],
        description: 'Open task details',
      },
    ],
  },
  {
    title: 'Terminal',
    shortcuts: [
      {
        keys: [modKey, 'T'],
        description: 'Open new terminal',
      },
      {
        keys: [modKey, 'W'],
        description: 'Close current terminal',
      },
      {
        keys: [modKey, 'L'],
        description: 'Clear terminal',
      },
      {
        keys: [modKey, '1-9'],
        description: 'Switch to terminal 1-9',
      },
    ],
  },
];

/**
 * KeyboardShortcutsModal - Displays all available keyboard shortcuts
 *
 * Triggered by pressing '?' key anywhere in the app (except input fields)
 * Can be dismissed with Escape or clicking outside
 */
export function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate and work faster
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {shortcutSections.map((section, sectionIndex) => (
            <div key={section.title}>
              {sectionIndex > 0 && <Separator className="mb-4" />}
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      {shortcut.icon && (
                        <span className="text-muted-foreground">
                          {shortcut.icon}
                        </span>
                      )}
                      <span>{shortcut.description}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <Badge
                          key={keyIndex}
                          variant="outline"
                          className="font-mono text-xs px-2 py-0.5"
                        >
                          {key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <p>
            Press <Badge variant="outline" className="font-mono text-xs mx-1">?</Badge> anytime to show this dialog.
            Press <Badge variant="outline" className="font-mono text-xs mx-1">Esc</Badge> to close.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
