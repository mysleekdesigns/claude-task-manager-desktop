/**
 * Authentication Provider
 *
 * Provides authentication state and operations throughout the application.
 * Handles login, registration, logout, and profile updates via IPC.
 *
 * Supports both Supabase authentication (when configured) and local bcrypt-based
 * authentication as a fallback. The `isUsingSupabase` flag indicates which mode
 * is active.
 *
 * Note: Session tokens are managed by the main process via electron-store.
 * The renderer only needs to call auth methods - no token management required.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { toast } from 'sonner';
import { useIPCMutation, useIPC, useIPCEvent } from '@/hooks/useIPC';
import type { User, LoginCredentials, RegisterData, ProfileUpdateData } from '@/types/auth';
import type { AuthUser, AuthStateChangePayload, OAuthProvider, OAuthSuccessPayload, OAuthErrorPayload } from '@/types/ipc';

// ============================================================================
// Context Types
// ============================================================================

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isUsingSupabase: boolean;
  isOAuthLoading: OAuthProvider | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: ProfileUpdateData) => Promise<void>;
  refreshSession: () => Promise<void>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

// ============================================================================
// Context Creation
// ============================================================================

const initialState: AuthContextValue = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isUsingSupabase: false,
  isOAuthLoading: null,
  login: () => {
    return Promise.reject(new Error('AuthProvider not initialized'));
  },
  register: () => {
    return Promise.reject(new Error('AuthProvider not initialized'));
  },
  logout: () => {
    return Promise.reject(new Error('AuthProvider not initialized'));
  },
  updateProfile: () => {
    return Promise.reject(new Error('AuthProvider not initialized'));
  },
  refreshSession: () => {
    return Promise.reject(new Error('AuthProvider not initialized'));
  },
  signInWithOAuth: () => {
    return Promise.reject(new Error('AuthProvider not initialized'));
  },
};

const AuthContext = createContext<AuthContextValue>(initialState);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert AuthUser from IPC to User for context
 */
function convertAuthUser(authUser: AuthUser): User {
  return {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email,
    avatar: authUser.avatar,
    createdAt: authUser.createdAt,
    updatedAt: authUser.updatedAt,
  };
}

