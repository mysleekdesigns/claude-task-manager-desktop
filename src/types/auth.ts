/**
 * Authentication Types
 *
 * Type definitions for authentication state and operations.
 */

/**
 * User entity representing an authenticated user
 */
export interface User {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Authentication state for the AuthContext
 */
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Login credentials for authentication
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data for new user signup
 */
export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

/**
 * Profile update data (partial updates allowed)
 */
export interface ProfileUpdateData {
  name?: string;
  avatar?: string;
}

/**
 * Session response returned after successful authentication
 */
export interface SessionResponse {
  user: User;
  token: string;
}
