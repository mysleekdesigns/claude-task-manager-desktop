/**
 * KeyFilesList Component
 *
 * Displays a list of important files in the project.
 */

import { FileIcon, FolderIcon } from 'lucide-react';

interface KeyFilesListProps {
  keyFiles: string[];
  className?: string;
}

/**
 * Determine if a path represents a directory based on common patterns
 */
function isDirectory(path: string): boolean {
  // If it ends with / or has no extension in the last part
  if (path.endsWith('/')) return true;
  const lastPart = path.split('/').pop() || '';
  return !lastPart.includes('.');
}

/**
 * Get the display name for a file path
 */
function getDisplayName(path: string): string {
  // Remove leading ./ if present
  return path.replace(/^\.\//, '');
}

export function KeyFilesList({ keyFiles, className }: KeyFilesListProps) {
  if (!keyFiles || keyFiles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No key files identified yet. Run a project scan to detect important files.
      </p>
    );
  }

  return (
    <div className={className}>
      <ul className="space-y-1">
        {keyFiles.map((file) => {
          const isDir = isDirectory(file);
          const displayName = getDisplayName(file);

          return (
            <li
              key={file}
              className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50 transition-colors"
            >
              {isDir ? (
                <FolderIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className="font-mono text-sm truncate" title={file}>
                {displayName}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
