/**
 * ProjectIndexTab Component
 *
 * Main container for the Project Index tab showing CLAUDE.md content,
 * tech stack badges, and key files list.
 */

import { useState, useCallback } from 'react';
import { RefreshCw, Clock, BookOpen, Code2, FileCode2 } from 'lucide-react';
import { useIPCQuery, useIPCMutation } from '@/hooks/useIPC';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClaudeMdViewer } from './ClaudeMdViewer';
import { TechStackBadges } from './TechStackBadges';
import { KeyFilesList } from './KeyFilesList';
import type { ProjectContext } from '@/types/ipc';

interface ProjectIndexTabProps {
  projectId: string;
}

/**
 * Format a date string to relative time
 */
function formatLastScanned(dateString: string | null): string {
  if (!dateString) return 'Never scanned';

  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  const days = Math.floor(diffInSeconds / 86400);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

export function ProjectIndexTab({ projectId }: ProjectIndexTabProps) {
  const [scanError, setScanError] = useState<string | null>(null);

  // Fetch existing project context
  const {
    data: context,
    loading: contextLoading,
    error: contextError,
    refetch: refetchContext,
  } = useIPCQuery('context:get', [projectId], { enabled: !!projectId });

  // Scan mutation
  const scanMutation = useIPCMutation('context:scan');

  // Handle scan button click
  const handleScan = useCallback(async () => {
    setScanError(null);
    try {
      await scanMutation.mutate(projectId);
      await refetchContext();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to scan project');
    }
  }, [projectId, scanMutation, refetchContext]);

  // Loading state
  if (contextLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-muted-foreground">Loading project context...</div>
      </div>
    );
  }

  // Error state (context fetch error)
  if (contextError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load project context: {contextError.message}
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetchContext()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  const projectContext = context as ProjectContext | null;

  return (
    <div className="space-y-6">
      {/* Header with Scan Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Last scanned: {formatLastScanned(projectContext?.lastScanned ?? null)}</span>
          </div>
        </div>
        <Button
          onClick={handleScan}
          disabled={scanMutation.loading}
          variant="outline"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${scanMutation.loading ? 'animate-spin' : ''}`} />
          {scanMutation.loading ? 'Scanning...' : 'Scan Project'}
        </Button>
      </div>

      {/* Scan Error Alert */}
      {scanError && (
        <Alert variant="destructive">
          <AlertDescription>{scanError}</AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {!projectContext && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Project Context Yet</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Scan your project to detect the tech stack, find key files, and load
              your CLAUDE.md configuration file.
            </p>
            <Button onClick={handleScan} disabled={scanMutation.loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${scanMutation.loading ? 'animate-spin' : ''}`} />
              {scanMutation.loading ? 'Scanning...' : 'Scan Project'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Context Cards */}
      {projectContext && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CLAUDE.md Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">CLAUDE.md</CardTitle>
              </div>
              <CardDescription>
                Project configuration and instructions for Claude Code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClaudeMdViewer content={projectContext.claudeMd} />
            </CardContent>
          </Card>

          {/* Tech Stack Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Tech Stack</CardTitle>
              </div>
              <CardDescription>
                Detected technologies and frameworks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TechStackBadges techStack={projectContext.techStack} />
            </CardContent>
          </Card>

          {/* Key Files Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileCode2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Key Files</CardTitle>
              </div>
              <CardDescription>
                Important project files and entry points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KeyFilesList keyFiles={projectContext.keyFiles} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
