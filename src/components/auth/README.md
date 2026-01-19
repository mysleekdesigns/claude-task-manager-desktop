# Authentication Components

This directory contains authentication-related UI components for Phase 3.

## Components

### ProtectedRoute

A route guard component that requires authentication to access protected pages.

**Usage:**
```tsx
import { ProtectedRoute } from '@/components/auth';

// Wrap protected pages
function App() {
  return (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  );
}
```

**Behavior:**
- Shows loading spinner while checking authentication state
- Redirects to `/login` if user is not authenticated (Phase 4)
- Renders children if user is authenticated

## Related Files

- **Login Page**: `/src/routes/login.tsx`
- **Register Page**: `/src/routes/register.tsx`
- **useAuth Hook**: `/src/hooks/useAuth.ts`
- **AuthProvider**: `/src/components/providers/AuthProvider.tsx`

## Integration Notes

These components are designed to work with React Router (Phase 4). Currently:
- Navigation uses `console.log` placeholders
- Redirects show messages instead of actual navigation
- Once React Router is integrated, replace placeholders with `useNavigate()`

## Styling

All components use:
- shadcn/ui components (Card, Input, Button, Label, Checkbox)
- Tailwind CSS 4 with cyan accent theme
- Dark mode support via CSS variables
- Responsive design
