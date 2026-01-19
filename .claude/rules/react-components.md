---
paths:
  - "src/components/**/*.tsx"
  - "src/routes/**/*.tsx"
---

# React Component Rules

## Component Structure

```tsx
// 1. Imports
import { useState, useCallback } from 'react';
import { Component } from '@/components/ui/component';
import type { Props } from '@/types';

// 2. Type definitions
interface ComponentProps {
  prop: Type;
}

// 3. Component
export function Component({ prop }: ComponentProps) {
  // 3a. Hooks (useState, useEffect, custom hooks)
  const [state, setState] = useState();

  // 3b. Derived state / memoization
  const derived = useMemo(() => compute(prop), [prop]);

  // 3c. Callbacks
  const handleClick = useCallback(() => {
    // ...
  }, []);

  // 3d. Effects
  useEffect(() => {
    // ...
  }, []);

  // 3e. Render
  return (
    <div>...</div>
  );
}
```

## shadcn/ui Usage

- Import components from `@/components/ui/`
- Use consistent variants (default, destructive, outline, ghost)
- Compose primitives for custom components
- Follow accessibility patterns (labels, ARIA)

## State Management

- Use Zustand for global state (auth, current project)
- Use React Query for server state (data fetching)
- Use local state for component-specific UI state
- Avoid prop drilling - use context or composition

## Performance

- Use React.memo for expensive components
- Use useMemo for expensive computations
- Use useCallback for callbacks passed to children
- Avoid creating objects/arrays in render

## Accessibility

- All interactive elements must be keyboard accessible
- Use semantic HTML elements
- Provide labels for form inputs
- Support screen readers with ARIA attributes
