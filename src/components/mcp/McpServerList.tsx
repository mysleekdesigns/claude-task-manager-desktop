/**
 * MCP Server List Component
 *
 * Displays a list of MCP servers grouped by category.
 */

import { useMemo } from 'react';
import { McpServerItem } from './McpServerItem';
import { Separator } from '@/components/ui/separator';
import {
  BookOpen,
  Network,
  Plug,
  Globe,
  HardDrive,
  Server,
} from 'lucide-react';
import type { McpConfig, PresetMcpServer } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface McpServerListProps {
  configs: McpConfig[];
  presets: PresetMcpServer[];
  onToggle: (id: string) => Promise<void>;
  onConfigure?: (server: McpConfig) => void;
  onDelete: (id: string) => Promise<void>;
  isToggling?: boolean;
}

// ============================================================================
// Category Configuration
// ============================================================================

const CATEGORIES: Array<{
  id: string;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'documentation', label: 'Documentation', icon: <BookOpen className="h-5 w-5" /> },
  { id: 'knowledge', label: 'Knowledge Graphs', icon: <Network className="h-5 w-5" /> },
  { id: 'integration', label: 'Integrations', icon: <Plug className="h-5 w-5" /> },
  { id: 'browser', label: 'Browser Automation', icon: <Globe className="h-5 w-5" /> },
  { id: 'builtin', label: 'Built-in', icon: <HardDrive className="h-5 w-5" /> },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the preset definition for a server by name and type
 */
function getPresetForServer(
  server: McpConfig,
  presets: PresetMcpServer[]
): PresetMcpServer | undefined {
  return presets.find(
    (preset) =>
      preset.name.toLowerCase() === server.name.toLowerCase() ||
      preset.type === server.type
  );
}

/**
 * Get category icon based on category ID
 */
function getCategoryIcon(categoryId: string): React.ReactNode {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  return category?.icon || <Server className="h-5 w-5" />;
}

// ============================================================================
// Component
// ============================================================================

export function McpServerList({
  configs,
  presets,
  onToggle,
  onConfigure,
  onDelete,
  isToggling,
}: McpServerListProps) {
  // Group servers by category
  const serversByCategory = useMemo(() => {
    const grouped: Record<string, Array<{ config: McpConfig; preset: PresetMcpServer | undefined }>> = {
      documentation: [],
      knowledge: [],
      integration: [],
      browser: [],
      builtin: [],
      custom: [],
    };

    configs.forEach((config) => {
      const preset = getPresetForServer(config, presets);
      const category = preset?.category || 'custom';

      if (grouped[category]) {
        grouped[category].push({ config, preset });
      }
    });

    return grouped;
  }, [configs, presets]);

  // Filter out empty categories
  const activeCategories = CATEGORIES.filter(
    (category) => (serversByCategory[category.id]?.length ?? 0) > 0
  );

  // Check if there are custom servers
  const hasCustomServers = (serversByCategory['custom']?.length ?? 0) > 0;

  if (configs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Server className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">No MCP servers configured</h3>
        <p className="text-muted-foreground max-w-md">
          Add your first MCP server to enable AI-powered context and capabilities.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preset Categories */}
      {activeCategories.map((category, index) => {
        const categoryServers = serversByCategory[category.id] ?? [];
        return (
          <div key={category.id}>
            {/* Category Header */}
            <div className="flex items-center gap-2 mb-4">
              {category.icon}
              <h3 className="font-semibold text-lg">{category.label}</h3>
              <span className="text-sm text-muted-foreground">
                ({categoryServers.length})
              </span>
            </div>

            {/* Category Servers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {categoryServers.map(({ config, preset }) => {
                const props: React.ComponentProps<typeof McpServerItem> = {
                  server: config,
                  icon: getCategoryIcon(category.id),
                  description: preset?.description,
                  category: category.label,
                  onToggle,
                  onDelete,
                };
                if (onConfigure) {
                  props.onConfigure = onConfigure;
                }
                if (isToggling !== undefined) {
                  props.isToggling = isToggling;
                }
                return <McpServerItem key={config.id} {...props} />;
              })}
            </div>

            {/* Separator between categories */}
            {index < activeCategories.length - 1 && <Separator className="mt-6" />}
          </div>
        );
      })}

      {/* Custom Servers Section */}
      {hasCustomServers && (
        <>
          {activeCategories.length > 0 && <Separator />}
          <div>
            {/* Custom Category Header */}
            <div className="flex items-center gap-2 mb-4">
              <Server className="h-5 w-5" />
              <h3 className="font-semibold text-lg">Custom Servers</h3>
              <span className="text-sm text-muted-foreground">
                ({(serversByCategory['custom']?.length ?? 0)})
              </span>
            </div>

            {/* Custom Servers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {(serversByCategory['custom'] ?? []).map(({ config }) => {
                const props: React.ComponentProps<typeof McpServerItem> = {
                  server: config,
                  icon: <Server className="h-5 w-5" />,
                  description: `Custom ${config.type} server`,
                  category: "Custom",
                  onToggle,
                  onDelete,
                };
                if (onConfigure) {
                  props.onConfigure = onConfigure;
                }
                if (isToggling !== undefined) {
                  props.isToggling = isToggling;
                }
                return <McpServerItem key={config.id} {...props} />;
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
