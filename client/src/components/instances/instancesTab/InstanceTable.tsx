import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { Profile } from '@shared/schema';
import { ExecutionColumn, ExecutionActions } from '../../modals/executionColumn';
import { HandleColumn } from '../../modals/handleColumn';
import {
  getStatusBadgeVariant,
  getStatusBadgeClasses,
  mapLegacyStatus
} from '../../modals/executionColumn';
import { formatExecutionTimeAgo } from './instanceUtils';

interface InstanceTableProps {
  profiles: Profile[];
  paginatedProfiles: Profile[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (column: 'id' | 'name' | 'status' | 'lastRun') => void;
  onProfileClick: (profile: Profile) => void;
  onScriptClick: (profileId: number) => void;
  onTwitterCaringClick?: (profileId: number) => void;
  onRunProfile: (profileId: number) => void;
  onStopProfile: (profileId: number) => void;
  onLogClick: (profile: Profile) => void;
  onOutputClick: (profile: Profile) => void;
  onOpenBrowser: (profile: Profile) => void;
  onDuplicate: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
  isTwitterCaring: boolean;
  isOpeningBrowser?: boolean;
  isDuplicating?: boolean;
  selectedScript?: string;
}

export const InstanceTable: React.FC<InstanceTableProps> = ({
  profiles,
  paginatedProfiles,
  sortBy,
  sortOrder,
  onSort,
  onProfileClick,
  onScriptClick,
  onTwitterCaringClick,
  onRunProfile,
  onStopProfile,
  onLogClick,
  onOutputClick,
  onOpenBrowser,
  onDuplicate,
  onDelete,
  isTwitterCaring,
  isOpeningBrowser = false,
  isDuplicating = false,
  selectedScript,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 dark:bg-gray-900 h-6">
            <TableHead className="w-[50px] py-1">
              <button
                onClick={() => onSort('id')}
                className={`flex items-center space-x-1 hover:text-blue-600 transition-colors ${
                  sortBy === 'id' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                } p-1 rounded`}
              >
                <span>ID</span>
                {sortBy === 'id' ? (
                  sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4 opacity-0 group-hover:opacity-50" />
                )}
              </button>
            </TableHead>
            <TableHead className="w-[200px] py-1">
              <button
                onClick={() => onSort('name')}
                className={`flex items-center space-x-1 hover:text-blue-600 transition-colors ${
                  sortBy === 'name' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                } p-1 rounded`}
              >
                <span>Name</span>
                {sortBy === 'name' ? (
                  sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4 opacity-0 group-hover:opacity-50" />
                )}
              </button>
            </TableHead>
            <TableHead className="w-[200px] text-gray-500 dark:text-gray-400 py-1">Script</TableHead>
            <TableHead className="w-[200px] text-gray-500 dark:text-gray-400 py-1">Executions</TableHead>
            <TableHead className="w-[100px] py-1">
              <button
                onClick={() => onSort('lastRun')}
                className={`flex items-center space-x-1 hover:text-blue-600 transition-colors ${
                  sortBy === 'lastRun' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                } p-1 rounded`}
              >
                <span>Last</span>
                {sortBy === 'lastRun' ? (
                  sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4 opacity-0 group-hover:opacity-50" />
                )}
              </button>
            </TableHead>
            <TableHead className="w-[50px] py-1">
              <button
                onClick={() => onSort('status')}
                className={`flex items-center space-x-1 hover:text-blue-600 transition-colors ${
                  sortBy === 'status' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                } p-1 rounded`}
              >
                <span>Status</span>
                {sortBy === 'status' ? (
                  sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4 opacity-0 group-hover:opacity-50" />
                )}
              </button>
            </TableHead>
            <TableHead className="w-[50px] py-1">Handle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedProfiles.map((profile, index) => (
            <TableRow
              key={profile.id}
              className={`hover:bg-gray-100 dark:hover:bg-gray-700 h-6 ${index % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-900"}`}
            >
              <TableCell className="font-medium text-sm text-left w-[50px] py-1">
                {profile.id}
              </TableCell>
              <TableCell className="text-sm text-left py-1">
                <div className="max-w-md">
                  <button
                    onClick={() => onProfileClick(profile)}
                    className="font-medium hover:underline cursor-pointer truncate text-left text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    title="View instance details"
                  >
                    {profile.name}
                  </button>
                </div>
              </TableCell>
              <TableCell className="text-sm text-left py-1">
                <div className="max-w-md">
                  {!selectedScript || selectedScript == "none" || selectedScript == "" || selectedScript == "undefined" ? (
                    <button
                      onClick={() => onScriptClick(profile.id)}
                      className="font-medium hover:underline cursor-pointer truncate text-left text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      title="Edit script"
                    >
                      Edit
                    </button>
                  ) : (
                    <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                      {selectedScript}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right py-1">
                <ExecutionActions
                  isRunning={profile.status === 'RUNNING'}
                  onRun={() => onRunProfile(profile.id)}
                  onStop={() => onStopProfile(profile.id)}
                  onViewLog={() => onLogClick(profile)}
                  onViewOutput={() => onOutputClick(profile)}
                  showIndicator={true}
                  indicatorComponent={<ExecutionColumn profile={profile} />}
                  runTooltip="Run instance"
                  stopTooltip="Stop instance"
                  logTooltip="View log file"
                  outputTooltip="Show output files"
                />
              </TableCell>

              {/* Last Run Column */}
              <TableCell className="text-left py-1">
                {profile.updatedAt ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatExecutionTimeAgo(profile.updatedAt.toString())}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">
                    Never
                  </div>
                )}
              </TableCell>

              {/* Status Column */}
              <TableCell className="text-sm text-left py-1">
                <Badge
                  variant={getStatusBadgeVariant(profile.status)}
                  className={`text-xs ${getStatusBadgeClasses(profile.status)}`}
                >
                  {mapLegacyStatus(profile.status)}
                </Badge>
              </TableCell>

              {/* Handle Column */}
              <TableCell className="text-right py-1">
                <HandleColumn
                  entity={profile}
                  onOpenBrowser={() => onOpenBrowser(profile)}
                  onDuplicate={() => onDuplicate(profile)}
                  onDelete={() => onDelete(profile)}
                  isOpeningBrowser={isOpeningBrowser}
                  isDuplicating={isDuplicating}
                  openBrowserTooltip="Launch instance only (without running script)"
                  duplicateTooltip="Clone instance with all apps and settings"
                  deleteTooltip="Delete instance and all associated data"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
