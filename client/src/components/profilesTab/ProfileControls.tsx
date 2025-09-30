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
  Settings,
  PlayCircle,
  PauseCircle,
  Filter,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface ProfileControlsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  uniqueStatuses: string[];
  onCreateNew: () => void;
  isCreating: boolean;
  onNavigateToSettings?: () => void;
  isAutoRunEnabled: boolean;
  scheduledProfilesCount: number;
  totalProfiles: number;
  onRefreshScheduledProfiles: () => Promise<void>;
}

export const ProfileControls: React.FC<ProfileControlsProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  uniqueStatuses,
  onCreateNew,
  isCreating,
  onNavigateToSettings,
  isAutoRunEnabled,
  scheduledProfilesCount,
  totalProfiles,
  onRefreshScheduledProfiles,
}) => {
  const { toast } = useToast();

  const handleRefreshScheduled = async () => {
    try {
      await onRefreshScheduledProfiles();
      toast({
        title: "Refreshed",
        description: `${scheduledProfilesCount} scheduled profiles`,
      });
    } catch (error) {
      console.error('Failed to fetch scheduled profiles:', error);
      toast({
        title: "Error",
        description: "Failed to refresh scheduled profiles",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        {/* Profile Control */}
        <div className="flex items-center space-x-4 w-full">       
          <Button
            onClick={onCreateNew}
            disabled={isCreating}
            className="bg-accent text-white hover:bg-emerald-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isCreating ? "Creating..." : "New"}
          </Button>

          <div className="relative">
            <Input
              type="text"
              placeholder="Search profiles..."
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
            <div 
              className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              onClick={handleRefreshScheduled}
              title="Click to refresh scheduled profiles count"
            >
             scheduled {scheduledProfilesCount}  of {totalProfiles} profiles
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