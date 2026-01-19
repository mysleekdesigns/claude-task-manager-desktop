/**
 * useAuth Hook
 *
 * Hook to access authentication context throughout the application.
 * Must be used within an AuthProvider.
 */

import { useContext } from 'react';
import { AuthContext } from '@/components/providers/AuthProvider';

/**
 * Hook to access authentication state and operations.
 *
 * @throws Error if used outside of AuthProvider
 * @returns Authentication context value
 *
 * @example
 * ```typescript
 * function LoginPage() {
 *   const { login, isLoading, user, isAuthenticated } = useAuth();
 *
 *   const handleLogin = async (email: string, password: string) => {
 *     await login(email, password);
 *     // User is now logged in
 *   };
 *
 *   if (isAuthenticated) {
 *     return <div>Welcome, {user?.name}!</div>;
 *   }
 *
 *   return <LoginForm onSubmit={handleLogin} />;
 * }
 * ```
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export default useAuth;
