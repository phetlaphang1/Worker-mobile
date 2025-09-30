import { useState, useEffect, useMemo } from "react";
import { Users, BarChart3, Server, Download, RefreshCw, Plus } from "lucide-react";
import Sidebar from "@/components/modals/sidebar";
import TasksPanel from "@/components/tasksTab";
import ProfilesPanel from "@/components/profilesTab";
import SettingsPanel from "@/components/settingsTab";
import TwtCaringTab from "@/components/twitterTab";
import AutomationBuilder from "@/components/automationTab/AutomationBuilder";
import MobileNavigation from "@/components/MobileNavigation";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/libs/api";
import { useToast } from "@/hooks/use-toast";

type ActiveTab = "tasks" | "profiles" | "settings" | "twitter-caring" | "automation";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("tasks");
  const [autoFetchInterval, setAutoFetchInterval] = useState<number>(30); // in seconds
  const [isAutoFetchEnabled, setIsAutoFetchEnabled] = useState<boolean>(false);
  const [selectedProfileIdFilter, setSelectedProfileIdFilter] = useState<number | undefined>(undefined);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<string>("general");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Load settings from localStorage
    const savedInterval = localStorage.getItem("autoFetchInterval");
    const savedEnabled = localStorage.getItem("autoFetchEnabled");
    
    if (savedInterval) setAutoFetchInterval(parseInt(savedInterval));
    if (savedEnabled) setIsAutoFetchEnabled(savedEnabled === "true");
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isAutoFetchEnabled && autoFetchInterval >= 5) { // Minimum 5 seconds
      intervalId = setInterval(() => {
        refreshTasks();
        toast({
          title: "Auto Fetch",
          description: "Tasks refreshed automatically",
        });
      }, autoFetchInterval * 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoFetchEnabled, autoFetchInterval]);

  const handleAutoFetchChange = (interval: number, enabled: boolean) => {
    setAutoFetchInterval(interval);
    setIsAutoFetchEnabled(enabled);
    
    // Save to localStorage
    localStorage.setItem("autoFetchInterval", interval.toString());
    localStorage.setItem("autoFetchEnabled", enabled.toString());
  };

  const handleNavigateToTwitterCaring = (profileId: number) => {
    setSelectedProfileIdFilter(profileId);
    setActiveTab("twitter-caring");
  };

  const handleNavigateToProfileSettings = () => {
    setSettingsDefaultTab("profiles");
    setActiveTab("settings");
  };

  const handleNavigateToTaskSettings = () => {
    setSettingsDefaultTab("tasks");
    setActiveTab("settings");
  };

  const handleTabChange = (tab: ActiveTab) => {
    if (tab !== "twitter-caring") {
      setSelectedProfileIdFilter(undefined);
    }
    setActiveTab(tab);
  };

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks"],
    queryFn: api.tasks.list,
    staleTime: 1000 * 30, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["/api/profiles"],
    queryFn: api.profiles.list,
    staleTime: 1000 * 60, // Consider data fresh for 1 minute
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Fetch Twitter Caring data to get unique profile count
  const { data: twitterCaringData = [] } = useQuery({
    queryKey: ["/api/twitters/caring"],
    queryFn: async () => {
      const response = await fetch("/api/twitters/caring");
      if (!response.ok) throw new Error("Failed to fetch Twitter caring data");
      return response.json();
    },
    staleTime: 1000 * 60, // Consider data fresh for 1 minute
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const fetchTasksMutation = useMutation({
    mutationFn: api.tasks.fetchFromTaskCenter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Success",
        description: "Tasks fetched from Task Center successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch tasks from Task Center",
        variant: "destructive",
      });
    },
  });

  // Debounced refresh to prevent rapid successive calls
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTasks = async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes
    
    setIsRefreshing(true);
    try {
      // Only invalidate tasks query - profiles don't need frequent updates
      await queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    } finally {
      // Add minimum delay to prevent UI flashing
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const getLastSyncTime = () => {
    const now = new Date();
    return now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Add running task count calculation
  const runningTaskCount = tasks.filter(task => task.status === 'RUNNING').length;

  // Add running profile count calculation
  const runningProfileCount = profiles.filter(profile => profile.status === 'RUNNING').length;

  // Calculate unique Twitter Caring profile count
  const twitterCaringCount = useMemo(() => {
    const uniqueProfileIds = new Set(
      twitterCaringData
        .map((record: any) => record.profileId)
        .filter(Boolean)
    );
    return uniqueProfileIds.size;
  }, [twitterCaringData]);

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-gray-900">
      <div className="sidebar-desktop">
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          taskCount={tasks.length}
          runningTaskCount={runningTaskCount}
          profileCount={profiles.length}
          runningProfileCount={runningProfileCount}
          twitterCaringCount={twitterCaringCount}
        />
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Bar */}
        {activeTab === 'settings' && (
          <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-800 dark:text-white">
                  Settings
                </h2>
              </div>
            </div>
          </header>
        )}
      

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {activeTab === "tasks" && (
            <TasksPanel 
              tasks={tasks}
              isLoading={tasksLoading}
              onFetchTasks={() => fetchTasksMutation.mutate()}
              isFetching={fetchTasksMutation.isPending}
              onRefresh={refreshTasks}
              isRefreshing={isRefreshing}
              onNavigateToSettings={handleNavigateToTaskSettings}
            />
          )}
          {activeTab === "profiles" && (
            <ProfilesPanel 
              profiles={profiles}
              isLoading={profilesLoading}
              onNavigateToTwitterCaring={handleNavigateToTwitterCaring}
              onNavigateToSettings={handleNavigateToProfileSettings}
            />
          )}
          {activeTab === "twitter-caring" && (
            <TwtCaringTab profileIdFilter={selectedProfileIdFilter} />
          )}
          {activeTab === "settings" && (
            <SettingsPanel
              autoFetchInterval={autoFetchInterval}
              isAutoFetchEnabled={isAutoFetchEnabled}
              onAutoFetchChange={handleAutoFetchChange}
              defaultTab={settingsDefaultTab}
            />
          )}
          {activeTab === "automation" && (
            <AutomationBuilder />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Floating Action Button for Mobile */}
      {activeTab === "tasks" && (
        <button className="fab" onClick={() => fetchTasksMutation.mutate()}>
          <Plus />
        </button>
      )}
    </div>
  );
}
