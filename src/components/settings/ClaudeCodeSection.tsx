/**
 * Claude Code Section Component (Phase 15)
 *
 * Settings section for Claude Code task automation preferences including:
 * - Default max agentic turns
 * - Default max budget (USD)
 * - Auto-approve tools list
 * - Custom system prompt template
 * - Auto-launch Claude toggle
 */

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useIPCMutation, useIPCQuery } from '@/hooks/useIPC';
import { Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ============================================================================
// Types
// ============================================================================

interface ClaudeCodeSettings {
  defaultMaxTurns?: number;
  defaultMaxBudget?: number;
  autoApproveTools?: string[];
  customSystemPrompt?: string;
  autoLaunchClaude?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ClaudeCodeSection() {
  // Local state
  const [defaultMaxTurns, setDefaultMaxTurns] = useState(50);
  const [defaultMaxBudget, setDefaultMaxBudget] = useState(5.0);
  const [autoApproveTools, setAutoApproveTools] = useState('');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [autoLaunchClaude, setAutoLaunchClaude] = useState(true);

  // IPC hooks
  const { data: preferences, loading: loadingPreferences, refetch } = useIPCQuery(
    'settings:getPreferences'
  );
  const savePreferencesMutation = useIPCMutation('settings:savePreferences');

  // Load preferences on mount
  useEffect(() => {
    if (preferences) {
      // Load auto-launch from main preferences
      setAutoLaunchClaude(preferences.autoLaunchClaude || false);

      // Parse Claude Code settings from keyboardShortcuts field
      // (using this field as a temporary storage until a proper field is added)
      if (preferences.keyboardShortcuts) {
        try {
          // Handle both old format (parsed object) and new format (Record<string, string>)
          const shortcuts = typeof preferences.keyboardShortcuts === 'string'
            ? JSON.parse(preferences.keyboardShortcuts)
            : (preferences.keyboardShortcuts as unknown as Record<string, unknown>);

          // Try to get claudeCodeSettings - it might be a string (new format) or object (old format)
          let claudeSettings: ClaudeCodeSettings | undefined;
          if (shortcuts.claudeCodeSettings) {
            if (typeof shortcuts.claudeCodeSettings === 'string') {
              claudeSettings = JSON.parse(shortcuts.claudeCodeSettings) as ClaudeCodeSettings;
            } else {
              claudeSettings = shortcuts.claudeCodeSettings as ClaudeCodeSettings;
            }
          }

          if (claudeSettings) {
            setDefaultMaxTurns(claudeSettings.defaultMaxTurns ?? 50);
            setDefaultMaxBudget(claudeSettings.defaultMaxBudget ?? 5.0);
            setAutoApproveTools(claudeSettings.autoApproveTools?.join(', ') ?? '');
            setCustomSystemPrompt(claudeSettings.customSystemPrompt ?? '');
          }
        } catch (error) {
          console.error('Failed to parse Claude Code settings:', error);
        }
      }
    }
  }, [preferences]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSaveSettings = useCallback(async () => {
    try {
      // Parse auto-approve tools from comma-separated string
      const toolsArray = autoApproveTools
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Build Claude Code settings object
      const claudeSettings: ClaudeCodeSettings = {
        defaultMaxTurns,
        defaultMaxBudget,
        autoApproveTools: toolsArray,
        autoLaunchClaude,
      };

      // Only add customSystemPrompt if it has content
      if (customSystemPrompt.trim()) {
        claudeSettings.customSystemPrompt = customSystemPrompt.trim();
      }

      // Merge with existing keyboard shortcuts (parse from JSON string)
      let existingShortcuts: Record<string, unknown> = {};
      if (preferences?.keyboardShortcuts) {
        try {
          existingShortcuts = typeof preferences.keyboardShortcuts === 'string'
            ? JSON.parse(preferences.keyboardShortcuts)
            : (preferences.keyboardShortcuts as unknown as Record<string, unknown>);
        } catch (error) {
          console.error('Failed to parse existing shortcuts:', error);
        }
      }

      // Store Claude Code settings in the shortcuts object
      const updatedShortcuts = {
        ...existingShortcuts,
        claudeCodeSettings: claudeSettings,
      };

      // Save to preferences (convert to Record<string, string> format)
      const shortcutsForSave: Record<string, string> = {};
      for (const [key, value] of Object.entries(updatedShortcuts)) {
        shortcutsForSave[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }

      await savePreferencesMutation.mutate({
        autoLaunchClaude,
        keyboardShortcuts: shortcutsForSave,
      });

      await refetch();
      toast.success('Claude Code settings saved successfully');
    } catch (error) {
      console.error('Failed to save Claude Code settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    }
  }, [
    defaultMaxTurns,
    defaultMaxBudget,
    autoApproveTools,
    customSystemPrompt,
    autoLaunchClaude,
    preferences,
    savePreferencesMutation,
    refetch,
  ]);

  const handleMaxTurnsChange = useCallback((value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 500) {
      setDefaultMaxTurns(num);
    }
  }, []);

  const handleMaxBudgetChange = useCallback((value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0.1 && num <= 100) {
      setDefaultMaxBudget(num);
    }
  }, []);

  // Check if settings have changed
  const hasChanges = useCallback(() => {
    if (!preferences) return false;

    // Check auto-launch
    if (autoLaunchClaude !== (preferences.autoLaunchClaude || false)) {
      return true;
    }

    // Check Claude Code settings
    try {
      const shortcuts = preferences.keyboardShortcuts
        ? (typeof preferences.keyboardShortcuts === 'string'
          ? JSON.parse(preferences.keyboardShortcuts)
          : (preferences.keyboardShortcuts as unknown as Record<string, unknown>))
        : {};

      // Parse claudeCodeSettings - it might be a string (new format) or object (old format)
      let claudeSettings: ClaudeCodeSettings | undefined;
      if (shortcuts.claudeCodeSettings) {
        if (typeof shortcuts.claudeCodeSettings === 'string') {
          claudeSettings = JSON.parse(shortcuts.claudeCodeSettings) as ClaudeCodeSettings;
        } else {
          claudeSettings = shortcuts.claudeCodeSettings as ClaudeCodeSettings;
        }
      }

      const currentToolsArray = autoApproveTools
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      return (
        defaultMaxTurns !== (claudeSettings?.defaultMaxTurns ?? 50) ||
        defaultMaxBudget !== (claudeSettings?.defaultMaxBudget ?? 5.0) ||
        JSON.stringify(currentToolsArray) !== JSON.stringify(claudeSettings?.autoApproveTools ?? []) ||
        customSystemPrompt.trim() !== (claudeSettings?.customSystemPrompt ?? '')
      );
    } catch (error) {
      return true;
    }
  }, [
    preferences,
    defaultMaxTurns,
    defaultMaxBudget,
    autoApproveTools,
    customSystemPrompt,
    autoLaunchClaude,
  ]);

  // ============================================================================
  // Render
  // ============================================================================

  if (loadingPreferences) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Claude Code Automation</CardTitle>
          <CardDescription>Loading settings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claude Code Automation</CardTitle>
        <CardDescription>
          Configure default settings for Claude Code task automation
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Default Max Turns */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="max-turns">Default Max Turns</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Maximum number of agentic turns Claude can take before pausing.
                    Higher values allow more autonomous work but use more resources.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-4">
            <Input
              id="max-turns"
              type="number"
              min="1"
              max="500"
              value={defaultMaxTurns}
              onChange={(e) => handleMaxTurnsChange(e.target.value)}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">
              turns (1-500)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Recommended: 25 for small tasks, 50 for medium, 100+ for complex tasks
          </p>
        </div>

        {/* Default Max Budget */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="max-budget">Default Max Budget</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Maximum cost in USD for API usage per task. Claude will pause
                    when this budget is reached.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="max-budget"
                type="number"
                min="0.1"
                max="100"
                step="0.5"
                value={defaultMaxBudget}
                onChange={(e) => handleMaxBudgetChange(e.target.value)}
                className="w-32 pl-7"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              USD (0.1-100)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Recommended: $1-$5 for most tasks
          </p>
        </div>

        {/* Auto-Approve Tools */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-approve">Auto-Approve Tools</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Comma-separated list of tools that Claude can use without asking.
                    Use patterns like "Read", "Edit", "Bash:git:*" for git commands.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="auto-approve"
            placeholder="e.g., Read, Edit, Bash:git:*, Write"
            value={autoApproveTools}
            onChange={(e) => setAutoApproveTools(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to manually approve all tool usage. Common tools: Read, Edit, Write, Bash
          </p>
        </div>

        {/* Custom System Prompt */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="custom-prompt">Custom System Prompt</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Additional instructions appended to task descriptions.
                    Use for coding standards, patterns, or project-specific guidelines.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Textarea
            id="custom-prompt"
            placeholder="e.g., Follow React best practices. Use TypeScript strict mode. Add comprehensive tests."
            value={customSystemPrompt}
            onChange={(e) => setCustomSystemPrompt(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            This text will be appended to every task prompt sent to Claude
          </p>
        </div>

        {/* Auto-Launch Claude */}
        <div className="flex items-center justify-between space-x-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="auto-launch-claude" className="cursor-pointer">
              Auto-Launch Claude Code
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically start Claude Code in terminals when creating tasks
            </p>
          </div>
          <Switch
            id="auto-launch-claude"
            checked={autoLaunchClaude}
            onCheckedChange={setAutoLaunchClaude}
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSaveSettings}
            disabled={!hasChanges() || savePreferencesMutation.loading}
          >
            {savePreferencesMutation.loading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
