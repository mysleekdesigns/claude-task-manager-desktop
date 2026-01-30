/**
 * ClaudeMdViewer Component
 *
 * Read-only display of CLAUDE.md content with simple markdown rendering.
 */

import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ClaudeMdViewerProps {
  content: string | null;
  className?: string;
}

/**
 * Simple markdown to HTML converter for basic formatting
 * Handles: headers, code blocks, inline code, bold, italic, lists, links
 */
function parseMarkdown(markdown: string): string {
  let html = markdown;

  // Escape HTML entities first
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (must be processed before other patterns)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre class="bg-muted rounded-md p-3 overflow-x-auto my-3"><code class="text-sm font-mono">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-base font-semibold mt-4 mb-2">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-5 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">$1</a>');

  // Lists (unordered)
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc list-inside">$1</li>');
  html = html.replace(/^\* (.+)$/gm, '<li class="ml-4 list-disc list-inside">$1</li>');

  // Lists (ordered)
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal list-inside">$1</li>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-4 border-border" />');

  // Paragraphs (wrap remaining text blocks)
  html = html
    .split('\n\n')
    .map((block) => {
      // Don't wrap if it's already an HTML element or empty
      if (
        block.trim().startsWith('<') ||
        block.trim() === '' ||
        block.includes('<pre') ||
        block.includes('<h1') ||
        block.includes('<h2') ||
        block.includes('<h3') ||
        block.includes('<h4') ||
        block.includes('<hr')
      ) {
        return block;
      }
      return `<p class="mb-3">${block.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');

  return html;
}

export function ClaudeMdViewer({ content, className }: ClaudeMdViewerProps) {
  const renderedContent = useMemo(() => {
    if (!content) return null;
    return parseMarkdown(content);
  }, [content]);

  if (!content) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 text-center ${className || ''}`}>
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No CLAUDE.md Found</h3>
        <p className="text-muted-foreground max-w-md text-sm">
          This project does not have a CLAUDE.md file. Create one in your project root
          to provide context and instructions for Claude Code.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className={`h-[500px] ${className || ''}`}>
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed pr-4"
        dangerouslySetInnerHTML={{ __html: renderedContent || '' }}
      />
    </ScrollArea>
  );
}
