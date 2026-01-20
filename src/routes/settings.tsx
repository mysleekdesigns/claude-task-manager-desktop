import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Label } from '@/components/ui/label';
import { GitHubTokenSettings } from '@/components/github/GitHubTokenSettings';

export function SettingsPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your application preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the look and feel of the application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Theme</Label>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      <GitHubTokenSettings />

      <Card>
        <CardHeader>
          <CardTitle>Keyboard Shortcuts</CardTitle>
          <CardDescription>Navigation shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Toggle Sidebar</span>
              <kbd className="px-2 py-1 rounded border border-border bg-muted font-mono text-xs">⌘B</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>New Task</span>
              <kbd className="px-2 py-1 rounded border border-border bg-muted font-mono text-xs">⌘N</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Navigate to Page</span>
              <kbd className="px-2 py-1 rounded border border-border bg-muted font-mono text-xs">⌘⇧ + Key</kbd>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
