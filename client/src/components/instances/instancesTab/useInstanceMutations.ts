import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/libs/api";
import { useToast } from "@/hooks/use-toast";
import type { Profile } from '@shared/schema';

export const useInstanceMutations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const launchProfileMutation = useMutation({
    mutationFn: async (params: { profileId: number }) => {
      // Optimistically update the profile status
      queryClient.setQueryData(["/api/profiles"], (oldData: any) => {
        return oldData.map((profile: any) =>
          profile.id === params.profileId
            ? { ...profile, status: "active" }
            : profile
        );
      });

      console.log("Start Running: ");

      const response = await fetch(
        `/api/profiles/${params.profileId}/launch`,
        { method: "POST" }
      );

      console.log("Complete Running: ");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to launch instance");
      }
      const result = await response.json()
      console.log("Instance Execution Response: ", result);
      return result ;
    },
    onSuccess: (data, params) => {
      console.log("Instance data: ", data);
      console.log("Instance params: ",params);
      const execution = data.execution;


      // Only show success toast if the execution wasn't stopped
      if (execution.status !== 'STOPPED') {
        toast({
          title: `Instance [${params.profileId}] Executed Completely`,
          description: `Script executed completely at ${new Date(execution.timestamp).toLocaleTimeString()}`,
        });
      }

      // Log execution details to console for debugging
      console.log("Instance Launch Results:", {
        profile: execution.profileName,
        config: execution.config,
        script: execution.script,
        status: execution.status,
      });

      // Invalidate all relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct/tasks"] });
    },
    onError: (error: any, params) => {
      // Update status to inactive on error (instance failed to start)
      queryClient.setQueryData(["/api/profiles"], (oldData: any) => {
        return oldData.map((profile: any) =>
          profile.id === params.profileId
            ? { ...profile, status: "inactive" }
            : profile
        );
      });

      toast({
        title:`Instance [${params.profileId}] Executed Failed`,
        description: error.message || "Failed to launch instance",
        variant: "destructive",
      });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: api.profiles.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({
        title: "Success",
        description: "Instance deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete instance",
        variant: "destructive",
      });
    },
  });

  const duplicateProfileMutation = useMutation({
    mutationFn: async ({ profile, newName, copyApps }: { profile: Profile; newName: string; copyApps: boolean }) => {
      // Use clone API endpoint
      const response = await fetch(`/api/profiles/${profile.id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newName,
          copyApps,
          launchAndSetup: false // Don't auto-launch
        })
      });

      if (!response.ok) {
        throw new Error('Failed to clone instance');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({
        title: "Instance Cloned",
        description: `Created "${data.profile.name}" successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Duplication Failed",
        description: error.message || "Failed to duplicate instance",
        variant: "destructive",
      });
    },
  });

  const stopProfileMutation = useMutation({
    mutationFn: async (params: { profileId: number }) => {
      // Optimistically update the profile status
      queryClient.setQueryData(["/api/profiles"], (oldData: any) => {
        return oldData.map((profile: any) =>
          profile.id === params.profileId
            ? { ...profile, status: "inactive" }
            : profile
        );
      });

      console.log("Stop Running: ", params.profileId);

      const response = await fetch(
        `/api/profiles/${params.profileId}/stop`,
        { method: "POST" }
      );

      console.log("Complete Stopping: ");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to stop instance");
      }
      const result = await response.json()
      console.log("Instance Stop Response: ", result);
      return result ;
    },
    onSuccess: (_data, params) => {
      toast({
        title: `Instance [${params.profileId}] Stopped`,
        description: `Instance execution stopped successfully`,
      });

      // Invalidate all relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct/tasks"] });
    },
    onError: (error: any, params) => {
      // Keep status as running if stop fails (profile is still active)
      queryClient.setQueryData(["/api/profiles"], (oldData: any) => {
        return oldData.map((profile: any) =>
          profile.id === params.profileId
            ? { ...profile, status: "active" }
            : profile
        );
      });

      toast({
        title: `Instance [${params.profileId}] Stop Failed`,
        description: error.message || "Failed to stop instance",
        variant: "destructive",
      });
    },
  });

  const createNewProfileMutation = useMutation({
    mutationFn: (config: any) => {
      // Use config from NewInstanceModal
      return api.profiles.create(config);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({
        title: "Success",
        description: `${data.name} instance created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create instance",
        variant: "destructive",
      });
    },
  });

  const updateScriptMutation = useMutation({
    mutationFn: async ({
      profileId,
      content,
    }: {
      profileId: number;
      content: string;
    }) => {
      const response = await fetch(
        `/api/profiles/${profileId}/script`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to update script");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Script updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update script",
        variant: "destructive",
      });
    },
  });

  const launchInstanceOnlyMutation = useMutation({
    mutationFn: async (profile: Profile) => {
      const response = await fetch(`/api/profiles/${profile.id}/launch-only`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Failed to launch instance');
      }
      return { profileId: profile.id };
    },
    onSuccess: () => {
      // Invalidate profiles and devices (but not tasks since no script is running)
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/devices"] });
      toast({
        title: "Instance Launched",
        description: "Instance launched successfully (without running script)",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Launch Instance",
        description: error.message || "Could not launch instance",
        variant: "destructive",
      });
    },
  });

  const refreshStatusMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/profiles/refresh-status', {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Failed to refresh status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({
        title: "Statuses Refreshed",
        description: "All instance statuses have been synced with LDPlayer",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh statuses",
        variant: "destructive",
      });
    },
  });

  const runAllMutation = useMutation({
    mutationFn: async (options?: { onlyInactive?: boolean; delay?: number; maxConcurrent?: number }) => {
      const response = await fetch('/api/profiles/run-all-with-scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onlyInactive: options?.onlyInactive ?? false,  // ← CHANGED: Run ALL instances (không phân biệt status)
          delay: options?.delay ?? 2000,  // ← Giảm delay xuống 2s
          maxConcurrent: options?.maxConcurrent ?? 1  // ← CHANGED: Chạy tuần tự (1 instance 1 lần)
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to run all profiles');
      }
      return response.json();
    },
    retry: false,  // ← Don't retry automatically
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/devices"] });
      toast({
        title: "Run All Complete",
        description: `✅ ${data.successCount} launched, ❌ ${data.failCount} failed, ⏭️ ${data.skippedCount} skipped`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Run All Failed",
        description: error.message || "Failed to launch all profiles",
        variant: "destructive",
      });
    },
  });

  const stopAllMutation = useMutation({
    mutationFn: async (options?: { onlyActive?: boolean; delay?: number }) => {
      const response = await fetch('/api/profiles/stop-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onlyActive: options?.onlyActive ?? true,
          delay: options?.delay ?? 2000
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to stop all profiles');
      }
      return response.json();
    },
    retry: false,  // ← Don't retry automatically
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monitor/devices"] });
      toast({
        title: "Stop All Complete",
        description: `✅ ${data.successCount} stopped, ❌ ${data.failCount} failed, ⏭️ ${data.skippedCount} skipped`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Stop All Failed",
        description: error.message || "Failed to stop all profiles",
        variant: "destructive",
      });
    },
  });

  return {
    launchProfileMutation,
    deleteProfileMutation,
    duplicateProfileMutation,
    stopProfileMutation,
    createNewProfileMutation,
    updateScriptMutation,
    launchInstanceOnlyMutation,
    refreshStatusMutation,
    runAllMutation,
    stopAllMutation
  };
};
