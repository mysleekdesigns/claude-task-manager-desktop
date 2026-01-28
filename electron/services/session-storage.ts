/**
 * Session Storage Service
 *
 * Manages persistent session storage using electron-store.
 * Stores the current session token securely in the Electron user data directory.
 */

import Store from 'electron-store';

interface SessionStore {
  token: string | null;
}

/**
 * Minimal store interface matching the electron-store methods we use
 */
interface SessionStoreInterface {
  get(key: 'token'): string | null;
  set(key: 'token', value: string | null): void;
}

/**
 * In-memory fallback store for when electron-store cannot write to disk
 * (e.g., during E2E tests or sandboxed environments)
 */
class InMemorySessionStore implements SessionStoreInterface {
  private data: SessionStore = { token: null };

  get(key: 'token'): string | null {
    return this.data[key];
  }

  set(key: 'token', value: string | null): void {
    this.data[key] = value;
  }
}

/**
 * Create the session store with fallback to in-memory storage
 */
function createSessionStore(): SessionStoreInterface {
  try {
    return new Store<SessionStore>({
      name: 'session',
      encryptionKey: 'claude-tasks-session-encryption-key',
      defaults: {
        token: null,
      },
    });
  } catch (error) {
    // Handle EPERM and other permission errors by falling back to in-memory storage
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode === 'EPERM' || errorCode === 'EACCES' || errorCode === 'EROFS') {
      console.warn(
        `[SessionStorage] Cannot write to disk (${errorCode}), using in-memory storage. ` +
          'Sessions will not persist across app restarts.'
      );
    } else {
      // For unexpected errors, still fall back but log more details
      console.warn(
        '[SessionStorage] Failed to initialize electron-store, using in-memory fallback:',
        error
      );
    }
    return new InMemorySessionStore();
  }
}

/**
 * Electron store for session persistence
 */
const store: SessionStoreInterface = createSessionStore();

/**
 * Get the current session token
 *
 * @returns The stored session token or null if not logged in
 */
export function getSessionToken(): string | null {
  return store.get('token');
}

/**
 * Set the session token
 *
 * @param token - The session token to store
 */
export function setSessionToken(token: string): void {
  store.set('token', token);
}

/**
 * Clear the session token (logout)
 */
export function clearSessionToken(): void {
  store.set('token', null);
}

/**
 * Check if a session exists
 *
 * @returns True if a session token is stored
 */
export function hasSession(): boolean {
  return store.get('token') !== null;
}
