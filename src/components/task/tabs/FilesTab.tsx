/**
 * FilesTab Component
 *
 * Displays files modified by the task with action indicators.
 */

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { File, FilePlus, FileEdit, Trash2 } from 'lucide-react';
import type { Task, TaskFile } from '@/types/ipc';

interface FilesTabProps {
  task: Task;
}

export function FilesTab({ task }: FilesTabProps) {
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <FilePlus className="h-4 w-4 text-green-500" />;
      case 'modified':
        return <FileEdit className="h-4 w-4 text-blue-500" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4 text-destructive" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'created':
        return <Badge className="bg-green-500 hover:bg-green-600">Created</Badge>;
      case 'modified':
        return <Badge variant="secondary">Modified</Badge>;
      case 'deleted':
        return <Badge variant="destructive">Deleted</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const groupFilesByAction = () => {
    const files = task.files || [];
    return {
      created: files.filter((f) => f.action === 'created'),
      modified: files.filter((f) => f.action === 'modified'),
      deleted: files.filter((f) => f.action === 'deleted'),
    };
  };

  const groupedFiles = groupFilesByAction();
  const totalFiles = (task.files || []).length;

  if (totalFiles === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">No files modified yet.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Summary */}
      <div className="flex gap-3 mb-4">
        {groupedFiles.created.length > 0 && (
          <Badge className="bg-green-500 hover:bg-green-600">
            {groupedFiles.created.length} Created
          </Badge>
        )}
        {groupedFiles.modified.length > 0 && (
          <Badge variant="secondary">
            {groupedFiles.modified.length} Modified
          </Badge>
        )}
        {groupedFiles.deleted.length > 0 && (
          <Badge variant="destructive">
            {groupedFiles.deleted.length} Deleted
          </Badge>
        )}
      </div>

      {/* Files List */}
      <ScrollArea className="h-[350px]">
        <div className="space-y-2">
          {(task.files || []).map((file: TaskFile) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              {getActionIcon(file.action)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono truncate">{file.path}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTimestamp(file.createdAt)}
                </p>
              </div>
              {getActionBadge(file.action)}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
