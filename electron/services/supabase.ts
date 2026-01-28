/**
 * Supabase Client Service
 *
 * Singleton Supabase client for Electron main process with persistent session storage,
 * auto-refresh token handling, realtime configuration, and connection status monitoring.
 */

import { createClient, SupabaseClient, Session, AuthChangeEvent } from '@supabase/supabase-js';
import Store from 'electron-store';

/**
 * Connection status types for Supabase realtime
 */
export type ConnectionStatus = 'online' | 'offline' | 'connecting';

/**
 * OAuth provider types supported for authentication
 */
export type OAuthProvider = 'github' | 'google';

/**
 * Session storage interface for electron-store
 */
interface SupabaseSessionStore {
  session: Session | null;
}

/**
 * Minimal store interface matching the electron-store methods we use
 */
interface SessionStoreInterface {
  get(key: 'session'): Session | null;
  set(key: 'session', value: Session | null): void;
}

/**
 * In-memory fallback store for when electron-store cannot write to disk
 * (e.g., during E2E tests or sandboxed environments)
 */
class InMemorySessionStore implements SessionStoreInterface {
  private data: SupabaseSessionStore = { session: null };

  get(key: 'session'): Session | null {
    return this.data[key];
  }

  set(key: 'session', value: Session | null): void {
    this.data[key] = value;
  }
}

/**
 * Callback type for connection status changes
 */
type ConnectionStatusCallback = (status: ConnectionStatus) => void;

/**
 * Callback type for auth state changes
 */
type AuthStateCallback = (event: AuthChangeEvent, session: Session | null) => void;

/**
 * Supabase Service Class
 *
 * Provides a singleton Supabase client configured for Electron desktop apps with:
 * - Persistent session storage using electron-store
 * - Auto-refresh token handling
 * - Realtime connection monitoring
 * - Connection status tracking
 */
class SupabaseService {
  private client: SupabaseClient | null = null;
  private store: SessionStoreInterface;
  private connectionStatus: ConnectionStatus = 'offline';
  private connectionStatusCallbacks: Set<ConnectionStatusCallback> = new Set();
  private authStateCallbacks: Set<AuthStateCallback> = new Set();
  private initialized = false;
  private usingInMemoryStore = false;

