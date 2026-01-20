/**
 * MCP Server Item Component
 *
 * Displays a single MCP server configuration with toggle switch and configure button.
 */

import { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { McpConfig } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface McpServerItemProps {
  server: McpConfig;
  icon?: React.ReactNode;
  description: string | undefined;
  category?: string;
  onToggle: (id: string) => Promise<void>;
  onConfigure?: (server: McpConfig) => void | undefined;
  onDelete: (id: string) => Promise<void>;
  isToggling?: boolean;
}

// ============================================================================
// Category Badge Configuration
// ============================================================================

const CATEGORY_BADGE_CONFIG: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  documentation: { variant: 'default' },
  knowledge: { variant: 'secondary' },
  integration: { variant: 'outline' },
  browser: { variant: 'default' },
  builtin: { variant: 'secondary' },
};

// ============================================================================
// Component
// ============================================================================

export function McpServerItem({
  server,
  icon,
  description,
  category,
  onToggle,
  onConfigure,
  onDelete,
  isToggling = false,
}: McpServerItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggle = useCallback(async () => {
    await onToggle(server.id);
  }, [server.id, onToggle]);

  const handleConfigure = useCallback(() => {
    onConfigure?.(server);
  }, [server, onConfigure]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDelete(server.id);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Failed to delete server:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [server.id, onDelete]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteDialog(false);
  }, []);

  const badgeConfig = category
    ? CATEGORY_BADGE_CONFIG[category] ?? CATEGORY_BADGE_CONFIG['builtin']
    : CATEGORY_BADGE_CONFIG['builtin'];

  return (
    <>
      <Card
        className={`hover:border-primary/50 transition-colors ${
          server.enabled ? 'border-primary/30' : ''
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {icon && <div className="flex-shrink-0 text-muted-foreground">{icon}</div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-base truncate">{server.name}</h4>
                  {category && badgeConfig && (
                    <Badge variant={badgeConfig.variant} className="text-xs">
                      {category}
                    </Badge>
                  )}
                </div>
                {description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={server.enabled}
                onCheckedChange={handleToggle}
                disabled={isToggling}
                aria-label={`Toggle ${server.name}`}
              />
              <span className="text-sm text-muted-foreground">
                {server.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onConfigure && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleConfigure}
                  className="h-8"
                >
                  <Settings className="mr-1.5 h-4 w-4" />
                  Configure
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDeleteClick}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Server Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the configuration for "{server.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
