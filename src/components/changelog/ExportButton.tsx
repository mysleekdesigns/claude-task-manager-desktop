/**
 * Export Button Component
 *
 * Button to export changelog as markdown.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Check } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ExportButtonProps {
  onExport: () => Promise<{ markdown: string }>;
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ExportButton({ onExport, disabled }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setIsSuccess(false);

    try {
      const result = await onExport();

      // Create blob and download
      const blob = new Blob([result.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `changelog-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Show success
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to export changelog:', error);
      alert('Failed to export changelog. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || isExporting}
      variant="outline"
      className="gap-2"
    >
      {isSuccess ? (
        <>
          <Check className="h-4 w-4" />
          Exported
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export Markdown'}
        </>
      )}
    </Button>
  );
}
