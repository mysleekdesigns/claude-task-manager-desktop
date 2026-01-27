/**
 * OAuth Sign-In Buttons
 *
 * Provides OAuth sign-in buttons for GitHub and Google authentication.
 * Only renders when Supabase authentication is configured.
 *
 * Features:
 * - GitHub OAuth button with lucide-react icon
 * - Google OAuth button with custom SVG icon
 * - Loading state with spinner during authentication
 * - Disables all buttons when any OAuth flow is in progress
 * - Returns null if Supabase is not configured (OAuth requires Supabase)
 */

import { Github, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { OAuthProvider } from '@/types/ipc';

/**
 * Google icon component
 *
 * Custom SVG icon for Google since lucide-react doesn't include it.
 */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

interface OAuthButtonsProps {
  disabled?: boolean;
}

/**
 * OAuth sign-in buttons for GitHub and Google
 *
 * @param disabled - Optional flag to disable buttons externally (e.g., during form submission)
 * @returns OAuth buttons or null if Supabase is not configured
 */
export function OAuthButtons({ disabled = false }: OAuthButtonsProps) {
  const { signInWithOAuth, isOAuthLoading, isUsingSupabase } = useAuth();

  const handleOAuthClick = async (provider: OAuthProvider) => {
    try {
      await signInWithOAuth(provider);
    } catch {
      // Error is already handled by AuthProvider
    }
  };

  // Only show OAuth buttons if Supabase is configured
  if (!isUsingSupabase) {
    return null;
  }

  const isLoading = isOAuthLoading !== null;
  const isDisabled = disabled || isLoading;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => { void handleOAuthClick('github'); }}
        disabled={isDisabled}
        className="w-full"
      >
        {isOAuthLoading === 'github' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Github className="h-4 w-4 mr-2" />
        )}
        GitHub
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => { void handleOAuthClick('google'); }}
        disabled={isDisabled}
        className="w-full"
      >
        {isOAuthLoading === 'google' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4 mr-2" />
        )}
        Google
      </Button>
    </div>
  );
}
