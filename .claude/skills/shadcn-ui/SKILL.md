---
name: shadcn-ui
description: shadcn/ui component patterns for React with Tailwind CSS. Use when building UI components, implementing forms, dialogs, or styled interfaces. Covers component usage, customization, and accessibility.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# shadcn/ui Component Patterns

## Overview

shadcn/ui provides accessible, customizable React components built on Radix UI primitives and styled with Tailwind CSS. Components are copied into your project (not installed as dependencies).

## Installation

```bash
# Initialize shadcn/ui
npx shadcn@latest init

# Add components
npx shadcn@latest add button card dialog input select tabs
```

## Core Components

### Button
```tsx
import { Button } from '@/components/ui/button';

<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button disabled>Disabled</Button>
<Button loading>Loading...</Button>
```

### Card
```tsx
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Task Title</CardTitle>
    <CardDescription>Task description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Content</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Dialog
```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

function CreateTaskDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Task</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Add a new task to your project.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {/* Form fields */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### Form with Input
```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

<div className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="title">Title</Label>
    <Input
      id="title"
      placeholder="Enter task title"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
    />
  </div>
  <div className="space-y-2">
    <Label htmlFor="description">Description</Label>
    <Textarea
      id="description"
      placeholder="Describe the task..."
      value={description}
      onChange={(e) => setDescription(e.target.value)}
    />
  </div>
</div>
```

### Select
```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

<Select value={priority} onValueChange={setPriority}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Priority" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="LOW">Low</SelectItem>
    <SelectItem value="MEDIUM">Medium</SelectItem>
    <SelectItem value="HIGH">High</SelectItem>
    <SelectItem value="URGENT">Urgent</SelectItem>
  </SelectContent>
</Select>
```

### Tabs
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

<Tabs defaultValue="overview" className="w-full">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
    <TabsTrigger value="logs">Logs</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">
    <OverviewTab task={task} />
  </TabsContent>
  <TabsContent value="subtasks">
    <SubtasksTab taskId={task.id} />
  </TabsContent>
  <TabsContent value="logs">
    <LogsTab taskId={task.id} />
  </TabsContent>
</Tabs>
```

### Badge
```tsx
import { Badge } from '@/components/ui/badge';

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Destructive</Badge>
<Badge variant="outline">Outline</Badge>

// Priority badge
function PriorityBadge({ priority }: { priority: Priority }) {
  const variants = {
    LOW: 'secondary',
    MEDIUM: 'default',
    HIGH: 'warning',
    URGENT: 'destructive',
  } as const;

  return <Badge variant={variants[priority]}>{priority}</Badge>;
}
```

### Dropdown Menu
```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
    <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={onDelete} className="text-destructive">
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Theming

### CSS Variables
```css
/* src/styles/globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    /* ... */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    /* ... */
  }
}
```

### Dark Mode Toggle
```tsx
import { useTheme } from '@/components/providers/ThemeProvider';
import { Moon, Sun } from 'lucide-react';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
```
