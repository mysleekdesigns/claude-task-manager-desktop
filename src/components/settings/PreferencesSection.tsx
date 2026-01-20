/**
 * Preferences Section Component (Phase 14.3)
 *
 * Settings section for application preferences including:
 * - Theme selector (Light/Dark/System)
 * - Default terminal count
 * - Auto-launch Claude toggle
 * - Minimize to tray toggle
 */

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useIPCMutation, useIPCQuery } from '@/hooks/useIPC';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

type Theme = 'light' | 'dark' | 'system';

// ============================================================================
// Component
// ============================================================================

export function PreferencesSection() {
  // Local state
  const [theme, setTheme] = useState<Theme>('system');
  const [defaultTerminalCount, setDefaultTerminalCount] = useState(4);
  const [autoLaunchClaude, setAutoLaunchClaude] = useState(false);
  const [minimizeToTray, setMinimizeToTray] = useState(true);

  // IPC hooks
  const { data: preferences, loading: loadingPreferences, refetch } = useIPCQuery(
    'settings:getPreferences'
  );
  const savePreferencesMutation = useIPCMutation('settings:savePreferences');

  // Load preferences on mount
  useEffect(() => {
    if (preferences) {
      setTheme((preferences.theme as Theme) || 'system');
      setDefaultTerminalCount(preferences.defaultTerminalCount || 4);
      setAutoLaunchClaude(preferences.autoLaunchClaude || false);
      setMinimizeToTray(preferences.minimizeToTray !== false); // Default to true
    }
  }, [preferences]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSavePreferences = useCallback(async () => {
    try {
      await savePreferencesMutation.mutate({
        theme,
        defaultTerminalCount,
        autoLaunchClaude,
        minimizeToTray,
      });

      await refetch();
      toast.success('Preferences saved successfully');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save preferences');
    }
  }, [
    theme,
    defaultTerminalCount,
    autoLaunchClaude,
    minimizeToTray,
    savePreferencesMutation,
    refetch,
  ]);

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);

    // Apply theme immediately
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(newTheme);
    }
  }, []);

  const handleTerminalCountChange = useCallback((value: string) => {
    const count = parseInt(value, 10);
    if (!isNaN(count) && count >= 1 && count <= 12) {
      setDefaultTerminalCount(count);
    }
  }, []);

  // Check if preferences have changed
  const hasChanges =
    theme !== (preferences?.theme || 'system') ||
    defaultTerminalCount !== (preferences?.defaultTerminalCount || 4) ||
    autoLaunchClaude !== (preferences?.autoLaunchClaude || false) ||
    minimizeToTray !== (preferences?.minimizeToTray !== false);

  // ============================================================================
  // Render
  // ============================================================================

  if (loadingPreferences) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Loading preferences...</CardDescription>
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
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Customize your application experience</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Theme Selector */}
        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <Select value={theme} onValueChange={handleThemeChange}>
            <SelectTrigger id="theme" className="w-full">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose your preferred color theme or follow system settings
          </p>
        </div>

        {/* Default Terminal Count */}
        <div className="space-y-2">
          <Label htmlFor="terminal-count">Default Terminal Count</Label>
          <div className="flex items-center gap-4">
            <Input
              id="terminal-count"
              type="number"
              min="1"
              max="12"
              value={defaultTerminalCount}
              onChange={(e) => handleTerminalCountChange(e.target.value)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">
              terminals per task
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Number of terminal instances to create when starting a new task (1-12)
          </p>
        </div>

        {/* Auto-launch Claude */}
        <div className="flex items-center justify-between space-x-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="auto-launch" className="cursor-pointer">
              Auto-launch Claude Code
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically start Claude Code in terminals when creating tasks
            </p>
          </div>
          <Switch
            id="auto-launch"
            checked={autoLaunchClaude}
            onCheckedChange={setAutoLaunchClaude}
          />
        </div>

        {/* Minimize to Tray */}
        <div className="flex items-center justify-between space-x-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="minimize-tray" className="cursor-pointer">
              Minimize to System Tray
            </Label>
            <p className="text-sm text-muted-foreground">
              Keep the app running in the background when closing the window
            </p>
          </div>
          <Switch
            id="minimize-tray"
            checked={minimizeToTray}
            onCheckedChange={setMinimizeToTray}
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSavePreferences}
            disabled={!hasChanges || savePreferencesMutation.loading}
          >
            {savePreferencesMutation.loading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
