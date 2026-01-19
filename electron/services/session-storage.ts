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
 * Electron store for session persistence
 */
const store = new Store<SessionStore>({
  name: 'session',
  encryptionKey: 'claude-tasks-session-encryption-key',
  defaults: {
    token: null,
  },
});

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
