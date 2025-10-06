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
      queryClient.setQueryData(["http://localhost:5050/api/profiles"], (oldData: any) => {
        return oldData.map((profile: any) =>
          profile.id === params.profileId
            ? { ...profile, status: "RUNNING" }
            : profile
        );
      });

      console.log("Start Running: ");

      const response = await fetch(
        `http://localhost:5050/api/profiles/${params.profileId}/launch`,
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

      queryClient.invalidateQueries({ queryKey: ["http://localhost:5050/api/profiles"] });
    },
    onError: (error: any, params) => {
      // Update status to FAILED on error
      queryClient.setQueryData(["http://localhost:5050/api/profiles"], (oldData: any) => {
        return oldData.map((profile: any) =>
          profile.id === params.profileId
            ? { ...profile, status: "FAILED" }
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
      queryClient.invalidateQueries({ queryKey: ["http://localhost:5050/api/profiles"] });
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
    mutationFn: async (profile: Profile) => {
      // Create duplicate profile data with modified name
      const duplicateData = {
        name: `${profile.name} - Copy`,
        description: profile.description || "",
        browser: profile.browser,
        userAgent: profile.userAgent,
        customUserAgent: profile.customUserAgent || "",
        viewportWidth: profile.viewportWidth,
        viewportHeight: profile.viewportHeight,
        timezone: profile.timezone,
        language: profile.language,
        useProxy: profile.useProxy,
        proxyType: profile.proxyType,
        proxyHost: profile.proxyHost || "",
        proxyPort: profile.proxyPort || "",
        proxyUsername: profile.proxyUsername || "",
        proxyPassword: profile.proxyPassword || "",
        customField: profile.customField || null,
        isHeadless: profile.isHeadless || false,
        isIncognito: profile.isIncognito || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return api.profiles.create(duplicateData);
    },
    onSuccess: (newProfile) => {
      queryClient.invalidateQueries({ queryKey: ["http://localhost:5050/api/profiles"] });
      toast({
        title: "Instance Duplicated",
        description: `Created "${newProfile.name}" with copied configuration`,
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
      queryClient.setQueryData(["http://localhost:5050/api/profiles"], (oldData: any) => {
        return oldData.map((profile: any) =>
          profile.id === params.profileId
            ? { ...profile, status: "READY" }
            : profile
        );
      });

      console.log("Stop Running: ", params.profileId);

      const response = await fetch(
        `http://localhost:5050/api/profiles/${params.profileId}/stop`,
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
    onSuccess: (data, params) => {
      toast({
        title: `Instance [${params.profileId}] Stopped`,
        description: `Instance execution stopped successfully`,
      });

      queryClient.invalidateQueries({ queryKey: ["http://localhost:5050/api/profiles"] });
    },
    onError: (error: any, params) => {
      // Keep status as RUNNING if stop fails (profile is still running)
      queryClient.setQueryData(["http://localhost:5050/api/profiles"], (oldData: any) => {
        return oldData.map((profile: any) =>
          profile.id === params.profileId
            ? { ...profile, status: "RUNNING" }
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
    mutationFn: (profiles: Profile[]) => {
      // Get the next profile ID by finding the highest existing ID + 1
      const maxId = profiles.length > 0 ? Math.max(...profiles.map(p => p.id)) : 0;
      const nextId = maxId + 1;
      return api.profiles.create({
        name: `Instance ${nextId}`,
        description: `Automatically generated instance ${nextId}`,
        browser: "chrome-windows",
        isHeadless:false,
        isIncognito:false,
        userAgent: "",
        customUserAgent: "",
        viewportWidth: 1280,
        viewportHeight: 720,
        timezone: "America/New_York",
        language: "en-US",
        useProxy: false,
        proxyType: "http",
        proxyHost: "",
        proxyPort: "",
        proxyUsername: "",
        proxyPassword: "",
        status: "READY",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["http://localhost:5050/api/profiles"] });
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
        `http://localhost:5050/api/profiles/${profileId}/script`,
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
      queryClient.invalidateQueries({ queryKey: ["http://localhost:5050/api/profiles"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update script",
        variant: "destructive",
      });
    },
  });

  const openBrowserMutation = useMutation({
    mutationFn: async (profile: Profile) => {
      const response = await fetch(`http://localhost:5050/api/profiles/${profile.id}/open-browser`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Failed to open browser with instance');
      }
      return { profileId: profile.id };
    },
    onSuccess: (data) => {
      toast({
        title: "Browser Opened",
        description: "Chrome browser opened with instance configuration",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Open Browser",
        description: error.message || "Could not open Chrome browser",
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
    openBrowserMutation
  };
};