// ============================================================================
// Provider Component
// ============================================================================

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingSupabase, setIsUsingSupabase] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<OAuthProvider | null>(null);
  const isMountedRef = useRef(true);
  const invoke = useIPC();

  // IPC Mutations
  const loginMutation = useIPCMutation('auth:login');
  const registerMutation = useIPCMutation('auth:register');

  // Listen for auth state changes from main process (Supabase only)
  // This handles external auth changes like token refresh or session expiry
  useIPCEvent('auth:state-change', useCallback((session: AuthStateChangePayload | null) => {
    if (!isMountedRef.current) return;

    if (session && session.user) {
      // Update user state when auth changes externally
      setUser(convertAuthUser(session.user));
    } else {
      // Session was cleared (e.g., token expired, signed out elsewhere)
      setUser(null);
    }
  }, []));

  // Listen for OAuth success events from main process
  useIPCEvent('auth:oauth-success', useCallback((payload: OAuthSuccessPayload) => {
    if (!isMountedRef.current) return;

    setUser(convertAuthUser(payload.user));
    setIsOAuthLoading(null);

    toast.success('Login successful', {
      description: `Signed in with ${payload.provider === 'github' ? 'GitHub' : 'Google'}`,
    });
  }, []));

  // Listen for OAuth error events from main process
  useIPCEvent('auth:oauth-error', useCallback((payload: OAuthErrorPayload) => {
    if (!isMountedRef.current) return;

    setIsOAuthLoading(null);

    toast.error('OAuth sign-in failed', {
      description: payload.errorDescription || payload.error,
    });
  }, []));

  // Auto-login: Check for existing session on mount
  // The main process manages session tokens in electron-store
  useEffect(() => {
    const checkSession = async () => {
      if (!isMountedRef.current) return;

      try {
        // Check if Supabase authentication is being used
        const usingSupabase = await invoke('auth:isSupabaseAuth');
        if (isMountedRef.current) {
          setIsUsingSupabase(usingSupabase);
        }

        // Main process checks for stored session automatically
        const currentUser = await invoke('auth:getCurrentUser');

        if (isMountedRef.current) {
          if (currentUser) {
            setUser(convertAuthUser(currentUser));
          } else {
            setUser(null);
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to load current user:', error);
        if (isMountedRef.current) {
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    void checkSession();
  }, [invoke]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================================================
  // Auth Operations
  // ============================================================================

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      if (!isMountedRef.current) return;

      try {
        const credentials: LoginCredentials = { email, password };
        const response = await loginMutation.mutate(credentials);

        if (isMountedRef.current) {
          setUser(convertAuthUser(response.user));
          // Token is managed by main process - no need to store it here

          toast.success('Login successful', {
            description: `Welcome back, ${response.user.name ?? response.user.email}!`,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to login';
        toast.error('Login failed', {
          description: message,
        });
        throw error;
      }
    },
    [loginMutation]
  );

  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string
    ): Promise<void> => {
      if (!isMountedRef.current) return;

      try {
        const data: RegisterData = { name, email, password };
        const response = await registerMutation.mutate(data);

        if (isMountedRef.current) {
          setUser(convertAuthUser(response.user));
          // Token is managed by main process - no need to store it here

          toast.success('Registration successful', {
            description: `Welcome, ${response.user.name ?? response.user.email}!`,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to register';
        toast.error('Registration failed', {
          description: message,
        });
        throw error;
      }
    },
    [registerMutation]
  );

  const logout = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current) return;

    try {
      // Main process handles session invalidation
      await invoke('auth:logout');

      if (isMountedRef.current) {
        setUser(null);

        toast.info('Logged out', {
          description: 'You have been successfully logged out.',
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to logout';
      toast.error('Logout failed', {
        description: message,
      });
      throw error;
    }
  }, [invoke]);

  const updateProfile = useCallback(
    async (updates: ProfileUpdateData): Promise<void> => {
      if (!isMountedRef.current || !user) {
        throw new Error('Not authenticated');
      }

      try {
        // Main process validates session automatically
        const updatedUser = await invoke('auth:updateProfile', updates);

        if (isMountedRef.current) {
          setUser(convertAuthUser(updatedUser));
          toast.success('Profile updated', {
            description: 'Your profile has been updated successfully.',
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to update profile';
        toast.error('Update failed', {
          description: message,
        });
        throw error;
      }
    },
    [user, invoke]
  );

  const refreshSession = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current) return;

    try {
      const result = await invoke('auth:refreshSession');

      if (!result.success) {
        // Session refresh failed - may need to re-authenticate
        console.warn('Session refresh failed:', result.message);

        // If session is invalid, clear user state
        if (result.message?.includes('expired') || result.message?.includes('invalid')) {
          if (isMountedRef.current) {
            setUser(null);
            toast.warning('Session expired', {
              description: 'Please log in again.',
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
      // Don't throw - session refresh is a background operation
    }
  }, [invoke]);

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider): Promise<void> => {
      if (!isMountedRef.current) return;

      if (isOAuthLoading) {
        // Already an OAuth flow in progress
        return;
      }

      setIsOAuthLoading(provider);

      try {
        // This initiates the OAuth flow - opens browser
        // The result comes back via the auth:oauth-success or auth:oauth-error events
        await invoke('auth:signInWithOAuth', provider);

        // Note: We don't reset isOAuthLoading here because the flow continues
        // in the browser. It will be reset when we receive the success/error event.
      } catch (error) {
        setIsOAuthLoading(null);
        const message =
          error instanceof Error ? error.message : 'Failed to start OAuth flow';
        toast.error('OAuth sign-in failed', {
          description: message,
        });
        throw error;
      }
    },
    [invoke, isOAuthLoading]
  );

  // ============================================================================
  // Context Value
  // ============================================================================

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      isUsingSupabase,
      isOAuthLoading,
      login,
      register,
      logout,
      updateProfile,
      refreshSession,
      signInWithOAuth,
    }),
    [user, isLoading, isUsingSupabase, isOAuthLoading, login, register, logout, updateProfile, refreshSession, signInWithOAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Export the context for use in useAuth hook
export { AuthContext };
