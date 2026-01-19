---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Code Style Guidelines

## General Rules

- Use TypeScript strict mode (`strict: true` in tsconfig.json)
- Prefer explicit type annotations for function parameters and return types
- Use `interface` for object shapes, `type` for unions/primitives
- Avoid `any` - use `unknown` if type is truly unknown
- Use `const` by default, `let` only when reassignment is needed

## Naming Conventions

- **Components**: PascalCase (`TaskCard.tsx`, `KanbanBoard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useTasks.ts`, `useIPC.ts`)
- **Utilities**: camelCase (`formatDate.ts`, `parseJson.ts`)
- **Types/Interfaces**: PascalCase (`Task`, `Project`, `TaskStatus`)
- **Constants**: SCREAMING_SNAKE_CASE (`DEFAULT_TERMINAL_COUNT`)
- **IPC Channels**: domain:action format (`tasks:list`, `terminal:create`)

## React Patterns

- Use functional components with hooks
- Prefer named exports over default exports
- Destructure props at the function signature level
- Use `React.FC` sparingly (prefer explicit prop types)

```tsx
// Preferred
interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  // ...
}

// Avoid
export default function TaskCard(props) {
  // ...
}
```

## Imports Order

1. React and core libraries
2. Third-party libraries
3. Internal absolute imports (@/)
4. Relative imports
5. Types (using `type` import)

```tsx
import { useState, useCallback } from 'react';

import { useQuery } from '@tanstack/react-query';
import { GripVertical } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { useIPC } from '@/hooks/useIPC';

import { TaskCard } from './TaskCard';

import type { Task, TaskStatus } from '@/types';
```

## Error Handling

- Use try/catch for async operations
- Provide meaningful error messages
- Log errors with context in development
- Show user-friendly messages in production

```typescript
try {
  await invoke('tasks:create', taskData);
} catch (error) {
  console.error('Failed to create task:', error);
  toast.error('Failed to create task. Please try again.');
}
```
