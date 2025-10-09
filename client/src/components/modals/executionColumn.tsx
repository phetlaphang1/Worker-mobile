import React from 'react';
import { Users, Eye, EyeOff, Play, Square, Activity, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExecutionColumnProps {
  profile: {
    isIncognito?: boolean | null;
    isHeadless?: boolean | null;
  } | null | undefined;
}

export const ExecutionColumn: React.FC<ExecutionColumnProps> = ({ profile }) => {
  if (!profile) return null;
  
  return (
    <div className="flex items-center gap-2">
      {/* Incognito Mode Indicator */}
      <div 
        className={`h-8 w-8 p-0 flex items-center justify-center rounded ${
          profile.isIncognito
            ? "text-blue-600 bg-transparent"
            : "text-gray-600 dark:text-gray-400 bg-transparent"
        }`}
        title={profile.isIncognito ? "Incognito profile" : "Regular profile"}
      >
        <Users className="h-4 w-4" />
      </div>
      {/* Headless Mode Indicator */}
      <div 
        className={`h-8 w-8 p-0 flex items-center justify-center rounded ${
          profile.isHeadless
            ? "text-blue-600 bg-transparent"
            : "text-gray-600 dark:text-gray-400 bg-transparent"
        }`}
        title={profile.isHeadless ? "Headless profile" : "Regular profile"}
      >
        {profile.isHeadless ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </div>
    </div>
  );
};

// Keep the old export name for backward compatibility
export const ProfileIndicator = ExecutionColumn;

// RunButton Component
interface RunButtonProps {
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  runTooltip?: string;
  stopTooltip?: string;
}

export const RunButton: React.FC<RunButtonProps> = ({
  isRunning,
  onRun,
  onStop,
  runTooltip = "Run",
  stopTooltip = "Stop"
}) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-7 w-7 p-0 ${
        isRunning
          ? "text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100"
          : "text-green-600 hover:text-green-700 hover:bg-green-50"
      }`}
      onClick={() => {
        if (isRunning) {
          onStop();
        } else {
          onRun();
        }
      }}
      title={isRunning ? stopTooltip : runTooltip}
    >
      {isRunning ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
    </Button>
  );
};

// ExecutionActions Component
interface ExecutionActionsProps {
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  onViewLog: () => void;
  onViewOutput: () => void;
  showIndicator?: boolean;
  indicatorComponent?: React.ReactNode;
  runTooltip?: string;
  stopTooltip?: string;
  logTooltip?: string;
  outputTooltip?: string;
}

export const ExecutionActions: React.FC<ExecutionActionsProps> = ({
  isRunning,
  onRun,
  onStop,
  onViewLog,
  onViewOutput,
  showIndicator = false,
  indicatorComponent,
  runTooltip = "Run",
  stopTooltip = "Stop",
  logTooltip = "View log file",
  outputTooltip = "Show output files"
}) => {
  return (
    <div className="flex items-center space-x-1">
      {showIndicator && indicatorComponent}
      <RunButton
        isRunning={isRunning}
        onRun={onRun}
        onStop={onStop}
        runTooltip={runTooltip}
        stopTooltip={stopTooltip}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        onClick={onViewLog}
        title={logTooltip}
      >
        <Activity className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        onClick={onViewOutput}
        title={outputTooltip}
      >
        <ExternalLink className="h-3 w-3" />
      </Button>
    </div>
  );
};


export const getStatusBadgeVariant = (status?: string) => {
  switch (status) {
    case 'NEW':
      return 'secondary';
    case 'READY':
      return 'default';
    case 'RUNNING':
      return 'default';
    case 'COMPLETED':
      return 'secondary';
    case 'FAILED':
      return 'destructive';
    default:
      return 'outline';
  }
};

export const getStatusBadgeClasses = (status?: string) => {
  switch (status) {
    case 'NEW':
      return 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600 font-semibold';
    case 'READY':
      return 'bg-green-500 text-white border-green-600 hover:bg-green-600 font-semibold';
    case 'RUNNING':
      return 'bg-purple-500 text-white border-purple-600 hover:bg-purple-600 font-semibold animate-pulse';
    case 'COMPLETED':
      return 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 font-semibold';
    case 'FAILED':
      return 'bg-red-500 text-white border-red-600 hover:bg-red-600 font-semibold';
    default:
      return 'bg-gray-400 text-white border-gray-500 hover:bg-gray-500 font-semibold';
  }
};

export const mapLegacyStatus = (status?: string): 'NEW' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' => {
  switch (status) {
    case 'NEW':
      return 'READY';
    case 'READY':
      return 'READY';
    case 'active':  // Mobile instance active status (from ProfileManager)
      return 'RUNNING';
    case 'inactive':  // Mobile instance inactive status (from ProfileManager)
      return 'READY';
    case 'RUNNING':
      return 'RUNNING';
    case 'running':  // Mobile instance running status (lowercase - legacy)
      return 'RUNNING';
    case 'stopped':  // Mobile instance stopped status (lowercase - legacy)
      return 'READY';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'FAILED':
      return 'FAILED';
    default:
      return 'READY';
  }
};
