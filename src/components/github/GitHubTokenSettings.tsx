/**
 * GitHub Token Settings Component (Phase 12.1)
 *
 * Allows users to configure, validate, and manage their GitHub Personal Access Token.
 */

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useIPCMutation, useIPCQuery } from '@/hooks/useIPC';
import { Eye, EyeOff, Check, X, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface GitHubTokenValidation {
  valid: boolean;
  username?: string;
  name?: string;
  avatarUrl?: string;
  scopes?: string[];
  error?: string;
}

// ============================================================================
// Component
// ============================================================================

export function GitHubTokenSettings() {
  // Local state
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [validationResult, setValidationResult] = useState<GitHubTokenValidation | null>(null);

  // IPC hooks
  const { data: tokenStatus, loading: checkingToken, refetch: refetchHasToken } = useIPCQuery(
    'github:getToken'
  );
  const hasToken = tokenStatus?.hasToken ?? false;

  const saveTokenMutation = useIPCMutation('github:saveToken');
  const validateTokenMutation = useIPCMutation('github:validateToken');
  const deleteTokenMutation = useIPCMutation('github:deleteToken');

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleValidate = useCallback(async () => {
    try {
      const result = await validateTokenMutation.mutate();
      setValidationResult(result);

      if (result.valid) {
        toast.success(`Token validated for ${result.username ?? 'user'}`);
      } else {
        toast.error(result.error ?? 'Token validation failed');
      }
    } catch (error) {
      console.error('Failed to validate token:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to validate token');
      setValidationResult({ valid: false, error: 'Validation failed' });
    }
  }, [validateTokenMutation]);

  const handleDeleteToken = useCallback(async () => {
    try {
      await deleteTokenMutation.mutate();
      setValidationResult(null);
      setToken('');
      await refetchHasToken();
      toast.success('Token deleted successfully');
    } catch (error) {
      console.error('Failed to delete token:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete token');
    }
  }, [deleteTokenMutation, refetchHasToken]);

  const handleSaveToken = useCallback(async () => {
    if (!token.trim()) {
      toast.error('Please enter a token');
      return;
    }

    try {
      await saveTokenMutation.mutate(token);
      toast.success('Token saved successfully');
      setToken('');
      setShowToken(false);

      // Automatically validate after saving
      await refetchHasToken();
      await handleValidate();
    } catch (error) {
      console.error('Failed to save token:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save token');
    }
  }, [token, saveTokenMutation, refetchHasToken, handleValidate]);

  // Check validation on mount if token exists
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (hasToken && !validationResult) {
      void handleValidate();
    }
  }, [hasToken, validationResult, handleValidate]);

  // ============================================================================
  // Render Status
  // ============================================================================

  const renderStatus = () => {
    if (checkingToken || validateTokenMutation.loading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking token...</span>
        </div>
      );
    }

    if (!hasToken) {
      return (
        <Badge variant="outline" className="gap-1">
          <X className="h-3 w-3" />
          Not Configured
        </Badge>
      );
    }

    if (validationResult?.valid) {
      return (
        <div className="flex items-center gap-3">
          <Badge variant="default" className="gap-1">
            <Check className="h-3 w-3" />
            Valid
          </Badge>
          {validationResult.username && (
            <span className="text-sm text-muted-foreground">
              @{validationResult.username}
            </span>
          )}
        </div>
      );
    }

    if (validationResult?.valid === false) {
      return (
        <Badge variant="destructive" className="gap-1">
          <X className="h-3 w-3" />
          Invalid
        </Badge>
      );
    }

    return null;
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>GitHub Integration</CardTitle>
            <CardDescription>
              Connect your GitHub account to access issues, pull requests, and repositories
            </CardDescription>
          </div>
          {renderStatus()}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Token Input Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="github-token">Personal Access Token</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="github-token"
                  type={showToken ? 'text' : 'password'}
                  placeholder={hasToken ? '••••••••••••••••' : 'ghp_xxxxxxxxxxxxxxxxxxxx'}
                  value={token}
                  onChange={(e) => { setToken(e.target.value); }}
                  disabled={saveTokenMutation.loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => { setShowToken(!showToken); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button
                onClick={() => { void handleSaveToken(); }}
                disabled={!token.trim() || saveTokenMutation.loading}
                className="whitespace-nowrap"
              >
                {saveTokenMutation.loading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Token
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Create a token at{' '}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                github.com/settings/tokens
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          {/* Action Buttons */}
          {hasToken && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { void handleValidate(); }}
                disabled={validateTokenMutation.loading}
              >
                {validateTokenMutation.loading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Validate Token
              </Button>
              <Button
                variant="outline"
                onClick={() => { void handleDeleteToken(); }}
                disabled={deleteTokenMutation.loading}
                className="text-destructive hover:text-destructive"
              >
                {deleteTokenMutation.loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete Token
              </Button>
            </div>
          )}
        </div>

        {/* Validation Result */}
        {validationResult && (
          <div className="space-y-3">
            {validationResult.valid ? (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div>
                      <strong>Token is valid</strong>
                      {validationResult.name && (
                        <span className="block text-sm text-muted-foreground mt-1">
                          {validationResult.name} (@{validationResult.username})
                        </span>
                      )}
                    </div>
                    {validationResult.scopes && validationResult.scopes.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Scopes:</p>
                        <div className="flex flex-wrap gap-1">
                          {validationResult.scopes.map((scope) => (
                            <Badge key={scope} variant="secondary" className="text-xs">
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <X className="h-4 w-4" />
                <AlertDescription>
                  <strong>Token is invalid</strong>
                  {validationResult.error && (
                    <span className="block text-sm mt-1">{validationResult.error}</span>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Required Scopes Info */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">Recommended Scopes</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• <code>repo</code> - Full control of private repositories</div>
            <div>• <code>read:org</code> - Read organization data</div>
            <div>• <code>user:email</code> - Access user email addresses</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
