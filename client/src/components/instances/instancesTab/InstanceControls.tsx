import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  PlayCircle,
  PauseCircle,
  Filter,
  RefreshCw,
  Play,
  Square,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface InstanceControlsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  uniqueStatuses: string[];
  onCreateNew: () => void;
  isCreating: boolean;
  onNavigateToSettings?: () => void;
  isAutoRunEnabled: boolean;
  totalProfiles: number;
  deviceMonitorStats?: {
    totalInstances: number;
    runningInstances: number;
    connectedInstances: number;
    logcatProcesses: number;
    uptime: number;
  };
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onRunAll?: () => void;
  onStopAll?: () => void;
  isRunningAll?: boolean;
  isStoppingAll?: boolean;
}

export const InstanceControls: React.FC<InstanceControlsProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  uniqueStatuses,
  onCreateNew,
  isCreating,
  onNavigateToSettings,
  isAutoRunEnabled,
  totalProfiles,
  deviceMonitorStats,
  onRefresh,
  isRefreshing = false,
  onRunAll,
  onStopAll,
  isRunningAll = false,
  isStoppingAll = false,
}) => {
  const { toast } = useToast();

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        {/* Instance Control */}
        <div className="flex items-center space-x-4 w-full">
          <Button
            onClick={onCreateNew}
            disabled={isCreating}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isCreating ? "Creating Instance..." : "New Instance"}
          </Button>

          <Button
            onClick={onRunAll}
            disabled={isRunningAll || !onRunAll}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            <Play className={`h-4 w-4 mr-2 ${isRunningAll ? 'animate-pulse' : ''}`} />
            {isRunningAll ? "Running All..." : "Run All"}
          </Button>

          <Button
            onClick={onStopAll}
            disabled={isStoppingAll || !onStopAll}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            <Square className={`h-4 w-4 mr-2 ${isStoppingAll ? 'animate-pulse' : ''}`} />
            {isStoppingAll ? "Stopping All..." : "Stop All"}
          </Button>

          <Button
            onClick={onRefresh}
            disabled={isRefreshing}
            variant="outline"
            className="border-gray-300 hover:bg-gray-100"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>

          <div className="relative">
            <Input
              type="text"
              placeholder="Search instances..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 w-64"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>

          <div className="flex items-center space-x-2">
            <Button
              onClick={() => onNavigateToSettings?.()}
              variant="outline"
              className="hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    {isAutoRunEnabled ? (
                      <PauseCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <PlayCircle className="h-5 w-5 text-green-500" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isAutoRunEnabled ? "Auto run enabled" : "Auto run disabled"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              Settings
            </Button>
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                <span>{totalProfiles} total</span>
              </div>
              {deviceMonitorStats && (
                <>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span>{deviceMonitorStats.runningInstances} running</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>{deviceMonitorStats.connectedInstances} connected</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Filters and Info */}
        <div className="flex items-center justify-between w-full">
         <div></div>
          {/* Right: Filters */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </>
  );
};
