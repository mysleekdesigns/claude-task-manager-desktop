import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { ApiKeysSection } from '@/components/settings/ApiKeysSection';
import { PreferencesSection } from '@/components/settings/PreferencesSection';
import { KeyboardShortcutsSection } from '@/components/settings/KeyboardShortcutsSection';
import { ClaudeCodeSection } from '@/components/settings/ClaudeCodeSection';

export function SettingsPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your profile, API keys, preferences, shortcuts, and Claude Code automation
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="inline-flex h-auto w-auto gap-2 bg-transparent p-0">
          <TabsTrigger
            value="profile"
            className="min-w-[100px] data-[state=active]:!bg-cyan-500 data-[state=active]:!text-gray-900 data-[state=active]:!border-cyan-500 data-[state=inactive]:bg-background data-[state=inactive]:text-foreground hover:bg-accent hover:text-accent-foreground border border-input shadow-sm h-9 px-4 py-2 rounded-md font-medium transition-colors"
          >
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="api-keys"
            className="min-w-[100px] data-[state=active]:!bg-cyan-500 data-[state=active]:!text-gray-900 data-[state=active]:!border-cyan-500 data-[state=inactive]:bg-background data-[state=inactive]:text-foreground hover:bg-accent hover:text-accent-foreground border border-input shadow-sm h-9 px-4 py-2 rounded-md font-medium transition-colors"
          >
            API Keys
          </TabsTrigger>
          <TabsTrigger
            value="preferences"
            className="min-w-[100px] data-[state=active]:!bg-cyan-500 data-[state=active]:!text-gray-900 data-[state=active]:!border-cyan-500 data-[state=inactive]:bg-background data-[state=inactive]:text-foreground hover:bg-accent hover:text-accent-foreground border border-input shadow-sm h-9 px-4 py-2 rounded-md font-medium transition-colors"
          >
            Preferences
          </TabsTrigger>
          <TabsTrigger
            value="shortcuts"
            className="min-w-[100px] data-[state=active]:!bg-cyan-500 data-[state=active]:!text-gray-900 data-[state=active]:!border-cyan-500 data-[state=inactive]:bg-background data-[state=inactive]:text-foreground hover:bg-accent hover:text-accent-foreground border border-input shadow-sm h-9 px-4 py-2 rounded-md font-medium transition-colors"
          >
            Shortcuts
          </TabsTrigger>
          <TabsTrigger
            value="claude-code"
            className="min-w-[100px] data-[state=active]:!bg-cyan-500 data-[state=active]:!text-gray-900 data-[state=active]:!border-cyan-500 data-[state=inactive]:bg-background data-[state=inactive]:text-foreground hover:bg-accent hover:text-accent-foreground border border-input shadow-sm h-9 px-4 py-2 rounded-md font-medium transition-colors"
          >
            Claude Code
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[calc(100vh-16rem)] w-full mt-6">
          <TabsContent value="profile" className="mt-0">
            <ProfileSection />
          </TabsContent>

          <TabsContent value="api-keys" className="mt-0">
            <ApiKeysSection />
          </TabsContent>

          <TabsContent value="preferences" className="mt-0">
            <PreferencesSection />
          </TabsContent>

          <TabsContent value="shortcuts" className="mt-0">
            <KeyboardShortcutsSection />
          </TabsContent>

          <TabsContent value="claude-code" className="mt-0">
            <ClaudeCodeSection />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
