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
      return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
    case 'READY':
      return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
    case 'RUNNING':
      return 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200';
    case 'COMPLETED':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200';
    case 'FAILED':
      return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200';
  }
};

export const mapLegacyStatus = (status?: string): 'NEW' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' => {
  switch (status) {
    case 'NEW':
      return 'NEW';
    case 'READY':
      return 'READY';
    case 'RUNNING':
      return 'RUNNING';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'FAILED':
      return 'FAILED';
    default:
      return 'NEW';
  }
};
