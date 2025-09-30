import { apiRequest } from "./queryClient";
import type { Task, Profile, InsertProfile } from "@shared/schema";

export const api = {
  // Task operations
  tasks: {
    list: () => fetch("/api/tasks").then(res => res.json()) as Promise<Task[]>,
    get: (id: number) => fetch(`/api/tasks/${id}`).then(res => res.json()) as Promise<Task>,
    fetchFromTaskCenter: () => apiRequest("POST", "/api/tasks/fetch-from-task-center"),
    update: (id: number, data: Partial<Task>) => apiRequest("PUT", `/api/tasks/${id}`, data),
    delete: (id: number) => apiRequest("DELETE", `/api/tasks/${id}`),
    run: (params: { taskId: number; headless?: boolean }) => 
      apiRequest("POST", `/api/tasks/${params.taskId}/run`, { headless: params.headless || false }),
  },
  
  // Profile operations
  profiles: {
    list: () => fetch("/api/profiles").then(res => res.json()) as Promise<Profile[]>,
    get: (id: number) => fetch(`/api/profiles/${id}`).then(res => res.json()) as Promise<Profile>,
    create: async (data: InsertProfile) => {
      const response = await apiRequest("POST", "/api/profiles", data);
      return response.json() as Promise<Profile>;
    },
    update: (id: number, data: Partial<InsertProfile>) => apiRequest("PUT", `/api/profiles/${id}`, data),
    launch: (params: { profileId: number; headless?: boolean }) => 
      apiRequest("POST", `/api/profiles/${params.profileId}/launch`, { headless: params.headless }),
    stop: (id: number) => apiRequest("POST", `/api/profiles/${id}/stop`),
    delete: (id: number) => apiRequest("DELETE", `/api/profiles/${id}`),
    getScript: (id: number) => apiRequest("GET", `/api/profiles/${id}/script`),
    getLog: (id: number) => apiRequest("GET", `/api/profiles/${id}/log`),
    getOutput: (id: number) => apiRequest("GET", `/api/profiles/${id}/output`),
  }
};