  constructor() {
    // Initialize electron-store for session persistence
    // Falls back to in-memory storage on permission errors (e.g., E2E tests, sandboxed environments)
    try {
      this.store = new Store<SupabaseSessionStore>({
        name: 'supabase-session',
        encryptionKey: 'claude-tasks-supabase-session-key',
        defaults: {
          session: null,
        },
      });
    } catch (error) {
      // Handle EPERM and other permission errors by falling back to in-memory storage
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode === 'EPERM' || errorCode === 'EACCES' || errorCode === 'EROFS') {
        console.warn(
          `SupabaseService: Cannot write to disk (${errorCode}), using in-memory session storage. ` +
            'Sessions will not persist across app restarts.'
        );
        this.store = new InMemorySessionStore();
        this.usingInMemoryStore = true;
      } else {
        // For unexpected errors, still fall back but log more details
        console.warn(
          'SupabaseService: Failed to initialize electron-store, using in-memory fallback:',
          error
        );
        this.store = new InMemorySessionStore();
        this.usingInMemoryStore = true;
      }
    }
  }

  /**
   * Check if using in-memory storage (sessions won't persist)
   */
  public isUsingInMemoryStore(): boolean {
    return this.usingInMemoryStore;
  }

  /**
   * Initialize the Supabase client
   *
   * Must be called before using other methods.
   * Reads configuration from environment variables.
   *
   * @throws Error if SUPABASE_URL or SUPABASE_ANON_KEY are not set
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }

    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn(
        'Supabase not configured: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required'
      );
      return;
    }

    // Get stored session for initial auth state
    const storedSession = this.store.get('session');

    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Use custom storage adapter for electron-store
        storage: {
          getItem: (key: string) => {
            if (key.includes('auth-token')) {
              const session = this.store.get('session');
              return session ? JSON.stringify(session) : null;
            }
            return null;
          },
          setItem: (key: string, value: string) => {
            if (key.includes('auth-token')) {
              try {
                const session = JSON.parse(value);
                this.store.set('session', session);
              } catch {
                // Ignore parse errors
              }
            }
          },
          removeItem: (key: string) => {
            if (key.includes('auth-token')) {
              this.store.set('session', null);
            }
          },
        },
        // Auto-refresh tokens
        autoRefreshToken: true,
        // Persist session
        persistSession: true,
        // Detect session from URL (not applicable for desktop but set for completeness)
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          // Heartbeat interval for connection monitoring (30 seconds)
          eventsPerSecond: 10,
        },
      },
    });

    // Set initial session if we have one stored
    if (storedSession) {
      this.client.auth.setSession(storedSession).catch((error) => {
        console.error('Failed to restore Supabase session:', error);
        this.clearSession();
      });
    }

    // Listen for auth state changes
    this.client.auth.onAuthStateChange((event, session) => {
      // Persist session on changes
      if (session) {
        this.store.set('session', session);
      } else if (event === 'SIGNED_OUT') {
        this.store.set('session', null);
      }

      // Notify auth state callbacks
      this.authStateCallbacks.forEach((callback) => {
        try {
          callback(event, session);
        } catch (error) {
          console.error('Error in auth state callback:', error);
        }
      });
    });

    // Set up realtime connection monitoring
    this.setupRealtimeMonitoring();

    this.initialized = true;
    console.log('Supabase client initialized');
  }

  /**
   * Set up realtime connection status monitoring
   */
  private setupRealtimeMonitoring(): void {
    if (!this.client) return;

    // Monitor the default realtime channel for connection status
    const channel = this.client.channel('system');

    channel
      .on('system', { event: '*' }, (payload) => {
        console.log('Realtime system event:', payload);
      })
      .subscribe((status) => {
        let newStatus: ConnectionStatus;

        switch (status) {
          case 'SUBSCRIBED':
            newStatus = 'online';
            break;
          case 'CLOSED':
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            newStatus = 'offline';
            break;
          default:
            newStatus = 'connecting';
        }

        this.updateConnectionStatus(newStatus);
      });
  }

  /**
   * Update connection status and notify callbacks
   */
  private updateConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.connectionStatusCallbacks.forEach((callback) => {
        try {
          callback(status);
        } catch (error) {
          console.error('Error in connection status callback:', error);
        }
      });
    }
  }

  /**
   * Get the Supabase client instance
   *
   * @returns The singleton Supabase client
   * @throws Error if the client is not initialized
   */
  public getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error(
        'Supabase client not initialized. Call initialize() first or check environment variables.'
      );
    }
    return this.client;
  }

  /**
   * Check if Supabase is configured and initialized
   *
   * @returns True if the client is available
   */
  public isInitialized(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Get the current session
   *
   * @returns The current session or null if not authenticated
   */
  public async getSession(): Promise<Session | null> {
    if (!this.client) {
      return this.store.get('session');
    }

    const { data, error } = await this.client.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    return data.session;
  }

  /**
   * Get the stored session synchronously (from electron-store)
   *
   * @returns The stored session or null
   */
  public getStoredSession(): Session | null {
    return this.store.get('session');
  }

  /**
   * Set/store a session
   *
   * @param session - The session to store
   */
  public async setSession(session: Session): Promise<void> {
    this.store.set('session', session);

    if (this.client) {
      const { error } = await this.client.auth.setSession(session);
      if (error) {
        console.error('Error setting session:', error);
        throw error;
      }
    }
  }

  /**
   * Clear the current session (logout)
   */
  public async clearSession(): Promise<void> {
    this.store.set('session', null);

    if (this.client) {
      const { error } = await this.client.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      }
    }
  }

  /**
   * Get current connection status
   *
   * @returns The current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Subscribe to connection status changes
   *
   * @param callback - Function to call when connection status changes
   * @returns Unsubscribe function
   */
  public onConnectionStatusChange(callback: ConnectionStatusCallback): () => void {
    this.connectionStatusCallbacks.add(callback);

    // Immediately call with current status
    callback(this.connectionStatus);

    return () => {
      this.connectionStatusCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to auth state changes
   *
   * @param callback - Function to call when auth state changes
   * @returns Unsubscribe function
   */
  public onAuthStateChange(callback: AuthStateCallback): () => void {
    this.authStateCallbacks.add(callback);

    return () => {
      this.authStateCallbacks.delete(callback);
    };
  }

  /**
   * Refresh the current session token
   *
   * @returns The refreshed session or null if refresh failed
   */
  public async refreshSession(): Promise<Session | null> {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await this.client.auth.refreshSession();
    if (error) {
      console.error('Error refreshing session:', error);
      return null;
    }

    return data.session;
  }

  /**
   * Initiate OAuth sign-in flow
   *
   * Returns the OAuth authorization URL to be opened in the system browser.
   * The browser will redirect back to claude-tasks://auth/callback after auth.
   *
   * @param provider - OAuth provider ('github' or 'google')
   * @returns The authorization URL to open in the browser
   * @throws Error if client not initialized
   */
  public async signInWithOAuth(provider: OAuthProvider): Promise<string> {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await this.client.auth.signInWithOAuth({
      provider,
      options: {
        skipBrowserRedirect: true,
        redirectTo: 'claude-tasks://auth/callback',
      },
    });

    if (error) {
      throw error;
    }

    if (!data.url) {
      throw new Error('No authorization URL returned from Supabase');
    }

    return data.url;
  }

  /**
   * Clean up resources on app quit
   */
  public async cleanup(): Promise<void> {
    if (this.client) {
      // Remove all realtime subscriptions
      await this.client.removeAllChannels();
      this.updateConnectionStatus('offline');
    }

    this.connectionStatusCallbacks.clear();
    this.authStateCallbacks.clear();
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService();

// Export types for use in other modules
export type { Session, AuthChangeEvent };
