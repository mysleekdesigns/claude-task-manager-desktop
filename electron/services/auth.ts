/**
 * Authentication Service
 *
 * Provides authentication utilities including password hashing, verification,
 * session token generation, and password validation.
 *
 * NOTE: These utilities are used for:
 * 1. Local authentication fallback when Supabase is not configured
 * 2. Client-side password validation (validatePassword, validateEmail)
 *
 * When Supabase is configured (SUPABASE_URL and SUPABASE_ANON_KEY environment
 * variables are set), the primary authentication is handled by Supabase Auth.
 * However, password validation functions are still used for client-side
 * validation before sending requests to Supabase.
 */

import bcryptjs from 'bcryptjs';
import crypto from 'crypto';

/**
 * Bcrypt cost factor for password hashing.
 * Higher values = more secure but slower.
 * 12 is a good balance for desktop apps.
 */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Session token length in bytes (64 bytes = 128 hex characters)
 */
const SESSION_TOKEN_BYTES = 64;

/**
 * Default session expiry duration (30 days in milliseconds)
 */
export const DEFAULT_SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Password validation requirements
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate password strength
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 *
 * @param password - The password to validate
 * @returns Validation result with errors if any
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Hash a password using bcryptjs
 *
 * @param password - The plain text password to hash
 * @returns Promise resolving to the hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 *
 * @param password - The plain text password to verify
 * @param hash - The hash to compare against
 * @returns Promise resolving to true if the password matches
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

/**
 * Generate a secure random session token
 *
 * @returns A cryptographically secure random token (hex string)
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(SESSION_TOKEN_BYTES).toString('hex');
}

/**
 * Calculate session expiry date
 *
 * @param expiryMs - Optional custom expiry duration in milliseconds
 * @returns Date object representing when the session expires
 */
export function calculateSessionExpiry(
  expiryMs: number = DEFAULT_SESSION_EXPIRY_MS
): Date {
  return new Date(Date.now() + expiryMs);
}

/**
 * Check if a session has expired
 *
 * @param expiresAt - The session expiry date
 * @returns True if the session has expired
 */
export function isSessionExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Validate email format
 *
 * @param email - The email to validate
 * @returns True if the email format is valid
 */
export function validateEmail(email: string): boolean {
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
