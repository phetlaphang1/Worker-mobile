import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/libs/api";
import { useToast } from "@/hooks/use-toast";
import type { Task } from '@shared/schema';

export const useTaskMutations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const launchTaskMutation = useMutation({
    mutationFn: async (params: {
      taskId: number;
      onTaskFinish?: (taskId: number) => void;
    }) => {
      const { taskId, onTaskFinish } = params;

      // Optimistically update the task status to RUNNING
      queryClient.setQueryData(["/api/tasks"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((task: any) =>
          task.id === taskId
            ? { ...task, status: "RUNNING" }
            : task
        );
      });

      // Build request body
      const body: any = {};
      console.log("Launching task with params:", { taskId, ...body });

      try {
        const response = await fetch(`/api/tasks/${taskId}/launch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        
        const result = await response.json();
        
        // Check if the response indicates an error
        if (!response.ok || result.status === 'error' || result.execution?.status === 'FAILED') {
          // Extract the most specific error message
          const errorMessage = result.message || result.error || "Task execution failed";
          console.error("Task execution failed:", errorMessage);
          throw new Error(errorMessage);
        }
        
        return result;
      } finally {
        // Always call onTaskFinish regardless of success or failure
        if (onTaskFinish) {
          onTaskFinish(taskId);
        }
      }
    },
    onSuccess: (data, params) => {      
      toast({
        title: `Task [${params.taskId}] Execution Completed`,
        description: `Task [${params.taskId}] executed successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any, params) => {
      // Revert the task status on error
      queryClient.setQueryData(["/api/tasks"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((task: any) =>
          task.id === params.taskId
            ? { ...task, status: "FAILED" }
            : task
        );
      });

      toast({
        title: `Task [${params.taskId}] Execution Failed`,
        description: error.message || "Failed to launch task",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const stopTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      console.log("Stopping task:", taskId);

      // Optimistically update the task status to FAILED (stopped)
      queryClient.setQueryData(["/api/tasks"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((task: any) =>
          task.id === taskId
            ? { ...task, status: "FAILED" }
            : task
        );
      });

      const response = await fetch(`/api/tasks/${taskId}/stop`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to stop task");
      }
      
      const result = await response.json();
      console.log("Task stop response:", result);
      return result;
    },
    onSuccess: (data, taskId) => {
      toast({
        title: `Task [${taskId}] Stopped`,
        description: `Task execution stopped successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any, taskId) => {
      toast({
        title: `Task [${taskId}] Stop Failed`,
        description: error.message || "Failed to stop task",
        variant: "destructive",
      });
    },
  });

  const markTaskCompletedMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to mark task as completed");
      }
      
      return response.json();
    },
    onSuccess: (data, taskId) => {
      toast({
        title: "Task Completed",
        description: `Task ${taskId} marked as completed`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark task as completed",
        variant: "destructive",
      });
    },
  });

  const clearTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const response = await fetch(`/api/tasks/${taskId}/clear`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to clear task");
      }
      
      return response.json();
    },
    onSuccess: (data, taskId) => {
      toast({
        title: "Task Cleared",
        description: `Task ${taskId} has been cleared and ready to run again`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear task",
        variant: "destructive",
      });
    },
  });

  return {
    launchTaskMutation,
    stopTaskMutation,
    markTaskCompletedMutation,
    clearTaskMutation,    
  };
};