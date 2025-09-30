import { useState, useEffect } from "react";
import { CheckSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@shared/schema";
import type { Profile } from "@shared/schema";

// Import components
import TaskDetailsModal from "./modals-details/taskDetails";
import ProfileDetailsModal from "./modals-details/profileDetails";
import ScriptDetailsModal from "./modals-details/scriptDetails";
import { LogDetailsModal, OutputDetailsModal } from "./modals-details/executionDetails";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Import extracted components
import { TaskTable } from './tasksTab/TaskTable';
import { TaskControls } from './tasksTab/TaskControls';
import { TaskPagination } from './tasksTab/TaskPagination';
import { useTaskMutations } from './tasksTab/useTaskMutations';
import { getLastExecutionTime, searchAllTaskInfo } from './tasksTab/taskUtils';

interface TasksPanelProps {
  tasks: Task[];
  isLoading: boolean;
  onFetchTasks: () => void;
  isFetching: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onNavigateToSettings?: () => void;
}

export default function TasksPanel({
  tasks,
  isLoading,
  onFetchTasks,
  isFetching,
  onRefresh,
  isRefreshing = false,
  onNavigateToSettings,
}: TasksPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filtering and sorting state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'profile' | 'script' | 'status' | 'lastRun'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [profileFilter, setProfileFilter] = useState("all");
  const [scriptFilter, setScriptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Modal states
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false);
  const [scriptDetailsOpen, setScriptDetailsOpen] = useState(false);
  const [selectedProfileData, setSelectedProfileData] = useState<any>(null);
  const [selectedScriptData, setSelectedScriptData] = useState<any>(null);
  const [logDetails, setLogDetails] = useState<{
    taskId: number;
    content: string;
  } | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [outputDetails, setOutputDetails] = useState<{
    taskId: number;
    files: any[];
    path: string;
  } | null>(null);
  const [isOutputModalOpen, setIsOutputModalOpen] = useState(false);
  
  // Profile selection modal states
  const [isProfileSelectionOpen, setIsProfileSelectionOpen] = useState(false);
  const [taskForProfileSelection, setTaskForProfileSelection] = useState<Task | null>(null);
  
  // Clear confirmation modal states
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [taskToBeCleared, setTaskToBeCleared] = useState<Task | null>(null);
  
  // Task running state management
  const [runningTaskIds, setRunningTaskIds] = useState<Set<number>>(new Set());
  
  // Last execution time from task updatedAt
  const [lastExecutionTimes, setLastExecutionTimes] = useState<Map<number, string>>(new Map());
  const [isAutoRunEnabled, setIsAutoRunEnabled] = useState(false);
  
  // Loading states for new actions
  const [isOpeningBrowser, setIsOpeningBrowser] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isClearingStorage, setIsClearingStorage] = useState(false);

  // Fetch profiles for selection
  const { data: profiles = [] } = useQuery({
    queryKey: ["/api/profiles"],
    queryFn: () => fetch("/api/profiles").then(res => res.json()),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  // Import mutations
  const {
    launchTaskMutation,
    stopTaskMutation,
    markTaskCompletedMutation,
    clearTaskMutation,
  } = useTaskMutations();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        if (data.taskSettings?.isAutoRunTask !== undefined) {
          setIsAutoRunEnabled(data.taskSettings.isAutoRunTask);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    fetchSettings();
  }, []);

  // Update last execution times
  useEffect(() => {
    const newTimes = new Map();
    tasks.forEach((task) => {
      const time = getLastExecutionTime(task);
      if (time) {
        newTimes.set(task.id, time);
      }
    });
    setLastExecutionTimes(newTimes);
  }, [tasks]);

  // Update running task IDs based on task statuses
  useEffect(() => {
    const runningIds = new Set(tasks.filter(task => task.status === 'RUNNING').map(task => task.id));
    setRunningTaskIds(runningIds);
  }, [tasks]);

  // Handler functions
  const handleTaskDetailsClick = (task: Task) => {
    setSelectedTask(task);
    setTaskDetailsOpen(true);
  };

  const handleProfileDetailsClick = (profileData: any) => {
    setSelectedProfileData(profileData);
    setProfileDetailsOpen(true);
  };

  const handleScriptDetailsClick = (scriptData: any) => {
    setSelectedScriptData(scriptData);
    setScriptDetailsOpen(true);
  };

 const handleRunTask = (task: Task) => {
    setRunningTaskIds(prev => {
      const newSet = new Set(prev);
      newSet.add(task.id);
      return newSet;
    });
    launchTaskMutation.mutate({
      taskId: task.id,
      onTaskFinish: (taskId: number) => {
        setRunningTaskIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      }
    });
  };

  const handleStopTask = (taskId: number) => {
    setRunningTaskIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(taskId);
      return newSet;
    });
    stopTaskMutation.mutate(taskId);
  };

  const handleCompleteTask = (taskId: number) => {
    markTaskCompletedMutation.mutate(taskId);
  };

  const handleClearTaskClick = (task: Task) => {
    setTaskToBeCleared(task);
    setIsClearConfirmOpen(true);
  };

  const confirmClearTask = () => {
    if (taskToBeCleared) {
      clearTaskMutation.mutate(taskToBeCleared.id);
      setIsClearConfirmOpen(false);
      setTaskToBeCleared(null);
    }
  };

  const handleLogClick = async (task: Task) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}/log`);
      if (response.ok) {
        const data = await response.json();
        setLogDetails({ taskId: task.id, content: data.content });
        setIsLogModalOpen(true);
      } else {
        toast({
          title: "No Log Found",
          description: "No log file exists for this task yet. Run the task first.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch log content",
        variant: "destructive",
      });
    }
  };

  const handleOutputClick = async (task: Task) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}/output`);
      const data = await response.json();
      setOutputDetails({ taskId: task.id, ...data });
      setIsOutputModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch output data:', error);
      toast({
        title: "Error",
        description: "Failed to load output files",
        variant: "destructive",
      });
    }
  };

  const handleOpenBrowser = async (task: Task, profile: any) => {
    setIsOpeningBrowser(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}/open-browser`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        const profileInfo = data.profileId 
          ? `using local profile ID: ${data.profileId}` 
          : 'using task profile';
        toast({
          title: "Browser Opened",
          description: `Chrome browser opened for task "${task.name || task.id}" ${profileInfo}`,
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to open browser');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to open Chrome browser",
        variant: "destructive",
      });
    } finally {
      setIsOpeningBrowser(false);
    }
  };

  const handleCreateProfileFromTask = async (task: Task, profile: any) => {
    setIsCreatingProfile(true);
    try {
      // Create a new profile based on the task's profile data
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: `${profile?.name || 'Profile'} (Copy from Task ${task.id})`,
          isIncognito: profile?.isIncognito || false,
          isHeadless: profile?.isHeadless || false,
          browser: profile?.browser || 'chrome',
          userAgent: profile?.userAgent || profile?.customUserAgent || '',
        }),
      });
      if (response.ok) {
        const newProfile = await response.json();
        toast({
          title: "Profile Created",
          description: `New profile "${newProfile.name}" created successfully`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      } else {
        throw new Error('Failed to create profile');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create profile from task",
        variant: "destructive",
      });
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const handleClearTaskStorage = async (task: Task) => {
    setIsClearingStorage(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}/clear`, {
        method: 'POST',
      });
      if (response.ok) {
        toast({
          title: "Task Cleared",
          description: `Task ${task.name} and its storage have been cleared`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      } else {
        throw new Error('Failed to clear task storage');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear task storage",
        variant: "destructive",
      });
    } finally {
      setIsClearingStorage(false);
    }
  };

  // Filtering and sorting logic
  const filteredAndSortedTasks = tasks
    .filter(task => {
      const matchesSearch = searchAllTaskInfo(task, searchTerm);
      
      const profileName = (task as any).profile?.name;
      const matchesProfile = !profileFilter || profileFilter === "all" || 
                            (profileName && profileName === profileFilter) ||
                            (!profileName && profileFilter === "No Profile");
      
      const scriptName = (task as any).script?.name;
      const matchesScript = !scriptFilter || scriptFilter === "all" || 
                           (scriptName && scriptName === scriptFilter) ||
                           (!scriptName && scriptFilter === "No Script");
      
      const matchesStatus = !statusFilter || statusFilter === "all" || 
                           task.status.toLowerCase().includes(statusFilter.toLowerCase());
      
      return matchesSearch && matchesProfile && matchesScript && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'id':
          comparison = a.id - b.id;
          break;
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'profile':
          const aProfile = (a as any).profile?.name || '';
          const bProfile = (b as any).profile?.name || '';
          comparison = aProfile.localeCompare(bProfile);
          break;
        case 'script':
          const aScript = (a as any).script?.name || '';
          const bScript = (b as any).script?.name || '';
          comparison = aScript.localeCompare(bScript);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'lastRun':
          const aTime = lastExecutionTimes.get(a.id) || '';
          const bTime = lastExecutionTimes.get(b.id) || '';
          comparison = aTime.localeCompare(bTime);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedTasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTasks = filteredAndSortedTasks.slice(startIndex, startIndex + itemsPerPage);

  // Handle sorting
  const handleSort = (column: 'id' | 'name' | 'profile' | 'script' | 'status' | 'lastRun') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Get unique values for filters
  const profileNames = tasks.map(task => {
    const profileName = (task as any).profile?.name;
    return profileName && profileName.trim() !== "" ? profileName : "No Profile";
  }).filter(name => name && name.trim() !== "");
  const uniqueProfiles = Array.from(new Set(profileNames));
  
  const scriptNames = tasks.map(task => {
    const scriptName = (task as any).script?.name;
    return scriptName && scriptName.trim() !== "" ? scriptName : "No Script";
  }).filter(name => name && name.trim() !== "");
  const uniqueScripts = Array.from(new Set(scriptNames));
  
  const statusNames = tasks.map(task => task.status).filter(status => status && status.trim() !== "");
  const uniqueStatuses = Array.from(new Set(statusNames));

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-64" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <TaskControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        profileFilter={profileFilter}
        onProfileFilterChange={setProfileFilter}
        scriptFilter={scriptFilter}
        onScriptFilterChange={setScriptFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        uniqueProfiles={uniqueProfiles}
        uniqueScripts={uniqueScripts}
        uniqueStatuses={uniqueStatuses}
        onFetchTasks={onFetchTasks}
        isFetching={isFetching}
        isRefreshing={isRefreshing}
        onNavigateToSettings={onNavigateToSettings}
        isAutoRunEnabled={isAutoRunEnabled}
      />

      {filteredAndSortedTasks.length === 0 ? (
        <div className="text-center py-12">
          <CheckSquare className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No tasks
          </h3>
          <p className="text-gray-500 mb-6">
            Refresh tasks from Task Center to get started
          </p>
          <Button
            onClick={onFetchTasks}
            disabled={isFetching || isRefreshing}
            className="bg-primary text-white hover:bg-blue-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Syncing..." : "Sync"}
          </Button>
        </div>
      ) : (
        <>
          <TaskTable
            tasks={tasks}
            paginatedTasks={paginatedTasks}
            profiles={profiles}
            sortBy={sortBy}
            sortOrder={sortOrder}
            lastExecutionTimes={lastExecutionTimes}
            onSort={handleSort}
            onTaskClick={handleTaskDetailsClick}
            onProfileClick={handleProfileDetailsClick}
            onScriptClick={handleScriptDetailsClick}
            onRunTask={handleRunTask}
            onStopTask={handleStopTask}
            onCompleteTask={handleCompleteTask}
            onClearTask={handleClearTaskClick}
            onViewLog={handleLogClick}
            onViewOutput={handleOutputClick}
            runningTaskIds={runningTaskIds}
            onOpenBrowser={handleOpenBrowser}
            onCreateProfileFromTask={handleCreateProfileFromTask}
            onClearTaskStorage={handleClearTaskStorage}
            isOpeningBrowser={isOpeningBrowser}
            isCreatingProfile={isCreatingProfile}
            isClearingStorage={isClearingStorage}
          />

          <TaskPagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filteredAndSortedTasks.length}
            startIndex={startIndex}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(items) => {
              setItemsPerPage(items);
              setCurrentPage(1);
            }}
          />
        </>
      )}

      {/* Modals */}
      <TaskDetailsModal
        task={selectedTask}
        isOpen={taskDetailsOpen}
        onClose={() => setTaskDetailsOpen(false)}
      />

      <ProfileDetailsModal
        profileData={selectedProfileData}
        isOpen={profileDetailsOpen}
        onClose={() => setProfileDetailsOpen(false)}
        isTaskProfile={true}
      />

      <ScriptDetailsModal
        scriptData={selectedScriptData}
        isOpen={scriptDetailsOpen}
        onClose={() => setScriptDetailsOpen(false)}
      />

      <LogDetailsModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title={`Script Log - Task ${logDetails?.taskId}`}
        content={logDetails?.content || ""}
        type="task"
        id={logDetails?.taskId}
      />

      <OutputDetailsModal
        isOpen={isOutputModalOpen}
        onClose={() => setIsOutputModalOpen(false)}
        title={`Output Folder - Task ${outputDetails?.taskId}`}
        path={outputDetails?.path || ""}
        files={outputDetails?.files || []}
        baseUrl={`/api/tasks/${outputDetails?.taskId}`}
      />

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Completed Task</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset task "{taskToBeCleared?.name}" to READY status. 
              Are you sure you want to clear this completed task?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearTask}
              disabled={clearTaskMutation.isPending}
            >
              {clearTaskMutation.isPending ? "Clearing..." : "Clear Task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}