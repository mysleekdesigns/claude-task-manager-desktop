import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useIPCQuery, useIPCMutation } from '@/hooks/useIPC';

function App() {
  // Use the new type-safe IPC hooks
  const {
    data: version,
    loading: versionLoading,
    error: versionError,
  } = useIPCQuery('app:getVersion');

  const {
    data: platform,
    loading: platformLoading,
    error: platformError,
  } = useIPCQuery('app:getPlatform');

  // Use mutation hook for directory dialog (user-triggered action)
  const {
    mutate: openDirectory,
    loading: dialogLoading,
  } = useIPCMutation('dialog:openDirectory');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const loading = versionLoading || platformLoading;
  const error = versionError || platformError;

  const handleShowToast = () => {
    toast.success('Welcome to Claude Tasks Desktop!', {
      description:
        'Styling setup with Tailwind CSS and shadcn/ui is complete.',
    });
  };

  const handleDialogSave = () => {
    if (inputValue.trim()) {
      toast.info(`Saved: ${inputValue}`);
      setInputValue('');
      setDialogOpen(false);
    } else {
      toast.error('Please enter a value');
    }
  };

  const handleSelectDirectory = async () => {
    try {
      const result = await openDirectory({
        title: 'Select a Project Directory',
        buttonLabel: 'Select',
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const path = result.filePaths[0];
        if (path) {
          setSelectedPath(path);
          toast.success('Directory selected', {
            description: path,
          });
        }
      }
    } catch (err) {
      console.error('Failed to open directory dialog:', err);
      toast.error('Failed to open directory dialog');
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Header with theme toggle */}
      <header className="mx-auto mb-8 flex max-w-4xl items-center justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-3xl font-bold text-transparent">
            Claude Tasks Desktop
          </h1>
          <p className="text-muted-foreground">
            AI-driven development task manager
          </p>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-4xl space-y-6">
        {/* App Info Card - Now using type-safe IPC hooks */}
        <Card>
          <CardHeader>
            <CardTitle>Application Info</CardTitle>
            <CardDescription>
              Current environment and system information (via type-safe IPC)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <span className="text-muted-foreground">Loading...</span>
              </div>
            ) : error ? (
              <div className="rounded-md bg-destructive/10 p-4 text-destructive">
                Error: {error.message}
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-muted-foreground">Name</dt>
                  <dd className="text-foreground">{version?.name}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Version</dt>
                  <dd className="text-foreground">{version?.version}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Platform</dt>
                  <dd className="text-foreground">{platform?.platform}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    Architecture
                  </dt>
                  <dd className="text-foreground">{platform?.arch}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    OS Version
                  </dt>
                  <dd className="text-foreground">{platform?.osVersion}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Mode</dt>
                  <dd className="text-foreground">
                    {version?.isDev ? 'Development' : 'Production'}
                  </dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Native Dialog Test Card */}
        <Card>
          <CardHeader>
            <CardTitle>Native Dialog Test</CardTitle>
            <CardDescription>
              Test the type-safe IPC dialog handler
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => void handleSelectDirectory()} disabled={dialogLoading}>
              {dialogLoading ? 'Opening...' : 'Select Directory'}
            </Button>
            {selectedPath && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm">
                  <span className="font-medium">Selected:</span>{' '}
                  <code className="text-xs">{selectedPath}</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Phase Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Phase 1.4 Complete</CardTitle>
            <CardDescription>
              Type-safe IPC Communication Layer is ready
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">
              The IPC communication layer has been configured with the following:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                IpcChannels interface with typed channels (src/types/ipc.ts)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Type-safe invoke wrapper (src/lib/ipc.ts)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                React hooks: useIPCQuery, useIPCMutation, useIPCEvent
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Centralized handler registration (electron/ipc/index.ts)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Domain-based handlers (app.ts, dialog.ts)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                IPCError class with error serialization
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Development logging with timing (check console)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Secure channel whitelist in preload script
              </li>
            </ul>
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={handleShowToast}>Show Toast</Button>
            <Button variant="outline" onClick={handleShowToast}>
              Outline Button
            </Button>
            <Button variant="secondary" onClick={handleShowToast}>
              Secondary
            </Button>
          </CardFooter>
        </Card>

        {/* Component Demo Card */}
        <Card>
          <CardHeader>
            <CardTitle>Component Demo</CardTitle>
            <CardDescription>
              Demonstration of installed shadcn/ui components
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="demo-input">Demo Input</Label>
              <Input
                id="demo-input"
                placeholder="Type something..."
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); }}
              />
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Open Dialog</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Demo Dialog</DialogTitle>
                  <DialogDescription>
                    This is a demonstration of the Dialog component from
                    shadcn/ui.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="dialog-input" className="text-right">
                      Value
                    </Label>
                    <Input
                      id="dialog-input"
                      value={inputValue}
                      onChange={(e) => { setInputValue(e.target.value); }}
                      className="col-span-3"
                      placeholder="Enter a value..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => { setDialogOpen(false); }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleDialogSave}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Next Steps Card */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-muted-foreground">Next Up</CardTitle>
            <CardDescription>Phase 2: Database Setup</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ready for Phase 2: SQLite + Prisma database integration with User
              and Project models.
            </p>
          </CardContent>
        </Card>
      </main>

      <footer className="mx-auto mt-8 max-w-4xl border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>Claude Tasks Desktop - Phase 1.4 IPC Communication Layer Complete</p>
      </footer>
    </div>
  );
}

export default App;
