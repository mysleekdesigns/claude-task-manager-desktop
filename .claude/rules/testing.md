---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "tests/**/*"
---

# Testing Guidelines

## Test Structure

Use the Arrange-Act-Assert pattern:

```typescript
describe('TaskCard', () => {
  it('renders task title', () => {
    // Arrange
    const task = { id: '1', title: 'Test Task', status: 'PENDING' };

    // Act
    render(<TaskCard task={task} onClick={() => {}} />);

    // Assert
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });
});
```

## Component Testing

- Test user interactions, not implementation details
- Use Testing Library queries (`getByRole`, `getByText`)
- Test accessibility with accessible queries
- Mock IPC calls with vi.mock

```tsx
vi.mock('@/hooks/useIPC', () => ({
  useIPC: () => ({
    invoke: vi.fn().mockResolvedValue([]),
  }),
}));

it('calls onTaskClick when clicked', async () => {
  const onClick = vi.fn();
  render(<TaskCard task={mockTask} onClick={onClick} />);

  await userEvent.click(screen.getByRole('article'));

  expect(onClick).toHaveBeenCalledWith(mockTask);
});
```

## Hook Testing

- Use renderHook from @testing-library/react
- Wrap with necessary providers
- Test async state changes with waitFor

```tsx
const { result } = renderHook(() => useTasks('project-1'), {
  wrapper: QueryClientProvider,
});

await waitFor(() => expect(result.current.isSuccess).toBe(true));
```

## IPC Handler Testing

- Mock Prisma client
- Test handler logic directly
- Verify database operations

## Coverage Requirements

- Aim for 80%+ coverage on core logic
- Focus on business logic and edge cases
- Don't test trivial code (getters, simple wrappers)
