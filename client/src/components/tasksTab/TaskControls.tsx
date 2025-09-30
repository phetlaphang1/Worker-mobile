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
  RefreshCw,
  Settings,
  PlayCircle,
  PauseCircle,
  Filter,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TaskControlsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  profileFilter: string;
  onProfileFilterChange: (value: string) => void;
  scriptFilter: string;
  onScriptFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  uniqueProfiles: string[];
  uniqueScripts: string[];
  uniqueStatuses: string[];
  onFetchTasks: () => void;
  isFetching: boolean;
  isRefreshing: boolean;
  onNavigateToSettings?: () => void;
  isAutoRunEnabled: boolean;
}

export const TaskControls: React.FC<TaskControlsProps> = ({
  searchTerm,
  onSearchChange,
  profileFilter,
  onProfileFilterChange,
  scriptFilter,
  onScriptFilterChange,
  statusFilter,
  onStatusFilterChange,
  uniqueProfiles,
  uniqueScripts,
  uniqueStatuses,
  onFetchTasks,
  isFetching,
  isRefreshing,
  onNavigateToSettings,
  isAutoRunEnabled,
}) => {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">         
        {/* Task Controls */}       
        <div className="flex items-center space-x-4 w-full">           
          <Button
              onClick={onFetchTasks}
              disabled={isFetching || isRefreshing}
              className="bg-accent text-white hover:bg-emerald-600"
              >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? "Syncing..." : "Sync"}
          </Button>

          <div className="relative">
           <Input
             type="text"
             placeholder="Search tasks, profiles, scripts, requests, responses..."
             value={searchTerm}
             onChange={(e) => onSearchChange(e.target.value)}
             className="pl-10 w-64"
           />
           <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>

          <div className="relative">
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
            
          </div>

        </div>
                                 
        {/* Filters and Info */}
        <div className="flex items-center justify-between w-full">
          <div></div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={profileFilter} onValueChange={onProfileFilterChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by Profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Profiles</SelectItem>
                {uniqueProfiles.map(profile => (
                  <SelectItem key={profile} value={profile}>{profile}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={scriptFilter} onValueChange={onScriptFilterChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by Script" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scripts</SelectItem>
                {uniqueScripts.map(script => (
                  <SelectItem key={script} value={script}>{script}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
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