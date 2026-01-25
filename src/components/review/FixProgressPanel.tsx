/**
 * Fix Progress Panel Component
 *
 * Displays the fix and verification workflow inline in the modal.
 * Shows each phase (Research -> Fix -> Verify) as separate agent processes.
 * Provides a "mission control" view of the entire fix+verify workflow.
 */

import { useMemo } from 'react';
import { Search, Wand2, RefreshCw, Shield, Code, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AgentProcessList, type AgentProcess, type AgentStatus } from './AgentProcessList';
import { useFixProgress } from '@/hooks/useFix';
import { cn } from '@/lib/utils';
import type { FixType } from '@/types/ipc';
import type { FixPhase } from '@/store/useFixStore';

// ============================================================================
// Constants
// ============================================================================

const FIX_TYPE_ICONS: Record<FixType, React.ComponentType<{ className?: string }>> = {
  security: Shield,
  quality: Code,
  performance: Zap,
};

const FIX_TYPE_LABELS: Record<FixType, string> = {
  security: 'Security',
  quality: 'Code Quality',
  performance: 'Performance',
};

const PHASE_CONFIG: Record<FixPhase, {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  research: {
    name: 'Research',
    icon: Search,
  },
  fix: {
    name: 'Apply Fix',
    icon: Wand2,
  },
  verify: {
    name: 'Verify',
    icon: RefreshCw,
  },
};

// ============================================================================
// Types
// ============================================================================

export interface FixProgressPanelProps {
  /** Task ID */
  taskId: string;
  /** Type of fix being performed */
  fixType: FixType;
  /** Optional class name */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert fix status and phase to agent statuses for each phase
 */
function getPhaseStatuses(
  currentPhase: FixPhase | undefined,
  status: string | undefined
): Record<FixPhase, AgentStatus> {
  const phases: FixPhase[] = ['research', 'fix', 'verify'];
  const result: Record<FixPhase, AgentStatus> = {
    research: 'pending',
    fix: 'pending',
    verify: 'pending',
  };

  if (!status || status === 'IDLE') {
    return result;
  }

  // Handle verification states
  if (status === 'VERIFYING') {
    result.research = 'completed';
    result.fix = 'completed';
    result.verify = 'verifying';
    return result;
  }

  if (status === 'VERIFIED_SUCCESS') {
    result.research = 'completed';
    result.fix = 'completed';
    result.verify = 'completed';
    return result;
  }

  if (status === 'VERIFIED_FAILED') {
    result.research = 'completed';
    result.fix = 'completed';
    result.verify = 'failed';
    return result;
  }

  if (status === 'COMPLETED') {
    // All phases completed (no verification yet)
    result.research = 'completed';
    result.fix = 'completed';
    result.verify = 'pending';
    return result;
  }

  if (status === 'FAILED') {
    // Mark current phase as failed, previous as completed
    const currentIndex = currentPhase ? phases.indexOf(currentPhase) : 0;
    phases.forEach((phase, index) => {
      if (index < currentIndex) {
        result[phase] = 'completed';
      } else if (index === currentIndex) {
        result[phase] = 'failed';
      }
    });
    return result;
  }

  // IN_PROGRESS status
  if (status === 'IN_PROGRESS') {
    const currentIndex = currentPhase ? phases.indexOf(currentPhase) : 0;
    phases.forEach((phase, index) => {
      if (index < currentIndex) {
        result[phase] = 'completed';
      } else if (index === currentIndex) {
        result[phase] = 'running';
      }
    });
    return result;
  }

  return result;
}

/**
 * Get activity message for a phase
 */
function getPhaseActivity(
  phase: FixPhase,
  phaseStatus: AgentStatus,
  currentActivity: string | undefined,
  currentPhase: FixPhase | undefined
): string | undefined {
  if (phaseStatus === 'pending') {
    return undefined;
  }

  if (phaseStatus === 'completed') {
    return 'Complete';
  }

  if (phaseStatus === 'failed') {
    return 'Failed';
  }

  // Running or verifying - show current activity if this is the active phase
  if ((phaseStatus === 'running' || phaseStatus === 'verifying') && currentPhase === phase) {
    return currentActivity || 'Working...';
  }

  return undefined;
}

// ============================================================================
// Main Component
// ============================================================================

export function FixProgressPanel({ taskId, fixType, className }: FixProgressPanelProps) {
  const fixStatus = useFixProgress(taskId, fixType);
  const FixIcon = FIX_TYPE_ICONS[fixType];
  const fixLabel = FIX_TYPE_LABELS[fixType];

  // Build agent process list from fix status
  const agents = useMemo<AgentProcess[]>(() => {
    const phaseStatuses = getPhaseStatuses(fixStatus?.phase, fixStatus?.status);
    const phases: FixPhase[] = ['research', 'fix', 'verify'];

    return phases.map((phase) => {
      const config = PHASE_CONFIG[phase];
      const status = phaseStatuses[phase];
      const activity = getPhaseActivity(
        phase,
        status,
        fixStatus?.currentActivity,
        fixStatus?.phase
      );

      return {
        id: phase,
        name: config.name,
        icon: config.icon,
        status,
        activity,
      };
    });
  }, [fixStatus]);

  // Don't render if there's no fix status
  if (!fixStatus) {
    return null;
  }

  // Determine overall status
  const isActive = fixStatus.status === 'IN_PROGRESS' || fixStatus.status === 'VERIFYING';
  const isCompleted = fixStatus.status === 'VERIFIED_SUCCESS';
  const isFailed = fixStatus.status === 'FAILED' || fixStatus.status === 'VERIFIED_FAILED';

  return (
    <Card className={cn(
      'border-l-4 transition-colors',
      isActive && 'border-l-cyan-500 bg-cyan-500/5',
      isCompleted && 'border-l-green-500 bg-green-500/5',
      isFailed && 'border-l-amber-500 bg-amber-500/5',
      !isActive && !isCompleted && !isFailed && 'border-l-muted',
      className
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FixIcon className={cn(
            'h-5 w-5',
            isActive && 'text-cyan-500',
            isCompleted && 'text-green-500',
            isFailed && 'text-amber-500'
          )} />
          <span className={cn(
            isActive && 'text-cyan-500',
            isCompleted && 'text-green-500',
            isFailed && 'text-amber-500'
          )}>
            {fixLabel} Fix
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <AgentProcessList agents={agents} compact />

        {/* Error message if failed */}
        {fixStatus.error && (
          <div className="mt-3 p-2 bg-red-500/10 rounded-md border border-red-500/20">
            <p className="text-xs text-red-400">{fixStatus.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
