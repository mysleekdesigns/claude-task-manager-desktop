/**
 * useAuth Hook
 *
 * Hook to access authentication context throughout the application.
 * Must be used within an AuthProvider.
 *
 * Supports both Supabase authentication (when configured) and local bcrypt-based
 * authentication as a fallback. Check `isUsingSupabase` to determine which mode
 * is active.
 */

import { useContext } from 'react';
import { AuthContext } from '@/components/providers/AuthProvider';

/**
 * Hook to access authentication state and operations.
 *
 * @throws Error if used outside of AuthProvider
 * @returns Authentication context value with the following properties:
 *   - user: Current user or null if not authenticated
 *   - isLoading: True while checking initial session
 *   - isAuthenticated: True if user is logged in
 *   - isUsingSupabase: True if Supabase auth is active (vs local auth)
 *   - login: Function to log in with email/password
 *   - register: Function to create a new account
 *   - logout: Function to log out
 *   - updateProfile: Function to update user profile
 *   - refreshSession: Function to manually refresh session token (Supabase only)
 *
 * @example
 * ```typescript
 * function LoginPage() {
 *   const { login, isLoading, user, isAuthenticated, isUsingSupabase } = useAuth();
 *
 *   const handleLogin = async (email: string, password: string) => {
 *     await login(email, password);
 *     // User is now logged in
 *   };
 *
 *   if (isAuthenticated) {
 *     return (
 *       <div>
 *         Welcome, {user?.name}!
 *         {isUsingSupabase && <span>Cloud sync enabled</span>}
 *       </div>
 *     );
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
