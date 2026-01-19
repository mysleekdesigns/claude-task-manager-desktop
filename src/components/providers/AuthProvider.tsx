/**
 * Authentication Provider
 *
 * Provides authentication state and operations throughout the application.
 * Handles login, registration, logout, and profile updates via IPC.
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
import { useIPCMutation, useIPC } from '@/hooks/useIPC';
import type { User, LoginCredentials, RegisterData, ProfileUpdateData } from '@/types/auth';
import type { AuthUser } from '@/types/ipc';

// ============================================================================
// Context Types
// ============================================================================

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: ProfileUpdateData) => Promise<void>;
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
  login: async () => {
    throw new Error('AuthProvider not initialized');
  },
  register: async () => {
    throw new Error('AuthProvider not initialized');
  },
  logout: async () => {
    throw new Error('AuthProvider not initialized');
  },
  updateProfile: async () => {
    throw new Error('AuthProvider not initialized');
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
  const isMountedRef = useRef(true);
  const invoke = useIPC();

  // IPC Mutations
  const loginMutation = useIPCMutation('auth:login');
  const registerMutation = useIPCMutation('auth:register');

  // Auto-login: Check for existing session on mount
  // The main process manages session tokens in electron-store
  useEffect(() => {
    const checkSession = async () => {
      if (!isMountedRef.current) return;

      try {
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
            description: `Welcome back, ${response.user.name || response.user.email}!`,
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
            description: `Welcome, ${response.user.name || response.user.email}!`,
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

  // ============================================================================
  // Context Value
  // ============================================================================

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
      updateProfile,
    }),
    [user, isLoading, login, register, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Export the context for use in useAuth hook
export { AuthContext };
