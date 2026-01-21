/**
 * API Keys Section Component (Phase 14.3)
 *
 * Settings section for managing API keys including:
 * - Claude API key
 * - GitHub token (uses existing GitHubTokenSettings component)
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useIPCMutation, useIPCQuery } from '@/hooks/useIPC';
import { Eye, EyeOff, Check, X, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { GitHubTokenSettings } from '@/components/github/GitHubTokenSettings';

// ============================================================================
// Types
// ============================================================================

interface ClaudeApiKeyValidation {
  valid: boolean;
  model?: string;
  error?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ApiKeysSection() {
  // Local state for Claude API key
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [validationResult, setValidationResult] = useState<ClaudeApiKeyValidation | null>(null);

  // IPC hooks for Claude API key
  const { data: keyStatus, loading: checkingKey, refetch: refetchHasKey } = useIPCQuery(
    'claude:getApiKey'
  );
  const hasClaudeKey = keyStatus?.hasKey ?? false;

  const saveKeyMutation = useIPCMutation('claude:saveApiKey');
  const validateKeyMutation = useIPCMutation('claude:validateApiKey');
  const deleteKeyMutation = useIPCMutation('claude:deleteApiKey');

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleValidateClaudeKey = useCallback(async () => {
    try {
      const result = await validateKeyMutation.mutate();
      setValidationResult(result);

      if (result.valid) {
        toast.success(`API key validated successfully`);
      } else {
        toast.error(result.error ?? 'API key validation failed');
      }
    } catch (error) {
      console.error('Failed to validate API key:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to validate API key');
      setValidationResult({ valid: false, error: 'Validation failed' });
    }
  }, [validateKeyMutation]);

  const handleSaveClaudeKey = useCallback(async () => {
    if (!claudeApiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    // Basic format validation
    if (!claudeApiKey.startsWith('sk-ant-')) {
      toast.error('Invalid API key format. Claude API keys start with "sk-ant-"');
      return;
    }

    try {
      await saveKeyMutation.mutate(claudeApiKey);
      toast.success('Claude API key saved successfully');
      setClaudeApiKey('');
      setShowClaudeKey(false);

      // Automatically validate after saving
      await refetchHasKey();
      await handleValidateClaudeKey();
    } catch (error) {
      console.error('Failed to save API key:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save API key');
    }
  }, [claudeApiKey, saveKeyMutation, refetchHasKey, handleValidateClaudeKey]);

  const handleDeleteClaudeKey = useCallback(async () => {
    try {
      await deleteKeyMutation.mutate();
      setValidationResult(null);
      setClaudeApiKey('');
      await refetchHasKey();
      toast.success('Claude API key deleted successfully');
    } catch (error) {
      console.error('Failed to delete API key:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete API key');
    }
  }, [deleteKeyMutation, refetchHasKey]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderClaudeKeyStatus = () => {
    if (checkingKey || validateKeyMutation.loading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking key...</span>
        </div>
      );
    }

    if (!hasClaudeKey) {
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
          {validationResult.model && (
            <span className="text-sm text-muted-foreground">
              {validationResult.model}
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
    <div className="space-y-6">
      {/* Claude API Key */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Claude API Key</CardTitle>
              <CardDescription>
                Connect to Claude AI for enhanced task automation and code generation
              </CardDescription>
            </div>
            {renderClaudeKeyStatus()}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* API Key Input Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="claude-api-key">API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="claude-api-key"
                    type={showClaudeKey ? 'text' : 'password'}
                    placeholder={hasClaudeKey ? '••••••••••••••••••••••••••••' : 'sk-ant-api03-...'}
                    value={claudeApiKey}
                    onChange={(e) => { setClaudeApiKey(e.target.value); }}
                    disabled={saveKeyMutation.loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => { setShowClaudeKey(!showClaudeKey); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showClaudeKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <Button
                  onClick={() => { void handleSaveClaudeKey(); }}
                  disabled={!claudeApiKey.trim() || saveKeyMutation.loading}
                  className="whitespace-nowrap"
                >
                  {saveKeyMutation.loading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Key
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your API key from{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  console.anthropic.com
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            {/* Action Buttons */}
            {hasClaudeKey && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { void handleValidateClaudeKey(); }}
                  disabled={validateKeyMutation.loading}
                >
                  {validateKeyMutation.loading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Test Connection
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { void handleDeleteClaudeKey(); }}
                  disabled={deleteKeyMutation.loading}
                  className="text-destructive hover:text-destructive"
                >
                  {deleteKeyMutation.loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete Key
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
                        <strong>API key is valid</strong>
                        {validationResult.model && (
                          <span className="block text-sm text-muted-foreground mt-1">
                            Default model: {validationResult.model}
                          </span>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <X className="h-4 w-4" />
                  <AlertDescription>
                    <strong>API key is invalid</strong>
                    {validationResult.error && (
                      <span className="block text-sm mt-1">{validationResult.error}</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* API Key Info */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">About Claude API</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>• Used for AI-powered task generation and code assistance</div>
              <div>• Supports models like Claude 3.5 Sonnet and Opus</div>
              <div>• Required for AI Review and automation features</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GitHub Token - Reuse existing component */}
      <GitHubTokenSettings />
    </div>
  );
}
