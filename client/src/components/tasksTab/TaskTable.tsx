import React, { useState, useEffect } from 'react';
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
  UserPlus,
  Check,
} from "lucide-react";
import type { Task } from '@shared/schema';
import type { Profile } from '@shared/schema';
import { ExecutionColumn, ExecutionActions } from '../modals/executionColumn';
import { HandleColumn } from '../modals/handleColumn';
import {
  getStatusBadgeVariant,
  getStatusBadgeClasses,
  mapLegacyStatus
} from '../modals/executionColumn';
import { getLocalProfileId, formatExecutionTimeAgo } from './taskUtils';

interface TaskTableProps {
  tasks: Task[];
  paginatedTasks: Task[];
  profiles: Profile[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  lastExecutionTimes: Map<number, string>;
  onSort: (column: 'id' | 'name' | 'profile' | 'script' | 'status' | 'lastRun') => void;
  onTaskClick: (task: Task) => void;
  onProfileClick: (profileData: any) => void;
  onScriptClick: (scriptData: any) => void;
  onRunTask: (task: Task) => void;
  onStopTask: (taskId: number) => void;
  onCompleteTask: (taskId: number) => void;
  onClearTask: (task: Task) => void;
  onViewLog: (task: Task) => void;
  onViewOutput: (task: Task) => void;
  runningTaskIds: Set<number>;
  onOpenBrowser?: (task: Task, profile: Profile) => void;
  onCreateProfileFromTask?: (task: Task, profile: Profile) => void;
  onClearTaskStorage?: (task: Task) => void;
  isOpeningBrowser?: boolean;
  isCreatingProfile?: boolean;
  isClearingStorage?: boolean;
}

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  paginatedTasks,
  profiles,
  sortBy,
  sortOrder,
  lastExecutionTimes,
  onSort,
  onTaskClick,
  onProfileClick,
  onScriptClick,
  onRunTask,
  onStopTask,
  onCompleteTask,
  onClearTask,
  onViewLog,
  onViewOutput,
  runningTaskIds,
  onOpenBrowser,
  onCreateProfileFromTask,
  onClearTaskStorage,
  isOpeningBrowser = false,
  isCreatingProfile = false,
  isClearingStorage = false,
}) => {
  const [taskCenterUserId, setTaskCenterUserId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch config on component mount
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setTaskCenterUserId(data.taskCenterUserId);
      })
      .catch(err => {
        console.error('Failed to fetch config:', err);
      });
  }, []);

  const isTaskRunning = (taskId: number) => {
    return runningTaskIds.has(taskId);
  };

  const getProfileById = (profileId: number) => {
    return profiles.find(p => p.id === profileId);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 dark:bg-gray-900 h-6">
            <TableHead className="w-[40px] py-1">
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
            <TableHead className="w-[100px] py-1">
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
            <TableHead className="w-[100px] py-1">
              <button
                onClick={() => onSort('script')}
                className={`flex items-center space-x-1 hover:text-blue-600 transition-colors ${
                  sortBy === 'script' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                } p-1 rounded`}
              >
                <span>Script</span>
                {sortBy === 'script' ? (
                  sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4 opacity-0 group-hover:opacity-50" />
                )}
              </button>
            </TableHead>
            <TableHead className="w-[250px] py-1">
              <button
                onClick={() => onSort('profile')}
                className={`flex items-center space-x-1 hover:text-blue-600 transition-colors ${
                  sortBy === 'profile' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                } p-1 rounded`}
              >
                <span>Profile</span>
                {sortBy === 'profile' ? (
                  sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4 opacity-0 group-hover:opacity-50" />
                )}
              </button>
            </TableHead>
            <TableHead className="w-[100px] text-gray-500 dark:text-gray-400 py-1">Executions</TableHead>
            <TableHead className="w-[50px] py-1">
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
          {paginatedTasks.map((task, index) => {
            const taskWithProfile = task as any;
            const profileName = taskWithProfile.profile?.name;
            const localProfileId = getLocalProfileId(task, taskCenterUserId);
            
            // Try to get the full profile data from profiles list
            const profileFromList = localProfileId 
              ? getProfileById(localProfileId) 
              : taskWithProfile.profile?.id 
                ? getProfileById(taskWithProfile.profile.id) 
                : null;
            
            // Use task's profile data for display (includes all Task Center info)
            // profileFromList is only used for certain operations
            const profileData = taskWithProfile.profile;
            const scriptData = taskWithProfile.script;
            const isRunning = isTaskRunning(task.id);
            
            return (
              <TableRow
                key={task.id}
                className={`hover:bg-gray-100 dark:hover:bg-gray-700 h-6 ${index % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-900"}`}
              >
                <TableCell className="font-medium text-sm text-left w-[40px] py-1">
                  {task.id}
                </TableCell>
                <TableCell className="text-sm text-left py-1">
                  <div className="max-w-[100px]">
                    <button
                      onClick={() => onTaskClick(task)}
                      className="font-medium hover:underline cursor-pointer truncate text-left text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      title="View task details"
                    >
                      {task.name}
                    </button>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-left py-1">
                  <div className="max-w-[100px]">
                    {scriptData ? (
                      <button
                        onClick={() => onScriptClick(scriptData)}
                        className="font-medium hover:underline cursor-pointer truncate text-left text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        title="View script details"
                      >
                        {scriptData.name || 'Unnamed Script'}
                      </button>
                    ) : (
                      <span className="text-gray-400">No Script</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-left py-1">
                  <div className="max-w-[250px] flex items-center gap-1">
                    {profileData ? (
                      <>
                        <button
                          onClick={() => onProfileClick(profileData)}
                          className="font-medium hover:underline cursor-pointer truncate text-left text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          title="View profile details"
                        >
                          {profileName || 'Unknown'}
                        </button>
                        {localProfileId && (
                          <Badge
                            variant="secondary"
                            className={`text-xs px-1 py-0 h-4 ${
                              localProfileId === -1
                                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-700'
                                : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-700'
                            }`}
                            title={localProfileId === -1 ? 'Profile not found in local storage' : `Local Profile ID: ${localProfileId}`}
                          >
                             {localProfileId === -1 ? '!' : localProfileId}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">No Profile</span>
                    )}
                  </div>
                </TableCell>
                
                {/* Actions Column */}
                <TableCell className="text-right py-1">
                  <ExecutionActions
                    isRunning={isRunning}
                    onRun={() => onRunTask(task)}
                    onStop={() => onStopTask(task.id)}
                    onViewLog={() => onViewLog(task)}
                    onViewOutput={() => onViewOutput(task)}
                    showIndicator={true}
                    indicatorComponent={<ExecutionColumn profile={profileFromList || profileData} />}
                    runTooltip="Run task"
                    stopTooltip="Stop task"
                    logTooltip="View log file"
                    outputTooltip="Show output files"
                  />
                </TableCell>
                
                {/* Last Run Column */}
                <TableCell className="text-left py-1">
                  {lastExecutionTimes.get(task.id) ? (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatExecutionTimeAgo(lastExecutionTimes.get(task.id)!)}
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
                    variant={getStatusBadgeVariant(task.status)}
                    className={`text-xs ${getStatusBadgeClasses(task.status)}`}
                  >
                    {mapLegacyStatus(task.status)}
                  </Badge>
                </TableCell>
                
                {/* Handle Column */}
                <TableCell className="text-right py-1">
                  <HandleColumn
                    entity={profileFromList || profileData}
                    onOpenBrowser={(profileFromList || profileData) && onOpenBrowser ? () => onOpenBrowser(task, profileFromList || profileData) : undefined}
                    onDuplicate={(profileFromList || profileData) && onCreateProfileFromTask ? () => onCreateProfileFromTask(task, profileFromList || profileData) : undefined}
                    onDelete={onClearTaskStorage ? () => onClearTaskStorage(task) : undefined}
                    isOpeningBrowser={isOpeningBrowser}
                    isDuplicating={isCreatingProfile}
                    isDeleting={isClearingStorage}
                    showOpenBrowser={Boolean((profileFromList || profileData) && onOpenBrowser)}
                    showDuplicate={Boolean((profileFromList || profileData) && onCreateProfileFromTask)}
                    showDelete={Boolean(onClearTaskStorage)}
                    openBrowserTooltip="Open Chrome browser for testing with task's profile configuration"
                    duplicateTooltip="Create new local profile from task's profile"
                    deleteTooltip="Clear task and remove profile folder from storage"
                    disableOpenBrowser={isRunning || !onOpenBrowser}
                    disableDuplicate={!onCreateProfileFromTask}
                    disableDelete={!onClearTaskStorage}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};