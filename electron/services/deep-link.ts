/**
 * Deep Link Service
 *
 * Handles OAuth callback URLs received via deep links (claude-tasks:// protocol).
 * Parses tokens from URL hash fragments or query parameters and validates URL security.
 *
 * Supports multiple OAuth response formats:
 * 1. Implicit flow: tokens in hash fragment (#access_token=...&refresh_token=...)
 * 2. PKCE flow: authorization code in query params (?code=...)
 * 3. Error responses: error info in query params (?error=...&error_description=...)
 */

/**
 * Expected deep link protocol for the application
 */
const DEEP_LINK_PROTOCOL = 'claude-tasks:';

/**
 * Expected path for OAuth callbacks
 */
const OAUTH_CALLBACK_PATH = '/auth/callback';

/**
 * OAuth tokens extracted from a successful callback
 */
export interface OAuthTokens {
  /** The access token for API requests */
  accessToken: string;
  /** The refresh token for obtaining new access tokens */
  refreshToken: string;
  /** Token expiry duration in seconds (optional) */
  expiresIn?: number;
  /** Unix timestamp when the token expires (optional) */
  expiresAt?: number;
  /** Token type, typically "bearer" (optional) */
  tokenType?: string;
}

/**
 * OAuth authorization code for PKCE flow
 */
export interface OAuthCode {
  /** The authorization code to exchange for tokens */
  code: string;
}

/**
 * OAuth error information from a failed callback
 */
export interface OAuthError {
  /** Error code from the OAuth provider */
  error: string;
  /** Human-readable error description (optional) */
  errorDescription?: string;
  /** Error code from provider (optional) */
  errorCode?: string;
}

/**
 * Result of parsing an OAuth callback URL
 */
export type OAuthCallbackResult =
  | { success: true; type: 'tokens'; tokens: OAuthTokens }
  | { success: true; type: 'code'; code: OAuthCode }
  | { success: false; error: OAuthError };

/**
 * Validates that a URL is a valid OAuth callback URL for this application.
 *
 * Security checks:
 * - Protocol must be exactly "claude-tasks:"
 * - Path must be exactly "/auth/callback"
 *
 * @param url - The URL to validate
 * @returns True if the URL is a valid OAuth callback URL
 */
export function isValidOAuthCallbackUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    // Check protocol matches exactly
    if (parsedUrl.protocol !== DEEP_LINK_PROTOCOL) {
      return false;
    }

    // Check path matches expected OAuth callback path
    // URL parsing treats the host as the first part of the path for custom protocols
    // So "claude-tasks://auth/callback" has host "auth" and pathname "/callback"
    const fullPath = `/${parsedUrl.host}${parsedUrl.pathname}`;
    if (fullPath !== OAUTH_CALLBACK_PATH) {
      return false;
    }

    return true;
  } catch {
    // URL parsing failed - invalid URL format
    return false;
  }
}

/**
 * Extracts the hash fragment from a URL and parses it as URLSearchParams.
 *
 * OAuth implicit flow returns tokens in the URL hash fragment (after #).
 * This function extracts that fragment and converts it to a searchable format.
 *
 * @param url - The URL containing a hash fragment
 * @returns URLSearchParams object for querying the fragment parameters
 */
function parseHashFragment(url: string): URLSearchParams {
  try {
    const parsedUrl = new URL(url);
    // Remove the leading "#" from the hash
    const hashContent = parsedUrl.hash.slice(1);
    return new URLSearchParams(hashContent);
  } catch {
    // Return empty params if URL parsing fails
    return new URLSearchParams();
  }
}

/**
 * Extracts query parameters from a URL.
 *
 * OAuth PKCE flow and error responses use query parameters.
 *
 * @param url - The URL containing query parameters
 * @returns URLSearchParams object for querying the parameters
 */
function parseQueryParams(url: string): URLSearchParams {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.searchParams;
  } catch {
    return new URLSearchParams();
  }
}

/**
 * Parses an OAuth callback URL and extracts tokens, auth code, or error information.
 *
 * This function handles multiple OAuth response formats:
 *
 * 1. Error responses (query params): ?error=...&error_description=...
 * 2. PKCE flow (query params): ?code=...
 * 3. Implicit flow (hash fragment): #access_token=...&refresh_token=...
 *
 * @param url - The OAuth callback URL to parse
 * @returns Result object indicating success with tokens/code or failure with error
 */
export function parseOAuthCallback(url: string): OAuthCallbackResult {
  // Validate URL format first
  if (!isValidOAuthCallbackUrl(url)) {
    return {
      success: false,
      error: {
        error: 'invalid_url',
        errorDescription: 'The URL is not a valid OAuth callback URL',
      },
    };
  }

  const queryParams = parseQueryParams(url);
  const hashParams = parseHashFragment(url);

  // 1. Check for error in query params first (most common for errors)
  const queryError = queryParams.get('error');
  if (queryError) {
    return {
      success: false,
      error: {
        error: queryError,
        ...(queryParams.get('error_description') && {
          errorDescription: queryParams.get('error_description')!
        }),
        ...(queryParams.get('error_code') && {
          errorCode: queryParams.get('error_code')!
        }),
      },
    };
  }

  // 2. Check for error in hash params (some OAuth providers use this)
  const hashError = hashParams.get('error');
  if (hashError) {
    return {
      success: false,
      error: {
        error: hashError,
        ...(hashParams.get('error_description') && {
          errorDescription: hashParams.get('error_description')!
        }),
      },
    };
  }

  // 3. Check for authorization code in query params (PKCE flow)
  const code = queryParams.get('code');
  if (code) {
    return {
      success: true,
      type: 'code',
      code: { code },
    };
  }

  // 4. Check for tokens in hash fragment (implicit flow)
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (accessToken && refreshToken) {
    const expiresInStr = hashParams.get('expires_in');
    const expiresAtStr = hashParams.get('expires_at');
    const tokenType = hashParams.get('token_type') || undefined;

    const expiresIn = expiresInStr ? parseInt(expiresInStr, 10) : undefined;
    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : undefined;

    return {
      success: true,
      type: 'tokens',
      tokens: {
        accessToken,
        refreshToken,
        ...(expiresIn !== undefined && !isNaN(expiresIn) ? { expiresIn } : {}),
        ...(expiresAt !== undefined && !isNaN(expiresAt) ? { expiresAt } : {}),
        ...(tokenType ? { tokenType } : {}),
      },
    };
  }

  // 5. No valid data found - check if we have partial tokens
  if (accessToken && !refreshToken) {
    return {
      success: false,
      error: {
        error: 'missing_token',
        errorDescription: 'Refresh token is missing from the callback URL',
      },
    };
  }

  // 6. No tokens, no code, no error - empty callback
  return {
    success: false,
    error: {
      error: 'empty_callback',
      errorDescription: 'No tokens, authorization code, or error found in the callback URL. The hash fragment may have been stripped by the browser.',
    },
  };
}

/**
 * Checks if a URL is a deep link for this application.
 *
 * @param url - The URL to check
 * @returns True if the URL uses the claude-tasks: protocol
 */
export function isDeepLink(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === DEEP_LINK_PROTOCOL;
  } catch {
    return false;
  }
}

/**
 * Extracts the path from a deep link URL.
 *
 * @param url - The deep link URL
 * @returns The path portion of the URL, or null if invalid
 */
export function getDeepLinkPath(url: string): string | null {
  if (!isDeepLink(url)) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    return `/${parsedUrl.host}${parsedUrl.pathname}`;
  } catch {
    return null;
  }
}
